import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { vaultDocumentsTable, vaultVersionsTable } from "@workspace/db/schema";
import { eq, and, like, or, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router: IRouter = Router();

const VAULT_DIR = process.env.VAULT_DIR || "/tmp/vault";
if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });

const vaultStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VAULT_DIR),
  filename: (_req, file, cb) => {
    const unique = `vault-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const vaultUpload = multer({
  storage: vaultStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type for vault"));
  },
});

function extractText(filePath: string, mimeType: string): string {
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    try {
      return fs.readFileSync(filePath, "utf-8").substring(0, 10000);
    } catch { return ""; }
  }
  return `[Binary document: ${mimeType}. Text extraction requires parser service.]`;
}

function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

const superAdminOnly = requireRole("SUPER_ADMIN");

router.get("/documents", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { taxType, docType, jurisdiction, status, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let conditions = [eq(vaultDocumentsTable.isDeleted, false)];
    if (taxType) conditions.push(eq(vaultDocumentsTable.taxType, taxType as string));
    if (docType) conditions.push(eq(vaultDocumentsTable.docType, docType as string));
    if (jurisdiction) conditions.push(eq(vaultDocumentsTable.jurisdiction, jurisdiction as string));
    if (status) conditions.push(eq(vaultDocumentsTable.status, status as string));
    if (search) conditions.push(like(vaultDocumentsTable.title, `%${search}%`));

    const whereClause = and(...conditions);
    const documents = await db.select().from(vaultDocumentsTable)
      .where(whereClause).limit(limit).offset(offset)
      .orderBy(vaultDocumentsTable.priority);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(vaultDocumentsTable).where(whereClause);

    res.json({ documents, total: Number(count), page, limit });
  } catch (err) {
    req.log.error({ err }, "List vault docs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents", withAuth, superAdminOnly, vaultUpload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const { title, docType, taxType, jurisdiction, lawSection, issueDate, effectiveDate, expiryDate, priority, tags } = req.body;
    if (!title || !docType) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "title and docType required" });
      return;
    }
    const sha256Hash = computeSha256(req.file.path);
    const extractedText = extractText(req.file.path, req.file.mimetype);
    const parsedTags = tags ? (typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()) : tags) : [];

    const [doc] = await db.insert(vaultDocumentsTable).values({
      title,
      docType,
      taxType,
      jurisdiction,
      lawSection,
      issueDate,
      effectiveDate,
      expiryDate,
      priority: parseInt(priority) || 5,
      tags: parsedTags,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      sha256Hash,
      extractedText,
      uploadedBy: req.user!.userId,
      indexedAt: new Date(),
      versionNo: 1,
      status: "active",
    }).returning();

    await db.insert(vaultVersionsTable).values({
      documentId: doc.id,
      versionNo: 1,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      sha256Hash,
      extractedText,
      uploadedBy: req.user!.userId,
      changeNote: "Initial upload",
    });

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      action: "VAULT_UPLOAD",
      module: "vault",
      resourceId: doc.id,
      resourceType: "VaultDocument",
      afterState: { title, docType, taxType, jurisdiction } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Vault upload error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [doc] = await db.select().from(vaultDocumentsTable)
      .where(and(eq(vaultDocumentsTable.id, req.params.id), eq(vaultDocumentsTable.isDeleted, false))).limit(1);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Get vault doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/documents/:id", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const [existing] = await db.select().from(vaultDocumentsTable)
      .where(eq(vaultDocumentsTable.id, req.params.id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const [updated] = await db.update(vaultDocumentsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(vaultDocumentsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      action: "VAULT_UPDATE",
      module: "vault",
      resourceId: req.params.id,
      resourceType: "VaultDocument",
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: req.body as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update vault doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/documents/:id", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    await db.update(vaultDocumentsTable)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(vaultDocumentsTable.id, req.params.id));
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      action: "VAULT_DELETE",
      module: "vault",
      resourceId: req.params.id,
      resourceType: "VaultDocument",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Document deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete vault doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/documents/:id/activate", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const [updated] = await db.update(vaultDocumentsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(vaultDocumentsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      action: "VAULT_ACTIVATE",
      module: "vault",
      resourceId: req.params.id,
      resourceType: "VaultDocument",
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Activate vault doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/documents/:id/deactivate", withAuth, superAdminOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const [updated] = await db.update(vaultDocumentsTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(vaultDocumentsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      action: "VAULT_DEACTIVATE",
      module: "vault",
      resourceId: req.params.id,
      resourceType: "VaultDocument",
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Deactivate vault doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents/:id/versions", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const versions = await db.select().from(vaultVersionsTable)
      .where(eq(vaultVersionsTable.documentId, req.params.id))
      .orderBy(vaultVersionsTable.versionNo);
    res.json({ versions, total: versions.length });
  } catch (err) {
    req.log.error({ err }, "Get vault versions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/search", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, taxType, docType, jurisdiction, limit: limitParam } = req.body;
    if (!query) {
      res.status(400).json({ error: "Query required" });
      return;
    }
    const limit = parseInt(limitParam) || 5;
    let conditions = [
      eq(vaultDocumentsTable.status, "active"),
      eq(vaultDocumentsTable.isDeleted, false),
    ];
    if (taxType) conditions.push(eq(vaultDocumentsTable.taxType, taxType));
    if (docType) conditions.push(eq(vaultDocumentsTable.docType, docType));
    if (jurisdiction) conditions.push(eq(vaultDocumentsTable.jurisdiction, jurisdiction));

    const docs = await db.select().from(vaultDocumentsTable)
      .where(and(...conditions, or(
        like(vaultDocumentsTable.title, `%${query}%`),
        like(vaultDocumentsTable.lawSection, `%${query}%`),
        like(vaultDocumentsTable.summary, `%${query}%`),
      )))
      .orderBy(vaultDocumentsTable.priority)
      .limit(limit);

    const results = docs.map(doc => ({
      document: doc,
      relevanceScore: 0.85,
      excerpt: doc.summary ? doc.summary.substring(0, 300) : doc.title,
      matchedSections: [doc.lawSection].filter(Boolean),
    }));

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      action: "VAULT_SEARCH",
      module: "vault",
      afterState: { query, resultsFound: results.length } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.json({ results, totalFound: results.length });
  } catch (err) {
    req.log.error({ err }, "Vault search error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
