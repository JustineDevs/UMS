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
  let workerReachable = false;
  if (workerBaseUrl) {
    try {
      const res = await fetch(`${workerBaseUrl}/healthz`, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      workerReachable = res.ok;
    } catch {
      workerReachable = false;
    }
  }

  const degraded = !workerBaseUrl || missingObservabilityEnv.length > 0 || !workerReachable;

  /** Always 200; use `status` for SOP readiness (avoids 503 during Medusa cold start in E2E). */
  return NextResponse.json(
    healthSopResponseSchema.parse({
      status: degraded ? "degraded" : "ok",
      commerceSource: "cloudflare_worker",
      worker: {
        configured: Boolean(workerBaseUrl),
        healthReachable: workerReachable,
      },
      missingObservabilityEnv,
      timestamp,
    }),
    { status: 200 },
  );
}
