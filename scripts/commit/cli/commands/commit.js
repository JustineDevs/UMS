/**
 * Commit command: parallel commit with security checks.
 * Composable; delegates to parallel-commit module.
 */

const path = require('path');

const parallelCommitPath = path.join(__dirname, '../../parallel-commit.js');

async function run(opts = {}) {
  const prevArgv = process.argv.slice();
  const args = ['node', 'universal-music-store-commit'];
  if (opts.dryRun) args.push('--dry-run');
  if (opts.noSecurityCheck) args.push('--no-security-check');
  if (opts.warnOnly) args.push('--warn-only');
  if (opts.noStageAll) args.push('--no-stage-all');
  if (opts.skipPreflight) args.push('--skip-preflight');
  process.argv = args;

  const mod = require(parallelCommitPath);
  if (opts.max) mod.config.maxConcurrentCommits = opts.max;
  await mod.main();
  process.argv = prevArgv;
}

function help() {
  console.log(`
  universal-music-store-commit commit [options]

  Parallel commit with security checks. Commits each changed file individually.

  Options:
    --dry-run              Preview what would be committed
    --no-stage-all         Do not run git add -A before scanning (default stages everything)
    --skip-preflight       Skip pnpm ci:preflight (turbo lint/typecheck/test + Python)
    --no-security-check    Disable security checks (not recommended)
    --warn-only            Warn on sensitive files, do not fail
    --max <n>              Files per batch (Promise.all within each batch). Default 1 (sequential; avoids .git/index.lock races on Windows). Use >1 only if you accept risk.
    -h, --help             Show this help

  Examples:
    pnpm run commit:dry
    pnpm run commit -- --max 3
    pnpm run commit -- --no-stage-all
`);
}

module.exports = { run, help };
