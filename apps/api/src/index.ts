import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFileName =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
config({ path: resolve(__dirname, "../../../", envFileName) });

import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requestIdMiddleware } from "./lib/requestId.js";
import { getReadinessPayload, healthRouter } from "./routes/health.js";
import { complianceRouter } from "./routes/compliance.js";
import { errorHandler } from "./lib/errorHandler.js";
import { requireInternalApiKey } from "./lib/requireInternalApiKey.js";
import { logStartup } from "./lib/logger.js";
import rateLimit from "express-rate-limit";
import { expressComplianceApiRateLimitOptions } from "@universal-music-store/rate-limits";
import { shouldFailBootForMissingInternalKey } from "./lib/checkProductionInternalApiKey.js";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.set(
  "trust proxy",
  process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true",
);

if (shouldFailBootForMissingInternalKey()) {
  console.error("FATAL: INTERNAL_API_KEY must be set in production");
  process.exit(1);
}

app.use(requestIdMiddleware);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      const allowed =
        process.env.CORS_ORIGIN?.split(",")
          .map((s) => s.trim())
          .filter(Boolean) ?? [];
      const isProd = process.env.NODE_ENV === "production";
      if (!origin) {
        callback(null, !isProd);
        return;
      }
      if (allowed.length === 0) {
        callback(null, !isProd);
        return;
      }
      if (allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

const complianceRateLimiter = rateLimit(expressComplianceApiRateLimitOptions());

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "universal-music-store-api",
    status: "ok",
    health: "/health",
    readiness: "/readyz",
    compliance: "/compliance",
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/readyz", async (_req, res) => {
  const body = await getReadinessPayload();
  res.status(body.ready ? 200 : 503).json(body);
});

app.use("/health", healthRouter);
app.use(
  "/compliance",
  complianceRateLimiter,
  requireInternalApiKey,
  complianceRouter,
);

app.use(errorHandler);

app.listen(PORT, () => {
  if (!process.env.INTERNAL_API_KEY && process.env.NODE_ENV !== "production") {
    logStartup("dev_auth_bypass_active", {
      level: "warn",
      msg: "INTERNAL_API_KEY is not set — compliance endpoints are unprotected (dev only)",
    });
  }
  logStartup("api_server_listen", { port: Number(PORT) });
});
