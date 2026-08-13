#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const childProcess = require("node:child_process");
const { resolveMedusaCommand } = require("./resolve-medusa-command.cjs");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;
const originalFork = childProcess.fork;

function resolvePinnedMedusaVersion() {
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

function resolvePinnedPackagePath(packageName, preferredVersion = "") {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) {
    return "";
  }

  const packagePrefix = packageName.replace("/", "+");
  const entries = fs
    .readdirSync(pnpmDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(`${packagePrefix}@`),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const preferredEntries = preferredVersion
    ? entries.filter((entry) => entry.name.includes(`${packagePrefix}@${preferredVersion}`))
    : entries;

  for (const entry of [...preferredEntries, ...entries]) {
    const candidate = path.join(
      pnpmDir,
      entry.name,
      "node_modules",
      packageName,
    );
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

function resolvePinnedMedusaPackagePath(request) {
  if (typeof request !== "string" || !request.startsWith("@medusajs/")) {
    return "";
  }

  const packageName = request.split("/").slice(0, 2).join("/");
  return resolvePinnedPackagePath(packageName, resolvePinnedMedusaVersion());
}

const pinnedMedusaVersion = resolvePinnedMedusaVersion();
const frameworkPackagePath =
  resolvePinnedPackagePath("@medusajs/framework", pinnedMedusaVersion) || "";

function resolveFrameworkExportPath(request) {
  if (request === "@medusajs/framework") {
    return path.join(frameworkPackagePath, "dist", "index.js");
  }

  if (!request.startsWith("@medusajs/framework/")) {
    return "";
  }

  const exportName = request.slice("@medusajs/framework/".length);
  const directFile = path.join(
    frameworkPackagePath,
    "dist",
    `${exportName}.js`,
  );
  if (fs.existsSync(directFile)) {
    return directFile;
  }

  const nestedIndex = path.join(
    frameworkPackagePath,
    "dist",
    exportName,
    "index.js",
  );
  if (fs.existsSync(nestedIndex)) {
    return nestedIndex;
  }

  return "";
}

function resolveMedusaExportPath(packageName, packageRoot, request) {
  if (!packageRoot) {
    return "";
  }

  if (request === packageName) {
    return path.join(packageRoot, "dist", "index.js");
  }

  if (request === `${packageName}/package.json`) {
    return path.join(packageRoot, "package.json");
  }

  if (!request.startsWith(`${packageName}/`)) {
    return "";
  }

  let exportName = request.slice(`${packageName}/`.length);
  if (exportName.startsWith("src/")) {
    exportName = exportName.slice("src/".length);
  }
  exportName = exportName.replace(/\.(?:c|m)?(?:t|j)sx?$/i, "");
  const candidates = [
    path.join(packageRoot, "dist", `${exportName}.js`),
    path.join(packageRoot, "dist", exportName, "index.js"),
    path.join(packageRoot, "dist", "modules", `${exportName}.js`),
    path.join(packageRoot, "dist", "modules", exportName, "index.js"),
    path.join(packageRoot, "dist", "commands", `${exportName}.js`),
    path.join(packageRoot, "dist", "commands", exportName, "index.js"),
    path.join(packageRoot, "dist", "loaders", `${exportName}.js`),
    path.join(packageRoot, "dist", "loaders", exportName, "index.js"),
    path.join(packageRoot, "dist", "jobs", `${exportName}.js`),
    path.join(packageRoot, "dist", "jobs", exportName, "index.js"),
    path.join(packageRoot, "dist", "subscribers", `${exportName}.js`),
    path.join(packageRoot, "dist", "subscribers", exportName, "index.js"),
    path.join(packageRoot, "dist", "feature-flags", `${exportName}.js`),
    path.join(packageRoot, "dist", "feature-flags", exportName, "index.js"),
    path.join(packageRoot, "dist", "core-flows", `${exportName}.js`),
    path.join(packageRoot, "dist", "core-flows", exportName, "index.js"),
    path.join(packageRoot, "dist", "utils", `${exportName}.js`),
    path.join(packageRoot, "dist", "utils", exportName, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

function resolveCwdStub() {}

resolveCwdStub.silent = function patchedResolveCwdSilent(specifier) {
  const prefix = "@medusajs/medusa/commands/";
  if (typeof specifier === "string" && specifier.startsWith(prefix)) {
    const commandFileName = `${specifier.slice(prefix.length)}.js`;
    return resolveMedusaCommand(repoRoot, commandFileName);
  }
  return undefined;
};
resolveCwdStub.default = resolveCwdStub;
resolveCwdStub.__esModule = true;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "resolve-cwd") {
    return resolveCwdStub;
  }
  if (request === "@medusajs/framework/zod" && frameworkPackagePath) {
    const depsZodPath = path.join(
      frameworkPackagePath,
      "dist",
      "deps",
      "zod.js",
    );
    const zodHelpersPath = path.join(
      frameworkPackagePath,
      "dist",
      "zod",
      "zod-helpers.js",
    );
    const depsZod = originalLoad.call(this, depsZodPath, parent, isMain);
    const zodHelpers = originalLoad.call(this, zodHelpersPath, parent, isMain);
    return {
      ...depsZod,
      zodValidator: zodHelpers.zodValidator,
      default: depsZod,
      __esModule: true,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

Module._resolveFilename = function patchedResolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  if (typeof request === "string" && request.startsWith("@medusajs/")) {
    const packageName = request.split("/").slice(0, 2).join("/");
    const medusaPackagePath = resolvePinnedPackagePath(
      packageName,
      pinnedMedusaVersion,
    );
    if (medusaPackagePath && request === packageName) {
      return path.join(medusaPackagePath, "dist", "index.js");
    }

    if (medusaPackagePath && request === `${packageName}/package.json`) {
      return path.join(medusaPackagePath, "package.json");
    }
  }

  if (
    frameworkPackagePath &&
    typeof request === "string" &&
    request.startsWith("@medusajs/framework")
  ) {
    const candidate = resolveFrameworkExportPath(request) ||
      resolveMedusaExportPath("@medusajs/framework", frameworkPackagePath, request);
    if (candidate) {
      return candidate;
    }
  }

  if (
    typeof request === "string" &&
    request.startsWith("@medusajs/") &&
    !request.startsWith("@medusajs/framework")
  ) {
    const packageName = request.split("/").slice(0, 2).join("/");
    const packagePath =
      resolvePinnedPackagePath(packageName, pinnedMedusaVersion) || "";
    const candidate = resolveMedusaExportPath(packageName, packagePath, request);
    if (candidate) {
      return candidate;
    }
  }

  if (request === "inngest" || request.startsWith("inngest/")) {
    const packagePath = resolvePinnedPackagePath("inngest");
    if (packagePath) {
      if (request === "inngest") {
        const candidate = path.join(packagePath, "index.js");
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } else {
        let exportName = request.slice("inngest/".length);
        exportName = exportName.replace(/\.(?:c|m)?(?:t|j)sx?$/i, "");
        const candidateFiles = [
          path.join(packagePath, `${exportName}.js`),
          path.join(packagePath, exportName, "index.js"),
        ];
        for (const candidate of candidateFiles) {
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

childProcess.fork = function patchedFork(modulePath, args, options) {
  const nextOptions = { ...(options || {}) };
  const currentExecArgv = Array.isArray(process.execArgv)
    ? process.execArgv
    : [];
  const forkExecArgv = Array.isArray(nextOptions.execArgv)
    ? nextOptions.execArgv
    : [];

  if (forkExecArgv.length > 0 || currentExecArgv.length > 0) {
    const mergedExecArgv = [];
    for (const arg of [...currentExecArgv, ...forkExecArgv]) {
      if (!mergedExecArgv.includes(arg)) {
        mergedExecArgv.push(arg);
      }
    }
    nextOptions.execArgv = mergedExecArgv;
  }

  return originalFork.call(this, modulePath, args, nextOptions);
};
