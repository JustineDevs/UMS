"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { cleanupLocalWebpackCache } = require("./cleanup-next-webpack-cache.cjs");

test("local post-build cleanup removes webpack cache only", (t) => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uvs-next-cleanup-"));
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));

  const cacheRoot = path.join(appRoot, ".next-production", "cache");
  const webpackCache = path.join(cacheRoot, "webpack", "server-production");
  const runtimeCache = path.join(cacheRoot, "images");
  fs.mkdirSync(webpackCache, { recursive: true });
  fs.mkdirSync(runtimeCache, { recursive: true });
  fs.writeFileSync(path.join(webpackCache, "0.pack"), "build cache");
  fs.writeFileSync(path.join(runtimeCache, "image.bin"), "runtime cache");

  cleanupLocalWebpackCache(appRoot, false);

  assert.equal(fs.existsSync(path.join(cacheRoot, "webpack")), false);
  assert.equal(fs.existsSync(path.join(runtimeCache, "image.bin")), true);
});

test("Vercel post-build preserves its managed webpack cache", (t) => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uvs-vercel-cleanup-"));
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));

  const webpackCache = path.join(
    appRoot,
    ".next-production",
    "cache",
    "webpack",
  );
  fs.mkdirSync(webpackCache, { recursive: true });
  fs.writeFileSync(path.join(webpackCache, "0.pack"), "build cache");

  cleanupLocalWebpackCache(appRoot, true);

  assert.equal(fs.existsSync(path.join(webpackCache, "0.pack")), true);
});
