import { NextResponse } from "next/server";
import { checkBotId as runBotIdCheck } from "botid/server";
import { isSameOriginMutation } from "./request-origin";
import { isStorefrontAuthDisabled } from "./auth";

type BotIdVerification = {
  isBot: boolean;
  isHuman?: boolean;
  isVerifiedBot?: boolean;
  bypassed?: boolean;
};

type CheckBotId = () => Promise<BotIdVerification>;

const checkBotId: CheckBotId = runBotIdCheck;

function isLocalE2EBotIdBypassed(): boolean {
  return process.env.UVS_E2E_BOTID_BYPASS === "1" && process.env.VERCEL !== "1";
}

export function withBotIdProtection<
  TArgs extends readonly [Request, ...unknown[]],
>(
  handler: (..._args: TArgs) => Promise<Response>,
): (..._args: TArgs) => Promise<Response> {
  return async (..._args: TArgs) => {
    const request = _args[0];
    if (!isSameOriginMutation(request)) {
      return NextResponse.json(
        { error: "Cross-site mutation rejected", code: "CROSS_SITE_MUTATION" },
        { status: 403 },
      );
    }
    if (isStorefrontAuthDisabled() || isLocalE2EBotIdBypassed()) {
      return handler(..._args);
    }
    const protectionFailure = await verifyBotIdProtection();
    if (protectionFailure) return protectionFailure;
    return handler(..._args);
  };
}

/**
 * Runs Bot ID without imposing an authorization order on the caller.
 * Authenticated mutations can call this after their session check so an
 * unauthenticated request receives the contract's 401 before bot policy.
 */
export async function verifyBotIdProtection(): Promise<Response | null> {
  if (isStorefrontAuthDisabled() || isLocalE2EBotIdBypassed()) return null;
  let verification: BotIdVerification;
  try {
    verification = await checkBotId();
  } catch {
    return NextResponse.json(
      { error: "Bot protection is temporarily unavailable", code: "BOT_PROTECTION_UNAVAILABLE" },
      { status: 503 },
    );
  }
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return null;
}
