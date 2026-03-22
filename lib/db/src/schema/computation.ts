import { pgTable, text, boolean, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";
import { usersTable } from "./users";

export const taxComputationsTable = pgTable("tax_computations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id).unique(),
  accountingResult: real("accounting_result").default(0),
  totalAdjustments: real("total_adjustments").default(0),
  withholdingCredits: real("withholding_credits").default(0),
  carryforwards: real("carryforwards").default(0),
  taxRate: real("tax_rate").default(0),
  minimumTax: real("minimum_tax").default(0),
  taxableIncome: real("taxable_income").default(0),
  grossTax: real("gross_tax").default(0),
  minimumTaxAmount: real("minimum_tax_amount").default(0),
  taxPayable: real("tax_payable").default(0),
  lessWithholding: real("less_withholding").default(0),
  lessAdvances: real("less_advances").default(0),
  netPayableOrRefundable: real("net_payable_or_refundable").default(0),
  adjustments: jsonb("adjustments").$type<Record<string, unknown>[]>().default([]),
  aiCommentary: text("ai_commentary"),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by").references(() => usersTable.id),
  snapshotRef: text("snapshot_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("tax_computations_engagement_idx").on(t.engagementId),
]);

export const insertTaxComputationSchema = createInsertSchema(taxComputationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaxComputation = z.infer<typeof insertTaxComputationSchema>;
export type TaxComputation = typeof taxComputationsTable.$inferSelect;
