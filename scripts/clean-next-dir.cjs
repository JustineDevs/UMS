"use strict";

/**
 * Removes `<app>/.next` before `next build`. Used from app package.json so the path
 * does not depend on `stress-test/` (that tree may be absent on hosts that do not ship it).
 * On Windows, a single rm can fail with ENOTEMPTY/EPERM when handles are still releasing.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const rel = process.argv[2] || "apps/storefront";
const nextDir = path.join(root, rel, ".next");

const ATTEMPTS = 10;
const BASE_DELAY_MS = 200;

async function removeNextDir() {
  if (!fs.existsSync(nextDir)) {
    return;
  }

  let lastErr = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      await fs.promises.rm(nextDir, { recursive: true, force: true });
      return;
    } catch (err) {
      lastErr = err;
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      const retryable =
        code === "ENOTEMPTY" ||
        code === "EPERM" ||
        code === "EBUSY" ||
        code === "EACCES" ||
        code === "EMFILE";
      if (!retryable || attempt === ATTEMPTS - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * (attempt + 1)));
    }
  }
  if (lastErr) throw lastErr;
}

function lockErrorCode(err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : "";
  return code === "EPERM" ||
    code === "EBUSY" ||
    code === "EACCES" ||
    code === "ENOTEMPTY"
    ? code
    : "";
}

(async () => {
  if (process.env.SKIP_NEXT_CLEAN === "1") {
    console.warn(
      `[clean-next-dir] SKIP_NEXT_CLEAN=1 set; leaving ${rel}/.next in place.`,
    );
    return;
  }
  try {
    await removeNextDir();
  } catch (err) {
    const code = lockErrorCode(err);
    if (code) {
      console.warn(
        `[clean-next-dir] Cannot remove ${rel}/.next (${code}) after ${ATTEMPTS} attempts.`,
      );
      console.warn(
        "[clean-next-dir] Another process is likely using that folder (often `next dev`).",
      );
      console.warn(
        "[clean-next-dir] Continuing with `next build` anyway. For a fully clean build, stop the dev server, delete .next manually, or set SKIP_NEXT_CLEAN=1 and remove .next when idle.",
      );
      return;
    }
    console.error("[clean-next-dir]", err);
    process.exit(1);
  }
})();
