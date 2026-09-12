import { writeFile } from "node:fs/promises";

import type { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

const OUTPUT_ENV = "E2E_MEDUSA_SECRET_OUTPUT";

/**
 * Creates a disposable hashed Medusa secret key for isolated browser tests.
 * The raw token is written only to the runner's temporary file so it can be
 * passed to the storefront server without committing or exposing a credential.
 */
export default async function createE2eSecret({ container }: ExecArgs) {
  const outputPath = process.env[OUTPUT_ENV]?.trim();
  if (!outputPath) {
    throw new Error(`${OUTPUT_ENV} must point to a temporary output file`);
  }

  const apiKeyService = container.resolve(Modules.API_KEY);
  const created = await apiKeyService.createApiKeys({
    title: "CI E2E browser suite",
    type: "secret",
    created_by: "ci",
  });
  const token = created?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Medusa did not return the generated E2E secret token");
  }

  await writeFile(outputPath, token, { encoding: "utf8", mode: 0o600 });
}
