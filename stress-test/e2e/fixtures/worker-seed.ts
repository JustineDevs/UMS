/**
 * Deterministic labels per Playwright worker for parallel-safe isolation hints.
 */
export function workerSeedSuffix(workerIndex: number): string {
  const w = Number.isFinite(workerIndex) ? Math.max(0, Math.floor(workerIndex)) : 0;
  return `w${w}`;
}

export function workerScopedId(prefix: string, workerIndex: number): string {
  return `${prefix}-${workerSeedSuffix(workerIndex)}`;
}
