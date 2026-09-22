import { proxyCronToWorker } from "@/lib/worker-cron-proxy";

export const dynamic = "force-dynamic";

/** Compatibility URL for existing scheduler clients; reservation expiry executes in the Worker. */
export function GET(request: Request) {
  return proxyCronToWorker(request, "inventory-reservations");
}
