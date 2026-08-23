/** @type {import('next').NextConfig} */
const path = require("path");
const { existsSync, readdirSync } = require("fs");
let withBotId = (config) => config;
try {
  ({ withBotId } = require("botid/next/config"));
} catch {
  withBotId = (config) => config;
}
const {
  loadMonorepoRootEnv,
} = require("../../scripts/load-monorepo-root-env.cjs");
// Repo-root env files (e.g. MEDUSA_SECRET_API_KEY for checkout totals preview)
loadMonorepoRootEnv(__dirname);

const allowedDevOrigins = ["127.0.0.1"];

function resolvePnpmEntry(packagePrefix, relativePath) {
  const storeDir = path.join(__dirname, "../../node_modules/.pnpm");
  if (!existsSync(storeDir)) {
    return null;
  }

  const candidates = readdirSync(storeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(packagePrefix))
    .map((entry) => path.join(storeDir, entry.name, "node_modules", relativePath))
    .filter((candidate) => existsSync(candidate));

  return candidates[0] ?? null;
}

const cmdkEntry =
  resolvePnpmEntry("cmdk@", path.join("cmdk", "dist", "index.mjs")) ??
  resolvePnpmEntry("cmdk@", path.join("cmdk", "dist", "index.js"));

const botIdClientEntry =
  resolvePnpmEntry("botid@", path.join("botid", "dist", "client", "index.mjs")) ??
  resolvePnpmEntry("botid@", path.join("botid", "dist", "client", "index.js"));
const botIdClientCoreEntry =
  resolvePnpmEntry("botid@", path.join("botid", "dist", "client", "core", "index.mjs")) ??
  resolvePnpmEntry("botid@", path.join("botid", "dist", "client", "core", "index.js"));
const opentelemetryApiEntry =
  resolvePnpmEntry("@opentelemetry+api@", path.join("@opentelemetry", "api", "build", "esnext", "index.js")) ??
  resolvePnpmEntry("@opentelemetry+api@", path.join("@opentelemetry", "api", "build", "esnext", "index.mjs"));

function resolveStorefrontDependency(name) {
  try {
    return require.resolve(name, { paths: [__dirname] });
  } catch {
    return null;
  }
}

const xenditRuntimeDependencies = [
  "classnames",
  "preact",
  "libphonenumber-js",
  "jsbarcode",
  "qrcode",
  "dijkstrajs",
  "pngjs",
  "yargs",
  "tslib",
  "html-to-text",
  "@selderee/plugin-htmlparser2",
  "selderee",
  "domhandler",
  "domutils",
  "domelementtype",
  "dom-serializer",
  "entities",
  "htmlparser2",
  "deepmerge",
].reduce((aliases, name) => {
  const resolved = resolveStorefrontDependency(name);
  if (resolved) aliases[`${name}$`] = resolved;
  return aliases;
}, {});

const entitiesDecodeEntry = resolvePnpmEntry(
  "entities@",
  path.join("entities", "lib", "decode.js"),
);

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
      hostname: "cdn.simpleicons.org",
      pathname: "/**",
    },
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
    { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
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
    "https://js.stripe.com",
    "https://www.paypal.com",
    "https://www.sandbox.paypal.com",
    "https://connect.facebook.net",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://www.recaptcha.net",
    "https://www.gstatic.com",
    "https://va.vercel-scripts.com",
    CSP_NONCE_PLACEHOLDER,
  ].filter(Boolean);

  const extraFrameSrc = [
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    "https://www.paypal.com",
    "https://www.sandbox.paypal.com",
    "https://www.recaptcha.net",
  ];

  const extraImgSrc = [
    "https:",
    "data:",
    "blob:",
    "https://www.google-analytics.com",
    "https://www.facebook.com",
    "https://connect.facebook.net",
  ];

  const extraConnectSrc = [
    ...publicMedusaConnectSources(),
    "https://api.stripe.com",
    "https://www.paypal.com",
    "https://www.sandbox.paypal.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://connect.facebook.net",
    "https://graph.facebook.com",
    "https://recaptchaenterprise.googleapis.com",
    "https://vitals.vercel-insights.com",
    "https://va.vercel-scripts.com",
  ];

  const directives = [
    `default-src ${self}`,
    `script-src ${self} ${unsafeInline}${unsafeEval} ${extraScriptSrc.join(" ")}`,
    `style-src ${self} ${unsafeInline} https://fonts.googleapis.com`,
    `img-src ${self} ${extraImgSrc.join(" ")}`,
    `font-src ${self} data: https://fonts.gstatic.com`,
    `connect-src ${self} ${extraConnectSrc.join(" ")}`,
    `frame-src ${self} ${extraFrameSrc.join(" ")}`,
    `frame-ancestors ${[self, ...previewFrameAncestors()].join(" ")}`,
    `object-src ${none}`,
    `base-uri ${self}`,
    `form-action ${self}`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}

function publicMedusaConnectSources() {
  const configured = process.env.NEXT_PUBLIC_MEDUSA_URL?.trim();
  if (!configured) return [];
  try {
    const origin = new URL(configured).origin;
    return /^https?:$/.test(new URL(configured).protocol) ? [origin] : [];
  } catch {
    return [];
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // CSP frame-ancestors is the source of truth because the admin preview is a
  // controlled cross-origin frame in local and deployed environments.
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
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  { key: "Content-Security-Policy", value: buildCsp() },
];

function previewFrameAncestors() {
  const configured = (
    process.env.ADMIN_PREVIEW_ORIGINS ??
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    process.env.ADMIN_NEXTAUTH_URL ??
    ""
  )
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter((value) => /^https?:\/\//.test(value));
  if (process.env.NODE_ENV === "production") return configured;
  return [...new Set([...configured, "http://localhost:3001", "http://127.0.0.1:3001"])];
}

const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

const discoveryHeaders = [
  {
    key: "Link",
    value: [
      `<${siteOrigin}/llms.txt>; rel="describedby"; type="text/plain"`,
      `<${siteOrigin}/llms-full.txt>; rel="service-doc"; type="text/plain"`,
      `<${siteOrigin}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
    ].join(", "),
  },
];

const nextConfig = {
  allowedDevOrigins,
  poweredByHeader: false,
  // Keep supervised dev servers from mutating a production build in `.next`.
  distDir:
    process.env.VERCEL === "1"
      ? ".next"
      : process.env.NODE_ENV === "production"
        ? ".next-production"
        : ".next",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@universal-music-store/types",
    "@universal-music-store/sdk",
    "@universal-music-store/ui",
    "@universal-music-store/validation",
    "@universal-music-store/user-preferences",
    "@universal-music-store/platform-data",
    "@universal-music-store/omnichannel-policy",
    "@universal-music-store/resend-mail",
    "@medusajs/js-sdk",
    "botid",
  ],
  experimental: {
    optimizePackageImports: [
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
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/track/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/order-confirmation/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/account/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/checkout/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      { source: "/((?!api|_next).*)", headers: discoveryHeaders },
    ];
  },
  /** Older clients or typos called `/api/medusa-totals-preview`; canonical route is under `/api/checkout/`. */
  async rewrites() {
    return [
      {
        source: "/api/medusa-totals-preview",
        destination: "/api/checkout/medusa-totals-preview",
      },
    ];
  },
  webpack: (config) => {
    config.resolve.symlinks = false;
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
      ...(cmdkEntry ? { cmdk: cmdkEntry } : {}),
      ...(botIdClientEntry ? { "botid/client": botIdClientEntry } : {}),
      ...(botIdClientCoreEntry ? { "botid/client/core": botIdClientCoreEntry } : {}),
      ...(opentelemetryApiEntry ? { "@opentelemetry/api": opentelemetryApiEntry } : {}),
      ...xenditRuntimeDependencies,
      ...(entitiesDecodeEntry ? { "entities/lib/decode.js": entitiesDecodeEntry } : {}),
    };
    return config;
  },
};

module.exports = withBotId(nextConfig);
