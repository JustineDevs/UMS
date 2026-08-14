import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import {
  AuthSplitShell,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@universal-music-store/ui";
import { AdminGoogleSignInButton } from "@/components/AdminGoogleSignInButton";
import { authOptions } from "@/lib/auth";

const storefrontUrl =
  process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as string | undefined;
  if (role === "admin" || role === "staff") {
    redirect("/admin");
  }

  const sp = await searchParams;
  const callback =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/admin";

  return (
    <AuthSplitShell variant="admin">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
            Staff sign in
          </CardTitle>
          <CardDescription className="font-body text-sm leading-relaxed">
            Sign in with Google using the account that is authorized for staff access. This is the
            only sign-in method for the admin app. For the customer shop, use the storefront link
            below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminGoogleSignInButton callbackUrl={callback} />
          <p className="text-center text-sm text-on-surface-variant">
            <Link
              href={storefrontUrl}
              className="font-medium text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open customer storefront
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthSplitShell>
  );
}
