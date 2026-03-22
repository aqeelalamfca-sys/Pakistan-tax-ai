import { Router, IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, firmsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, hashPassword, comparePassword, withAuth, AuthenticatedRequest } from "../lib/auth";
import { logAudit, getClientIp } from "../lib/audit";
import speakeasy from "speakeasy";
import { z } from "zod";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaToken: z.string().optional(),
});

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", message: parsed.error.message });
      return;
    }
    const { email, password, mfaToken } = parsed.data;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }
    if (user.mfaEnabled && user.mfaSecret) {
      if (!mfaToken) {
        res.status(200).json({ requiresMfa: true, token: "" });
        return;
      }
      const mfaValid = speakeasy.totp.verify({ token: mfaToken, secret: user.mfaSecret, encoding: "base32" });
      if (!mfaValid) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid MFA token" });
        return;
      }
    }
    let firmName: string | undefined;
    if (user.firmId) {
      const [firm] = await db.select().from(firmsTable).where(eq(firmsTable.id, user.firmId)).limit(1);
      firmName = firm?.name;
    }
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId,
      firmName,
    });
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    await logAudit({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      firmId: user.firmId ?? undefined,
      action: "LOGIN",
      module: "auth",
      ipAddress: getClientIp(req),
    });
    res.json({
      token,
      requiresMfa: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        firmId: user.firmId,
        firmName,
        mfaEnabled: user.mfaEnabled,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", withAuth, async (req: AuthenticatedRequest, res) => {
  await logAudit({
    userId: req.user!.userId,
    userName: req.user!.email,
    firmId: req.user!.firmId ?? undefined,
    action: "LOGOUT",
    module: "auth",
    ipAddress: getClientIp(req),
  });
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    let firmName: string | undefined;
    if (user.firmId) {
      const [firm] = await db.select().from(firmsTable).where(eq(firmsTable.id, user.firmId)).limit(1);
      firmName = firm?.name;
    }
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      firmId: user.firmId,
      firmName,
      mfaEnabled: user.mfaEnabled,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mfa/setup", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const secretObj = speakeasy.generateSecret({ name: "Tax Intelligence Engine" });
    const secret = secretObj.base32;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    await db.update(usersTable).set({ mfaSecret: secret }).where(eq(usersTable.id, req.user!.userId));
    const qrCodeUrl = speakeasy.otpauthURL({ secret, label: user.email, issuer: "Tax Intelligence Engine", encoding: "base32" });
    res.json({
      secret,
      qrCodeUrl,
      backupCodes: Array.from({ length: 8 }, () => Math.random().toString(36).substring(2, 10).toUpperCase()),
    });
  } catch (err) {
    req.log.error({ err }, "MFA setup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mfa/verify", withAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: "Token required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user.mfaSecret) {
      res.status(400).json({ error: "MFA not set up" });
      return;
    }
    const valid = speakeasy.totp.verify({ token, secret: user.mfaSecret, encoding: "base32" });
    if (!valid) {
      res.status(401).json({ error: "Invalid MFA token" });
      return;
    }
    await db.update(usersTable).set({ mfaEnabled: true }).where(eq(usersTable.id, req.user!.userId));
    await logAudit({
      userId: user.id,
      userName: user.email,
      firmId: user.firmId ?? undefined,
      action: "MFA_ENABLED",
      module: "auth",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "MFA enabled" });
  } catch (err) {
    req.log.error({ err }, "MFA verify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
