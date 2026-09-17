import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@universal-music-store/ui";
import { describeAuthSignInError } from "@/lib/auth-sign-in-errors";
import { WatermelonSignIn } from "@/components/WatermelonSignIn";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign in",
  description: "Access your account and order history with Google.",
  path: "/sign-in",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reauth?: string }>;
}) {
  const sp = await searchParams;
  const callback =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/account";
  const authErr = describeAuthSignInError(sp.error);

  return (
    <>
      <WatermelonSignIn callbackUrl={callback} reauth={sp.reauth === "1"} />
      {sp.error ? (
        <div className="mx-auto max-w-md px-6 pb-8">
          <Alert variant="destructive">
            <AlertTitle>Sign-in did not complete</AlertTitle>
            <AlertDescription>
              <p className="leading-relaxed opacity-95">{authErr.hint}</p>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-medium opacity-80">
                  Details for support
                </summary>
                <p className="mt-2 font-mono opacity-80">{authErr.codeLabel}</p>
              </details>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </>
  );
}
