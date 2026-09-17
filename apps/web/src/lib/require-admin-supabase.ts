import { tryCreateSupabaseClient } from "@universal-music-store/platform-data";
import { correlatedJson } from "@/lib/staff-api-response";

const CONFIG_HINT =
  "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY for local dev). Apply migrations: pnpm --filter @universal-music-store/database migrate";

type SupabaseClientNonNull = NonNullable<
  ReturnType<typeof tryCreateSupabaseClient>
>;

/**
 * Returns a Supabase client for admin API routes, or a 503 JSON response when env is missing.
 */
export function adminSupabaseOr503(correlationId: string):
  | { client: SupabaseClientNonNull }
  | { response: ReturnType<typeof correlatedJson> } {
  const client = tryCreateSupabaseClient();
  if (!client) {
    return {
      response: correlatedJson(
        correlationId,
        {
          error: "Supabase is not configured",
          code: "SUPABASE_NOT_CONFIGURED",
          hint: CONFIG_HINT,
        },
        { status: 503 },
      ),
    };
  }
  return { client };
}
