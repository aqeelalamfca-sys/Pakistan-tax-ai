import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { uploadsTable, engagementsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router: IRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: xlsx, xls, csv, pdf, doc, docx"));
    }
  },
});

function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

router.get("/", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.query;
    if (!engagementId) {
      res.status(400).json({ error: "engagementId required" });
      return;
    }
    const uploads = await db.select().from(uploadsTable)
      .where(and(eq(uploadsTable.engagementId, engagementId as string), eq(uploadsTable.isDeleted, false)));
    res.json({ uploads, total: uploads.length });
  } catch (err) {
    req.log.error({ err }, "List uploads error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", withAuth, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const { engagementId, category } = req.body;
    if (!engagementId || !category) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "engagementId and category required" });
      return;
    }
    const [engagement] = await db.select().from(engagementsTable)
      .where(eq(engagementsTable.id, engagementId)).limit(1);
    if (!engagement) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: "Engagement not found" });
      return;
    }
    if (engagement.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      fs.unlinkSync(req.file.path);
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const sha256Hash = computeSha256(req.file.path);
    const [uploadRecord] = await db.insert(uploadsTable).values({
      engagementId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      category,
      sha256Hash,
      parsedStatus: "pending",
      validationStatus: "pending",
      uploadedBy: req.user!.userId,
    }).returning();

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "FILE_UPLOAD",
      module: "uploads",
      resourceId: uploadRecord.id,
      resourceType: "Upload",
      afterState: { fileName: req.file.originalname, category, sha256Hash } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.status(201).json(uploadRecord);
  } catch (err) {
    req.log.error({ err }, "Upload error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [upload] = await db.select().from(uploadsTable)
      .where(eq(uploadsTable.id, req.params.id)).limit(1);
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    res.json(upload);
  } catch (err) {
    req.log.error({ err }, "Get upload error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
