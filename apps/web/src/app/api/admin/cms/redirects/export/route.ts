import { exportWorkerCmsRedirectsForAdmin } from "@/lib/worker-admin-bridge";
// text/csv raw response is returned by the Worker proxy.
// requireStaffSession-equivalent bearer verification is enforced by the Worker origin.
export async function GET() { return (await exportWorkerCmsRedirectsForAdmin()) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable" }), { status: 503 }); }
