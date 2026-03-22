import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { firmsTable } from "./firms";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const engagementStatusEnum = [
  "Draft",
  "Waiting_for_Data",
  "Data_Uploaded",
  "Validated",
  "Mapped",
  "Draft_Computation",
  "Under_Review",
  "Approved",
  "Filed_Closed"
] as const;

export const engagementsTable = pgTable("engagements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firmId: text("firm_id").notNull().references(() => firmsTable.id),
  clientId: text("client_id").notNull().references(() => clientsTable.id),
  title: text("title").notNull(),
  taxYear: text("tax_year").notNull(),
  taxType: text("tax_type"),
  status: text("status").notNull().default("Draft"),
  teamMembers: jsonb("team_members").$type<string[]>().default([]),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by").references(() => usersTable.id),
  checklist: jsonb("checklist"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("engagements_firm_id_idx").on(t.firmId),
  index("engagements_client_id_idx").on(t.clientId),
  index("engagements_status_idx").on(t.status),
]);

export const insertEngagementSchema = createInsertSchema(engagementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEngagement = z.infer<typeof insertEngagementSchema>;
export type Engagement = typeof engagementsTable.$inferSelect;
