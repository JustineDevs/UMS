#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function resolvePinnedMedusaVersion(repoRoot) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "apps", "medusa", "package.json"), "utf8"),
    );
    return (
      pkg.dependencies?.["@medusajs/medusa"] ||
      pkg.devDependencies?.["@medusajs/medusa"] ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function candidateCommandPaths(repoRoot, commandFileName) {
  const paths = [];
  const appLocal = path.join(
    repoRoot,
    "apps",
    "medusa",
    "node_modules",
    "@medusajs",
    "medusa",
    "dist",
    "commands",
    commandFileName,
  );
  paths.push(appLocal);

  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  const pinnedVersion = resolvePinnedMedusaVersion(repoRoot);
  if (!fs.existsSync(pnpmDir)) {
    return paths;
  }

  const entries = fs
    .readdirSync(pnpmDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("@medusajs+medusa@"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const preferredEntries = pinnedVersion
    ? entries.filter((entry) => entry.name.includes(`@medusajs+medusa@${pinnedVersion}`))
    : entries;

  for (const entry of [...preferredEntries, ...entries]) {
    if (!entry.isDirectory() || !entry.name.startsWith("@medusajs+medusa@")) {
      continue;
    }
    const candidate = path.join(
      pnpmDir,
      entry.name,
      "node_modules",
      "@medusajs",
      "medusa",
      "dist",
      "commands",
      commandFileName,
    );
    if (paths.includes(candidate)) {
      continue;
    }
    paths.push(candidate);
  }

  return paths;
}

function resolveMedusaCommand(repoRoot, commandFileName) {
  for (const candidate of candidateCommandPaths(repoRoot, commandFileName)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to resolve Medusa command file ${commandFileName} from ${repoRoot}`,
  );
}

module.exports = { resolveMedusaCommand };
