import test from "node:test";
import assert from "node:assert/strict";
import { callTerminalAgent, TerminalAgentError } from "./terminal-agent-client";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.TERMINAL_AGENT_URL;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.TERMINAL_AGENT_URL;
  else process.env.TERMINAL_AGENT_URL = originalUrl;
});

test("terminal agent rejects non-local HTTP URLs", async () => {
  process.env.TERMINAL_AGENT_URL = "http://169.254.169.254";
  await assert.rejects(callTerminalAgent("/print", {}), (error: unknown) => error instanceof TerminalAgentError && error.status === 503);
});

test("terminal agent bounds and parses responses", async () => {
  process.env.TERMINAL_AGENT_URL = "http://127.0.0.1:17711";
  globalThis.fetch = async () => new Response(JSON.stringify({ accepted: true }), { status: 202 });
  assert.deepEqual(await callTerminalAgent("/print", { orderId: "order-1" }), { status: 202, payload: { accepted: true } });
});

test("terminal agent rejects oversized responses", async () => {
  process.env.TERMINAL_AGENT_URL = "http://127.0.0.1:17711";
  globalThis.fetch = async () => new Response("x".repeat(1024 * 1024 + 1), { status: 200 });
  await assert.rejects(callTerminalAgent("/print", {}), (error: unknown) => error instanceof TerminalAgentError && error.status === 502);
});
