import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { uploadsTable } from "./uploads";
import { engagementsTable } from "./engagements";

export const validationResultsTable = pgTable("validation_results", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  uploadId: text("upload_id").references(() => uploadsTable.id),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  checkType: text("check_type").notNull(),
  checkCategory: text("check_category").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  affectedRows: jsonb("affected_rows").$type<number[]>().default([]),
  suggestedFix: text("suggested_fix"),
  isAcknowledged: text("is_acknowledged").default("false"),
  acknowledgedBy: text("acknowledged_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("validation_results_engagement_idx").on(t.engagementId),
  index("validation_results_upload_idx").on(t.uploadId),
]);

export const insertValidationResultSchema = createInsertSchema(validationResultsTable).omit({ id: true, createdAt: true });
export type InsertValidationResult = z.infer<typeof insertValidationResultSchema>;
export type ValidationResult = typeof validationResultsTable.$inferSelect;
