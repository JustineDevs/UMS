"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { REVIEW_STAR_PATH } from "@/components/ReviewStarRatingDisplay";
import { getRecaptchaToken } from "@/components/RecaptchaScript";

export function ProductReviewForm({
  productSlug,
  medusaProductId,
}: {
  productSlug: string;
  medusaProductId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [verifiedHint, setVerifiedHint] = useState<boolean | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/reviews/csrf", { credentials: "same-origin" })
      .then((res) => res.json() as Promise<{ token?: string }>)
      .then((data) => setCsrfToken(data.token ?? ""))
      .catch(() => setCsrfToken(""));
  }, []);

  const signInHref = `/sign-in?callbackUrl=${encodeURIComponent(pathname || "/shop")}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (honeypotRef.current?.value) {
      setError("Unable to submit review");
      return;
    }
    setSaving(true);
    try {
      const recaptchaToken = await getRecaptchaToken("review");
      if (!recaptchaToken) {
        setError("Security verification is unavailable. Please try again later.");
        return;
      }
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          medusaProductId,
          rating,
          body: body.trim(),
          recaptchaToken,
          csrfToken,
          formStartedAt,
          _hp: honeypotRef.current?.value ?? "",
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        code?: string;
        isVerifiedBuyer?: boolean;
      };
      if (res.status === 401) {
        setError(j.error ?? "Sign in required");
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setError(j.error ?? "Unable to submit");
        setSaving(false);
        return;
      }
      setVerifiedHint(typeof j.isVerifiedBuyer === "boolean" ? j.isVerifiedBuyer : null);
      setDone(true);
      setBody("");
      setRating(5);
      setFormStartedAt(Date.now());
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="border-t border-outline-variant/20 pt-8 text-sm text-on-surface-variant">
        Checking sign-in…
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user?.email) {
    return (
      <div className="space-y-3 border-t border-outline-variant/20 pt-8">
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
          Write a review
        </h3>
        <p className="text-sm text-on-surface-variant">
          Sign in with your account to submit a review. Submissions are reviewed before they appear on the product page.
        </p>
        <Link
          href={signInHref}
          className="inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          Sign in to review
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div
        className="rounded-xl border border-outline-variant/20 bg-surface/30 px-5 py-4 dark:bg-surface/20"
        role="status"
      >
        <p className="text-sm font-medium text-primary">Thank you.</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Your review was received and is pending moderation. It will appear here after staff approval.
        </p>
        {verifiedHint === true ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            Your purchase of this product was verified from your order history. The verified badge will show after approval.
          </p>
        ) : verifiedHint === false ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            We could not match a completed order for this product on your account. The review can still be approved without the verified badge.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-6 border-t border-outline-variant/20 pt-8"
    >
      <div>
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
          Write a review
        </h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Signed in as {session.user.email}. Your display name comes from your account. Reviews are moderated before they go live.
        </p>
      </div>
      {error ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div>
        <span className="mb-2 block text-xs font-medium text-on-surface-variant">
          Rating
        </span>
        <div
          role="radiogroup"
          aria-label={`Rating: ${rating} out of 5 stars`}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= rating;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={saving}
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`Set rating to ${n} out of 5`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-0.5 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-surface-container-lowest"
                  onClick={() => setRating(n)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-9 w-9 sm:h-10 sm:w-10 ${
                      active
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-outline-variant/30 dark:text-outline-variant/25"
                    }`}
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d={REVIEW_STAR_PATH} />
                  </svg>
                </button>
              );
            })}
          </div>
          <span className="text-sm tabular-nums text-on-surface-variant" aria-live="polite">
            {rating} / 5
          </span>
        </div>
      </div>
      <div>
        <label htmlFor="product-review-body" className="mb-2 block text-xs font-medium text-on-surface-variant">
          Review
        </label>
        <textarea
          id="product-review-body"
          required
          minLength={5}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        <input
          ref={honeypotRef}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-px w-px opacity-0"
          name="website"
          defaultValue=""
        />
      </div>
      <button
        type="submit"
        disabled={saving || !csrfToken}
        className="min-h-11 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {saving ? "Submitting…" : "Submit a review"}
      </button>
    </form>
  );
}
