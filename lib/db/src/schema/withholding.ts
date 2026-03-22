import { pgTable, text, boolean, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";
import { uploadsTable } from "./uploads";

export const withholdingEntriesTable = pgTable("withholding_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  uploadId: text("upload_id").references(() => uploadsTable.id),
  vendorName: text("vendor_name").notNull(),
  vendorNtn: text("vendor_ntn"),
  sectionCode: text("section_code").notNull(),
  paymentNature: text("payment_nature"),
  grossAmount: real("gross_amount").notNull().default(0),
  expectedRate: real("expected_rate").default(0),
  actualRate: real("actual_rate").default(0),
  whtDeducted: real("wht_deducted").default(0),
  shortDeduction: real("short_deduction").default(0),
  overDeduction: real("over_deduction").default(0),
  certificateStatus: text("certificate_status").default("pending"),
  depositStatus: text("deposit_status").default("pending"),
  isException: boolean("is_exception").notNull().default(false),
  sourceRowNumber: integer("source_row_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("withholding_entries_engagement_idx").on(t.engagementId),
]);

export const insertWithholdingEntrySchema = createInsertSchema(withholdingEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWithholdingEntry = z.infer<typeof insertWithholdingEntrySchema>;
export type WithholdingEntry = typeof withholdingEntriesTable.$inferSelect;
