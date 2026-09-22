import { monitorEventLoopDelay } from "node:perf_hooks";
import { getRegisteredSseClientCount } from "./admin-sse-hub";

export type DevRuntimeDiagnostics = {
  process: {
    pid: number;
    uptimeSeconds: number;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  eventLoop: {
    sampleMs: number;
    meanMs: number | null;
    maxMs: number | null;
    p99Ms: number | null;
  };
  activeSseClients: number;
};

const finiteMilliseconds = (value: number): number | null => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;

export async function collectDevRuntimeDiagnostics(sampleMs = 25): Promise<DevRuntimeDiagnostics> {
  const duration = Math.max(10, Math.min(100, Math.floor(sampleMs)));
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  await new Promise((resolve) => setTimeout(resolve, duration));
  histogram.disable();
  const memory = process.memoryUsage();
  return {
    process: {
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime() * 100) / 100,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
    eventLoop: {
      sampleMs: duration,
      meanMs: finiteMilliseconds(histogram.mean / 1e6),
      maxMs: finiteMilliseconds(histogram.max / 1e6),
      p99Ms: finiteMilliseconds(histogram.percentile(99) / 1e6),
    },
    activeSseClients: getRegisteredSseClientCount(),
  };
}
