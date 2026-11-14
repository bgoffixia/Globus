import app from "./app";
import { backfillCustomerIds } from "./lib/bank";
import { expireVaultSubscriptions } from "./lib/bank-vault";
import { logger } from "./lib/logger";
import { isPrivateDataEncryptionConfigured } from "./lib/private-data";
import { sendVaultExpiryReminders } from "./lib/vault-expiry-reminders";

const VAULT_EXPIRATION_SWEEP_INTERVAL_MS = 60_000;
const VAULT_EXPIRY_REMINDER_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isMfaOnlyStaging = process.env.BETTER_AUTH_STAGING_ENABLED === "true";

async function startServer() {
  if (!isMfaOnlyStaging) {
    await backfillCustomerIds();
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info(
      { privateDataEncryptionConfigured: isPrivateDataEncryptionConfigured() },
      "Private data encryption readiness",
    );
    logger.info({ port }, "Server listening");

    // In MFA-only staging, do not run banking maintenance jobs against the empty auth database.
    if (isMfaOnlyStaging) {
      logger.info("MFA-only staging mode: banking maintenance jobs are disabled");
      return;
    }

    const sweepExpiredVaultSubscriptions = async () => {
      try {
        const expiredCount = await expireVaultSubscriptions();
        if (expiredCount > 0) {
          logger.info(
            { expiredCount },
            "Expired Private Vault subscriptions and revoked their sessions",
          );
        }
      } catch (error) {
        logger.error(
          { err: error },
          "Could not expire Private Vault subscriptions",
        );
      }
    };

    void sweepExpiredVaultSubscriptions();
    const expirationSweep = setInterval(
      () => void sweepExpiredVaultSubscriptions(),
      VAULT_EXPIRATION_SWEEP_INTERVAL_MS,
    );
    expirationSweep.unref();

    if (process.env.NODE_ENV === "production") {
      const sendExpiringVaultReminders = async () => {
        try {
          const result = await sendVaultExpiryReminders();
          if (result.sent > 0 || result.failed > 0) {
            logger.info(
              result,
              "Processed Private Vault expiry reminder emails",
            );
          }
        } catch (error) {
          logger.error(
            { err: error },
            "Could not process Private Vault expiry reminders",
          );
        }
      };

      void sendExpiringVaultReminders();
      const reminderSweep = setInterval(
        () => void sendExpiringVaultReminders(),
        VAULT_EXPIRY_REMINDER_SWEEP_INTERVAL_MS,
      );
      reminderSweep.unref();
    } else {
      logger.info(
        "Private Vault expiry reminder emails are disabled outside production",
      );
    }
  });
}

void startServer().catch((error: unknown) => {
  logger.error({ err: error }, "Could not backfill Globus Customer IDs");
  process.exit(1);
});
