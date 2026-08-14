import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { handleStorefrontProfilePatchRequest } from "./profile-handler";
import { withBotIdProtection } from "@/lib/botid-protection";

export const dynamic = "force-dynamic";

async function handlePATCH(req: Request) {
  return handleStorefrontProfilePatchRequest(req, {
    getSession: getStorefrontSession,
    createStorefrontServiceSupabase,
  });
}

export const PATCH = withBotIdProtection(handlePATCH);
