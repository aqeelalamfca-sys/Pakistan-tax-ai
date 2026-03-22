import { pgTable, text, timestamp, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";

export const riskFlagsTable = pgTable("risk_flags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  riskCode: text("risk_code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(),
  confidence: real("confidence").default(0),
  estimatedImpact: real("estimated_impact").default(0),
  recommendation: text("recommendation"),
  status: text("status").notNull().default("open"),
  owner: text("owner"),
  dueDate: text("due_date"),
  disposition: text("disposition"),
  sourceModule: text("source_module"),
  sourceRecords: text("source_records"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("risk_flags_engagement_idx").on(t.engagementId),
  index("risk_flags_severity_idx").on(t.severity),
  index("risk_flags_status_idx").on(t.status),
]);

export const insertRiskFlagSchema = createInsertSchema(riskFlagsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRiskFlag = z.infer<typeof insertRiskFlagSchema>;
export type RiskFlag = typeof riskFlagsTable.$inferSelect;
