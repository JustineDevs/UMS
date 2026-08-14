"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@universal-music-store/ui";
import { getHttpErrorCopy } from "@/lib/http-error-copy";

type HttpErrorPageProps = {
  code: number;
  title?: string;
  description?: string;
  /** When set (e.g. from error boundary), shows a Retry action. */
  onRetry?: () => void;
  /** Error digest from Next.js error boundary. */
  digest?: string;
  /** Hide secondary actions (e.g. global-error minimal shell). */
  compact?: boolean;
};

export function HttpErrorPage({
  code,
  title: titleOverride,
  description: descriptionOverride,
  onRetry,
  digest,
  compact = false,
}: HttpErrorPageProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const copy = getHttpErrorCopy(code);
  const title = titleOverride ?? copy?.title ?? "Error";
  const description =
    descriptionOverride ?? copy?.description ?? "Something went wrong. Try again later.";

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ScrollTrigger.refresh();
      return;
    }
    const el = shellRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    gsap.fromTo(
      el,
      { autoAlpha: 0.88, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        ease: "power2.out",
        overwrite: "auto",
      },
    );
  }, [code, title, description]);

  return (
    <div ref={shellRef} className="min-w-0">
      <main className="storefront-page-shell flex min-h-[50vh] flex-col items-center justify-center text-center">
        <Card className="w-full max-w-lg shadow-[0px_24px_48px_rgba(0,0,0,0.06)]">
          <CardHeader className="space-y-3">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <Badge
                variant="secondary"
                className="font-mono text-xs uppercase tracking-widest text-on-surface-variant"
              >
                HTTP {code}
              </Badge>
            </div>
            <CardTitle className="font-headline text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {title}
            </CardTitle>
            <CardDescription className="font-body text-sm leading-relaxed text-on-surface-variant">
              {description}
            </CardDescription>
          </CardHeader>
          {digest ? (
            <CardContent className="pt-0">
              <p className="text-center font-mono text-xs text-on-surface-variant/80">
                {digest}
              </p>
            </CardContent>
          ) : null}
          {!compact ? (
            <CardFooter className="flex flex-col flex-wrap items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              {onRetry ? (
                <Button type="button" variant="default" size="lg" onClick={onRetry}>
                  Try again
                </Button>
              ) : null}
              {code === 401 || code === 403 ? (
                <Button asChild variant="default" size="lg" className="uppercase tracking-widest">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              ) : null}
              <Button
                asChild
                variant={onRetry || code === 401 || code === 403 ? "outline" : "default"}
                size="lg"
                className="uppercase tracking-widest"
              >
                <Link href="/">Back to home</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="uppercase tracking-widest">
                <Link href="/shop">Shop</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="uppercase tracking-widest">
                <Link href="/sitemap">Site map</Link>
              </Button>
            </CardFooter>
          ) : (
            <CardFooter className="flex justify-center">
              <Button asChild variant="default" size="lg">
                <Link href="/">Back to home</Link>
              </Button>
            </CardFooter>
          )}
        </Card>
      </main>
    </div>
  );
}
