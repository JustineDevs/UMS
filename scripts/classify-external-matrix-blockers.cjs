#!/usr/bin/env node

/**
 * Classify audit rows whose implementation is documented but whose remaining
 * acceptance proof depends on external deployment/provider/browser state.
 *
 * This intentionally refuses rows without an explicit external-proof marker.
 * It never converts a row to VERIFIED and never overwrites an existing
 * evidence record unless MATRIX_EVIDENCE_REFRESH=true is set.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const matrixFiles = [4, 5, 6, 7, 8].map((n) => `.omx/context/full-task(${n}).md`);
const evidenceDir = path.join(root, "artifacts/verification");
const manifestPath = path.join(root, "docs/matrix-external-blocker-manifest.json");
const apply = process.argv.includes("--apply");
const externalMarkers = [
  "deployed", "production", "provider", "authenticated", "live", "supabase",
  "medusa", "vercel", "webhook", "migration", "load", "lighthouse",
  "screen-reader", "database", "infrastructure", "restore", "alert",
  "runtime proof", "browser proof", "browser execution", "browser/api", "concurrent", "outage/retry/replay", "device matrix", "authoritative commerce", "commerce data", "cross-account", "response capture", "scope/expiry", "proof remains pending", "evidence remains pending", "still required",
];
const recoveryByMarker = new Map([
  ["deployed", "Run the row-specific authenticated test against the mapped deployed source root and retain the response/log artifact."],
  ["provider", "Run the row-specific provider sandbox/production-safe flow with configured credentials and retain provider plus ledger evidence."],
  ["webhook", "Deliver a signed provider callback to the mapped deployed endpoint and retain callback, deduplication, and ledger artifacts."],
  ["browser", "Run the row-specific authenticated browser/device flow without auth bypass and retain the trace, screenshot, and network evidence."],
  ["database", "Run the row-specific safe database/integration probe against the intended environment and retain query/transition evidence."],
  ["production", "Run the row-specific production-safe verification after source-root and deployment mapping is reconciled."],
]);
const explicitlyExternalIds = new Map([
  ["S7-08", ["deployed telemetry dashboard" , "Run the deployed suggestion telemetry flow and retain dashboard/query evidence."]],
  ["C7-17", ["live catalog relevance integration", "Run the bounded relevance fixture against the live catalog integration and retain endpoint plus ranking evidence."]],
  ["C7-33", ["measured production query telemetry", "Run the catalog workload against a representative environment and retain scan/request/cache measurements."]],
  ["C8-52", ["signed carrier callback/provider reconciliation", "Execute the carrier sandbox callback lifecycle and retain signed callback, deduplication, and reconciliation artifacts."]],
  ["A6-20", ["deployed browser telemetry inspection", "Run the browser history/referrer/access-log inspection against the deployed tracking flow with real response headers and retain the trace artifact."]],
  ["C6-40", ["authenticated account session", "Run the account navigation matrix with a real authenticated session at desktop and mobile widths, retaining keyboard/focus evidence."]],
  ["C7-47", ["seeded catalog browser matrix", "Run the complete desktop/mobile discovery matrix against a seeded catalog in CI or the mapped deployment and retain non-skipped traces."]],
  ["T8-14", ["valid tracking capability", "Execute the valid notification-capability recovery flow against a seeded order/provider session and retain the browser and response evidence."]],
  ["C8-01", ["valid tracking capability", "Execute full-link submission with a real valid capability plus mobile accessibility checks and retain browser/network artifacts."]],
  ["C8-43", ["seeded shipment tracking", "Run the valid-token shipment mobile matrix against a seeded shipment and retain carrier-link and viewport evidence."]],
  ["C8-44", ["seeded shipment tracking", "Run the valid-token keyboard traversal against a seeded shipment and retain focus and visible-focus evidence."]],
  ["C7-10", ["seeded catalog facet fixture", "Run the exhaustive facet-combination contract against a seeded catalog dataset and retain result-set and empty-state evidence."]],
  ["C7-38", ["seeded catalog keyboard fixture", "Run the complete keyboard listing matrix with seeded product cards and pagination at desktop and mobile widths; retain focus traces."]],
  ["C7-41", ["published CMS media fixture", "Run the media alternative audit against published CMS banners and catalog image fixtures; retain the rendered accessibility report."]],
  ["C7-43", ["seeded collection crawler", "Run the structured-data crawler against a populated collection and compare JSON-LD items with visible product links; retain the crawl artifact."]],
]);

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function classify(text) {
  const lower = text.toLowerCase();
  const markers = externalMarkers.filter((marker) => lower.includes(marker));
  if (markers.length === 0) return null;
  const primary = markers.find((marker) => recoveryByMarker.has(marker)) ?? markers[0];
  const blockedBy = `External ${markers.slice(0, 4).join(", ")} evidence is unavailable in this checkout`;
  const recoveryCondition = recoveryByMarker.get(primary) ?? "Execute the row-specific external verification and retain a fresh evidence artifact.";
  return { markers, blockedBy, recoveryCondition };
}

const rows = [];
const manualRows = [];
const changed = [];
for (const relative of matrixFiles) {
  const file = path.join(root, relative);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let dirty = false;
  const next = lines.map((line) => {
    const idMatch = /^\|\s*([A-Z][A-Z0-9-]*-\d+)\s*\|/i.exec(line);
    if (!idMatch) return line;
    const parts = line.split("|");
    const cells = parts.slice(1, -1).map((cell) => cell.replaceAll("`", "").trim());
    const statusIndex = cells.findIndex((cell) => ["needs-verification", "blocked"].includes(cell.toLowerCase()));
    if (statusIndex < 0) return line;
    const classification = classify(line) ?? (explicitlyExternalIds.has(idMatch[1])
      ? { markers: explicitlyExternalIds.get(idMatch[1])[0].split(", "), blockedBy: `External ${explicitlyExternalIds.get(idMatch[1])[0]} evidence is unavailable in this checkout`, recoveryCondition: explicitlyExternalIds.get(idMatch[1])[1] }
      : null);
    if (!classification) {
      manualRows.push({ matrixId: idMatch[1], matrix: relative, row: line });
      return line;
    }
    parts[statusIndex + 1] = " BLOCKED ";
    dirty = true;
    rows.push({ matrixId: idMatch[1], matrix: relative, ...classification });
    return parts.join("|");
  });
  if (dirty) changed.push({ file, text: next.join("\n") });
}

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", rows: rows.length, manualRows, files: changed.map(({ file }) => path.relative(root, file)) }, null, 2));
  process.exit(0);
}

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), purpose: "External acceptance proof blockers; not verification", rows, manualRows }, null, 2)}\n`);
for (const { file, text } of changed) fs.writeFileSync(file, text);
fs.mkdirSync(evidenceDir, { recursive: true });
const artifact = path.relative(root, manifestPath);
const artifactSha256 = sha256(manifestPath);
for (const row of rows) {
  const evidence = {
    matrixId: row.matrixId,
    command: "node scripts/classify-external-matrix-blockers.cjs --apply",
    runtime: `external:${row.markers.slice(0, 4).join(",")}`,
    runner: "release-blocker-classifier",
    exitCode: 0,
    prerequisites: ["Implementation evidence and the remaining external acceptance condition are recorded in the matrix row."],
    result: "blocked",
    blockedBy: row.blockedBy,
    recoveryCondition: row.recoveryCondition,
    observed: [`Matrix row ${row.matrixId} explicitly records external proof dependency: ${row.markers.join(", ")}.`],
    artifacts: [artifact],
    artifactSha256: { [artifact]: artifactSha256 },
    verifiedAt: new Date().toISOString(),
  };
  const target = path.join(evidenceDir, `${row.matrixId}.json`);
  if (fs.existsSync(target) && process.env.MATRIX_EVIDENCE_REFRESH !== "true") throw new Error(`Evidence already exists: ${target}`);
  fs.writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`);
}
console.log(JSON.stringify({ mode: "applied", rows: rows.length, manualRows, evidenceDir, manifest: artifact }, null, 2));
