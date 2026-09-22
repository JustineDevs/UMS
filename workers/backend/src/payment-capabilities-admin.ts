import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string; XENDIT_SECRET_KEY?: string; XENDIT_WEBHOOK_TOKEN?: string; UVS_MERCHANT_COUNTRY?: string };
type Provider = "stripe" | "paypal" | "xendit";
type ConnectionRow = { provider_config_key: string | null };
type Capability = string;
type CapabilityDefinition = { provider: Provider; capabilities: Capability[]; implementedCapabilities: Capability[]; verifiedCapabilities: Capability[]; checkoutModes: Array<"hosted" | "embedded">; notes: string };
const definitions: CapabilityDefinition[] = [
  { provider: "stripe", capabilities: ["hosted_checkout", "payment_links", "embedded_checkout", "catalog_sync", "recurring_billing", "save_payment_method", "authorize", "capture", "partial_capture", "refund", "partial_refund", "void", "invoices", "disputes", "payouts", "connected_accounts"], implementedCapabilities: ["hosted_checkout", "authorize", "capture", "refund", "partial_refund", "void"], verifiedCapabilities: ["hosted_checkout", "authorize", "capture", "refund", "partial_refund", "void"], checkoutModes: ["hosted"], notes: "Products and immutable Prices are reusable across Checkout, Links, Invoices, and Subscriptions." },
  { provider: "paypal", capabilities: ["hosted_checkout", "payment_links", "recurring_billing", "authorize", "capture", "partial_capture", "refund", "partial_refund", "void", "invoices", "disputes", "payouts", "connected_accounts"], implementedCapabilities: ["hosted_checkout", "authorize", "capture", "refund", "partial_refund"], verifiedCapabilities: ["hosted_checkout", "authorize", "capture", "refund", "partial_refund"], checkoutModes: ["hosted"], notes: "Orders and wallet approval are separate from Payment Links, Invoicing, Subscriptions, Payouts, and Disputes APIs." },
  { provider: "xendit", capabilities: ["hosted_checkout", "embedded_checkout", "save_payment_method", "authorize", "capture", "refund", "partial_refund", "payouts", "channel_discovery", "future_charge"], implementedCapabilities: ["hosted_checkout", "capture", "refund", "partial_refund"], verifiedCapabilities: ["hosted_checkout", "capture", "refund", "partial_refund"], checkoutModes: ["hosted", "embedded"], notes: "Payment Sessions expose PAYMENT_LINK or COMPONENTS modes and PAY, SAVE, or PAY_AND_SAVE session types." },
];
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "settings:read"); }
export async function handleAdminPaymentCapabilitiesRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401); if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const result = await database.query<ConnectionRow>("SELECT provider_config_key FROM public.payment_nango_connections WHERE organization_id = $1 AND active = TRUE LIMIT 20", [organizationId]);
  const connected = new Set(result.rows.map((row) => String(row.provider_config_key ?? "")));
  const stripeAvailable = (env.UVS_MERCHANT_COUNTRY ?? "PH").trim().toUpperCase() !== "PH";
  return json({ data: definitions.map((definition) => { const configured = (definition.provider !== "stripe" || stripeAvailable) && (connected.has(definition.provider) || connected.has(`${definition.provider}-sandbox`) || (definition.provider === "xendit" && Boolean(env.XENDIT_SECRET_KEY?.trim() && env.XENDIT_WEBHOOK_TOKEN?.trim()))); return { ...definition, configured, policy: definition.provider === "stripe" && !stripeAvailable ? { locked: true, code: "STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY" } : { locked: false }, unavailableInUvs: definition.capabilities.filter((capability) => !definition.implementedCapabilities.includes(capability)) }; }) });
}
