"use strict";

/**
 * Best-effort remove `<app>/.next/trace` before `next dev`.
 * On Windows, a leftover or locked trace file causes EPERM when Next opens it for writing.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const rel = process.argv[2] || "apps/web";
const nextDir = path.join(root, rel, ".next");
const tracePath = path.join(nextDir, "trace");

const ATTEMPTS = 12;
const FALLBACK_RM_ATTEMPTS = 6;
const BASE_DELAY_MS = 150;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  if (process.env.SKIP_NEXT_TRACE_CLEAN === "1") {
    return;
  }
  if (!fs.existsSync(tracePath)) {
    return;
  }

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const st = await fs.promises.stat(tracePath);
      if (st.isDirectory()) {
        await fs.promises.rm(tracePath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(tracePath);
      }
      return;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      if (code === "ENOENT") {
        return;
      }
      const retryable =
        code === "EPERM" ||
        code === "EBUSY" ||
        code === "EACCES" ||
        code === "ENOTEMPTY";
      if (!retryable || attempt === ATTEMPTS - 1) {
        break;
      }
      await sleep(BASE_DELAY_MS * (attempt + 1));
    }
  }

  if (!fs.existsSync(tracePath)) {
    return;
  }

  console.warn(
    `[clean-next-trace] Trace still present; removing entire ${rel}/.next (Windows lock recovery).`,
  );
  for (let a = 0; a < FALLBACK_RM_ATTEMPTS; a++) {
    try {
      await fs.promises.rm(nextDir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      if (a === FALLBACK_RM_ATTEMPTS - 1) {
        console.warn(
          `[clean-next-trace] Could not remove ${nextDir} (${code}). Stop other Next.js processes and run: node scripts/clean-next-dir.cjs ${rel}`,
        );
      } else {
        await sleep(200 * (a + 1));
      }
    }
  }
})();
