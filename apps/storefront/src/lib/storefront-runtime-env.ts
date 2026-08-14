import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const STOREFRONT_RUNTIME_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MEDUSA_SECRET_API_KEY",
  "MEDUSA_ADMIN_API_SECRET",
  "MEDUSA_BACKEND_URL",
  "NEXT_PUBLIC_MEDUSA_URL",
  "MEDUSA_REGION_ID",
  "NEXT_PUBLIC_MEDUSA_REGION_ID",
  "MEDUSA_PUBLISHABLE_API_KEY",
  "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
  "MEDUSA_SALES_CHANNEL_ID",
  "NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID",
  "NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID",
  "NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS",
] as const;

type StorefrontRuntimeEnvKey = (typeof STOREFRONT_RUNTIME_ENV_KEYS)[number];

let runtimeEnvLoaded = false;

function hasWorkspaceMarker(dir: string): boolean {
  return fs.existsSync(path.join(dir, "pnpm-workspace.yaml"));
}

function findWorkspaceRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    if (hasWorkspaceMarker(dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  const twoUp = path.resolve(startDir, "..", "..");
  if (hasWorkspaceMarker(twoUp)) {
    return twoUp;
  }
  return null;
}

/** Unique monorepo roots to scan for the root env file (Windows / turbo cwd quirks). */
function collectMonorepoRoots(preferredCwd?: string): string[] {
  const candidates: string[] = [];
  const monorepoRootEnv = process.env.MONOREPO_ROOT?.trim();
  if (monorepoRootEnv) {
    candidates.push(path.resolve(monorepoRootEnv));
  }
  const starts = new Set<string>();
  if (preferredCwd) starts.add(path.resolve(preferredCwd));
  starts.add(path.resolve(process.cwd()));
  for (const start of starts) {
    const w = findWorkspaceRoot(start);
    if (w) candidates.push(w);
    candidates.push(path.resolve(start, "..", ".."));
    candidates.push(path.resolve(start, ".."));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const r = path.resolve(c);
    if (seen.has(r)) continue;
    seen.add(r);
    if (hasWorkspaceMarker(r)) {
      out.push(r);
    }
  }
  return out;
}

function getRuntimeEnvFileName(): string {
  return process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.local";
}

function readEnvFileUtf8(filePath: string): string {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function parseEnvFile(
  filePath: string,
): Partial<Record<StorefrontRuntimeEnvKey, string>> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const parsed = parse(readEnvFileUtf8(filePath));
  const out: Partial<Record<StorefrontRuntimeEnvKey, string>> = {};
  for (const key of STOREFRONT_RUNTIME_ENV_KEYS) {
    const raw = parsed[key];
    if (typeof raw !== "string") continue;
    const value = raw.replace(/^\uFEFF/, "").trim();
    if (value !== "") {
      out[key] = value;
    }
  }
  return out;
}

function mergeRootEnv(
  rootDir: string,
): Partial<Record<StorefrontRuntimeEnvKey, string>> {
  const envFileName = getRuntimeEnvFileName();
  return {
    ...parseEnvFile(path.join(rootDir, envFileName)),
  };
}

function applyMergedEnv(
  envFromFiles: Partial<Record<StorefrontRuntimeEnvKey, string>>,
) {
  for (const key of STOREFRONT_RUNTIME_ENV_KEYS) {
    const fromFile = envFromFiles[key];
    const trimmedFile = typeof fromFile === "string" ? fromFile.trim() : "";
    if (!trimmedFile) continue;
    const cur = process.env[key];
    if (cur == null || String(cur).trim() === "") {
      process.env[key] = fromFile;
    }
  }
}

export function ensureStorefrontRuntimeEnvLoaded(options?: {
  cwd?: string;
  force?: boolean;
}): void {
  if (options?.force) {
    runtimeEnvLoaded = false;
  }
  if (runtimeEnvLoaded) {
    return;
  }

  const roots = collectMonorepoRoots(options?.cwd);
  if (roots.length > 0) {
    for (const rootDir of roots) {
      const envFromFiles = mergeRootEnv(rootDir);
      applyMergedEnv(envFromFiles);
    }
  } else {
    const fallback = path.resolve(process.cwd(), "..", "..");
    const envFileName = getRuntimeEnvFileName();
    if (fs.existsSync(path.join(fallback, envFileName))) {
      applyMergedEnv(mergeRootEnv(fallback));
    }
  }

  runtimeEnvLoaded = true;
}

export function resetStorefrontRuntimeEnvForTests(): void {
  runtimeEnvLoaded = false;
}
