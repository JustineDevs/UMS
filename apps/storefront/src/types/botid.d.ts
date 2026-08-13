declare module "botid/server" {
  export type BotIdVerification = {
    isBot: boolean;
  };

  export function checkBotId(): Promise<BotIdVerification>;
}

declare module "botid/client" {
  import type { JSX } from "react";

  type Protect = {
    path: string;
    method: string;
    advancedOptions?: {
      checkLevel?: "deepAnalysis" | "basic";
    };
  };

  type BotIdClientProps = {
    protect: Protect[];
  };

  export const BotIdClient: (props: BotIdClientProps) => JSX.Element;
}

declare module "botid/next/config" {
  export function withBotId<T>(config: T): T;
}
