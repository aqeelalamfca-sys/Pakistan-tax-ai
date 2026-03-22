import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { Request } from "express";

export interface AuditLogEntry {
  userId?: string;
  userName?: string;
  firmId?: string;
  action: string;
  module: string;
  resourceId?: string;
  resourceType?: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
  deviceInfo?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: entry.userId,
      userName: entry.userName,
      firmId: entry.firmId,
      action: entry.action,
      module: entry.module,
      resourceId: entry.resourceId,
      resourceType: entry.resourceType,
      beforeState: entry.beforeState as Record<string, unknown> | undefined,
      afterState: entry.afterState as Record<string, unknown> | undefined,
      ipAddress: entry.ipAddress,
      deviceInfo: entry.deviceInfo,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}
