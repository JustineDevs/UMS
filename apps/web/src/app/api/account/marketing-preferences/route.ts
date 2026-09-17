import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

async function workerRequest(request: Request): Promise<Response> {
  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return Response.json({ error: "Account preferences are unavailable." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (!userData.user || !sessionData.session?.access_token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const response = await fetch(`${baseUrl}/store/customers/me/marketing-preferences`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      ...(request.method === "PATCH" ? { "Content-Type": "application/json" } : {}),
    },
    ...(request.method === "PATCH" ? { body: await request.text() } : {}),
    cache: "no-store",
  });
  const status = response.ok ? 200 : response.status >= 500 ? 503 : response.status;
  const payload = await response.json().catch(() => ({ error: "invalid_worker_response" }));
  return Response.json(payload, { status });
}

export async function GET(request: Request) { return workerRequest(request); }

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  return workerRequest(request);
}
