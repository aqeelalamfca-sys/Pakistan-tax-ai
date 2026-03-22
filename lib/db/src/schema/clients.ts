import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { firmsTable } from "./firms";

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull().references(() => firmsTable.id),
  legalName: text("legal_name").notNull(),
  ntn: text("ntn"),
  cnic: text("cnic"),
  registrationNo: text("registration_no"),
  businessType: text("business_type"),
  industry: text("industry"),
  taxTypes: jsonb("tax_types").$type<string[]>().default([]),
  address: text("address"),
  contactPersons: jsonb("contact_persons").$type<Record<string, unknown>[]>().default([]),
  relatedParties: jsonb("related_parties").$type<Record<string, unknown>[]>().default([]),
  priorCarryforwards: jsonb("prior_carryforwards"),
  status: text("status").notNull().default("active"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("clients_firm_id_idx").on(t.firmId),
]);

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
