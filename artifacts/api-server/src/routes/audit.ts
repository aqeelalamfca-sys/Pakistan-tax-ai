import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/", withAuth, requireRole("SUPER_ADMIN", "FIRM_ADMIN", "PARTNER", "TAX_MANAGER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { firmId, userId, action, module, from, to } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;

    let conditions = [];
    const effectiveFirmId = req.user!.role === "SUPER_ADMIN" ? firmId as string : req.user!.firmId;
    if (effectiveFirmId) conditions.push(eq(auditLogsTable.firmId, effectiveFirmId));
    if (userId) conditions.push(eq(auditLogsTable.userId, userId as string));
    if (action) conditions.push(eq(auditLogsTable.action, action as string));
    if (module) conditions.push(eq(auditLogsTable.module, module as string));
    if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from as string)));
    if (to) conditions.push(lte(auditLogsTable.createdAt, new Date(to as string)));

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const logs = await db.select().from(auditLogsTable)
      .where(whereClause).orderBy(auditLogsTable.createdAt).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogsTable).where(whereClause);

    res.json({ logs, total: Number(count), page, limit });
  } catch (err) {
    req.log.error({ err }, "List audit logs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
