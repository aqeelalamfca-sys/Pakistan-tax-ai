import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),
  userName: text("user_name"),
  firmId: text("firm_id"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  resourceId: text("resource_id"),
  resourceType: text("resource_type"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_logs_firm_id_idx").on(t.firmId),
  index("audit_logs_user_id_idx").on(t.userId),
  index("audit_logs_action_idx").on(t.action),
  index("audit_logs_module_idx").on(t.module),
  index("audit_logs_created_at_idx").on(t.createdAt),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
