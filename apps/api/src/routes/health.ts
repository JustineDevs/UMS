import { Router } from "express";
import { createSupabaseClient } from "@universal-music-store/database";
import { getMedusaStoreBaseUrl } from "@universal-music-store/sdk";

export const healthRouter: ReturnType<typeof Router> = Router();

function getMedusaBaseUrl(): string {
  return getMedusaStoreBaseUrl();
}

async function checkMedusa(): Promise<{ url: string; ok: boolean }> {
  const base = getMedusaBaseUrl();
  try {
    const r = await fetch(`${base}/health`);
    return { url: base, ok: r.ok };
  } catch {
    return { url: base, ok: false };
  }
}

async function checkSupabase(): Promise<boolean> {
  try {
    const sb = createSupabaseClient();
    const { error } = await sb.from("users").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export type ReadinessPayload = {
  ready: boolean;
  medusa: "ok" | "unavailable";
  supabase: "ok" | "unavailable";
  timestamp: string;
};

export async function getReadinessPayload(): Promise<ReadinessPayload> {
  const [medusa, supabaseOk] = await Promise.all([
    checkMedusa(),
    checkSupabase(),
  ]);
  const allOk = medusa.ok && supabaseOk;
  return {
    ready: allOk,
    medusa: medusa.ok ? "ok" : "unavailable",
    supabase: supabaseOk ? "ok" : "unavailable",
    timestamp: new Date().toISOString(),
  };
}

healthRouter.get("/commerce", async (_req, res) => {
  const medusa = await checkMedusa();
  res.json({
    commerceEngine: "medusa",
    medusa: { url: medusa.url, status: medusa.ok ? "ok" : "unreachable" },
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/", async (_req, res) => {
  const [medusa, supabaseOk] = await Promise.all([
    checkMedusa(),
    checkSupabase(),
  ]);

  const allOk = medusa.ok && supabaseOk;
  const status = allOk ? "ok" : "degraded";

  res.status(200).json({
    status,
    medusa: medusa.ok ? "ok" : "unavailable",
    supabase: supabaseOk ? "ok" : "unavailable",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const body = await getReadinessPayload();
  const httpStatus = body.ready ? 200 : 503;
  res.status(httpStatus).json(body);
});
