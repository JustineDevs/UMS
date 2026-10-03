const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

test("moved E2E runner resolves the repository root and runtime lock", () => {
  const toolsDir = path.resolve(__dirname);
  const projectRoot = path.resolve(toolsDir, "..", "..", "..");
  assert.equal(path.basename(projectRoot), "UVS");
  assert.equal(require.resolve(path.join(projectRoot, "scripts/uvs-runtime-lock.cjs")), path.join(projectRoot, "scripts/uvs-runtime-lock.cjs"));
  assert.equal(path.join(projectRoot, "scripts", "stress-test"), path.resolve(toolsDir, ".."));
});
