import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = sha256(salt + pin);
  return `${salt}:${hash}`;
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;
  const actual = sha256(salt + pin);
  try {
    return timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expectedHash, "hex"),
    );
  } catch {
    return false;
  }
}

export async function setEmployeePin(
  supabase: SupabaseClient,
  employeeId: string,
  pin: string,
): Promise<void> {
  if (pin.length < 4 || pin.length > 8) {
    throw new Error("PIN must be 4-8 digits");
  }
  const pinHash = hashPin(pin);
  const { error } = await supabase
    .from("employees")
    .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
    .eq("id", employeeId);
  if (error) throw error;
}

export async function verifyEmployeePin(
  supabase: SupabaseClient,
  employeeId: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("employees")
    .select("pin_hash")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.pin_hash) return false;
  return verifyPinHash(pin, String(data.pin_hash));
}

export async function requirePinApproval(
  supabase: SupabaseClient,
  approverEmployeeId: string,
  pin: string,
  requiredRole: "admin" | "manager" = "manager",
): Promise<{ approved: boolean; reason?: string }> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, role, pin_hash, is_active")
    .eq("id", approverEmployeeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { approved: false, reason: "employee_not_found" };
  if (!data.is_active) return { approved: false, reason: "employee_inactive" };

  const role = String(data.role);
  const allowed =
    requiredRole === "manager"
      ? role === "admin" || role === "manager"
      : role === "admin";
  if (!allowed) return { approved: false, reason: "insufficient_role" };
  if (!data.pin_hash) return { approved: false, reason: "no_pin_set" };
  if (!verifyPinHash(pin, String(data.pin_hash))) {
    return { approved: false, reason: "invalid_pin" };
  }
  return { approved: true };
}
