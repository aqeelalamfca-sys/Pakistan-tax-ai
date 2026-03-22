import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { engagementsTable, clientsTable, usersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const createEngagementSchema = z.object({
  clientId: z.string(),
  title: z.string().min(1),
  taxYear: z.string(),
  taxType: z.string().optional(),
  teamMembers: z.array(z.string()).optional(),
});

router.get("/", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const firmId = req.user!.firmId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string;
    const clientIdFilter = req.query.clientId as string;

    let conditions = firmId ? [eq(engagementsTable.firmId, firmId)] : [];
    if (statusFilter) conditions.push(eq(engagementsTable.status, statusFilter));
    if (clientIdFilter) conditions.push(eq(engagementsTable.clientId, clientIdFilter));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const engagements = await db
      .select({
        engagement: engagementsTable,
        clientName: clientsTable.legalName,
      })
      .from(engagementsTable)
      .leftJoin(clientsTable, eq(engagementsTable.clientId, clientsTable.id))
      .where(whereClause)
      .limit(limit).offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(engagementsTable).where(whereClause);

    res.json({
      engagements: engagements.map(e => ({ ...e.engagement, clientName: e.clientName })),
      total: Number(count),
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "List engagements error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      res.status(403).json({ error: "No firm assigned" });
      return;
    }
    const parsed = createEngagementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }
    const checklist = {
      dataUploaded: false,
      validated: false,
      mapped: false,
      computationDraft: false,
      underReview: false,
      approved: false,
    };
    const [engagement] = await db.insert(engagementsTable).values({
      firmId,
      ...parsed.data,
      checklist,
      status: "Draft",
    }).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId,
      action: "CREATE_ENGAGEMENT",
      module: "engagements",
      resourceId: engagement.id,
      resourceType: "Engagement",
      afterState: engagement as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, engagement.clientId)).limit(1);
    res.status(201).json({ ...engagement, clientName: client?.legalName });
  } catch (err) {
    req.log.error({ err }, "Create engagement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [result] = await db.select({
      engagement: engagementsTable,
      clientName: clientsTable.legalName,
    })
      .from(engagementsTable)
      .leftJoin(clientsTable, eq(engagementsTable.clientId, clientsTable.id))
      .where(eq(engagementsTable.id, req.params.id)).limit(1);

    if (!result) {
      res.status(404).json({ error: "Engagement not found" });
      return;
    }
    if (result.engagement.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    res.json({ ...result.engagement, clientName: result.clientName });
  } catch (err) {
    req.log.error({ err }, "Get engagement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [existing] = await db.select().from(engagementsTable)
      .where(eq(engagementsTable.id, req.params.id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Engagement not found" });
      return;
    }
    if (existing.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { status, ...updateData } = req.body;
    const [updated] = await db.update(engagementsTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(engagementsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "UPDATE_ENGAGEMENT",
      module: "engagements",
      resourceId: req.params.id,
      resourceType: "Engagement",
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update engagement error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/status", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, reason } = req.body;
    if (!status) {
      res.status(400).json({ error: "Status required" });
      return;
    }
    const [existing] = await db.select().from(engagementsTable)
      .where(eq(engagementsTable.id, req.params.id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Engagement not found" });
      return;
    }
    if (existing.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const [updated] = await db.update(engagementsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(engagementsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "STATUS_CHANGE",
      module: "engagements",
      resourceId: req.params.id,
      resourceType: "Engagement",
      beforeState: { status: existing.status } as Record<string, unknown>,
      afterState: { status, reason } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Status update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
