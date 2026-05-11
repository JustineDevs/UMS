#!/usr/bin/env node

/**
 * Stress-test orchestration - runs all test types across the application.
 * Aligned with skills: e2e-testing, dogfood, design-with-taste, core-engineering, owasp-security.
 *
 * Phases:
 *  1. Lint
 *  2. Security check (sensitive files)
 *  3. Audit triage (check-audit-triage.js; aligns with release-gate)
 *  4. Unit/integration + Medusa stress
 *  5. E2E (Playwright smoke, flows, authenticated admin operations pass)
 *  6. Dogfood (visual screenshots)
 *
 * DB prep (optional, before E2E): pnpm e2e:prep — Medusa seed is skipped when the store API already has products; staff ensure refreshes `staff_permission_grants` (`*`) for the first ADMIN_ALLOWED_EMAILS user when role is staff.
 *
 * Usage: node stress-test/scripts/stress-test.js [options]
 *   --no-lint       Skip lint
 *   --no-security   Skip security check
 *   --no-audit      Skip audit triage (check-audit-triage.js)
 *   --no-test       Skip unit/integration/medusa tests
 *   --no-e2e        Skip E2E (requires dev servers)
 *   --no-dogfood    Skip dogfood screenshots
 */

const { spawnSync } = require("child_process");
const path = require("path");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const root = path.resolve(__dirname, "..", "..");

const phases = [
  {
    id: "lint",
    name: "Lint",
    cmd: ["pnpm", "lint"],
    skipFlag: "--no-lint",
  },
  {
    id: "security",
    name: "Security check (sensitive files)",
    cmd: ["pnpm", "security:check"],
    skipFlag: "--no-security",
  },
  {
    id: "audit",
    name: "Dependency audit (triage; same as release-gate)",
    cmd: ["node", "stress-test/scripts/check-audit-triage.js"],
    skipFlag: "--no-audit",
  },
  {
    id: "test",
    name: "Unit / integration / Medusa stress",
    cmd: ["pnpm", "test"],
    skipFlag: "--no-test",
  },
  {
    id: "e2e",
    name: "E2E (Playwright)",
    cmd: ["node", "stress-test/scripts/run-e2e.js"],
    skipFlag: "--no-e2e",
  },
  {
    id: "dogfood",
    name: "Dogfood (visual screenshots)",
    cmd: ["node", "stress-test/scripts/run-e2e.js", "dogfood", "--project=chromium"],
    skipFlag: "--no-dogfood",
  },
];

function run(cmd, args = []) {
  const [program, ...rest] = cmd;
  const result = spawnSync(program, [...rest, ...args], {
    stdio: "inherit",
    cwd: root,
    shell: true,
  });
  return result.status;
}

function main() {
  const args = process.argv.slice(2);
  const skipSet = new Set(args.filter((a) => a.startsWith("--no-")));

  console.log("\n🧪 Stress-test: full application\n");

  for (const phase of phases) {
    if (skipSet.has(phase.skipFlag)) {
      console.log(`⏭️  Skipping: ${phase.name}\n`);
      continue;
    }

    console.log(`\n━━━ ${phase.name} ━━━\n`);
    const code = run(phase.cmd);
    if (code !== 0) {
      console.error(`\n❌ ${phase.name} failed (exit ${code})`);
      process.exit(code);
    }
  }

  console.log("\n✅ All stress-test phases passed.\n");
}

main();
