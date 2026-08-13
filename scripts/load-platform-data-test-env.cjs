const path = require("node:path");
const { loadMonorepoRootEnv } = require("./load-monorepo-root-env.cjs");

loadMonorepoRootEnv(path.resolve(__dirname, "..", "packages", "platform-data"));
