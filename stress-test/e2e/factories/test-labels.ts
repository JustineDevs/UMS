import { workerScopedId } from "../fixtures/worker-seed";

/** Build a grep-friendly scenario label for reports and artifact paths. */
export function scenarioLabel(domain: string, name: string, workerIndex: number): string {
  return `${domain}:${name}:${workerScopedId("worker", workerIndex)}`;
}
