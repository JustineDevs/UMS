import { serve } from "inngest/express";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { inngest } from "../../lib/inngest/client";
import { allFunctions } from "../../lib/inngest/functions";

/**
 * Inngest webhook handler — receives and processes background jobs.
 * POST /inngest  — Inngest sends jobs here.
 * GET  /inngest  — Introspection by Inngest Dev Server.
 * PUT  /inngest  — Inngest registers functions via this endpoint.
 *
 * In production set INNGEST_SIGNING_KEY (from your Inngest dashboard).
 * In development the Inngest Dev Server auto-discovers this endpoint.
 */
const handler = serve({
  client: inngest,
  functions: allFunctions,
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return (handler as (req: unknown, res: unknown) => void)(req, res);
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return (handler as (req: unknown, res: unknown) => void)(req, res);
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  return (handler as (req: unknown, res: unknown) => void)(req, res);
}
