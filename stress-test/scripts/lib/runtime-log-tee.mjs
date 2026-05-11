/**
 * ESM: tee stdout/stderr to stress-test/test-results/runtime-logs/scripts/<label>-<iso>.log
 * Synchronous appends so logs survive immediate process.exit().
 * import { attach } from "./lib/runtime-log-tee.mjs";
 * attach(import.meta.url);
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function attach(importMetaUrl) {
  if (process.env.STRESS_TEST_NO_RUNTIME_LOG === "1") {
    return;
  }
  const scriptPath = fileURLToPath(importMetaUrl);
  const dir = path.dirname(scriptPath);
  const repoRoot = path.resolve(dir, "..", "..");
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
        /* ignore */
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

export function repoRootFromScript(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..", "..");
}
