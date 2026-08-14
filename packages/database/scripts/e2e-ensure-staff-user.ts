/**
 * Upserts a Supabase `users` row and `user_roles` = staff for E2E admin credentials sign-in.
 * Uses the first email in ADMIN_ALLOWED_EMAILS (same list as admin promotion). No separate E2E_* email var.
 * Grants `staff_permission_grants` = `*` so Playwright can hit protected routes (same as admin wildcard).
 *
 * Usage (from repo root): pnpm e2e:ensure-staff
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "../../../");
config({ path: resolve(repoRoot, ".env.local"), override: true });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const listRaw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  const firstFromList = listRaw?.split(",")[0]?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  if (!firstFromList) {
    console.error(
      "ADMIN_ALLOWED_EMAILS must list at least one email (same source as admin staff promotion).",
    );
    process.exit(1);
  }
  const email = normalizeEmail(firstFromList);
  const supabase = createClient(url, key);

  async function ensureWildcardGrants(userId: string): Promise<void> {
    const { error: delErr } = await supabase
      .from("staff_permission_grants")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw delErr;
    const { error: insErr } = await supabase
      .from("staff_permission_grants")
      .insert({
        user_id: userId,
        permission_key: "*",
      });
    if (insErr) throw insErr;
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser?.id) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", existingUser.id)
      .maybeSingle();
    const role = roleRow?.role as string | undefined;
    if (role === "staff") {
      await ensureWildcardGrants(existingUser.id);
      console.log(
        `E2E staff user already present (${email}); refreshed staff_permission_grants (*).`,
      );
      return;
    }
    if (role === "admin") {
      console.log(
        `E2E allow-list user already admin (${email}). No database changes (admin uses wildcard in session).`,
      );
      return;
    }
  }

  const { data: user, error: uErr } = await supabase
    .from("users")
    .upsert(
      { email, name: "E2E Staff", updated_at: new Date().toISOString() },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (uErr) throw uErr;
  if (!user?.id) throw new Error("upsert users returned no id");

  const { error: rErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: "staff" }, { onConflict: "user_id" });
  if (rErr) throw rErr;

  await ensureWildcardGrants(user.id);

  console.log(`E2E staff user ready: ${email} (role staff, grants *)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
