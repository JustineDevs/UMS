import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { readResponseJson } from "@/lib/read-response-json";
import { posCommerceDraftOrderResponseSchema } from "@/lib/admin-api-contracts";

export async function POST(request: Request) {
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) return staff.response;
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return Response.json({ error: "Worker API is not configured" }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return Response.json({ error: "Staff session is unavailable" }, { status: 401 });
  const key = request.headers.get("Idempotency-Key")?.trim() || crypto.randomUUID();
  const response = await fetch(`${base}/api/admin/pos/draft-order`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: await request.text(), cache: "no-store" });
  if (!response.ok) return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" } });
  const payload = await readResponseJson(response, null, { maxBytes: 32 * 1024 });
  const parsed = posCommerceDraftOrderResponseSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "POS draft returned an invalid response" }, { status: 502 });
  return Response.json(parsed.data, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
