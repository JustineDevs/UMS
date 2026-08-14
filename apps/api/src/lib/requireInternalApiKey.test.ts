import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { requireInternalApiKey } from "./requireInternalApiKey.js";

const envBackup: Record<string, string | undefined> = {};

function backup(...keys: string[]) {
  for (const k of keys) {
    envBackup[k] = process.env[k];
  }
}

function restore(...keys: string[]) {
  for (const k of keys) {
    if (envBackup[k] !== undefined) process.env[k] = envBackup[k];
    else delete process.env[k];
  }
}

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; jsonBody: unknown } {
  const res = {
    statusCode: 0,
    jsonBody: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
  } as Response & { statusCode: number; jsonBody: unknown };
  return res;
}

describe("requireInternalApiKey", () => {
  beforeEach(() => backup("NODE_ENV", "INTERNAL_API_KEY"));
  afterEach(() => restore("NODE_ENV", "INTERNAL_API_KEY"));

  it("calls next when dev and INTERNAL_API_KEY unset (auth bypass)", () => {
    process.env.NODE_ENV = "development";
    delete process.env.INTERNAL_API_KEY;
    const req = mockReq();
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    requireInternalApiKey(req, res, next);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 0);
  });

  it("returns 401 when key required and no key provided", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_KEY = "secret-123";
    const req = mockReq();
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    requireInternalApiKey(req, res, next);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.jsonBody, {
      error: "Unauthorized",
      code: "INVALID_INTERNAL_API_KEY",
    });
  });

  it("returns 401 when key required and wrong key provided", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_KEY = "secret-123";
    const req = mockReq({
      "x-internal-api-key": "wrong-key",
    });
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    requireInternalApiKey(req, res, next);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });

  it("calls next when correct Bearer key provided", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_KEY = "secret-123";
    const req = mockReq({
      authorization: "Bearer secret-123",
    });
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    requireInternalApiKey(req, res, next);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 0);
  });

  it("calls next when correct x-internal-api-key provided", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_KEY = "secret-123";
    const req = mockReq({
      "x-internal-api-key": "secret-123",
    });
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    requireInternalApiKey(req, res, next);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 0);
  });

  it("returns 503 when production and INTERNAL_API_KEY not set", () => {
    process.env.NODE_ENV = "production";
    delete process.env.INTERNAL_API_KEY;
    const req = mockReq();
    const res = mockRes();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };
    requireInternalApiKey(req, res, next);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 503);
    assert.deepStrictEqual(res.jsonBody, {
      error: "Server misconfigured",
      code: "MISSING_INTERNAL_API_KEY",
    });
  });
});
