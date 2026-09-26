"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";

export function WatermelonSignIn({ callbackUrl, reauth }: { callbackUrl: string; reauth: boolean }) {
  const handleGoogleLogin = async () => {
    try {
      await signIn("google", { callbackUrl }, reauth ? { prompt: "login" } : undefined);
    } catch {
      window.location.assign(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&error=ClientConfiguration`);
    }
  };

  return (
    <main id="main-content" className="flex min-h-[calc(100svh-5.5rem)] items-center justify-center bg-surface-container-low px-6 py-20" aria-labelledby="login-heading">
      <section className="w-full max-w-[380px] rounded-xl border border-outline-variant/30 bg-surface p-6 shadow-sm sm:p-8">
        <header className="text-center">
          <Link href="/" className="mx-auto inline-flex items-center gap-3" aria-label="Universal Music Store home">
            <Image src="/brand/uvs-logo-mark.png" alt="" width={40} height={40} className="size-10 object-contain" />
            <span className="font-headline text-sm font-bold text-primary">Universal Music Store</span>
          </Link>
          <h1 id="login-heading" className="mt-8 font-headline text-2xl font-bold tracking-tight text-primary">Login</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Log in to continue to your account.</p>
        </header>
        <button type="button" onClick={() => void handleGoogleLogin()} className="mt-7 inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-outline-variant/40 bg-surface-container-lowest text-sm font-semibold text-primary transition hover:bg-surface-container-low" data-testid="sign-in-google">
          <Image src="/brand/google-g.svg" alt="" width={18} height={18} className="size-[18px]" /> Continue with Google
        </button>
        <p className="mt-6 text-center text-sm text-on-surface-variant">Don&apos;t have an account yet? <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-semibold text-primary underline underline-offset-4">Sign up</Link></p>
        <p className="mt-5 text-center text-xs text-on-surface-variant">By continuing, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </section>
    </main>
  );
}
