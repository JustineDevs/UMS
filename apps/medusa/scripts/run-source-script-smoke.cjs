#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const cliShimPath = path.join(__dirname, "medusa-cli-shim.cjs");
const smokeWrapperPath = path.join(projectRoot, ".cache", "smoke-import.ts");
const scriptPath = process.argv[2];

if (!scriptPath) {
  throw new Error("Usage: run-source-script-smoke.cjs <script-path> [args...]");
}

const normalizedScriptPath = scriptPath.replace(/^[.][/\\]/, "");
const wrapperImportPath = `../${normalizedScriptPath}`;

fs.mkdirSync(path.dirname(smokeWrapperPath), { recursive: true });
fs.writeFileSync(
  smokeWrapperPath,
  `import ${JSON.stringify(wrapperImportPath)};\nexport default async function smokeImport() {\n  return undefined;\n}\n`,
);

try {
  const cliPath = require.resolve("@medusajs/cli/cli.js", {
    paths: [projectRoot],
  });

  const result = spawnSync(
    process.execPath,
    ["--require", cliShimPath, cliPath, "exec", "./.cache/smoke-import.ts", ...process.argv.slice(3)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        TS_NODE_SWC: process.env.TS_NODE_SWC ?? "true",
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
} finally {
  try {
    fs.rmSync(smokeWrapperPath, { force: true });
  } catch {
    // best-effort cleanup
  }
}
