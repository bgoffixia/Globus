import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const bankCurrencyEnum = pgEnum("bank_currency_code", [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "CAD",
  "AUD",
]);

export const bankTransactionTypeEnum = pgEnum("bank_transaction_type", [
  "simulation_credit",
  "admin_funding",
  "external_transfer",
  "external_transfer_in",
  "sandbox_credit",
  "transfer",
  "deposit_request",
  "withdrawal_request",
  "exchange_request",
]);

export const bankTransactionStatusEnum = pgEnum("bank_transaction_status", [
  "completed",
  "pending",
  "failed",
  "reversed",
]);

export const bankRequestTypeEnum = pgEnum("bank_request_type", [
  "deposit",
  "withdrawal",
  "exchange",
]);

export const bankUsersTable = pgTable("bank_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  country: text("country"),
  verificationStatus: text("verification_status").notNull().default("not_started"),
  verificationNote: text("verification_note"),
  accountStatus: text("account_status").notNull().default("active"),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bankWalletsTable = pgTable(
  "bank_wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    currency: bankCurrencyEnum("currency").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("bank_wallet_user_currency_unique").on(
      table.userId,
      table.currency,
    ),
    index("bank_wallet_user_idx").on(table.userId),
  ],
);

export const bankTransactionsTable = pgTable(
  "bank_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    initiatedByUserId: text("initiated_by_user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    fromUserId: text("from_user_id").references(() => bankUsersTable.id),
    toUserId: text("to_user_id").references(() => bankUsersTable.id),
    fromWalletId: uuid("from_wallet_id").references(() => bankWalletsTable.id),
    toWalletId: uuid("to_wallet_id").references(() => bankWalletsTable.id),
    type: bankTransactionTypeEnum("type").notNull(),
    status: bankTransactionStatusEnum("status").notNull(),
    currency: bankCurrencyEnum("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    feeMinor: bigint("fee_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    counterparty: text("counterparty"),
    description: text("description").notNull().default(""),
    mode: text("mode").notNull().default("simulation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_transaction_from_user_idx").on(table.fromUserId, table.createdAt),
    index("bank_transaction_to_user_idx").on(table.toUserId, table.createdAt),
    index("bank_transaction_status_idx").on(table.status, table.createdAt),
  ],
);

export const bankLedgerEntriesTable = pgTable(
  "bank_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => bankTransactionsTable.id),
    walletId: uuid("wallet_id").references(() => bankWalletsTable.id),
    accountCode: text("account_code").notNull(),
    currency: bankCurrencyEnum("currency").notNull(),
    side: text("side").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_ledger_transaction_idx").on(table.transactionId),
    index("bank_ledger_wallet_idx").on(table.walletId),
  ],
);

export const bankSandboxRequestsTable = pgTable(
  "bank_sandbox_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => bankTransactionsTable.id),
    reference: text("reference").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    type: bankRequestTypeEnum("type").notNull(),
    currency: bankCurrencyEnum("currency").notNull(),
    destinationCurrency: bankCurrencyEnum("destination_currency"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    status: text("status").notNull().default("pending_provider_setup"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_sandbox_request_user_idx").on(table.userId, table.createdAt),
  ],
);

export const bankAuditLogsTable = pgTable(
  "bank_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_audit_actor_idx").on(table.actorUserId, table.createdAt),
    index("bank_audit_target_idx").on(table.targetUserId, table.createdAt),
  ],
);
