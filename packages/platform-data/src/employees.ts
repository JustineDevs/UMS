import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type EmployeeRole = "admin" | "manager" | "cashier" | "staff";

export type Employee = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: EmployeeRole;
  is_active: boolean;
  hired_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateEmployeeInput = {
  full_name: string;
  email?: string;
  phone?: string;
  role?: EmployeeRole;
  hired_at?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  is_active?: boolean;
  metadata?: Record<string, unknown>;
};

function rowToEmployee(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id ?? ""),
    user_id: row.user_id != null ? String(row.user_id) : null,
    full_name: String(row.full_name ?? ""),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    role: (row.role as EmployeeRole) ?? "staff",
    is_active: Boolean(row.is_active ?? true),
    hired_at: row.hired_at != null ? String(row.hired_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listEmployees(
  supabase: SupabaseClient,
  opts?: { activeOnly?: boolean },
): Promise<Employee[]> {
  let q = supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.activeOnly) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToEmployee(r as Record<string, unknown>));
}

export async function getEmployee(
  supabase: SupabaseClient,
  id: string,
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowToEmployee(data as Record<string, unknown>);
}

export async function createEmployee(
  supabase: SupabaseClient,
  input: CreateEmployeeInput,
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert({
      full_name: input.full_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role ?? "staff",
      hired_at: input.hired_at ?? null,
      user_id: input.user_id ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToEmployee(data as Record<string, unknown>);
}

export async function updateEmployee(
  supabase: SupabaseClient,
  id: string,
  input: UpdateEmployeeInput,
): Promise<Employee> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.role !== undefined) patch.role = input.role;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.hired_at !== undefined) patch.hired_at = input.hired_at;
  if (input.user_id !== undefined) patch.user_id = input.user_id;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const { data, error } = await supabase
    .from("employees")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToEmployee(data as Record<string, unknown>);
}

export async function deleteEmployee(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}
