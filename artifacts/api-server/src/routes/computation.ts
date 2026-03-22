import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { taxComputationsTable, engagementsTable, riskFlagsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

function computeFinalPosition(input: {
  accountingResult: number;
  adjustments: Array<{ amount: number; type: "add" | "deduct" }>;
  withholdingCredits: number;
  carryforwards: number;
  taxRate: number;
  minimumTax: number;
}) {
  const totalAdjustments = (input.adjustments || []).reduce((sum, adj) => {
    return adj.type === "add" ? sum + adj.amount : sum - adj.amount;
  }, 0);
  const taxableIncome = input.accountingResult + totalAdjustments - (input.carryforwards || 0);
  const grossTax = Math.max(0, taxableIncome * (input.taxRate / 100));
  const minimumTaxAmount = Math.max(0, input.accountingResult * (input.minimumTax / 100));
  const taxPayable = Math.max(grossTax, minimumTaxAmount);
  const lessWithholding = input.withholdingCredits || 0;
  const lessAdvances = 0;
  const netPayableOrRefundable = taxPayable - lessWithholding - lessAdvances;
  return { totalAdjustments, taxableIncome, grossTax, minimumTaxAmount, taxPayable, lessWithholding, lessAdvances, netPayableOrRefundable };
}

router.get("/:engagementId", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const [computation] = await db.select().from(taxComputationsTable)
      .where(eq(taxComputationsTable.engagementId, engagementId)).limit(1);
    if (!computation) {
      res.status(404).json({ error: "Computation not found" });
      return;
    }
    res.json(computation);
  } catch (err) {
    req.log.error({ err }, "Get computation error");
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

    const existing = await db.select().from(taxComputationsTable)
      .where(eq(taxComputationsTable.engagementId, engagementId)).limit(1);
    if (existing[0]?.isLocked) {
      res.status(400).json({ error: "Computation is locked. Unlock first." });
      return;
    }

    const input = {
      accountingResult: req.body.accountingResult || 0,
      adjustments: req.body.adjustments || [],
      withholdingCredits: req.body.withholdingCredits || 0,
      carryforwards: req.body.carryforwards || 0,
      taxRate: req.body.taxRate || 29,
      minimumTax: req.body.minimumTax || 1.5,
    };
    const computed = computeFinalPosition(input);

    let computation;
    if (existing.length > 0) {
      [computation] = await db.update(taxComputationsTable).set({
        ...input,
        ...computed,
        updatedAt: new Date(),
      }).where(eq(taxComputationsTable.engagementId, engagementId)).returning();
    } else {
      [computation] = await db.insert(taxComputationsTable).values({
        engagementId,
        ...input,
        ...computed,
      }).returning();
    }

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "SAVE_COMPUTATION",
      module: "computation",
      resourceId: engagementId,
      resourceType: "Engagement",
      afterState: computed as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.json(computation);
  } catch (err) {
    req.log.error({ err }, "Save computation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:engagementId/lock", withAuth, requireRole("SUPER_ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const openHighRisks = await db.select().from(riskFlagsTable)
      .where(and(
        eq(riskFlagsTable.engagementId, engagementId),
        eq(riskFlagsTable.severity, "HIGH"),
        eq(riskFlagsTable.status, "open"),
      ));
    if (openHighRisks.length > 0) {
      res.status(400).json({ error: `Cannot lock: ${openHighRisks.length} open HIGH severity risk(s) exist.` });
      return;
    }
    await db.update(taxComputationsTable).set({
      isLocked: true,
      lockedAt: new Date(),
      lockedBy: req.user!.userId,
      updatedAt: new Date(),
    }).where(eq(taxComputationsTable.engagementId, engagementId));
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "LOCK_COMPUTATION",
      module: "computation",
      resourceId: engagementId,
      resourceType: "Engagement",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Computation locked" });
  } catch (err) {
    req.log.error({ err }, "Lock computation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:engagementId/unlock", withAuth, requireRole("SUPER_ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { reopenReason } = req.body;
    if (!reopenReason || reopenReason.length < 30) {
      res.status(400).json({ error: "Reopen reason must be at least 30 characters" });
      return;
    }
    await db.update(taxComputationsTable).set({
      isLocked: false,
      updatedAt: new Date(),
    }).where(eq(taxComputationsTable.engagementId, req.params.engagementId));
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "UNLOCK_COMPUTATION",
      module: "computation",
      resourceId: req.params.engagementId,
      resourceType: "Engagement",
      afterState: { reopenReason } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Computation unlocked" });
  } catch (err) {
    req.log.error({ err }, "Unlock computation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
