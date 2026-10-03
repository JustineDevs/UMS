"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function StorefrontAuthCard({
  heading,
  subheading,
  googleLabel,
  onGoogleLogin,
  footerPrompt,
  footerLabel,
  footerHref,
  children,
  googleTestId,
}: {
  heading: string;
  subheading: string;
  googleLabel: string;
  onGoogleLogin: () => void;
  footerPrompt: string;
  footerLabel: string;
  footerHref: string;
  children?: ReactNode;
  googleTestId?: string;
}) {
  return (
    <main
      className="storefront-page-shell flex min-h-[calc(100svh_-_5.5rem)] items-center justify-center bg-surface-container-low py-12"
      aria-labelledby="storefront-auth-heading"
    >
      <section className="w-full max-w-[420px] rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
        <header className="text-center">
          <Link
            href="/"
            className="mx-auto inline-flex items-center gap-3"
            aria-label="Universal Music Store home"
          >
            <Image
              src="/brand/uvs-logo-mark.png"
              alt=""
              width={40}
              height={40}
              className="size-10 object-contain"
            />
            <span className="font-headline text-sm font-bold text-primary">
              Universal Music Store
            </span>
          </Link>
          <h1
            id="storefront-auth-heading"
            className="mt-8 font-headline text-2xl font-bold tracking-tight text-primary"
          >
            {heading}
          </h1>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {subheading}
          </p>
        </header>
        <button
          type="button"
          onClick={onGoogleLogin}
          data-testid={googleTestId}
          className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Image
            src="/brand/google-g.svg"
            alt=""
            width={18}
            height={18}
            className="size-[18px]"
          />
          {googleLabel}
        </button>
        {children}
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          {footerPrompt}{" "}
          <Link
            href={footerHref}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {footerLabel}
          </Link>
        </p>
        <p className="mt-5 text-center text-xs leading-5 text-on-surface-variant">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
