import type { Request, Response } from "express";
import app from "../artifacts/api-server/src/app";
import { backfillCustomerIds } from "../artifacts/api-server/src/lib/bank";
import { logger } from "../artifacts/api-server/src/lib/logger";

let initialization: Promise<void> | undefined;

export default async function handler(req: Request, res: Response) {
  initialization ??= backfillCustomerIds();

  try {
    await initialization;
  } catch (error) {
    logger.error({ err: error }, "Vercel API initialization failed");
    initialization = undefined;

    if (!res.headersSent) {
      res.status(503).json({
        error: "API initialization failed. Please retry."
      });
    }
    return;
  }

  return app(req, res);
}
