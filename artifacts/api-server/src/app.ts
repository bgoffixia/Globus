import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.set("trust proxy", 1);

const financialActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many transaction requests. Try again in a few minutes.",
  },
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Self-managed Better Auth is mounted only in the isolated MFA staging deployment.
// Keep this before express.json(): Better Auth must receive the untouched request stream.
if (process.env.BETTER_AUTH_STAGING_ENABLED === "true") {
  const [{ toNodeHandler, fromNodeHeaders }, { betterAuthStaging }] =
    await Promise.all([
      import("better-auth/node"),
      import("./auth/better-auth-staging"),
    ]);

  const betterAuthOrigins = (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? process.env.BETTER_AUTH_URL ?? ""
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    "/api/better-auth",
    cors({
      origin: betterAuthOrigins,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.all("/api/better-auth/*splat", toNodeHandler(betterAuthStaging));

  // The first-factor session is intentionally limited until TOTP enrollment is complete.
  // This endpoint is a staging policy probe; it does not expose banking/customer data.
  app.get("/api/mfa-staging/access-check", async (req, res, next) => {
    try {
      const session = await betterAuthStaging.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session) {
        res.status(401).json({ error: "Sign in to the MFA staging environment." });
        return;
      }

      if (!session.user.twoFactorEnabled) {
        res.status(403).json({
          code: "MFA_ENROLLMENT_REQUIRED",
          error: "Complete authenticator-app enrollment before accessing the protected staging area.",
        });
        return;
      }

      res.json({
        allowed: true,
        mfaRequired: true,
        mfaEnabled: true,
      });
    } catch (error) {
      next(error);
    }
  });
}
app.use(express.json({
  verify(req, _res, buffer) {
    if (req.url?.split("?")[0] === "/api/bank/vault/paystack/webhook") {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }

  try {
    const originHost = new URL(origin).host;
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || req.get("host");
    if (requestHost && originHost === requestHost) {
      next();
      return;
    }
  } catch {
    // Invalid Origin values are rejected below.
  }

  res.status(403).json({ error: "Cross-origin request blocked." });
});
app.use("/api/bank/transfers", financialActionLimiter);
app.use("/api/bank/external-transfers", financialActionLimiter);
app.use("/api/bank/international-transfer-requests", financialActionLimiter);
app.use("/api/bank/ledger-requests", financialActionLimiter);
app.use("/api", router);

export default app;
