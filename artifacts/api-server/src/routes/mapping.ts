import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { accountMappingsTable, engagementsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const saveMappingSchema = z.object({
  sourceValue: z.string(),
  mappingType: z.enum(["account_code", "vendor", "ledger_description"]),
  mappedTo: z.string(),
  overrideReason: z.string().optional(),
});

router.get("/:engagementId", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { engagementId } = req.params;
    const mappings = await db.select().from(accountMappingsTable)
      .where(eq(accountMappingsTable.engagementId, engagementId));

    const totalRequired = mappings.length;
    const totalMapped = mappings.filter(m => m.isMapped).length;
    const completionPercent = totalRequired > 0 ? (totalMapped / totalRequired) * 100 : 0;

    res.json({ mappings, completionPercent, totalRequired, totalMapped });
  } catch (err) {
    req.log.error({ err }, "Get mappings error");
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

    const parsed = saveMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }

    const existing = await db.select().from(accountMappingsTable)
      .where(and(
        eq(accountMappingsTable.engagementId, engagementId),
        eq(accountMappingsTable.sourceValue, parsed.data.sourceValue),
        eq(accountMappingsTable.mappingType, parsed.data.mappingType),
      )).limit(1);

    let mapping;
    if (existing.length > 0) {
      [mapping] = await db.update(accountMappingsTable)
        .set({
          mappedTo: parsed.data.mappedTo,
          isManualOverride: true,
          overrideReason: parsed.data.overrideReason,
          isMapped: true,
          updatedAt: new Date(),
        })
        .where(eq(accountMappingsTable.id, existing[0].id)).returning();
    } else {
      [mapping] = await db.insert(accountMappingsTable).values({
        engagementId,
        firmId: engagement.firmId,
        ...parsed.data,
        isMapped: true,
        isManualOverride: !!parsed.data.overrideReason,
        confidence: 1.0,
      }).returning();
    }

    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "SAVE_MAPPING",
      module: "mapping",
      resourceId: engagementId,
      resourceType: "Engagement",
      afterState: parsed.data as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });

    res.json(mapping);
  } catch (err) {
    req.log.error({ err }, "Save mapping error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
