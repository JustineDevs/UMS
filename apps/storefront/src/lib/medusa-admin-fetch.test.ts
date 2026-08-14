import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MedusaAdminConfigurationError,
  medusaAdminFetch,
} from "./medusa-admin-fetch";
import {
  ensureStorefrontRuntimeEnvLoaded,
  resetStorefrontRuntimeEnvForTests,
} from "./storefront-runtime-env";

const RUNTIME_ENV_KEYS = [
  "MEDUSA_SECRET_API_KEY",
  "MEDUSA_ADMIN_API_SECRET",
  "MEDUSA_BACKEND_URL",
  "NEXT_PUBLIC_MEDUSA_URL",
  "MEDUSA_REGION_ID",
  "NEXT_PUBLIC_MEDUSA_REGION_ID",
  "MEDUSA_PUBLISHABLE_API_KEY",
  "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
] as const;

async function withTempWorkspace(
  files: Record<string, string>,
  run: (_workspaceDir: string) => Promise<void>,
): Promise<void> {
  const cwdBeforeTemp = process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storefront-env-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(tempDir, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
    }
    await run(tempDir);
  } finally {
    try {
      process.chdir(cwdBeforeTemp);
    } catch {
      process.chdir(os.tmpdir());
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function clearRuntimeEnv(): void {
  for (const key of RUNTIME_ENV_KEYS) {
    delete process.env[key];
  }
}

test("medusaAdminFetch loads repo-root env for storefront runtime paths", async () => {
  const beforeCwd = process.cwd();
  const beforeFetch = global.fetch;
  clearRuntimeEnv();
  resetStorefrontRuntimeEnvForTests();

  await withTempWorkspace(
    {
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      ".env.local": [
        "MEDUSA_SECRET_API_KEY=sk_repo_root",
        "MEDUSA_BACKEND_URL=https://repo-root.example.com/",
      ].join("\n"),
      "apps/storefront/package.json": "{}\n",
    },
    async (workspaceDir) => {
      const storefrontDir = path.join(workspaceDir, "apps/storefront");
      process.chdir(storefrontDir);
      ensureStorefrontRuntimeEnvLoaded();
      let calledUrl = "";
      let authHeader = "";
      global.fetch = (async (input, init) => {
        calledUrl = String(input);
        authHeader = new Headers(init?.headers).get("Authorization") ?? "";
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      const res = await medusaAdminFetch("/admin/regions/reg_123", {
        method: "GET",
      });

      assert.equal(res.status, 200);
      assert.equal(
        calledUrl,
        "https://repo-root.example.com/admin/regions/reg_123",
      );
      assert.equal(authHeader, "Basic c2tfcmVwb19yb290Og==");
    },
  );

  global.fetch = beforeFetch;
  process.chdir(beforeCwd);
  clearRuntimeEnv();
  resetStorefrontRuntimeEnvForTests();
});

test("medusaAdminFetch throws MedusaAdminConfigurationError when secret is unset", async () => {
  const beforeCwd = process.cwd();
  clearRuntimeEnv();
  resetStorefrontRuntimeEnvForTests();
  process.chdir(beforeCwd);

  await assert.rejects(
    medusaAdminFetch("/admin/test", { method: "GET" }),
    (err: unknown) => {
      assert.ok(err instanceof MedusaAdminConfigurationError);
      return true;
    },
  );

  clearRuntimeEnv();
  resetStorefrontRuntimeEnvForTests();
});

test("medusaAdminFetch keeps explicit process env over repo-root dotenv values", async () => {
  const beforeCwd = process.cwd();
  const beforeFetch = global.fetch;
  process.env.MEDUSA_SECRET_API_KEY = "sk_process";
  process.env.MEDUSA_BACKEND_URL = "https://process.example.com";
  resetStorefrontRuntimeEnvForTests();

  await withTempWorkspace(
    {
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      ".env.local": [
        "MEDUSA_SECRET_API_KEY=sk_repo_root",
        "MEDUSA_BACKEND_URL=https://repo-root.example.com/",
      ].join("\n"),
      "apps/storefront/package.json": "{}\n",
    },
    async (workspaceDir) => {
      process.chdir(path.join(workspaceDir, "apps/storefront"));
      ensureStorefrontRuntimeEnvLoaded();
      let calledUrl = "";
      let authHeader = "";
      global.fetch = (async (input, init) => {
        calledUrl = String(input);
        authHeader = new Headers(init?.headers).get("Authorization") ?? "";
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      await medusaAdminFetch("/admin/regions/reg_456", { method: "GET" });

      assert.equal(
        calledUrl,
        "https://process.example.com/admin/regions/reg_456",
      );
      assert.equal(authHeader, "Basic c2tfcHJvY2Vzczo=");
    },
  );

  global.fetch = beforeFetch;
  process.chdir(beforeCwd);
  clearRuntimeEnv();
  resetStorefrontRuntimeEnvForTests();
});
