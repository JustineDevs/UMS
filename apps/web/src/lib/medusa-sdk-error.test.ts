import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commerceFailureHttpStatus,
  formatMedusaSdkError,
} from "./medusa-sdk-error";

test("formatMedusaSdkError reads response.data.message", () => {
  const err = new Error("Request failed with status code 400") as Error & {
    response?: { data?: { message?: string } };
  };
  err.response = { data: { message: "Handle must be unique" } };
  assert.equal(formatMedusaSdkError(err), "Handle must be unique");
});

test("commerceFailureHttpStatus maps 400 to 400", () => {
  const err = { status: 400 };
  assert.equal(commerceFailureHttpStatus(err), 400);
});

test("commerceFailureHttpStatus defaults to 502 when no status", () => {
  assert.equal(commerceFailureHttpStatus(new Error("boom")), 502);
});
