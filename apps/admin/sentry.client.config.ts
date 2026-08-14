import { createRequire } from "node:module";

type SentryLike = {
  init: (options: {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    replaysSessionSampleRate?: number;
    integrations?: unknown[];
    enabled?: boolean;
  }) => void;
  replayIntegration: (options: {
    maskAllText?: boolean;
    blockAllMedia?: boolean;
  }) => unknown;
};

function loadSentry(): SentryLike {
  const require = createRequire(import.meta.url);
  try {
    const mod = require("@sentry/nextjs") as Partial<SentryLike>;
    if (
      typeof mod.init === "function" &&
      typeof mod.replayIntegration === "function"
    ) {
      return mod as SentryLike;
    }
  } catch {
    // Keep the app buildable when the Sentry package is not linked in this workspace state.
  }
  return {
    init() {},
    replayIntegration() {
      return undefined;
    },
  };
}

const Sentry = loadSentry();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.02,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
