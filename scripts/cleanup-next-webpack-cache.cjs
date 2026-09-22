"use strict";

const fs = require("node:fs");
const path = require("node:path");

function cleanupLocalWebpackCache(appRoot, isVercelBuild) {
  // Vercel manages its own cache. Local production builds start clean, so
  // retaining webpack's large cache has no incremental-build reuse benefit.
  if (isVercelBuild) return;

  const webpackCache = path.join(
    appRoot,
    ".next-production",
    "cache",
    "webpack",
  );
  fs.rmSync(webpackCache, { recursive: true, force: true });
}

if (require.main === module) {
  const repoRoot = path.join(__dirname, "..");
  cleanupLocalWebpackCache(
    path.join(repoRoot, "apps", "web"),
    process.env.VERCEL === "1",
  );
}

module.exports = { cleanupLocalWebpackCache };
