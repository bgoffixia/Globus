import {
  bigint,
  boolean,
  date,
  index,
  integer,
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
  "admin_adjustment",
  "reversal",
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
  "rejected",
  "reversed",
]);

export const bankRestrictionTypeEnum = pgEnum("bank_restriction_type", [
  "suspend_user",
  "restrict_outgoing_transfers",
  "restrict_withdrawals",
  "restrict_deposits",
  "freeze_wallet",
  "under_review",
  "read_only",
]);

export const bankRestrictionStatusEnum = pgEnum("bank_restriction_status", [
  "active",
  "removed",
]);

export const bankRequestTypeEnum = pgEnum("bank_request_type", [
  "deposit",
  "withdrawal",
  "exchange",
]);

export const bankUsersTable = pgTable("bank_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  customerId: text("customer_id").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  country: text("country"),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  transactionPinHash: text("transaction_pin_hash"),
  transactionPinFailedAttempts: integer("transaction_pin_failed_attempts")
    .notNull()
    .default(0),
  transactionPinLockedUntil: timestamp("transaction_pin_locked_until", {
    withTimezone: true,
  }),
  vaultPasscodeHash: text("vault_passcode_hash"),
  vaultPasscodeFailedAttempts: integer("vault_passcode_failed_attempts")
    .notNull()
    .default(0),
  vaultPasscodeLockedUntil: timestamp("vault_passcode_locked_until", {
    withTimezone: true,
  }),
  vaultSubscriptionStatus: text("vault_subscription_status")
    .notNull()
    .default("inactive"),
  vaultSubscriptionRequestedAt: timestamp("vault_subscription_requested_at", {
    withTimezone: true,
  }),
  vaultSubscriptionReviewedAt: timestamp("vault_subscription_reviewed_at", {
    withTimezone: true,
  }),
  vaultSubscriptionReviewedByUserId: text(
    "vault_subscription_reviewed_by_user_id",
  ),
  vaultSubscriptionReason: text("vault_subscription_reason"),
  vaultSubscriptionExpiresAt: timestamp("vault_subscription_expires_at", {
    withTimezone: true,
  }),
  vaultEmailBannerTheme: text("vault_email_banner_theme")
    .notNull()
    .default("navy"),
  vaultEmailBannerHeadline: text("vault_email_banner_headline")
    .notNull()
    .default("A Globus transfer notice"),
  vaultEmailIncludeSupportLink: boolean("vault_email_include_support_link")
    .notNull()
    .default(false),
  verificationStatus: text("verification_status").notNull().default("not_started"),
  verificationNote: text("verification_note"),
  accountStatus: text("account_status").notNull().default("active"),
  accountRestrictionReason: text("account_restriction_reason"),
  accountRestrictionNotes: text("account_restriction_notes"),
  accountRestrictedByUserId: text("account_restricted_by_user_id"),
  accountRestrictedAt: timestamp("account_restricted_at", { withTimezone: true }),
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
    transfersEnabled: boolean("transfers_enabled").notNull().default(true),
    depositsEnabled: boolean("deposits_enabled").notNull().default(true),
    withdrawalsEnabled: boolean("withdrawals_enabled").notNull().default(true),
    futureTransferMode: text("future_transfer_mode").notNull().default("failed"),
    restrictionReason: text("restriction_reason"),
    restrictionNotes: text("restriction_notes"),
    restrictedByUserId: text("restricted_by_user_id").references(
      () => bankUsersTable.id,
    ),
    restrictedAt: timestamp("restricted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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

export const bankSavedPaymentMethodsTable = pgTable(
  "bank_saved_payment_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    cardBrand: text("card_brand"),
    bankName: text("bank_name"),
    accountHolder: text("account_holder"),
    accountNumberEncrypted: text("account_number_encrypted"),
    country: text("country"),
    lastFour: text("last_four").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_saved_payment_method_user_idx").on(table.userId, table.createdAt),
    index("bank_saved_payment_method_active_idx").on(table.userId, table.deletedAt),
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
    adminReference: text("admin_reference"),
    adminNotes: text("admin_notes"),
    correctionOfTransactionId: uuid("correction_of_transaction_id"),
    reversalOfTransactionId: uuid("reversal_of_transaction_id"),
    correctionReason: text("correction_reason"),
    mode: text("mode").notNull().default("simulation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_transaction_from_user_idx").on(table.fromUserId, table.createdAt),
    index("bank_transaction_to_user_idx").on(table.toUserId, table.createdAt),
    index("bank_transaction_status_idx").on(table.status, table.createdAt),
    index("bank_transaction_correction_idx").on(table.correctionOfTransactionId),
    uniqueIndex("bank_transaction_single_reversal_idx").on(table.reversalOfTransactionId),
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
    savedPaymentMethodId: uuid("saved_payment_method_id").references(
      () => bankSavedPaymentMethodsTable.id,
      { onDelete: "set null" },
    ),
    paymentMethod: text("payment_method"),
    paymentMethodSummary: text("payment_method_summary"),
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

export const bankRestrictionsTable = pgTable(
  "bank_restrictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id").references(() => bankWalletsTable.id, {
      onDelete: "set null",
    }),
    type: bankRestrictionTypeEnum("restriction_type").notNull(),
    status: bankRestrictionStatusEnum("status").notNull().default("active"),
    reason: text("reason").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    internalNotes: text("internal_notes"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    removedByUserId: text("removed_by_user_id").references(
      () => bankUsersTable.id,
    ),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removalReason: text("removal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_restriction_user_idx").on(table.userId, table.effectiveAt),
    index("bank_restriction_wallet_idx").on(table.walletId, table.effectiveAt),
    index("bank_restriction_status_type_idx").on(table.status, table.type),
  ],
);

export const bankAdminSettingsTable = pgTable("bank_admin_settings", {
  id: text("id").primaryKey().default("operations"),
  fundingLimit: text("funding_limit").notNull().default("100000000"),
  secondApprovalThreshold: text("second_approval_threshold")
    .notNull()
    .default("100000000"),
  unverifiedDashboardMessage: text("unverified_dashboard_message")
    .notNull()
    .default(
      "Your identity verification is not complete. Submit a request for review to access eligible account features.",
    ),
  frozenIncomingPolicy: text("frozen_incoming_policy")
    .notNull()
    .default("allow_frozen"),
  updatedByUserId: text("updated_by_user_id").references(() => bankUsersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const bankVaultSessionsTable = pgTable(
  "bank_vault_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_vault_session_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
);

export const bankNotificationsTable = pgTable(
  "bank_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    reference: text("reference"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_notification_user_created_idx").on(table.userId, table.createdAt),
    index("bank_notification_user_unread_idx").on(table.userId, table.readAt),
  ],
);

export const bankPushSubscriptionsTable = pgTable(
  "bank_push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    endpointHash: text("endpoint_hash").notNull().unique(),
    subscriptionEncrypted: text("subscription_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("bank_push_subscription_user_idx").on(table.userId)],
);
