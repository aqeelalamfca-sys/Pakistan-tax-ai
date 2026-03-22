import { pgTable, text, boolean, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const vaultDocumentsTable = pgTable("vault_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  docType: text("doc_type").notNull(),
  taxType: text("tax_type"),
  jurisdiction: text("jurisdiction"),
  lawSection: text("law_section"),
  issueDate: text("issue_date"),
  effectiveDate: text("effective_date"),
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("active"),
  priority: integer("priority").notNull().default(5),
  versionNo: integer("version_no").notNull().default(1),
  tags: jsonb("tags").$type<string[]>().default([]),
  summary: text("summary"),
  extractedText: text("extracted_text"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  sha256Hash: text("sha256_hash"),
  uploadedBy: text("uploaded_by").references(() => usersTable.id),
  indexedAt: timestamp("indexed_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("vault_documents_doc_type_idx").on(t.docType),
  index("vault_documents_tax_type_idx").on(t.taxType),
  index("vault_documents_status_idx").on(t.status),
  index("vault_documents_jurisdiction_idx").on(t.jurisdiction),
]);

export const vaultVersionsTable = pgTable("vault_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text("document_id").notNull().references(() => vaultDocumentsTable.id),
  versionNo: integer("version_no").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  sha256Hash: text("sha256_hash"),
  extractedText: text("extracted_text"),
  changeNote: text("change_note"),
  uploadedBy: text("uploaded_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("vault_versions_document_idx").on(t.documentId),
]);

export const insertVaultDocumentSchema = createInsertSchema(vaultDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVaultDocument = z.infer<typeof insertVaultDocumentSchema>;
export type VaultDocument = typeof vaultDocumentsTable.$inferSelect;

export const insertVaultVersionSchema = createInsertSchema(vaultVersionsTable).omit({ id: true, createdAt: true });
export type InsertVaultVersion = z.infer<typeof insertVaultVersionSchema>;
export type VaultVersion = typeof vaultVersionsTable.$inferSelect;
