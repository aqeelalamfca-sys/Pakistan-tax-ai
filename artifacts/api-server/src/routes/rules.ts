import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { taxRulesTable, riskFlagsTable, engagementsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const createRuleSchema = z.object({
  ruleCode: z.string(),
  title: z.string(),
  description: z.string().optional(),
  taxType: z.string(),
  entityType: z.string().optional(),
  industry: z.string().optional(),
  conditionJson: z.record(z.unknown()),
  actionJson: z.record(z.unknown()),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  materialityThreshold: z.number().optional(),
  evidenceRequired: z.boolean().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

router.get("/", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { taxType, status } = req.query;
    let conditions = [];
    if (taxType) conditions.push(eq(taxRulesTable.taxType, taxType as string));
    if (status) conditions.push(eq(taxRulesTable.ruleStatus, status as string));
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const rules = await db.select().from(taxRulesTable).where(whereClause);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(taxRulesTable).where(whereClause);
    res.json({ rules, total: Number(count) });
  } catch (err) {
    req.log.error({ err }, "List rules error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", withAuth, requireRole("SUPER_ADMIN", "FIRM_ADMIN", "TAX_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }
    const [rule] = await db.insert(taxRulesTable).values(parsed.data).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "CREATE_RULE",
      module: "rules",
      resourceId: rule.id,
      resourceType: "TaxRule",
      afterState: rule as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.status(201).json(rule);
  } catch (err) {
    req.log.error({ err }, "Create rule error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:engagementId/run", withAuth, async (req: AuthenticatedRequest, res) => {
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

    const rules = await db.select().from(taxRulesTable)
      .where(and(eq(taxRulesTable.ruleStatus, "active"), eq(taxRulesTable.taxType, engagement.taxType || "income_tax")));

    let riskFlagsCreated = 0;
    for (const rule of rules) {
      const flagExists = await db.select().from(riskFlagsTable)
        .where(and(eq(riskFlagsTable.engagementId, engagementId), eq(riskFlagsTable.riskCode, rule.ruleCode))).limit(1);

      if (flagExists.length === 0) {
        await db.insert(riskFlagsTable).values({
          engagementId,
          riskCode: rule.ruleCode,
          title: rule.title,
          description: rule.description ?? undefined,
          severity: rule.severity,
          confidence: 0.7,
          estimatedImpact: rule.materialityThreshold ?? 0,
          recommendation: (rule.actionJson as { recommendation?: string })?.recommendation || "Review and resolve",
          status: "open",
          sourceModule: "rule_engine",
        });
        riskFlagsCreated++;
      }
    }

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "RUN_RULES",
      module: "rules",
      resourceId: engagementId,
      resourceType: "Engagement",
      afterState: { rulesEvaluated: rules.length, riskFlagsCreated } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.json({
      rulesEvaluated: rules.length,
      riskFlagsCreated,
      adjustmentsCreated: 0,
      summary: `Evaluated ${rules.length} rules, created ${riskFlagsCreated} new risk flags`,
    });
  } catch (err) {
    req.log.error({ err }, "Run rules error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
