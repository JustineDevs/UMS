import { NextResponse } from "next/server";
import {
  claimNextRunnableJob,
  completeJob,
  executeCampaign,
  enqueueDueCampaignJobs,
  failJob,
  releaseJobFailure,
} from "@universal-music-store/platform-data";
import { sendResendTransactionalEmail } from "@universal-music-store/resend-mail";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected =
    process.env.CRON_SECRET?.trim() || process.env.CAMPAIGN_CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  const actual = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : req.headers.get("x-cron-secret")?.trim();
  return Boolean(expected && actual && expected === actual);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createStorefrontServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const scheduled = await enqueueDueCampaignJobs(supabase);
  const job = await claimNextRunnableJob(
    supabase,
    "campaign.execute",
    `storefront-campaign-${process.pid}`,
  );
  if (!job) return NextResponse.json({ processed: 0, scheduled });

  const payload = job.payload;
  const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : null;
  const organizationId = typeof payload.organizationId === "string" ? payload.organizationId : null;
  const executionKey = typeof payload.executionKey === "string" ? payload.executionKey : null;
  if (!campaignId || !organizationId || !executionKey) {
    await failJob(supabase, job.id!, "Invalid campaign job payload");
    return NextResponse.json({ processed: 1, failed: true }, { status: 422 });
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id,execution_key")
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!campaign || campaign.execution_key !== executionKey) {
    await failJob(supabase, job.id!, "Campaign execution no longer matches the queued request");
    return NextResponse.json({ processed: 1, skipped: true });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    await releaseJobFailure(supabase, job.id!, "RESEND_API_KEY not configured", 60_000);
    return NextResponse.json({ processed: 1, retrying: true }, { status: 503 });
  }
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "noreply@universal-music-store.com";
  try {
    const sent = await executeCampaign(supabase, campaignId, organizationId, async (to, subject, html) => {
      const result = await sendResendTransactionalEmail({
        apiKey: resendKey,
        from,
        to,
        subject,
        html,
        tags: [{ name: "type", value: "campaign" }],
      });
      if (!result.ok) throw new Error(result.message);
    });
    await supabase
      .from("campaigns")
      .update({ execution_status: "completed", last_run_at: new Date().toISOString() })
      .eq("id", campaignId)
      .eq("organization_id", organizationId)
      .eq("execution_key", executionKey);
    await completeJob(supabase, job.id!, { sent, campaignId, organizationId });
    return NextResponse.json({ processed: 1, sent });
  } catch {
    await supabase
      .from("campaigns")
      .update({ execution_status: "failed" })
      .eq("id", campaignId)
      .eq("organization_id", organizationId)
      .eq("execution_key", executionKey);
    await releaseJobFailure(supabase, job.id!, "Campaign execution failed", 60_000);
    return NextResponse.json({ processed: 1, retrying: true }, { status: 502 });
  }
}
