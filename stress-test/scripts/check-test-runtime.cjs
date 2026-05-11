#!/usr/bin/env node

const path = require("node:path");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

function checkNode20() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (major !== 20) {
    throw new Error(
      `This repo's blocking test and release commands require Node 20. Current: ${process.version}. Switch to Node 20 before running stress or release gates.`,
    );
  }
}

function normalizeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "unknown error");
}

function nativeBindingHint(pkg, error) {
  const message = normalizeErrorMessage(error);
  const lower = message.toLowerCase();
  if (
    lower.includes("another platform") ||
    lower.includes("native binding") ||
    lower.includes("failed to load native binding")
  ) {
    return [
      `Native runtime mismatch while loading ${pkg}.`,
      "The current shell is not using dependencies installed for this OS/runtime.",
      "If you moved between Windows and WSL/Linux, reinstall dependencies inside the current environment before rerunning tests.",
    ].join(" ");
  }
  return message;
}

function requireInCwd(pkg, cwd) {
  const resolved = require.resolve(pkg, { paths: [cwd] });
  return require(resolved);
}

function assertEsbuildRuntime(cwd) {
  try {
    requireInCwd("esbuild", cwd);
  } catch (error) {
    throw new Error(nativeBindingHint("esbuild", error));
  }
}

function assertSwcRuntime(cwd) {
  try {
    requireInCwd("@swc/core", cwd);
  } catch (error) {
    throw new Error(nativeBindingHint("@swc/core", error));
  }
}

function checkRuntime(target, cwd = process.cwd()) {
  checkNode20();
  if (target === "esbuild") {
    assertEsbuildRuntime(cwd);
    return;
  }
  if (target === "swc") {
    assertSwcRuntime(cwd);
    return;
  }
  throw new Error(`Unknown runtime target: ${target}`);
}

if (require.main === module) {
  const target = process.argv[2];
  try {
    checkRuntime(target, process.cwd());
  } catch (error) {
    const script =
      path.relative(process.cwd(), __filename) || "stress-test/scripts/check-test-runtime.cjs";
    console.error(`\n[${script}] ${normalizeErrorMessage(error)}\n`);
    process.exit(1);
  }
}

module.exports = { checkRuntime };
