import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { bankUsersTable } from "./bank";

export const bankIdentityDocumentsTable = pgTable(
  "bank_identity_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").notNull().default("uploading"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("bank_identity_document_object_path_unique").on(table.objectPath),
    index("bank_identity_document_user_idx").on(table.userId, table.createdAt),
  ],
);

export const insertBankIdentityDocumentSchema = createInsertSchema(
  bankIdentityDocumentsTable,
).omit({ id: true, createdAt: true, uploadedAt: true });
export type InsertBankIdentityDocument = z.infer<
  typeof insertBankIdentityDocumentSchema
>;
export type BankIdentityDocument = typeof bankIdentityDocumentsTable.$inferSelect;
