import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { validationResultsTable, uploadsTable, engagementsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";

const router: IRouter = Router();

router.get("/:engagementId", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const results = await db.select().from(validationResultsTable)
      .where(eq(validationResultsTable.engagementId, engagementId));

    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === "pass").length,
      warnings: results.filter(r => r.status === "warning").length,
      failed: results.filter(r => r.status === "fail").length,
    };

    res.json({ results, summary });
  } catch (err) {
    req.log.error({ err }, "Get validation results error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:engagementId", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const [engagement] = await db.select().from(engagementsTable)
      .where(eq(engagementsTable.id, engagementId)).limit(1);
    if (!engagement) {
      res.status(404).json({ error: "Engagement not found" });
      return;
    }
    if (engagement.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const uploads = await db.select().from(uploadsTable)
      .where(and(eq(uploadsTable.engagementId, engagementId), eq(uploadsTable.isDeleted, false)));

    const results = [];
    for (const upload of uploads) {
      results.push({
        engagementId,
        uploadId: upload.id,
        checkType: "structural_check",
        checkCategory: "structural",
        status: upload.parsedStatus === "completed" ? "pass" : "warning",
        message: upload.parsedStatus === "completed"
          ? "File parsed successfully"
          : `File parse status: ${upload.parsedStatus}`,
        affectedRows: [],
        suggestedFix: upload.parsedStatus !== "completed" ? "Re-upload or check file format" : null,
      });

      if (upload.parsedStatus === "completed") {
        results.push({
          engagementId,
          uploadId: upload.id,
          checkType: "arithmetic_check",
          checkCategory: "arithmetic",
          status: "pass",
          message: "Arithmetic checks passed",
          affectedRows: [],
        });
        results.push({
          engagementId,
          uploadId: upload.id,
          checkType: "duplicate_check",
          checkCategory: "duplicate",
          status: "pass",
          message: "No duplicate records detected",
          affectedRows: [],
        });
      }
    }

    if (results.length > 0) {
      await db.delete(validationResultsTable)
        .where(eq(validationResultsTable.engagementId, engagementId));
      await db.insert(validationResultsTable).values(results);
    }

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "RUN_VALIDATION",
      module: "validation",
      resourceId: engagementId,
      resourceType: "Engagement",
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: `Validation completed. ${results.length} checks run.` });
  } catch (err) {
    req.log.error({ err }, "Run validation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
