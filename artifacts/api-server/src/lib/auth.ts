import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "tax-engine-dev-secret-change-in-production";
const JWT_EXPIRY = "8h";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  firmId: string | null;
  firmName?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function withAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: `Required role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["prepare", "review", "approve", "upload", "download", "manage_users", "manage_firm", "view_all_engagements", "override_computation", "export", "manage_rules", "manage_vault"],
  FIRM_ADMIN: ["prepare", "review", "upload", "download", "manage_users", "manage_firm", "view_all_engagements", "export", "manage_rules"],
  PARTNER: ["prepare", "review", "approve", "upload", "download", "view_all_engagements", "override_computation", "export"],
  TAX_MANAGER: ["prepare", "review", "upload", "download", "view_all_engagements", "export"],
  SENIOR: ["prepare", "upload", "download", "export"],
  ASSOCIATE: ["prepare", "upload", "download"],
  REVIEWER: ["review", "download"],
  CLIENT_USER: ["download"],
};

export function hasPermission(role: string, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
