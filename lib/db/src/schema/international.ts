import {
  bigint,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bankCurrencyEnum, bankTransactionsTable, bankUsersTable, bankWalletsTable } from "./bank";

export const bankExchangeRatesTable = pgTable(
  "bank_exchange_rates",
  {
    sourceCurrency: bankCurrencyEnum("source_currency").notNull(),
    destinationCurrency: text("destination_currency").notNull(),
    rate: numeric("rate", { precision: 24, scale: 10 }).notNull(),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("bank_exchange_rate_pair_unique").on(
      table.sourceCurrency,
      table.destinationCurrency,
    ),
  ],
);

export const bankInternationalTransferRequestsTable = pgTable(
  "bank_international_transfer_requests",
  {
    transactionId: uuid("transaction_id")
      .primaryKey()
      .references(() => bankTransactionsTable.id, { onDelete: "cascade" }),
    transferType: text("transfer_type").notNull().default("international_wire"),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id),
    sourceWalletId: uuid("source_wallet_id")
      .notNull()
      .references(() => bankWalletsTable.id),
    sourceCurrency: bankCurrencyEnum("source_currency").notNull(),
    sourceAmountMinor: bigint("source_amount_minor", { mode: "bigint" }).notNull(),
    destinationCurrency: text("destination_currency").notNull(),
    destinationAmountMinor: bigint("destination_amount_minor", {
      mode: "bigint",
    }).notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 24, scale: 10 }).notNull(),
    rateUpdatedAt: timestamp("rate_updated_at", { withTimezone: true }).notNull(),
    destinationCountry: text("destination_country").notNull(),
    recipientBank: text("recipient_bank").notNull(),
    routingCode: text("routing_code"),
    swiftBic: text("swift_bic"),
    recipientAccountName: text("recipient_account_name").notNull(),
    recipientAccountLast4: text("recipient_account_last4").notNull(),
    recipientEmailEncrypted: text("recipient_email_encrypted"),
    remark: text("remark").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_international_request_user_idx").on(table.userId, table.createdAt),
    index("bank_international_request_wallet_idx").on(table.sourceWalletId),
  ],
);
