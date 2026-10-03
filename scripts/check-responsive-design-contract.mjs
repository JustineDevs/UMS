import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssFiles = [
  path.join(root, "apps/web/src/app/globals.css"),
  path.join(root, "apps/web/src/admin-globals.css"),
];

const expectedBands = [
  ["max-width: 379px", "base-to-379"],
  ["min-width: 380px) and (max-width: 639px", "380-to-639"],
  ["min-width: 640px) and (max-width: 767px", "640-to-767"],
  ["min-width: 768px) and (max-width: 1023px", "768-to-1023"],
  ["min-width: 1024px) and (max-width: 1279px", "1024-to-1279"],
  ["min-width: 1280px) and (max-width: 1535px", "1280-to-1535"],
  ["min-width: 1536px) and (max-width: 1919px", "1536-to-1919"],
  ["min-width: 1920px) and (max-width: 2559px", "1920-to-2559"],
  ["min-width: 2560px", "2560-plus"],
];

const failures = [];
for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  if (!source.includes("--responsive-viewport-min: 0px")) {
    failures.push(`${relative}: missing --responsive-viewport-min: 0px`);
  }
  if (!source.includes("--responsive-viewport-max: 100vw")) {
    failures.push(`${relative}: missing --responsive-viewport-max: 100vw`);
  }
  for (const [needle, label] of expectedBands) {
    if (!source.includes(`@media (${needle}`)) {
      failures.push(`${relative}: missing explicit ${label} media band`);
    }
  }
}

function sourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(fullPath));
    else if (/\.(?:tsx?|css)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

for (const directory of [path.join(root, "apps/web/src"), path.join(root, "packages")]) {
  for (const file of sourceFiles(directory)) {
  const source = fs.readFileSync(file, "utf8");
  // Tailwind arbitrary values encode calc() whitespace with underscores. A
  // bare subtraction is invalid CSS and silently drops the responsive rule.
  if (/calc\([^)]*[a-z%0-9)]-[0-9]/i.test(source)) {
    failures.push(`${path.relative(root, file)}: malformed calc() subtraction without spacing`);
  }
  }
}

const viewportHelper = fs.readFileSync(path.join(root, "scripts/stress-test/e2e/helpers/viewports.ts"), "utf8");
for (const [needle, label] of [
  ["name: \"zeroTo379\", min: 0, max: 379", "0-to-379 test band"],
  ["name: \"cinema\", min: 2560", "2560-plus test band"],
]) {
  if (!viewportHelper.includes(needle)) failures.push(`viewports.ts: missing ${label}`);
}

if (failures.length) {
  console.error("[responsive-contract] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("[responsive-contract] 0px-to-max CSS bands and viewport matrix are explicit");
}
