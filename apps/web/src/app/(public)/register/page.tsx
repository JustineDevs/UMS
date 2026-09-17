import type { Metadata } from "next";
import { WatermelonRegister } from "@/components/WatermelonRegister";
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
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callback =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/account";

  return (
    <WatermelonRegister callbackUrl={callback} />
  );
}
