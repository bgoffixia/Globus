import express, { type Express } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";

const app: Express = express();
const isMfaOnlyStaging = process.env.BETTER_AUTH_STAGING_ENABLED === "true";
app.set("trust proxy", 1);

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

if (isMfaOnlyStaging) {
  // Keep the health endpoint independent of Better Auth, the database, and email
  // configuration. Vercel can then report a healthy Express function even when
  // an auth dependency is misconfigured; auth initialization is deferred until
  // an auth endpoint is actually called.
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

  app.use(
    "/api/mfa-staging",
    cors({
      origin: betterAuthOrigins,
      credentials: true,
      methods: ["GET", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.get("/api/mfa-staging/health", (_req, res) => {
    res.json({
      ok: true,
      mode: "mfa-only-staging",
      authInitialization: "deferred",
    });
  });

  type BetterAuthRuntime = {
    toNodeHandler: (auth: unknown) => express.RequestHandler;
    fromNodeHeaders: (headers: express.Request["headers"]) => Headers;
    betterAuthStaging: {
      handler: unknown;
      api: {
        getSession: (input: { headers: Headers }) => Promise<{
          user: { twoFactorEnabled?: boolean };
        } | null>;
      };
    };
  };

  let betterAuthRuntimePromise: Promise<BetterAuthRuntime> | undefined;
  const loadBetterAuthRuntime = () => {
    betterAuthRuntimePromise ??= Promise.all([
      import("better-auth/node"),
      import("./auth/better-auth-staging"),
    ]).then(([node, auth]) => ({
      toNodeHandler: node.toNodeHandler as BetterAuthRuntime["toNodeHandler"],
      fromNodeHeaders: node.fromNodeHeaders as BetterAuthRuntime["fromNodeHeaders"],
      betterAuthStaging: auth.betterAuthStaging as BetterAuthRuntime["betterAuthStaging"],
    }));
    return betterAuthRuntimePromise;
  };

  app.all("/api/better-auth/*splat", async (req, res, next) => {
    try {
      const { toNodeHandler, betterAuthStaging } = await loadBetterAuthRuntime();
      return toNodeHandler(betterAuthStaging)(req, res, next);
    } catch (error) {
      logger.error({ err: error }, "Could not initialize isolated Better Auth MFA staging");
      next(error);
    }
  });

  app.get("/api/mfa-staging/access-check", async (req, res, next) => {
    try {
      const { fromNodeHeaders, betterAuthStaging } = await loadBetterAuthRuntime();
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

      res.json({ allowed: true, mfaRequired: true, mfaEnabled: true });
    } catch (error) {
      logger.error({ err: error }, "Could not run isolated MFA staging access check");
      next(error);
    }
  });
} else {
  // Production and ordinary previews retain the existing Clerk + banking API stack.
  const [
    { clerkMiddleware },
    { publishableKeyFromHost },
    { default: router },
    {
      CLERK_PROXY_PATH,
      clerkProxyMiddleware,
      getClerkProxyHost,
    },
  ] = await Promise.all([
    import("@clerk/express"),
    import("@clerk/shared/keys"),
    import("./routes"),
    import("./middlewares/clerkProxyMiddleware"),
  ]);

  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

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

  const financialActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many transaction requests. Try again in a few minutes.",
    },
  });

  app.use("/api/bank/transfers", financialActionLimiter);
  app.use("/api/bank/external-transfers", financialActionLimiter);
  app.use("/api/bank/international-transfer-requests", financialActionLimiter);
  app.use("/api/bank/ledger-requests", financialActionLimiter);
  app.use("/api", router);
}

export default app;
