import { proxyCronToWorker } from "@/lib/worker-cron-proxy";

export const dynamic = "force-dynamic";

/** Compatibility URL for existing scheduler clients; stock qualification and delivery execute in the Worker. */
export function GET(request: Request) {
  return proxyCronToWorker(request, "back-in-stock");
}
