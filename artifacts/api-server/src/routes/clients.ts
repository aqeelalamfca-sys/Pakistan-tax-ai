import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const createClientSchema = z.object({
  legalName: z.string().min(1),
  ntn: z.string().optional(),
  cnic: z.string().optional(),
  registrationNo: z.string().optional(),
  businessType: z.string().optional(),
  industry: z.string().optional(),
  taxTypes: z.array(z.string()).optional(),
  address: z.string().optional(),
  contactPersons: z.array(z.unknown()).optional(),
});

router.get("/", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "No firm assigned" });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    const whereClause = firmId
      ? and(eq(clientsTable.firmId, firmId), eq(clientsTable.isDeleted, false))
      : eq(clientsTable.isDeleted, false);

    const clients = await db.select().from(clientsTable)
      .where(search ? and(whereClause, like(clientsTable.legalName, `%${search}%`)) : whereClause)
      .limit(limit).offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(clientsTable)
      .where(search ? and(whereClause, like(clientsTable.legalName, `%${search}%`)) : whereClause);

    res.json({ clients, total: Number(count), page, limit });
  } catch (err) {
    req.log.error({ err }, "List clients error");
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
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }
    const [client] = await db.insert(clientsTable).values({
      firmId,
      ...parsed.data,
    }).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId,
      action: "CREATE_CLIENT",
      module: "clients",
      resourceId: client.id,
      resourceType: "Client",
      afterState: client as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.status(201).json(client);
  } catch (err) {
    req.log.error({ err }, "Create client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, req.params.id), eq(clientsTable.isDeleted, false))).limit(1);
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    if (client.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    res.json(client);
  } catch (err) {
    req.log.error({ err }, "Get client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [existing] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, req.params.id), eq(clientsTable.isDeleted, false))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    if (existing.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const [updated] = await db.update(clientsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clientsTable.id, req.params.id)).returning();
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "UPDATE_CLIENT",
      module: "clients",
      resourceId: req.params.id,
      resourceType: "Client",
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [existing] = await db.select().from(clientsTable)
      .where(eq(clientsTable.id, req.params.id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    if (existing.firmId !== req.user!.firmId && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.update(clientsTable)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(clientsTable.id, req.params.id));
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "DELETE_CLIENT",
      module: "clients",
      resourceId: req.params.id,
      resourceType: "Client",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Client deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
