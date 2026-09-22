import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
function requirePattern(source, pattern, description) {
  if (!pattern.test(source)) throw new Error(`Webhook boundary check failed: ${description}`);
}

const channelProxy = read("apps/web/src/app/api/integrations/channels/webhook/route.ts");
const channelForwarder = read("apps/web/src/lib/worker-public-route-proxy.ts");
const channelWorker = read("workers/backend/src/channel-events-admin.ts");
const nangoProxy = read("apps/web/src/app/api/webhooks/nango/route.ts");
const nangoWorker = read("workers/backend/src/nango-webhook.ts");

requirePattern(channelProxy, /proxyWorkerPublicRoute\(request,\s*["']\/api\/integrations\/channels\/webhook["']/, "channel webhook must use the Worker public proxy");
for (const header of ["x-channel-nonce", "x-channel-signature", "x-channel-timestamp", "x-tenant-key"]) {
  requirePattern(channelForwarder, new RegExp(`"${header}"`), `channel proxy must forward ${header}`);
}
requirePattern(channelWorker, /verifySignature\(/, "Worker must verify the channel signature");
requirePattern(channelWorker, /admin_webhook_replays/, "channel webhook must persist replay protection");

for (const header of ["x-nango-hmac-sha256", "x-nango-event-id", "x-nango-webhook-id"]) {
  requirePattern(nangoProxy, new RegExp(`"${header}"`), `Nango proxy must forward ${header}`);
}
requirePattern(nangoWorker, /verifySignature\(/, "Worker must verify the Nango signature");
requirePattern(nangoWorker, /admin_webhook_replays/, "Nango webhook must persist replay protection");

console.log("Webhook proxy boundary: signed headers forwarded; Worker signature and replay checks present.");
