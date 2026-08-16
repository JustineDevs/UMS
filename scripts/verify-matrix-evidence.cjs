#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const matrixPath = path.join(root, ".omx/context/full-task(1).md");
const evidenceDir = path.resolve(process.env.MATRIX_EVIDENCE_DIR ?? "artifacts/verification");
const requireHttps = process.env.MATRIX_REQUIRE_HTTPS === "1";
const httpsRows = new Set(["PAY-01", "PAY-04", "PAY-05", "PAY-06", "PAY-08", "PAY-09", "PAY-10", "PAY-11", "PAY-12", "QA-05", "QA-10"]);
const browserProofRows = new Set([
  "CMS-01", "CMS-02", "CMS-03", "CMS-04", "CMS-05", "CMS-06", "CMS-07",
  "CMS-08", "CMS-09", "CMS-10", "CMS-11", "QA-01", "QA-02", "QA-04",
  "QA-05", "QA-08", "QA-10",
]);
const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const matrix = fs.readFileSync(matrixPath, "utf8");
const rows = [...matrix.matchAll(/^\|\s*([A-Z]+-\d+)\s*\|.*?\|\s*(pending|implemented|verified|blocked)\s*\|$/gm)]
  .map((match) => ({ id: match[1], status: match[2] }));
const expected = new Map(rows.map((row) => [row.id, row]));
const files = fs.existsSync(evidenceDir)
  ? fs.readdirSync(evidenceDir).filter((file) => file.endsWith(".json"))
  : [];
const errors = [];
const evidence = new Map();

for (const file of files) {
  const filePath = path.join(evidenceDir, file);
  let record;
  try {
    record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    continue;
  }
  if (!record || typeof record !== "object" || typeof record.matrixId !== "string") {
    errors.push(`${file}: matrixId is required`);
    continue;
  }
  if (evidence.has(record.matrixId)) errors.push(`${file}: duplicate evidence for ${record.matrixId}`);
  if (!expected.has(record.matrixId)) errors.push(`${file}: unknown matrixId ${record.matrixId}`);
  for (const key of ["command", "runtime", "runner", "result", "verifiedAt"]) {
    if (!nonEmptyString(record[key])) errors.push(`${file}: ${key} is required`);
  }
  if (!Number.isInteger(record.exitCode)) errors.push(`${file}: exitCode must be an integer from the executed runner`);
  if (record.exitCode !== 0) errors.push(`${file}: exitCode must be 0, got ${record.exitCode}`);
  if (record.result !== "pass") errors.push(`${file}: result must be pass, got ${record.result}`);
  if (browserProofRows.has(record.matrixId)) {
    if (/\bAUTH_DISABLED\s*=\s*true\b|\bAUTH_DISABLE\s*=\s*true\b/i.test(record.command)) {
      errors.push(`${file}: auth-disabled command cannot prove browser acceptance criteria`);
    }
    const observed = Array.isArray(record.observed) ? record.observed.join(" ") : "";
    if (/\b(skip|skipped|skip_no_ui|unavailable)\b/i.test(observed)) {
      errors.push(`${file}: skipped or unavailable browser evidence cannot prove acceptance criteria`);
    }
  }
  for (const key of ["prerequisites", "observed", "artifacts"]) {
    if (!Array.isArray(record[key]) || record[key].length === 0 || record[key].some((item) => !nonEmptyString(item))) {
      errors.push(`${file}: ${key} must contain non-empty strings`);
    }
  }
  const verifiedAt = Date.parse(record.verifiedAt);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(record.verifiedAt) || !Number.isFinite(verifiedAt) || verifiedAt > Date.now() + 60_000 || Date.now() - verifiedAt > 24 * 60 * 60 * 1000) {
    errors.push(`${file}: verifiedAt must be a fresh UTC ISO timestamp`);
  }
  if ((requireHttps || httpsRows.has(record.matrixId)) && !/^https:\/\/[^\s/]+/i.test(record.runtime)) {
    errors.push(`${file}: runtime must be an HTTPS URL, got ${record.runtime}`);
  }
  if (httpsRows.has(record.matrixId)) {
    if (!/^https:\/\/[^\s/]+/i.test(record.callbackUrl ?? "")) errors.push(`${file}: callbackUrl must be HTTPS`);
    if (!Number.isInteger(record.callbackStatus) || record.callbackStatus < 200 || record.callbackStatus >= 500) errors.push(`${file}: callbackStatus must prove a reachable callback`);
  }
  for (const artifact of Array.isArray(record.artifacts) ? record.artifacts : []) {
    const artifactPath = typeof artifact === "string" ? artifact.trim() : "";
    const absolute = artifactPath ? path.resolve(root, artifactPath) : "";
    if (!artifactPath || absolute === root || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      errors.push(`${file}: missing file artifact ${artifactPath}`);
      continue;
    }
    const expectedHash = record.artifactSha256?.[artifactPath];
    if (!nonEmptyString(expectedHash)) {
      errors.push(`${file}: artifactSha256 is required for ${artifactPath}`);
    } else {
      const actualHash = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
      if (actualHash !== expectedHash) errors.push(`${file}: artifact hash mismatch for ${artifactPath}`);
    }
  }
  if (!evidence.has(record.matrixId)) evidence.set(record.matrixId, file);
}

const missing = rows.filter((row) => !evidence.has(row.id));
if (missing.length) errors.push(`missing evidence: ${missing.map((row) => row.id).join(", ")}`);
const unverified = rows.filter((row) => row.status !== "verified");
if (unverified.length) errors.push(`matrix contains non-verified rows: ${unverified.map((row) => `${row.id}=${row.status}`).join(", ")}`);

const summary = {
  matrix: matrixPath,
  evidenceDir,
  totalRows: rows.length,
  verifiedRows: rows.filter((row) => row.status === "verified").length,
  evidenceRecords: evidence.size,
  missingRows: missing.map((row) => row.id),
  errors,
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = errors.length ? 1 : 0;
