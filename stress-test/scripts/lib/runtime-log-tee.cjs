#!/usr/bin/env node
/**
 * Tee this process stdout/stderr into stress-test/test-results/runtime-logs/scripts/<basename>-<iso>.log
 * Uses synchronous appends so logs survive immediate process.exit().
 * Call from CommonJS entrypoints: require("./lib/runtime-log-tee.cjs").attach(__filename);
 *
 * Set STRESS_TEST_NO_RUNTIME_LOG=1 to disable (e.g. nested invocations).
 */
"use strict";

const fs = require("fs");
const path = require("path");

function repoRootFromScriptsDir(scriptPath) {
  const dir = path.dirname(path.resolve(scriptPath));
  return path.resolve(dir, "..", "..");
}

function attach(scriptPath) {
  if (process.env.STRESS_TEST_NO_RUNTIME_LOG === "1") {
    return;
  }
  const repoRoot = repoRootFromScriptsDir(scriptPath);
  const logDir = path.join(repoRoot, "stress-test", "test-results", "runtime-logs", "scripts");
  fs.mkdirSync(logDir, { recursive: true });
  const base = path.basename(scriptPath, path.extname(scriptPath));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `${base}-${stamp}.log`);
  const header = `# ${base}\n# ${scriptPath}\n# started ${new Date().toISOString()}\n# argv ${JSON.stringify(process.argv)}\n# cwd ${process.cwd()}\n\n`;
  try {
    fs.appendFileSync(logPath, header);
  } catch {
    return;
  }

  const tee =
    (orig) =>
    function (chunk, encoding, cb) {
      try {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        fs.appendFileSync(logPath, buf);
      } catch {
        /* ignore disk errors */
      }
      return orig.call(this, chunk, encoding, cb);
    };

  process.stdout.write = tee(process.stdout.write.bind(process.stdout));
  process.stderr.write = tee(process.stderr.write.bind(process.stderr));

  process.once("exit", (code) => {
    try {
      fs.appendFileSync(logPath, `\n# ended code=${code} ${new Date().toISOString()}\n`);
    } catch {
      /* ignore */
    }
  });
}

module.exports = { attach, repoRootFromScriptsDir };
