import { NextResponse } from "next/server";
import { checkBotId as runBotIdCheck } from "botid/server";
import { isSameOriginMutation } from "./request-origin";

type BotIdVerification = {
  isBot: boolean;
  isHuman?: boolean;
  isVerifiedBot?: boolean;
  bypassed?: boolean;
};

type CheckBotId = () => Promise<BotIdVerification>;

const checkBotId: CheckBotId = runBotIdCheck;

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
    if (process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true") {
      return handler(..._args);
    }
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
    return handler(..._args);
  };
}
