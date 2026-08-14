import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function upsertOAuthUser(
  supabase: SupabaseClient,
  input: { email: string; name?: string | null; image?: string | null; googleSub: string },
  opts: { promoteEmails: string[] }
): Promise<{ role: string }> {
  const emailNorm = normalizeEmail(input.email);
  const promoteSet = opts.promoteEmails.map((e) => normalizeEmail(e)).filter(Boolean);

  // Upsert user (identity only; no role, no google_sub in users table)
  const { data: user, error: uErr } = await supabase
    .from("users")
    .upsert(
      {
        email: emailNorm,
        name: input.name,
        image: input.image,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (uErr) throw uErr;
  if (!user) throw new Error("Failed to upsert user");

  const userId = user.id as string;

  // Upsert oauth_accounts (google_sub moved here)
  const { error: oaErr } = await supabase
    .from("oauth_accounts")
    .upsert(
      {
        user_id: userId,
        provider: "google",
        provider_account_id: input.googleSub,
      },
      { onConflict: "provider,provider_account_id" }
    );
  if (oaErr) throw oaErr;

  // Resolve role: ADMIN_ALLOWED_EMAILS runs first so existing `staff` rows still upgrade to admin.
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  let role = (roleRow?.role as string) ?? "customer";

  if (promoteSet.includes(emailNorm)) {
    role = "admin";
    await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });
  } else if (roleRow?.role === "admin" || roleRow?.role === "staff") {
    role = roleRow.role as string;
  } else if (!roleRow) {
    await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "customer" }, { onConflict: "user_id" });
  }

  return { role };
}

export function isStaffRole(role: string): boolean {
  return role === "admin" || role === "staff";
}

export type StaffCheckSession = { user?: { role?: string } } | null;

export function checkStaffRole(session: StaffCheckSession):
  | { ok: true }
  | { ok: false; status: 401; code: "NO_SESSION" }
  | { ok: false; status: 403; code: "NOT_STAFF" } {
  if (!session?.user) {
    return { ok: false, status: 401, code: "NO_SESSION" };
  }
  const role = session.user.role;
  if (role !== "admin" && role !== "staff") {
    return { ok: false, status: 403, code: "NOT_STAFF" };
  }
  return { ok: true };
}
