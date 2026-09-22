const TERMINAL_AGENT_TIMEOUT_MS = 5_000;
const TERMINAL_AGENT_MAX_RESPONSE_BYTES = 1 * 1024 * 1024;

export class TerminalAgentError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "TerminalAgentError";
    this.status = status;
  }
}

function terminalAgentBaseUrl(): string {
  const raw = process.env.TERMINAL_AGENT_URL?.trim() ||
    process.env.NEXT_PUBLIC_TERMINAL_AGENT_URL?.trim() ||
    "http://127.0.0.1:17711";
  let url: URL;
  try { url = new URL(raw); } catch { throw new TerminalAgentError("Terminal agent URL is invalid"); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new TerminalAgentError("Terminal agent URL must use HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}

export async function callTerminalAgent(path: string, body: Record<string, unknown>): Promise<{ status: number; payload: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TERMINAL_AGENT_TIMEOUT_MS);
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const secret = process.env.TERMINAL_AGENT_SECRET?.trim();
  if (secret) headers["X-Terminal-Agent-Secret"] = secret;
  try {
    const response = await fetch(`${terminalAgentBaseUrl()}${path}`, {
      method: "POST", headers, body: JSON.stringify(body), cache: "no-store", signal: controller.signal,
    });
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > TERMINAL_AGENT_MAX_RESPONSE_BYTES) throw new TerminalAgentError("Terminal agent response exceeded the configured limit", 502);
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new TerminalAgentError("Terminal agent request failed", response.status >= 500 ? 503 : response.status);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > TERMINAL_AGENT_MAX_RESPONSE_BYTES) throw new TerminalAgentError("Terminal agent response exceeded the configured limit", 502);
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: "Terminal agent returned invalid JSON" }; }
    return { status: response.status, payload };
  } catch (error) {
    if (error instanceof TerminalAgentError) throw error;
    throw new TerminalAgentError("Terminal agent request failed");
  } finally {
    clearTimeout(timeout);
  }
}
