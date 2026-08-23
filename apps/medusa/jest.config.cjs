const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });
require("dotenv").config({
  path: path.resolve(process.cwd(), ".env.local"),
  override: true,
});

function resolveMedusaPackageExport(packagePrefix, packageDir, exportPath) {
  const pnpmRoot = path.resolve(__dirname, "../../node_modules/.pnpm");
  const entries = fs
    .readdirSync(pnpmRoot)
    .filter((entry) => entry.startsWith(packagePrefix));
  const preferred = entries.find((entry) => entry.includes("2.17.2")) ?? entries[0];

  if (!preferred) {
    throw new Error(`Unable to resolve ${packagePrefix} from ${pnpmRoot}`);
  }

  return path.join(pnpmRoot, preferred, "node_modules", packageDir, exportPath);
}

const medusaFrameworkRoot = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/index.js",
);
const medusaFrameworkUtils = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/utils/index.js",
);
const medusaFrameworkTypes = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/types/index.js",
);
const medusaFrameworkHttp = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/http/index.js",
);
const medusaFrameworkWorkflowsSdk = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/workflows-sdk/index.js",
);
const medusaFrameworkWorkflowsSdkComposer = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/workflows-sdk/composer.js",
);
const medusaFrameworkMikroOrmCore = resolveMedusaPackageExport(
  "@medusajs+framework@",
  "@medusajs/framework",
  "dist/deps/mikro-orm-core.js",
);
const medusaRoot = resolveMedusaPackageExport(
  "@medusajs+medusa@",
  "@medusajs/medusa",
  "dist/index.js",
);
const medusaUtils = resolveMedusaPackageExport(
  "@medusajs+medusa@",
  "@medusajs/medusa",
  "dist/utils/index.js",
);
const medusaTypes = resolveMedusaPackageExport(
  "@medusajs+medusa@",
  "@medusajs/medusa",
  "dist/types/index.js",
);
const medusaCoreFlows = resolveMedusaPackageExport(
  "@medusajs+medusa@",
  "@medusajs/medusa",
  "dist/core-flows/index.js",
);

module.exports = {
  /** Keep haste-map / Jest cache inside the app (avoids EPERM when Node runs from Cursor’s install dir on Windows). */
  cacheDirectory: path.join(__dirname, ".jest-cache"),
  transform: {
    "^.+\\.(?:[jt]sx?|mts)$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "mts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  moduleNameMapper: {
    "^@universal-music-store/sdk/feature-flags$": path.resolve(__dirname, "../../packages/sdk/src/feature-flags.ts"),
    "^@medusajs/framework$": medusaFrameworkRoot,
    "^@medusajs/framework/utils$": medusaFrameworkUtils,
    "^@medusajs/framework/types$": medusaFrameworkTypes,
    "^@medusajs/framework/http$": medusaFrameworkHttp,
    "^@medusajs/framework/workflows-sdk$": medusaFrameworkWorkflowsSdk,
    "^@medusajs/framework/workflows-sdk/composer$": medusaFrameworkWorkflowsSdkComposer,
    "^@medusajs/framework/mikro-orm/core$": medusaFrameworkMikroOrmCore,
    "^@medusajs/medusa$": medusaRoot,
    "^@medusajs/medusa/utils$": medusaUtils,
    "^@medusajs/medusa/types$": medusaTypes,
    "^@medusajs/medusa/core-flows$": medusaCoreFlows,
  },
  setupFiles: ["./integration-tests/setup.cjs"],
};

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = [
    "**/src/**/__tests__/**/*.unit.spec.[jt]s",
    "**/src/api/**/*.unit.spec.[jt]s",
  ];
}
