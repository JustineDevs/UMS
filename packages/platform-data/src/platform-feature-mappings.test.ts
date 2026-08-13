import assert from "node:assert/strict";
import test from "node:test";
import { buildPlatformFeatureMappingMetadata, buildPublicPlatformFeatureMappingMetadata, PLATFORM_FEATURE_MAPPINGS } from "./platform-feature-mappings.js";

test("platform mappings cover the requested operational domains", () => {
  assert.deepEqual([...new Set(PLATFORM_FEATURE_MAPPINGS.map((mapping) => mapping.domain))].sort(), [
    "crm",
    "integrations",
    "logistics",
    "multi_channel",
    "payroll_remittance",
    "pos",
    "support",
  ]);
  const meta = buildPlatformFeatureMappingMetadata();
  assert.equal(meta.coverage.total, 7);
  assert.equal(meta.coverage.planned, 1);
});

test("public mapping omits internal admin and API surfaces", () => {
  const publicMappings = buildPublicPlatformFeatureMappingMetadata();
  assert.equal(publicMappings.length, PLATFORM_FEATURE_MAPPINGS.length);
  for (const mapping of publicMappings) {
    assert.equal("adminSurfaces" in mapping, false);
    assert.equal("apiSurfaces" in mapping, false);
    assert.equal("dataFlow" in mapping, false);
  }
});
