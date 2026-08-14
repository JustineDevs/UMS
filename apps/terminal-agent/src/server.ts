import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  encodeEscPosProductLabel,
  encodeEscPosReceipt,
  drawerOpenPulse,
  type ProductLabelPayload,
  type ReceiptPayload,
} from "@universal-music-store/printer-core";
import {
  fetchDeviceByName,
  heartbeatDeviceByName,
  type AgentPosDevice,
} from "./supabase-device.js";
import { listAdapterCapabilities } from "./adapters.js";
import { sendTcpRaw } from "./tcp-send.js";
import { sendNodeEscposNetwork } from "./node-escpos-network.js";
import { postOctetStreamPrint } from "./relay-post.js";
import {
  dequeueStarCloudPrnt,
  enqueueStarCloudPrnt,
  starCloudPrntQueueLength,
} from "./star-cloudprnt-queue.js";
import {
  basePrinterFromEnv,
  resolvedDefaultAdapter,
  resolvedEpsonEposUrl,
  resolvedHttpRelayUrl,
  resolvedPrinterTcp,
  resolvedQzTrayRelayUrl,
} from "./device-profile.js";

type AgentState = {
  lastError: string | null;
  lastPrintAt: string | null;
};

const state: AgentState = { lastError: null, lastPrintAt: null };

let cachedDevice: AgentPosDevice | null = null;

function readEnvPort(): number {
  const raw = process.env.TERMINAL_AGENT_PORT ?? "17711";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 17711;
}

async function refreshDeviceFromSupabase(): Promise<void> {
  const name = process.env.TERMINAL_DEVICE_NAME?.trim();
  if (!name) return;
  const row = await fetchDeviceByName(name);
  cachedDevice = row;
}

async function sendHeartbeat(): Promise<void> {
  const name = process.env.TERMINAL_DEVICE_NAME?.trim();
  if (!name) return;
  await heartbeatDeviceByName(name);
}

function mutatingPostAllowed(req: http.IncomingMessage): boolean {
  const secret = process.env.TERMINAL_AGENT_SECRET?.trim();
  if (!secret) return true;
  return req.headers["x-terminal-agent-secret"] === secret;
}

async function sendEscPosToAdapter(
  bytes: Uint8Array,
  adapter: string,
  override?: { host: string; port: number },
): Promise<void> {
  const device = cachedDevice;

  if (adapter === "mock") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_MOCK_TERMINAL_ADAPTER !== "true"
    ) {
      throw new Error(
        "Development adapter is disabled in production. Configure a real printer adapter or set ALLOW_MOCK_TERMINAL_ADAPTER=true only for emergencies.",
      );
    }
    const outDir = process.env.TERMINAL_AGENT_MOCK_DIR?.trim();
    if (outDir) {
      await mkdir(outDir, { recursive: true });
      const f = path.join(outDir, `receipt-${Date.now()}.bin`);
      await writeFile(f, Buffer.from(bytes));
      return;
    }
    process.stdout.write(`[terminal-agent dev print ${bytes.length} bytes]\n`);
    return;
  }

  if (adapter === "escpos-tcp") {
    const { host, port } = override ?? resolvedPrinterTcp(device);
    await sendTcpRaw(host, port, bytes);
    return;
  }

  if (adapter === "node-escpos-network") {
    const { host, port } = override ?? resolvedPrinterTcp(device);
    await sendNodeEscposNetwork(host, port, bytes);
    return;
  }

  if (adapter === "http-relay") {
    const url = resolvedHttpRelayUrl(device);
    if (!url) {
      throw new Error(
        "http-relay: set TERMINAL_HTTP_RELAY_URL or device config httpRelayUrl",
      );
    }
    await postOctetStreamPrint(url, bytes);
    return;
  }

  if (adapter === "qz-tray") {
    const url = resolvedQzTrayRelayUrl(device);
    if (!url) {
      throw new Error(
        "qz-tray: set QZ_TRAY_RELAY_URL or device config qzTrayRelayUrl",
      );
    }
    await postOctetStreamPrint(url, bytes);
    return;
  }

  if (adapter === "epson-epos") {
    const url = resolvedEpsonEposUrl(device);
    if (!url) {
      throw new Error(
        "epson-epos: set EPSON_EPOS_PRINT_URL or device config epsonEposUrl",
      );
    }
    await postOctetStreamPrint(url, bytes);
    return;
  }

  if (adapter === "star-cloudprnt") {
    enqueueStarCloudPrnt(bytes);
    return;
  }

  throw new Error(`Adapter "${adapter}" is not implemented in this agent build`);
}

async function printWithAdapter(
  payload: ReceiptPayload,
  adapter: string,
  override?: { host: string; port: number },
): Promise<void> {
  await sendEscPosToAdapter(
    encodeEscPosReceipt(payload),
    adapter,
    override,
  );
}

async function printLabelWithAdapter(
  payload: ProductLabelPayload,
  adapter: string,
  override?: { host: string; port: number },
): Promise<void> {
  await sendEscPosToAdapter(
    encodeEscPosProductLabel(payload),
    adapter,
    override,
  );
}

async function openDrawerWithAdapter(
  adapter: string,
  override?: { host: string; port: number },
): Promise<void> {
  const device = cachedDevice;
  const pulse = drawerOpenPulse();

  if (adapter === "mock") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_MOCK_TERMINAL_ADAPTER !== "true"
    ) {
      throw new Error(
        "Development adapter is disabled in production. Configure a real adapter or set ALLOW_MOCK_TERMINAL_ADAPTER=true only for emergencies.",
      );
    }
    process.stdout.write("[terminal-agent dev open-drawer]\n");
    return;
  }

  if (adapter === "http-relay") {
    const url = resolvedHttpRelayUrl(device);
    if (!url) {
      throw new Error(
        "http-relay: set TERMINAL_HTTP_RELAY_URL or device config httpRelayUrl",
      );
    }
    await postOctetStreamPrint(url, pulse);
    return;
  }

  if (adapter === "qz-tray") {
    const url = resolvedQzTrayRelayUrl(device);
    if (!url) {
      throw new Error(
        "qz-tray: set QZ_TRAY_RELAY_URL or device config qzTrayRelayUrl",
      );
    }
    await postOctetStreamPrint(url, pulse);
    return;
  }

  if (adapter === "epson-epos") {
    const url = resolvedEpsonEposUrl(device);
    if (!url) {
      throw new Error(
        "epson-epos: set EPSON_EPOS_PRINT_URL or device config epsonEposUrl",
      );
    }
    await postOctetStreamPrint(url, pulse);
    return;
  }

  if (adapter === "star-cloudprnt") {
    enqueueStarCloudPrnt(pulse);
    return;
  }

  const { host, port } = override ?? resolvedPrinterTcp(device);
  await sendTcpRaw(host, port, pulse);
}

const CORS_METHODS = "GET,POST,OPTIONS";
const CORS_HEADERS = "Content-Type, X-Terminal-Agent-Secret";

function terminalAgentAllowedOrigins(): string[] {
  const raw = process.env.TERMINAL_AGENT_CORS_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["http://127.0.0.1:3001", "http://localhost:3001"];
}

/**
 * Browser cross-origin calls must send Origin matching this allowlist.
 * Requests without Origin (curl, server-side fetch) get wildcard ACAO for local tooling.
 */
function corsHeadersForRequest(
  req: http.IncomingMessage,
): { ok: true; headers: Record<string, string> } | { ok: false } {
  const origin = (req.headers.origin as string | undefined)?.trim();
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
  };
  if (!origin) {
    return {
      ok: true,
      headers: { ...base, "Access-Control-Allow-Origin": "*" },
    };
  }
  const allowed = terminalAgentAllowedOrigins();
  if (!allowed.includes(origin)) {
    return { ok: false };
  }
  return {
    ok: true,
    headers: {
      ...base,
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    },
  };
}

function json(
  res: http.ServerResponse,
  req: http.IncomingMessage,
  code: number,
  body: unknown,
) {
  const cors = corsHeadersForRequest(req);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (cors.ok) Object.assign(headers, cors.headers);
  res.writeHead(code, headers);
  res.end(JSON.stringify(body));
}

function readMaxBodyBytes(): number {
  const raw = process.env.TERMINAL_AGENT_MAX_BODY_BYTES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0 && n <= 10_000_000) return n;
  return 262_144;
}

function readJsonBody(req: http.IncomingMessage): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string }
> {
  const maxBytes = readMaxBodyBytes();
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const finish = (
      result:
        | { ok: true; value: unknown }
        | { ok: false; status: number; error: string },
    ) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        finish({ ok: false, status: 413, error: "Payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        const value = raw.length === 0 ? {} : JSON.parse(raw);
        finish({ ok: true, value });
      } catch {
        finish({ ok: false, status: 400, error: "Invalid JSON" });
      }
    });

    req.on("error", () => {
      finish({ ok: false, status: 400, error: "Request read error" });
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

  if (req.method === "OPTIONS") {
    const cors = corsHeadersForRequest(req);
    if (!cors.ok) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden origin");
      return;
    }
    res.writeHead(204, cors.headers);
    res.end();
    return;
  }

  const cors = corsHeadersForRequest(req);
  if (req.headers.origin && !cors.ok) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden origin");
    return;
  }

  const corsJson = cors.ok
    ? { ...cors.headers, "Content-Type": "application/json; charset=utf-8" }
    : { "Content-Type": "application/json; charset=utf-8" };

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, corsJson);
    res.end(
      JSON.stringify({
        ok: true,
        lastError: state.lastError,
        adapterName: resolvedDefaultAdapter(cachedDevice),
      }),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { ...corsJson });
    const tcp = resolvedPrinterTcp(cachedDevice);
    res.end(
      JSON.stringify({
        online: true,
        lastError: state.lastError,
        lastPrintAt: state.lastPrintAt,
        adapters: listAdapterCapabilities(),
        defaultPrinter: tcp,
        defaultAdapter: resolvedDefaultAdapter(cachedDevice),
        deviceName: process.env.TERMINAL_DEVICE_NAME?.trim() ?? null,
        starCloudPrntQueue: starCloudPrntQueueLength(),
      }),
    );
    return;
  }

  if (req.method === "GET" && url.pathname.toLowerCase() === "/cloudprnt") {
    const expected = process.env.STAR_CLOUDPRNT_TOKEN?.trim();
    const token = url.searchParams.get("token") ?? "";
    if (expected && token !== expected) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    const job = dequeueStarCloudPrnt();
    if (!job) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(Buffer.from(job));
    return;
  }

  if (req.method === "GET" && url.pathname === "/devices") {
    res.writeHead(200, { ...corsJson });
    const tcp = resolvedPrinterTcp(cachedDevice);
    res.end(
      JSON.stringify({
        devices: [
          {
            id: "default-receipt",
            kind: "printer",
            adapter: resolvedDefaultAdapter(cachedDevice),
            address: `${tcp.host}:${tcp.port}`,
          },
        ],
      }),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/print-receipt") {
    if (!mutatingPostAllowed(req)) {
      json(res, req, 401, { error: "Unauthorized" });
      return;
    }
    void readJsonBody(req).then(async (parsed) => {
      if (!parsed.ok) {
        json(res, req, parsed.status, { error: parsed.error });
        return;
      }
      try {
        const body = parsed.value as {
          receipt?: ReceiptPayload;
          adapter?: string;
          printer?: { host: string; port: number };
        };
        if (!body?.receipt?.title) {
          json(res, req, 400, { error: "receipt required" });
          return;
        }
        const adapter =
          body.adapter ?? resolvedDefaultAdapter(cachedDevice);
        await printWithAdapter(body.receipt, adapter, body.printer);
        state.lastError = null;
        state.lastPrintAt = new Date().toISOString();
        json(res, req, 200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        state.lastError = msg;
        json(res, req, 502, { error: msg });
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/print-label") {
    if (!mutatingPostAllowed(req)) {
      json(res, req, 401, { error: "Unauthorized" });
      return;
    }
    void readJsonBody(req).then(async (parsed) => {
      if (!parsed.ok) {
        json(res, req, parsed.status, { error: parsed.error });
        return;
      }
      try {
        const body = parsed.value as {
          label?: ProductLabelPayload;
          adapter?: string;
          printer?: { host: string; port: number };
        };
        const label = body?.label;
        const nameOk =
          typeof label?.productName === "string" &&
          label.productName.trim().length > 0;
        const skuOk = typeof label?.sku === "string";
        const priceOk =
          typeof label?.priceDisplay === "string" &&
          label.priceDisplay.trim().length > 0;
        if (!label || !nameOk || !skuOk || !priceOk) {
          json(res, req, 400, {
            error:
              "label with productName, sku, and priceDisplay strings required",
          });
          return;
        }
        const adapter =
          body.adapter ?? resolvedDefaultAdapter(cachedDevice);
        await printLabelWithAdapter(label, adapter, body.printer);
        state.lastError = null;
        state.lastPrintAt = new Date().toISOString();
        json(res, req, 200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        state.lastError = msg;
        json(res, req, 502, { error: msg });
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/open-drawer") {
    if (!mutatingPostAllowed(req)) {
      json(res, req, 401, { error: "Unauthorized" });
      return;
    }
    void readJsonBody(req).then(async (parsed) => {
      if (!parsed.ok) {
        json(res, req, parsed.status, { error: parsed.error });
        return;
      }
      try {
        const body = parsed.value as {
          printer?: { host: string; port: number };
          adapter?: string;
        };
        const adapter =
          body.adapter ?? resolvedDefaultAdapter(cachedDevice);
        await openDrawerWithAdapter(adapter, body.printer);
        state.lastError = null;
        json(res, req, 200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        state.lastError = msg;
        json(res, req, 502, { error: msg });
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/scan/attach") {
    json(res, req, 501, {
      error:
        "Scanner pairing is handled in the browser (WebHID) or HID keyboard wedge mode. This agent does not expose USB scanner control.",
    });
    return;
  }

  json(res, req, 404, { error: "Not found" });
});

const port = readEnvPort();
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `[terminal-agent] listening on http://127.0.0.1:${port}\n`,
  );
  const name = process.env.TERMINAL_DEVICE_NAME?.trim();
  if (name) {
    void refreshDeviceFromSupabase();
    setInterval(() => void refreshDeviceFromSupabase(), 60_000);
    setInterval(() => void sendHeartbeat(), 60_000);
  }
  process.stdout.write(
    `[terminal-agent] default TCP printer ${basePrinterFromEnv().host}:${basePrinterFromEnv().port}\n`,
  );
});
