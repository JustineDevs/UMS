import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "./payment-provider-capabilities.js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type PaymentProviderArtifactType =
  | "product"
  | "price"
  | "terminal"
  | "payment_link"
  | "invoice"
  | "checkout_session"
  | "payment_intent"
  | "payment_request"
  | "payment_token"
  | "authorization"
  | "capture"
  | "refund"
  | "dispute"
  | "payout"
  | "reconciliation";

export type PaymentProviderArtifactRow = {
  id: string;
  organization_id: string;
  merchant_identity: string;
  provider: PaymentProvider;
  artifact_type: PaymentProviderArtifactType;
  external_id: string;
  parent_external_id: string | null;
  status: string;
  amount_minor: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  last_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentTerminalArtifactBindingInput = {
  organization_id: string;
  merchant_identity: string;
  provider: PaymentProvider;
  external_id: string;
  device_id: string;
  model: string;
  serial_number: string;
  status?: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string | null;
};

export function buildPaymentTerminalArtifactBindingRows(
  input: PaymentTerminalArtifactBindingInput,
) {
  const status = input.status?.trim() || "pending";
  const metadata = input.metadata ?? {};
  return {
    artifact: {
      organization_id: input.organization_id,
      merchant_identity: input.merchant_identity,
      provider: input.provider,
      artifact_type: "terminal" as const,
      external_id: input.external_id,
      parent_external_id: null,
      status,
      amount_minor: null,
      currency: null,
      metadata: {
        ...metadata,
        pos_device_id: input.device_id,
        terminal_model: input.model,
        terminal_serial_number: input.serial_number,
      },
      last_error: null,
      idempotency_key: input.idempotency_key ?? null,
    },
    terminal: {
      organization_id: input.organization_id,
      device_id: input.device_id,
      provider: input.provider,
      model: input.model,
      serial_number: input.serial_number,
      provider_terminal_external_id: input.external_id,
      status,
      metadata: {
        ...metadata,
        provider_terminal_external_id: input.external_id,
      },
    },
  };
}

export async function upsertPaymentProviderArtifact(
  supabase: SupabaseClient,
  input: {
    organization_id: string;
    merchant_identity: string;
    provider: PaymentProvider;
    artifact_type: PaymentProviderArtifactType;
    external_id: string;
    parent_external_id?: string | null;
    status?: string;
    amount_minor?: number | null;
    currency?: string | null;
    metadata?: Record<string, unknown>;
    last_error?: string | null;
    idempotency_key?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase.from("payment_provider_artifacts").upsert(
    {
      ...input,
      parent_external_id: input.parent_external_id ?? null,
      status: input.status ?? "pending",
      amount_minor: input.amount_minor ?? null,
      currency: input.currency ?? null,
      metadata: input.metadata ?? {},
      last_error: input.last_error ?? null,
      idempotency_key: input.idempotency_key ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,artifact_type,external_id" },
  );
  if (!error) return true;
  if (isMissingTableOrSchemaError(error)) return false;
  console.error("[payment-provider-artifacts] upsert", error.message);
  return false;
}

export async function listPaymentProviderArtifacts(
  supabase: SupabaseClient,
  input: {
    organization_id: string;
    provider?: PaymentProvider | "all";
    artifactTypes?: PaymentProviderArtifactType[];
    limit?: number;
  },
): Promise<PaymentProviderArtifactRow[]> {
  let query = supabase
    .from("payment_provider_artifacts")
    .select("*")
    .eq("organization_id", input.organization_id)
    .order("updated_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, input.limit ?? 100)));

  if (input.provider && input.provider !== "all") {
    query = query.eq("provider", input.provider);
  }
  if (input.artifactTypes?.length) {
    query = query.in("artifact_type", input.artifactTypes);
  }

  const { data, error } = await query;
  if (!error) return (data ?? []) as PaymentProviderArtifactRow[];
  if (isMissingTableOrSchemaError(error)) return [];
  console.error("[payment-provider-artifacts] list", error.message);
  return [];
}

export async function upsertPaymentTerminalArtifactBinding(
  supabase: SupabaseClient,
  input: PaymentTerminalArtifactBindingInput,
): Promise<boolean> {
  const rows = buildPaymentTerminalArtifactBindingRows(input);
  const artifactResult = await supabase
    .from("payment_provider_artifacts")
    .upsert(
      {
        ...rows.artifact,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,artifact_type,external_id" },
    )
    .select("id")
    .single();
  if (artifactResult.error) {
    if (isMissingTableOrSchemaError(artifactResult.error)) return false;
    console.error(
      "[payment-provider-artifacts] terminal artifact upsert",
      artifactResult.error.message,
    );
    return false;
  }

  const { error } = await supabase.from("pos_payment_terminals").upsert(
    {
      ...rows.terminal,
      payment_provider_artifact_id:
        (artifactResult.data as { id?: string } | null)?.id ?? null,
    },
    { onConflict: "organization_id,provider_terminal_external_id" },
  );
  if (!error) return true;
  if (isMissingTableOrSchemaError(error)) return false;
  console.error("[payment-provider-artifacts] terminal binding upsert", error.message);
  return false;
}
