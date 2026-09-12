import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AuthSplitShell,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@universal-music-store/ui";
import { describeAuthSignInError } from "@/lib/auth-sign-in-errors";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
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
    <AuthSplitShell>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
            Sign in
          </CardTitle>
          <CardDescription className="font-body text-sm leading-relaxed">
            Access your account and order history with Google. After you sign in,
            you will be asked for a short delivery profile (name, mobile, address)
            if anything is still missing. By continuing you agree to our{" "}
            <Link href="/terms" className="underline hover:text-primary">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-primary">
              Privacy
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sp.error ? (
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
          ) : null}
          <GoogleSignInButton callbackUrl={callback} promptLogin={sp.reauth === "1"} label={sp.reauth === "1" ? "Re-authenticate with Google" : undefined} />
          <p className="text-center text-sm text-on-surface-variant">
            New here?{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline"
            >
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthSplitShell>
  );
}
