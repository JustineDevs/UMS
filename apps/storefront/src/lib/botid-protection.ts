import { NextResponse } from "next/server";
import { checkBotId as runBotIdCheck } from "botid/server";

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
    if (process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production") {
      return handler(..._args);
    }
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handler(..._args);
  };
}
