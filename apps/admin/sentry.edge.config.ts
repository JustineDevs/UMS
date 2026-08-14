import { createRequire } from "node:module";

type SentryLike = {
  init: (options: {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
    enabled?: boolean;
  }) => void;
};

function loadSentry(): SentryLike {
  const require = createRequire(import.meta.url);
  try {
    const mod = require("@sentry/nextjs") as Partial<SentryLike>;
    if (typeof mod.init === "function") {
      return mod as SentryLike;
    }
  } catch {
    // Keep the app buildable when the Sentry package is not linked in this workspace state.
  }
  return {
    init() {},
  };
}

const Sentry = loadSentry();

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  enabled: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
});
