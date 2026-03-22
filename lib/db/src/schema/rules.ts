import { pgTable, text, boolean, timestamp, jsonb, real, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taxRulesTable = pgTable("tax_rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ruleCode: text("rule_code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  taxType: text("tax_type").notNull(),
  entityType: text("entity_type"),
  industry: text("industry"),
  conditionJson: jsonb("condition_json").notNull(),
  actionJson: jsonb("action_json").notNull(),
  severity: text("severity").notNull(),
  materialityThreshold: real("materiality_threshold"),
  evidenceRequired: boolean("evidence_required").notNull().default(false),
  effectiveFrom: text("effective_from"),
  effectiveTo: text("effective_to"),
  ruleStatus: text("rule_status").notNull().default("active"),
  versionNo: integer("version_no").notNull().default(1),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("tax_rules_tax_type_idx").on(t.taxType),
  index("tax_rules_status_idx").on(t.ruleStatus),
]);

export const insertTaxRuleSchema = createInsertSchema(taxRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaxRule = z.infer<typeof insertTaxRuleSchema>;
export type TaxRule = typeof taxRulesTable.$inferSelect;
