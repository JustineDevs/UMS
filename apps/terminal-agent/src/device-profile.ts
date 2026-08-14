import type { AgentPosDevice } from "./supabase-device.js";

export function basePrinterFromEnv(): { host: string; port: number } {
  const host = process.env.PRINTER_TCP_HOST?.trim() ?? "127.0.0.1";
  const port = Number.parseInt(process.env.PRINTER_TCP_PORT ?? "9100", 10);
  return { host, port: Number.isFinite(port) ? port : 9100 };
}

export function resolvedPrinterTcp(
  device: AgentPosDevice | null,
): { host: string; port: number } {
  const base = basePrinterFromEnv();
  const tcp = device?.config?.printerTcp as
    | { host?: string; port?: number }
    | undefined;
  const host =
    typeof tcp?.host === "string" && tcp.host.trim().length > 0
      ? tcp.host.trim()
      : base.host;
  const port =
    typeof tcp?.port === "number" && Number.isFinite(tcp.port)
      ? tcp.port
      : base.port;
  return { host, port };
}

export function resolvedDefaultAdapter(device: AgentPosDevice | null): string {
  const fromEnv = process.env.TERMINAL_DEFAULT_ADAPTER?.trim();
  const fromDevice = device?.config?.defaultAdapter;
  if (typeof fromDevice === "string" && fromDevice.trim().length > 0) {
    return fromDevice.trim();
  }
  if (fromEnv) return fromEnv;
  return "escpos-tcp";
}

function urlFromConfigOrEnv(
  device: AgentPosDevice | null,
  configKey: string,
  envKey: string,
): string | null {
  const c = device?.config as Record<string, unknown> | undefined;
  const fromConfig = c?.[configKey];
  if (typeof fromConfig === "string" && fromConfig.trim().length > 0) {
    return fromConfig.trim();
  }
  const fromEnv = process.env[envKey]?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : null;
}

export function resolvedHttpRelayUrl(
  device: AgentPosDevice | null,
): string | null {
  return urlFromConfigOrEnv(device, "httpRelayUrl", "TERMINAL_HTTP_RELAY_URL");
}

export function resolvedQzTrayRelayUrl(
  device: AgentPosDevice | null,
): string | null {
  return urlFromConfigOrEnv(device, "qzTrayRelayUrl", "QZ_TRAY_RELAY_URL");
}

export function resolvedEpsonEposUrl(
  device: AgentPosDevice | null,
): string | null {
  return urlFromConfigOrEnv(device, "epsonEposUrl", "EPSON_EPOS_PRINT_URL");
}
