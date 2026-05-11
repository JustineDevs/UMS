import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);

type CheckResult = {
  name: string;
  url: string;
  status: "pass" | "fail" | "timeout";
  responseTimeMs: number;
  statusCode?: number;
  error?: string;
};

const CHECKS = [
  { name: "Storefront Home", url: "/", expectedStatus: 200 },
  { name: "Storefront Health", url: "/api/health", expectedStatus: 200 },
  { name: "Storefront Product List", url: "/shop", expectedStatus: 200 },
  { name: "Storefront Search", url: "/api/shop/search-suggest?q=test", expectedStatus: 200 },
  { name: "Medusa Health", url: "http://localhost:9000/health", expectedStatus: 200 },
  { name: "Admin Health", url: "http://localhost:3001/api/admin/integration-health", expectedStatus: 200 },
  { name: "API Health", url: "http://localhost:4000/health", expectedStatus: 200 },
];

async function runCheck(baseUrl: string, check: typeof CHECKS[number]): Promise<CheckResult> {
  const url = check.url.startsWith("http") ? check.url : `${baseUrl}${check.url}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    return {
      name: check.name,
      url,
      status: res.status === check.expectedStatus ? "pass" : "fail",
      responseTimeMs: elapsed,
      statusCode: res.status,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      name: check.name,
      url,
      status: isTimeout ? "timeout" : "fail",
      responseTimeMs: elapsed,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function main() {
  const baseUrl = process.env.STOREFRONT_URL || "http://localhost:3000";
  console.log(`Running synthetic checks against ${baseUrl}...\n`);

  const results: CheckResult[] = [];
  for (const check of CHECKS) {
    const result = await runCheck(baseUrl, check);
    results.push(result);

    const icon = result.status === "pass" ? "PASS" : result.status === "timeout" ? "TIMEOUT" : "FAIL";
    console.log(`[${icon}] ${result.name} - ${result.responseTimeMs}ms ${result.statusCode ? `(${result.statusCode})` : ""} ${result.error ?? ""}`);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status !== "pass").length;
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${results.length} checks`);

  if (failed > 0) process.exit(1);
}

main().catch(console.error);
