import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";
import { usersTable } from "./users";

export const reviewNotesTable = pgTable("review_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  status: text("status").notNull().default("open"),
  parentId: text("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("review_notes_engagement_idx").on(t.engagementId),
]);

export const approvalsTable = pgTable("approvals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  approvedBy: text("approved_by").notNull().references(() => usersTable.id),
  comments: text("comments"),
  snapshotRef: text("snapshot_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("approvals_engagement_idx").on(t.engagementId),
]);

export const insertReviewNoteSchema = createInsertSchema(reviewNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReviewNote = z.infer<typeof insertReviewNoteSchema>;
export type ReviewNote = typeof reviewNotesTable.$inferSelect;

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({ id: true, createdAt: true });
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvalsTable.$inferSelect;
