import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertWorkerBackendEnvProduction,
  listMissingWorkerBackendEnv,
} from "./storefront-runtime-env";

test("worker backend production configuration requires an HTTPS API_URL", () => {
  assert.deepEqual(listMissingWorkerBackendEnv({ NODE_ENV: "test" }), ["API_URL"]);
  assert.deepEqual(listMissingWorkerBackendEnv({ NODE_ENV: "test", API_URL: "http://api.example.test" }), [
    "API_URL must use HTTPS in production",
  ]);
  assert.deepEqual(listMissingWorkerBackendEnv({ NODE_ENV: "test", API_URL: "https://localhost:8787" }), [
    "API_URL must not point to a loopback host in production",
  ]);
  assert.deepEqual(listMissingWorkerBackendEnv({ NODE_ENV: "test", API_URL: "https://worker.example.test" }), []);
});

test("production startup fails closed without Worker backend configuration", () => {
  assert.throws(
    () => assertWorkerBackendEnvProduction({ NODE_ENV: "production" }),
    /API_URL/,
  );
  assert.doesNotThrow(() =>
    assertWorkerBackendEnvProduction({ NODE_ENV: "development" }),
  );
});
