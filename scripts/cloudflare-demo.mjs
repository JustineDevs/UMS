#!/usr/bin/env node

/**
 * Starts the local development stack behind one temporary HTTPS Cloudflare
 * Quick Tunnel. This is intentionally demo-only; it never changes deployment
 * configuration or writes secrets.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import process from "node:process";

const root = new URL("../", import.meta.url);
const gatewayPort = Number(process.env.CLOUDFLARE_DEMO_PORT || 8787);
const medusaOrigin = `http://127.0.0.1:${process.env.MEDUSA_DEMO_PORT || 9000}`;
const complianceOrigin = `http://127.0.0.1:${process.env.COMPLIANCE_DEMO_PORT || 4000}`;
const children = [];

function waitFor(url, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on("error", retry);
      request.setTimeout(3_000, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

function targetFor(pathname) {
  return pathname === "/compliance" ||
    pathname.startsWith("/compliance/") ||
    pathname === "/healthz" ||
    pathname === "/readyz"
    ? complianceOrigin
    : medusaOrigin;
}

function startGateway() {
  const server = http.createServer((request, response) => {
    const incoming = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`,
    );
    if (!incoming.pathname.startsWith("/") || incoming.pathname.startsWith("//")) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_local_path" }));
      return;
    }
    // The upstream origin is selected only from the fixed local allowlist.
    // Copying the request path/query cannot change the destination host.
    const target = new URL(targetFor(incoming.pathname));
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = {
      ...request.headers,
      host: target.host,
      connection: "close",
    };
    const upstream = http.request(
      target,
      { method: request.method, headers },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode || 502,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(response);
      },
    );
    upstream.on("error", () => {
      if (!response.headersSent)
        response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "local_backend_unavailable" }));
    });
    request.pipe(upstream);
  });
  server.listen(gatewayPort, "127.0.0.1");
  return server;
}

function stop(signal = "SIGTERM") {
  for (const child of children) child.kill(signal);
  process.exit(0);
}

const app = spawn("pnpm", ["dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
children.push(app);
app.on("exit", (code) => process.exit(code ?? 1));

try {
  await Promise.all([
    waitFor(`${medusaOrigin}/health`),
    waitFor(`${complianceOrigin}/healthz`),
  ]);
  const gateway = startGateway();
  const tunnel = spawn(
    "pnpm",
    [
      "dlx",
      "wrangler",
      "tunnel",
      "quick-start",
      `http://127.0.0.1:${gatewayPort}`,
    ],
    {
      cwd: root,
      stdio: ["inherit", "pipe", "pipe"],
    },
  );
  children.push(tunnel);
  const printUrl = (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    const match = text.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/i);
    if (match) {
      console.log(`\nDemo backend URL: ${match[0]}`);
      console.log(`Set NEXT_PUBLIC_MEDUSA_URL=${match[0]}`);
      console.log(`Set MEDUSA_BACKEND_URL=${match[0]}`);
      console.log(`Set API_URL=${match[0]}`);
      console.log(
        "Sandbox webhooks may use this HTTPS URL while this process remains running.\n",
      );
    }
  };
  tunnel.stdout.on("data", printUrl);
  tunnel.stderr.on("data", printUrl);
  tunnel.on("exit", (code) => {
    gateway.close();
    process.exit(code ?? 1);
  });
} catch (error) {
  console.error(
    `[cloudflare-demo] ${error instanceof Error ? error.message : String(error)}`,
  );
  stop();
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
