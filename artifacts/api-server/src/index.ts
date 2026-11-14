import app from "./app";
import { logger } from "./lib/logger";

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
  // Do not even import banking/database modules in the isolated MFA-only process.
  const banking = isMfaOnlyStaging
    ? null
    : await Promise.all([
        import("./lib/bank"),
        import("./lib/bank-vault"),
        import("./lib/private-data"),
        import("./lib/vault-expiry-reminders"),
      ]);

  if (!isMfaOnlyStaging && banking) {
    await banking[0].backfillCustomerIds();
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    if (isMfaOnlyStaging) {
      logger.info(
        { port, mode: "mfa-only-staging" },
        "Isolated Better Auth MFA staging server listening; banking modules and jobs are disabled",
      );
      return;
    }

    const [, bankVault, privateData, vaultReminders] = banking!;
    logger.info(
      { privateDataEncryptionConfigured: privateData.isPrivateDataEncryptionConfigured() },
      "Private data encryption readiness",
    );
    logger.info({ port }, "Server listening");

    const sweepExpiredVaultSubscriptions = async () => {
      try {
        const expiredCount = await bankVault.expireVaultSubscriptions();
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
          const result = await vaultReminders.sendVaultExpiryReminders();
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
  logger.error({ err: error }, "Could not start Globus API server");
  process.exit(1);
});
