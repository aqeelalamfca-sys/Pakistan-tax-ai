import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { riskFlagsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";

const router: IRouter = Router();

router.get("/:engagementId", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const { severity, status } = req.query;

    let conditions = [eq(riskFlagsTable.engagementId, engagementId)];
    if (severity) conditions.push(eq(riskFlagsTable.severity, severity as string));
    if (status) conditions.push(eq(riskFlagsTable.status, status as string));

    const risks = await db.select().from(riskFlagsTable).where(and(...conditions));
    const total = risks.length;
    const highCount = risks.filter(r => r.severity === "HIGH").length;
    const mediumCount = risks.filter(r => r.severity === "MEDIUM").length;
    const lowCount = risks.filter(r => r.severity === "LOW").length;

    res.json({ risks, total, highCount, mediumCount, lowCount });
  } catch (err) {
    req.log.error({ err }, "List risks error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/status", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, disposition, owner, dueDate } = req.body;
    if (!status) {
      res.status(400).json({ error: "Status required" });
      return;
    }
    const [existing] = await db.select().from(riskFlagsTable)
      .where(eq(riskFlagsTable.id, req.params.id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Risk not found" });
      return;
    }
    const [updated] = await db.update(riskFlagsTable)
      .set({ status, disposition, owner, dueDate, updatedAt: new Date() })
      .where(eq(riskFlagsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "UPDATE_RISK_STATUS",
      module: "risks",
      resourceId: req.params.id,
      resourceType: "RiskFlag",
      beforeState: { status: existing.status } as Record<string, unknown>,
      afterState: { status, disposition } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update risk status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
