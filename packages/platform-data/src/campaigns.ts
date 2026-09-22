import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type CampaignType =
  | "winback"
  | "birthday"
  | "first_purchase"
  | "upsell"
  | "custom";

export type Campaign = {
  id: string;
  name: string;
  type: CampaignType;
  segment_id: string | null;
  subject: string | null;
  body_template: string | null;
  channel: "email";
  is_active: boolean;
  last_run_at: string | null;
  schedule_cron: string | null;
  created_at: string;
  organization_id: string | null;
};

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    type: (row.type as CampaignType) ?? "custom",
    segment_id: row.segment_id != null ? String(row.segment_id) : null,
    subject: row.subject != null ? String(row.subject) : null,
    body_template: row.body_template != null ? String(row.body_template) : null,
    channel: "email",
    is_active: Boolean(row.is_active ?? true),
    last_run_at: row.last_run_at != null ? String(row.last_run_at) : null,
    schedule_cron:
      row.schedule_cron != null ? String(row.schedule_cron) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    organization_id: row.organization_id != null ? String(row.organization_id) : null,
  };
}

export async function listCampaigns(
  supabase: SupabaseClient,
  opts?: { type?: CampaignType; organizationId?: string },
): Promise<Campaign[]> {
  let q = supabase
    .from("campaigns")
    .select("id,name,type,segment_id,subject,body_template,channel,is_active,last_run_at,schedule_cron,created_at,organization_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (opts?.type) {
    q = q.eq("type", opts.type);
  }
  if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToCampaign(r as Record<string, unknown>));
}

export async function createCampaign(
  supabase: SupabaseClient,
  input: {
    name: string;
    type: CampaignType;
    segment_id?: string;
    subject?: string;
    body_template?: string;
    schedule_cron?: string;
    organization_id: string;
  },
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: input.name,
      type: input.type,
      segment_id: input.segment_id ?? null,
      subject: input.subject ?? null,
      body_template: input.body_template ?? null,
      channel: "email",
      schedule_cron: input.schedule_cron ?? null,
      organization_id: input.organization_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToCampaign(data as Record<string, unknown>);
}

export async function updateCampaign(
  supabase: SupabaseClient,
  id: string,
  organizationId: string,
  patch: Partial<{
    name: string;
    subject: string | null;
    body_template: string | null;
    is_active: boolean;
    schedule_cron: string | null;
    segment_id: string | null;
  }>,
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToCampaign(data as Record<string, unknown>);
}

export async function recordCampaignMessage(
  supabase: SupabaseClient,
  input: {
    campaign_id: string;
    recipient_email: string;
    status?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("campaign_messages").insert({
    campaign_id: input.campaign_id,
    recipient_email: input.recipient_email,
    status: input.status ?? "sent",
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function executeCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  organizationId: string,
  sendEmail: (_to: string, _subject: string, _html: string) => Promise<void>,
): Promise<number> {
  const pageSize = 500;
  async function readAll<T>(query: (_offset: number, _limitEnd: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await query(from, from + pageSize - 1);
      if (error) throw error;
      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id,name,subject,body_template,segment_id")
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .single();
  if (campErr) throw campErr;
  if (!campaign.segment_id) throw new Error("Campaign has no segment");

  const members = await readAll<{ customer_email: string }>((_offset, _limitEnd) => supabase
    .from("customer_segment_members")
    .select("customer_email")
    .eq("segment_id", campaign.segment_id)
    .eq("organization_id", organizationId)
    .order("customer_email")
    .range(_offset, _limitEnd));

  const preferences = await readAll<{ email: string; consent_status: string }>((_offset, _limitEnd) => supabase
    .from("marketing_preferences")
    .select("email, consent_status")
    .eq("organization_id", organizationId)
    .eq("channel", "email")
    .order("email")
    .range(_offset, _limitEnd)).catch((error: unknown) => {
      if (isMissingTableOrSchemaError(error as { code?: string; message?: string } | null)) return [];
      throw error;
    });
  const subscribed = new Set(
    preferences
      .filter((row) => row.consent_status === "subscribed")
      .map((row) => String(row.email).trim().toLowerCase()),
  );
  const sentMessages = await readAll<{ recipient_email: string }>((_offset, _limitEnd) => supabase
    .from("campaign_messages")
    .select("recipient_email")
    .eq("campaign_id", campaignId)
    .eq("status", "sent")
    .order("recipient_email")
    .range(_offset, _limitEnd)).catch((error: unknown) => {
      if (isMissingTableOrSchemaError(error as { code?: string; message?: string } | null)) return [];
      throw error;
    });
  const alreadySent = new Set(
    sentMessages.map((row) => String(row.recipient_email).trim().toLowerCase()),
  );

  let sent = 0;
  for (const member of members) {
    const recipient = String(member.customer_email).trim().toLowerCase();
    if (!recipient || !subscribed.has(recipient) || alreadySent.has(recipient)) continue;
    try {
      await sendEmail(
        recipient,
        String(campaign.subject ?? campaign.name),
        String(campaign.body_template ?? ""),
      );
      await recordCampaignMessage(supabase, {
        campaign_id: campaignId,
        recipient_email: recipient,
        status: "sent",
      });
      sent++;
    } catch {
      await recordCampaignMessage(supabase, {
        campaign_id: campaignId,
        recipient_email: String(member.customer_email),
        status: "failed",
      });
    }
  }

  await supabase
    .from("campaigns")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("organization_id", organizationId);

  return sent;
}
