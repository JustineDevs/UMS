#!/usr/bin/env node

const target = new URL(process.env.PERF_TARGET_URL || "http://localhost:3000/");
const concurrency = Number(process.env.PERF_CONCURRENCY || 10);
const requests = Number(process.env.PERF_REQUESTS || 50);
const maxP95 = Number(process.env.PERF_MAX_P95_MS || 1500);

(async () => {

if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(requests) || requests < concurrency) {
  throw new Error("PERF_CONCURRENCY and PERF_REQUESTS must be positive integers, with requests >= concurrency");
}

const durations = [];
let failures = 0;
let next = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(target, { redirect: "manual" });
      if (!response.ok && ![301, 302, 307, 308].includes(response.status)) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    } finally {
      durations.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)];
const result = { target: target.toString(), requests, concurrency, failures, p95Ms: Number(p95.toFixed(1)), maxP95Ms: maxP95 };
console.log(JSON.stringify(result));
if (failures > 0 || p95 > maxP95) process.exitCode = 1;
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
