import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  AuthSplitShell,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@universal-music-store/ui";
import { AdminE2eCredentialsForm } from "@/components/AdminE2eCredentialsForm";
import { buildAuthOptions } from "@/lib/auth";
import {
  firstAdminAllowedEmail,
  isAdminE2eCredentialsConfigured,
} from "@/lib/admin-allowed-emails";

export const metadata: Metadata = {
  title: "E2E staff sign-in",
  robots: { index: false, follow: false },
};

/**
 * Playwright and local automation only. Not linked from the main sign-in page.
 * Disabled unless NODE_ENV=development and E2E env is configured (see admin-allowed-emails).
 */
export default async function AdminE2eSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  if (!isAdminE2eCredentialsConfigured()) {
    notFound();
  }

  const session = await getServerSession(buildAuthOptions());
  const role = session?.user?.role as string | undefined;
  if (role === "admin" || role === "staff") {
    redirect("/admin");
  }

  const sp = await searchParams;
  const callback =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/admin";

  const e2eDefaultEmail = firstAdminAllowedEmail();

  return (
    <AuthSplitShell variant="admin">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
            E2E staff sign-in
          </CardTitle>
          <CardDescription className="font-body text-sm leading-relaxed">
            Development and automated tests only. Production staff must use the main sign-in with
            Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminE2eCredentialsForm
            callbackUrl={callback}
            defaultEmail={e2eDefaultEmail}
          />
          <p className="text-center text-sm text-on-surface-variant">
            <Link href="/sign-in" className="font-medium text-primary underline">
              Standard staff sign-in (Google)
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthSplitShell>
  );
}
