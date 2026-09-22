import { resolveWorkerCmsRedirectForAdmin } from "@/lib/worker-admin-bridge";
// requireStaffSession-equivalent bearer verification is enforced by the Worker origin.
export async function GET(request: Request) { const response = await resolveWorkerCmsRedirectForAdmin(new URL(request.url).searchParams.toString()); return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable" }), { status: 503 }); }
