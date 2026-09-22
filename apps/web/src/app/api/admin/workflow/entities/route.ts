import { fetchWorkerWorkflowEntitiesForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const name of ["limit", "offset", "entity_type"]) {
    const value = url.searchParams.get(name)?.trim();
    if (value) params.set(name, value);
  }
  const response = await fetchWorkerWorkflowEntitiesForAdmin(params.toString() ? `?${params}` : "");
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
}
