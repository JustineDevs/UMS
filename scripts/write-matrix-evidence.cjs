#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const [matrixId, command, runtime, runner, exitCodeRaw, observedJson, artifactsJson, callbackUrl, callbackStatus] = process.argv.slice(2);
if (!matrixId || !command || !runtime || !runner || exitCodeRaw === undefined || !observedJson || !artifactsJson) {
  console.error("usage: write-matrix-evidence <matrixId> <command> <runtime> <runner> <exit-code> <observed-json> <artifacts-json> [callback-url] [callback-status]");
  process.exit(2);
}
const exitCode = Number(exitCodeRaw);
if (!Number.isInteger(exitCode) || exitCode !== 0) throw new Error(`exit-code must be 0, got ${exitCodeRaw}`);
const parseArray = (value, label) => {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be a non-empty string array`);
  return parsed.map((item) => item.trim());
};
const record = {
  matrixId,
  command,
  runtime,
  runner,
  exitCode,
  prerequisites: ["fresh targeted run completed without skip"],
  result: "pass",
  observed: parseArray(observedJson, "observed"),
  artifacts: parseArray(artifactsJson, "artifacts"),
  verifiedAt: new Date().toISOString(),
};
if (callbackUrl) record.callbackUrl = callbackUrl;
if (callbackStatus) record.callbackStatus = Number(callbackStatus);
record.artifactSha256 = Object.fromEntries(record.artifacts.map((artifact) => {
  const absolute = path.resolve(process.cwd(), artifact);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`missing artifact: ${artifact}`);
  return [artifact, crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")];
}));
const dir = path.resolve(process.env.MATRIX_EVIDENCE_DIR ?? "artifacts/verification");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${matrixId}.json`);
if (fs.existsSync(file) && process.env.MATRIX_EVIDENCE_REFRESH !== "true") {
  throw new Error(`Evidence already exists for ${matrixId}; do not overwrite proof`);
}
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(file);
