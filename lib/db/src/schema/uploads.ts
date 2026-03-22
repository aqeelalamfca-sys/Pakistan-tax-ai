import { pgTable, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";
import { usersTable } from "./users";

export const uploadCategoryEnum = [
  "trial_balance",
  "general_ledger",
  "invoice_register",
  "withholding_schedule",
  "bank_statements",
  "payroll_summary",
  "prior_tax_computation",
  "prior_tax_returns",
  "tax_notices",
  "supporting_documents"
] as const;

export const parsedStatusEnum = ["pending", "processing", "completed", "failed"] as const;
export const validationStatusEnum = ["pending", "running", "pass", "warning", "fail"] as const;

export const uploadsTable = pgTable("uploads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  category: text("category").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  parsedStatus: text("parsed_status").notNull().default("pending"),
  validationStatus: text("validation_status").notNull().default("pending"),
  parserVersion: text("parser_version"),
  parsedRowCount: integer("parsed_row_count"),
  parseErrors: text("parse_errors"),
  uploadedBy: text("uploaded_by").references(() => usersTable.id),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("uploads_engagement_id_idx").on(t.engagementId),
]);

export const insertUploadSchema = createInsertSchema(uploadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploadsTable.$inferSelect;
