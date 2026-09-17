const { readdirSync } = require("node:fs");
const { join, relative, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

function collectTests(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTests(path);
    if (!/\.test\.(?:c|m)?tsx?$/.test(entry.name)) return [];
    // Integration tests require Medusa/Supabase and belong to the E2E/integration lane.
    if (entry.name.includes(".integration.test.") || path.includes(`${sep}__tests__${sep}`)) return [];
    return [path];
  });
}

const tests = collectTests(join(__dirname, "..", "src"))
  .sort((a, b) => relative(process.cwd(), a).localeCompare(relative(process.cwd(), b)));

const tsxCli = require.resolve("tsx/cli", { paths: [join(__dirname, "..")] });
const result = spawnSync(process.execPath, [tsxCli, "--test", ...tests], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
