import { spawnSync } from "node:child_process";
import path from "node:path";
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

const repoRoot = path.join(__dirname, "..", "..", "..");

/**
 * Fails closed if the mandatory five-provider stress harness exits non-zero.
 * Does not treat missing credentials as skip: missing region providers are FAIL rows inside the script.
 */
test.describe("mandatory payment matrix (CLI)", () => {
  test("stress-checkout-providers --mandatory-five completes with exit 0", () => {
    const r = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        path.join(repoRoot, "scripts", "stress-checkout-providers.ts"),
        "--mandatory-five",
      ],
      {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf-8",
        shell: true,
      },
    );
    expect(
      r.status,
      `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    ).toBe(0);
  });
});
