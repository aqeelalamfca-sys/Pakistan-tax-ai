import { pgTable, text, boolean, timestamp, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";

export const accountMappingsTable = pgTable("account_mappings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  firmId: text("firm_id").notNull(),
  sourceValue: text("source_value").notNull(),
  mappingType: text("mapping_type").notNull(),
  mappedTo: text("mapped_to"),
  confidence: real("confidence").default(0),
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  overrideReason: text("override_reason"),
  isMapped: boolean("is_mapped").notNull().default(false),
  templateName: text("template_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("account_mappings_engagement_idx").on(t.engagementId),
]);

export const insertAccountMappingSchema = createInsertSchema(accountMappingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccountMapping = z.infer<typeof insertAccountMappingSchema>;
export type AccountMapping = typeof accountMappingsTable.$inferSelect;
