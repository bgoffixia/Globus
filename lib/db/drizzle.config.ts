import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  // Neon Auth owns the neon_auth schema; Globus manages only its public tables.
  schemaFilter: ["public"],
  // Keep Neon’s starter/demo table and all unrelated tables outside Drizzle’s scope.
  tablesFilter: [
    "bank_users",
    "bank_wallets",
    "bank_saved_payment_methods",
    "bank_transactions",
    "bank_vault_transaction_notes",
    "bank_ledger_entries",
    "bank_sandbox_requests",
    "bank_audit_logs",
    "bank_restrictions",
    "bank_admin_settings",
    "bank_vault_paystack_plans",
    "bank_vault_paystack_events",
    "bank_vault_sessions",
    "bank_notifications",
    "bank_push_subscriptions",
    "bank_identity_documents",
    "bank_exchange_rates",
    "bank_international_transfer_requests",
  ],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
