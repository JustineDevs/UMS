import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const STOREFRONT_RUNTIME_ENV_KEYS = [
  "API_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
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

export function listMissingWorkerBackendEnv(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = env.API_URL?.trim();
  if (!raw) return ["API_URL"];
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return ["API_URL must use HTTPS in production"];
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      return ["API_URL must not point to a loopback host in production"];
    }
    return [];
  } catch {
    return ["API_URL must be a valid HTTPS URL in production"];
  }
}

export function assertWorkerBackendEnvProduction(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV !== "production") return;
  const missing = listMissingWorkerBackendEnv(env);
  if (missing.length) {
    throw new Error(`Worker backend configuration invalid: ${missing.join("; ")}`);
  }
}
