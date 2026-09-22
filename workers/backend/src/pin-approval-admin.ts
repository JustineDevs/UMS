import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (c: WorkerAuthClaims) => { const value = c.organization_id ?? c.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const can = (c: WorkerAuthClaims) => c.role === "owner" || c.role === "admin" || (Array.isArray(c.permissions) && c.permissions.some((p) => p === "*" || p === "pos:use"));
async function sha256(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join(""); }
function equal(a: string, b: string): boolean { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }

export async function handleAdminPinApprovalRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL }); if (!claims) return json({ error: "unauthorized" }, 401); if (!can(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  let body: unknown; try { const raw = await request.arrayBuffer(); if (raw.byteLength > 16 * 1024) return json({ error: "payload_too_large" }, 413); body = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload" }, 400); const input = body as Record<string, unknown>; const employeeId = input.approver_employee_id; const pin = input.pin; const role = input.required_role === undefined ? "manager" : input.required_role;
  if (typeof employeeId !== "string" || !/^[0-9a-f-]{36}$/i.test(employeeId) || typeof pin !== "string" || !/^\d{4,8}$/.test(pin) || (role !== "admin" && role !== "manager")) return json({ error: "invalid_payload" }, 400);
  const result = await database.query<{ role: string; pin_hash: string | null; is_active: boolean }>("SELECT role, pin_hash, is_active FROM public.employees WHERE id=$1 AND organization_id=$2 LIMIT 1", [employeeId, organizationId]); const employee = result.rows[0];
  if (!employee) return json({ approved: false, reason: "employee_not_found" }); if (!employee.is_active) return json({ approved: false, reason: "employee_inactive" }); const employeeRole = String(employee.role); if (role === "manager" ? employeeRole !== "admin" && employeeRole !== "manager" : employeeRole !== "admin") return json({ approved: false, reason: "insufficient_role" }); if (!employee.pin_hash) return json({ approved: false, reason: "no_pin_set" });
  const [salt, expected] = String(employee.pin_hash).split(":"); if (!salt || !expected || !equal(await sha256(`${salt}${pin}`), expected)) return json({ approved: false, reason: "invalid_pin" }); return json({ approved: true });
}
