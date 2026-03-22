import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { withAuth, AuthenticatedRequest, requireRole, hashPassword } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string(),
  password: z.string().min(8),
});

router.get("/", withAuth, requireRole("SUPER_ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const firmId = req.user!.firmId;
    const users = firmId
      ? await db.select({
          id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
          lastName: usersTable.lastName, role: usersTable.role, firmId: usersTable.firmId,
          isActive: usersTable.isActive, mfaEnabled: usersTable.mfaEnabled,
          lastLoginAt: usersTable.lastLoginAt, createdAt: usersTable.createdAt,
        }).from(usersTable).where(eq(usersTable.firmId, firmId))
      : await db.select({
          id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
          lastName: usersTable.lastName, role: usersTable.role, firmId: usersTable.firmId,
          isActive: usersTable.isActive, mfaEnabled: usersTable.mfaEnabled,
          lastLoginAt: usersTable.lastLoginAt, createdAt: usersTable.createdAt,
        }).from(usersTable);
    res.json({ users, total: users.length });
  } catch (err) {
    req.log.error({ err }, "List users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", withAuth, requireRole("SUPER_ADMIN", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }
    const { password, ...userData } = parsed.data;
    const passwordHash = await hashPassword(password);
    const firmId = req.user!.role === "SUPER_ADMIN" ? (req.body.firmId || req.user!.firmId) : req.user!.firmId;
    const [user] = await db.insert(usersTable).values({
      ...userData,
      passwordHash,
      firmId,
    }).returning({
      id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
      lastName: usersTable.lastName, role: usersTable.role, firmId: usersTable.firmId,
      isActive: usersTable.isActive, mfaEnabled: usersTable.mfaEnabled, createdAt: usersTable.createdAt,
    });
    await logAudit({
      userId: req.user!.userId,
      userName: req.user!.email,
      firmId: req.user!.firmId ?? undefined,
      action: "CREATE_USER",
      module: "users",
      resourceId: user.id,
      resourceType: "User",
      afterState: { email: user.email, role: user.role } as Record<string, unknown>,
      ipAddress: getClientIp(req),
    });
    res.status(201).json(user);
  } catch (err) {
    req.log.error({ err }, "Create user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
