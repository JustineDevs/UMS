/**
 * Shared E2E environment: URLs and strict-mode flags for Playwright specs.
 */

export const storefrontBase = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
export const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";
export const medusaBase = process.env.PLAYWRIGHT_MEDUSA_URL ?? "http://localhost:9000";

export function strictCatalog(): boolean {
  return process.env.CI_STRICT_E2E === "1" || process.env.CI === "true";
}

/**
 * Stress / payment matrix: fail instead of skip when PSP env is missing.
 * Does not inherit plain `CI=true` so default CI jobs keep skipping optional PSP specs.
 */
export function isE2eStrictPayments(): boolean {
  return (
    process.env.E2E_STRICT_PAYMENTS === "1" ||
    process.env.E2E_STRICT_E2E === "1"
  );
}

/** When set, every PSP enabled in Medusa payment-health must have matching E2E_* credentials. */
export function isE2eExpectAllPsps(): boolean {
  return process.env.E2E_EXPECT_ALL_PSPS === "1";
}

export function getStressIterations(): number {
  const n = Number.parseInt(process.env.E2E_STRESS_ITERATIONS ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(50, n);
}

/** Parallel describe mode for stress specs (cart collisions possible across workers). */
export function stressDescribeMode(): "parallel" | "serial" {
  const p = process.env.E2E_STRESS_PARALLEL?.trim();
  if (p === "1" || p === "true") return "parallel";
  const n = Number.parseInt(p ?? "", 10);
  if (Number.isFinite(n) && n > 1) return "parallel";
  return "serial";
}

/** Path to Playwright storageState JSON for an authenticated storefront customer (Google session). */
export function resolveStorefrontStorageStatePath(): string | undefined {
  const raw = process.env.PLAYWRIGHT_STOREFRONT_STORAGE_STATE?.trim();
  return raw || undefined;
}

export function suiteMode(): string {
  return (process.env.MAHARLIKA_SUITE ?? "all").trim().toLowerCase();
}
