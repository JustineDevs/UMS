import { proxyCronToWorker } from "@/lib/worker-cron-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return proxyCronToWorker(request, "campaigns");
}
