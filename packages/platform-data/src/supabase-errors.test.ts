import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

describe("isMissingTableOrSchemaError", () => {
  it("detects Postgres undefined_table", () => {
    assert.equal(isMissingTableOrSchemaError({ code: "42P01", message: "" }), true);
  });

  it("detects PostgREST schema cache miss", () => {
    assert.equal(
      isMissingTableOrSchemaError({
        code: "PGRST205",
        message: "Could not find the table 'public.x' in the schema cache",
      }),
      true,
    );
  });

  it("detects message-only schema cache errors from Supabase", () => {
    assert.equal(
      isMissingTableOrSchemaError({
        message:
          "Could not find the table 'public.storefront_home_content' in the schema cache",
      }),
      true,
    );
  });

  it("returns false for unrelated errors", () => {
    assert.equal(
      isMissingTableOrSchemaError({ code: "23505", message: "unique violation" }),
      false,
    );
  });
});
