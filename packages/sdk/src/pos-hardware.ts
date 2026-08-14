export type PrinterProfile = {
  id: string;
  name: string;
  type: "thermal" | "impact" | "inkjet";
  connectionType: "usb" | "network" | "bluetooth" | "cloudprnt";
  paperWidth: 58 | 80;
  dpi: number;
  address?: string;
  port?: number;
};

export type DrawerProfile = {
  id: string;
  name: string;
  connectionType: "printer_port" | "serial" | "network";
  kickPulse: "pin2" | "pin5";
  pulseOnMs: number;
  pulseOffMs: number;
};

export type StoreHardwareConfig = {
  storeId: string;
  storeName: string;
  printers: PrinterProfile[];
  drawers: DrawerProfile[];
  defaultPrinterId: string;
  defaultDrawerId: string;
};

export type HardwareHealthResult = {
  deviceId: string;
  deviceName: string;
  deviceType: "printer" | "drawer";
  status: "online" | "offline" | "degraded" | "unknown";
  lastCheckAt: string;
  responseTimeMs?: number;
  error?: string;
};

export async function checkPrinterHealth(
  agentUrl: string,
  printer: PrinterProfile,
): Promise<HardwareHealthResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${agentUrl}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    const elapsed = Date.now() - start;

    if (res.ok) {
      return {
        deviceId: printer.id,
        deviceName: printer.name,
        deviceType: "printer",
        status: elapsed > 2000 ? "degraded" : "online",
        lastCheckAt: new Date().toISOString(),
        responseTimeMs: elapsed,
      };
    }

    return {
      deviceId: printer.id,
      deviceName: printer.name,
      deviceType: "printer",
      status: "degraded",
      lastCheckAt: new Date().toISOString(),
      responseTimeMs: elapsed,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      deviceId: printer.id,
      deviceName: printer.name,
      deviceType: "printer",
      status: "offline",
      lastCheckAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export function isPeakHour(now = new Date()): boolean {
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return hour >= 10 && hour <= 20;
  return (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
}

export async function runPeakHourHealthCheck(
  agentUrl: string,
  config: StoreHardwareConfig,
): Promise<{
  storeId: string;
  isPeakHour: boolean;
  results: HardwareHealthResult[];
  allHealthy: boolean;
}> {
  const peak = isPeakHour();
  const results: HardwareHealthResult[] = [];

  for (const printer of config.printers) {
    const health = await checkPrinterHealth(agentUrl, printer);
    results.push(health);
  }

  return {
    storeId: config.storeId,
    isPeakHour: peak,
    results,
    allHealthy: results.every((r) => r.status === "online"),
  };
}

export const DEFAULT_THERMAL_PRINTER: PrinterProfile = {
  id: "default-thermal",
  name: "Star TSP100",
  type: "thermal",
  connectionType: "cloudprnt",
  paperWidth: 80,
  dpi: 203,
};

export const DEFAULT_DRAWER: DrawerProfile = {
  id: "default-drawer",
  name: "Standard Cash Drawer",
  connectionType: "printer_port",
  kickPulse: "pin2",
  pulseOnMs: 100,
  pulseOffMs: 100,
};
