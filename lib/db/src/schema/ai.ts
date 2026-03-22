import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engagementsTable } from "./engagements";
import { usersTable } from "./users";

export const aiRunsTable = pgTable("ai_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  promptKey: text("prompt_key").notNull(),
  promptVersion: text("prompt_version"),
  provider: text("provider").notNull(),
  model: text("model"),
  inputContext: jsonb("input_context"),
  vaultDocumentsUsed: jsonb("vault_documents_used").$type<string[]>().default([]),
  tokenCount: text("token_count"),
  durationMs: text("duration_ms"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_runs_engagement_idx").on(t.engagementId),
]);

export const aiOutputsTable = pgTable("ai_outputs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull().references(() => aiRunsTable.id),
  engagementId: text("engagement_id").notNull().references(() => engagementsTable.id),
  promptKey: text("prompt_key").notNull(),
  content: text("content").notNull(),
  moderationFlags: jsonb("moderation_flags").$type<string[]>().default([]),
  references: jsonb("references"),
  isStaged: boolean("is_staged").notNull().default(true),
  isPromoted: boolean("is_promoted").notNull().default(false),
  promotedAt: timestamp("promoted_at"),
  promotedBy: text("promoted_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_outputs_engagement_idx").on(t.engagementId),
]);

export const insertAiRunSchema = createInsertSchema(aiRunsTable).omit({ id: true, createdAt: true });
export type InsertAiRun = z.infer<typeof insertAiRunSchema>;
export type AiRun = typeof aiRunsTable.$inferSelect;

export const aiConfigTable = pgTable("ai_config", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  configKey: text("config_key").notNull().unique(),
  configValue: text("config_value").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedBy: text("updated_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiOutputSchema = createInsertSchema(aiOutputsTable).omit({ id: true, createdAt: true });
export type InsertAiOutput = z.infer<typeof insertAiOutputSchema>;
export type AiOutput = typeof aiOutputsTable.$inferSelect;
