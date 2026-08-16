import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { loadMonorepoRootEnv } = require("../../scripts/load-monorepo-root-env.cjs");
loadMonorepoRootEnv(__dirname);

function resolvePnpmEntry(packagePrefix, relativePath) {
  const storeDir = path.join(__dirname, "../../node_modules/.pnpm");
  const { existsSync, readdirSync } = require("node:fs");
  if (!existsSync(storeDir)) {
    return null;
  }

  const candidates = readdirSync(storeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(packagePrefix))
    .map((entry) => path.join(storeDir, entry.name, "node_modules", relativePath))
    .filter((candidate) => existsSync(candidate));

  return candidates[0] ?? null;
}

const opentelemetryApiEntry =
  resolvePnpmEntry("@opentelemetry+api@", path.join("@opentelemetry", "api", "build", "esnext", "index.js")) ??
  resolvePnpmEntry("@opentelemetry+api@", path.join("@opentelemetry", "api", "build", "esnext", "index.mjs"));

function imageRemotePatterns() {
  const raw =
    process.env.NEXT_PUBLIC_IMAGE_HOSTNAMES ?? "*.supabase.co,**.supabase.co";
  const fromEnv = raw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/**",
    }));
  return [
    ...fromEnv,
    {
      protocol: "https",
      hostname: "lh3.googleusercontent.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      pathname: "/**",
    },
    /** Meta / Facebook image CDNs (e.g. product thumbnails pasted from FB URLs). */
    { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
    { protocol: "http", hostname: "localhost", pathname: "/**" },
    { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
  ];
}

const CSP_NONCE_PLACEHOLDER = "";

function buildCsp() {
  const self = "'self'";
  const unsafeInline = "'unsafe-inline'";
  const unsafeEval =
    process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
  const none = "'none'";

  const extraScriptSrc = [
    "https://va.vercel-scripts.com",
    CSP_NONCE_PLACEHOLDER,
  ].filter(Boolean);
  const storefrontOrigin = (
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.PUBLIC_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const directives = [
    `default-src ${self}`,
    `script-src ${self} ${unsafeInline}${unsafeEval} ${extraScriptSrc.join(" ")}`,
    `style-src ${self} ${unsafeInline} https://fonts.googleapis.com`,
    `img-src ${self} data: blob: https:`,
    `font-src ${self} data: https://fonts.gstatic.com`,
    // Nango Connect UI runs in a hosted iframe and calls the Nango API from that UI.
    `connect-src ${self} https://api.nango.dev https://connect.nango.dev https://vitals.vercel-insights.com https://va.vercel-scripts.com`,
    `frame-src ${self} ${storefrontOrigin} https://connect.nango.dev`,
    `frame-ancestors ${none}`,
    `object-src ${none}`,
    `base-uri ${self}`,
    `form-action ${self}`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_AUTH_DISABLED:
      process.env.NODE_ENV !== "production" && process.env.AUTH_DISABLED === "true"
        ? "true"
        : "false",
  },
  outputFileTracingRoot: path.join(__dirname, "../.."),
  serverExternalPackages: [],
  experimental: {
    externalDir: true,
    optimizePackageImports: [
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: imageRemotePatterns(),
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ...(process.env.NODE_ENV === "production"
        ? [{
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          }]
        : []),
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "Content-Security-Policy", value: buildCsp() },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
  transpilePackages: [
    "@universal-music-store/types",
    "@universal-music-store/sdk",
    "@universal-music-store/ui",
    "@universal-music-store/database",
    "@universal-music-store/platform-data",
    "@universal-music-store/omnichannel-policy",
    "@universal-music-store/validation",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...(opentelemetryApiEntry ? { "@opentelemetry/api": opentelemetryApiEntry } : {}),
    };
    return config;
  },
};

export default nextConfig;
