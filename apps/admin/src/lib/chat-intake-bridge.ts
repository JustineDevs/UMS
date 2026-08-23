import { tryCreateSupabaseClient } from "@universal-music-store/database";

export type ChatIntakeRow = {
  id: string;
  source: string;
  status: string;
  phone: string | null;
  address: string | null;
  raw_text: string | null;
  medusa_draft_order_id: string | null;
  medusa_order_id: string | null;
  medusa_order_display_id: string | null;
  medusa_order_payment_status: string | null;
  payment_provider: string | null;
  payment_external_id: string | null;
  payment_status: string | null;
  created_at: string;
};

export const chatOrderTransitions: Record<string, readonly string[]> = {
  pending: ["draft_created", "processing", "cancelled"],
  draft_created: ["processing", "completed", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  failed: ["processing", "cancelled"],
  // A chat order cannot become completed until the provider reports capture.
  pending_payment: ["cancelled"],
  completed: [],
  cancelled: [],
};

export function isAllowedChatOrderTransition(
  currentStatus: string,
  nextStatus: string,
): boolean {
  return (chatOrderTransitions[currentStatus] ?? []).includes(nextStatus);
}

export function chatOrderCompletionStatus(paymentStatus: unknown) {
  const status = String(paymentStatus ?? "").toLowerCase();
  return status === "captured" || status === "partially_captured"
    ? "completed"
    : "pending_payment";
}

export async function fetchRecentChatIntake(limit = 50): Promise<ChatIntakeRow[]> {
  const supabase = tryCreateSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("chat_order_intake")
    .select(
      "id, source, status, phone, address, raw_text, medusa_draft_order_id, medusa_order_id, medusa_order_display_id, medusa_order_payment_status, payment_provider, payment_external_id, payment_status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[chat-intake-bridge]", error.message);
    return [];
  }

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      source: String(row.source ?? ""),
      status: String(row.status ?? ""),
      phone: typeof row.phone === "string" ? row.phone : null,
      address: typeof row.address === "string" ? row.address : null,
      raw_text: typeof row.raw_text === "string" ? row.raw_text : null,
      medusa_draft_order_id:
        typeof row.medusa_draft_order_id === "string"
          ? row.medusa_draft_order_id
          : null,
      medusa_order_id:
        typeof row.medusa_order_id === "string" ? row.medusa_order_id : null,
      medusa_order_display_id:
        typeof row.medusa_order_display_id === "string"
          ? row.medusa_order_display_id
          : null,
      medusa_order_payment_status:
        typeof row.medusa_order_payment_status === "string"
          ? row.medusa_order_payment_status
          : null,
      payment_provider: typeof row.payment_provider === "string" ? row.payment_provider : null,
      payment_external_id: typeof row.payment_external_id === "string" ? row.payment_external_id : null,
      payment_status: typeof row.payment_status === "string" ? row.payment_status : null,
      created_at: String(row.created_at ?? ""),
    };
  });
}
