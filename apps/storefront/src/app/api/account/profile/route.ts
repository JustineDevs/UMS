import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { handleStorefrontProfilePatchRequest } from "./profile-handler";
import { withBotIdProtection } from "@/lib/botid-protection";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

async function handlePATCH(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  return handleStorefrontProfilePatchRequest(req, {
    getSession: getStorefrontSession,
    createStorefrontServiceSupabase,
  });
}

export const PATCH = withBotIdProtection(handlePATCH);
