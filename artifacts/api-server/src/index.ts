import app from "./app";
import { backfillCustomerIds } from "./lib/bank";
import { expireVaultSubscriptions } from "./lib/bank-vault";
import { logger } from "./lib/logger";
import { isPrivateDataEncryptionConfigured } from "./lib/private-data";

const VAULT_EXPIRATION_SWEEP_INTERVAL_MS = 60_000;
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

async function startServer() {
  await backfillCustomerIds();

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
  });
}

void startServer().catch((error: unknown) => {
  logger.error({ err: error }, "Could not backfill Globus Customer IDs");
  process.exit(1);
});
