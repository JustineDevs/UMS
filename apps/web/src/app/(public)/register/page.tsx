import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@universal-music-store/ui";
import { WatermelonRegister } from "@/components/WatermelonRegister";
import { describeAuthSignInError } from "@/lib/auth-sign-in-errors";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Create account",
  description: "Create an account with Google sign-in.",
  path: "/register",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const callback =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/account";
  const authErr = describeAuthSignInError(sp.error);

  return (
    <>
      <WatermelonRegister callbackUrl={callback} />
      {sp.error ? (
        <div className="mx-auto max-w-md px-6 pb-8">
          <Alert variant="destructive">
            <AlertTitle>Account creation did not complete</AlertTitle>
            <AlertDescription>{authErr.hint}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </>
  );
}
