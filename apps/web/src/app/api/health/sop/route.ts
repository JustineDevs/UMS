import { NextResponse } from "next/server";
import { listMissingPostHogEnv } from "@universal-music-store/sdk";
import { healthSopResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

/**
 * SOP-6: quick JSON probe for storefront + Worker reachability (no secrets in response).
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "") ?? "";
  const missingObservabilityEnv = listMissingPostHogEnv();
  let workerReady = false;
  if (workerBaseUrl) {
    try {
      const res = await fetch(`${workerBaseUrl}/readyz`, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      workerReady = res.ok;
    } catch {
      workerReady = false;
    }
  }

  const degraded = !workerBaseUrl || missingObservabilityEnv.length > 0 || !workerReady;

  return NextResponse.json(
    healthSopResponseSchema.parse({
      status: degraded ? "degraded" : "ok",
      commerceSource: "cloudflare_worker",
      worker: {
        configured: Boolean(workerBaseUrl),
        readyReachable: workerReady,
      },
      deployment: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.GIT_COMMIT_SHA?.trim() || "unknown",
      },
      missingObservabilityEnv,
      timestamp,
    }),
    { status: degraded ? 503 : 200 },
  );
}
