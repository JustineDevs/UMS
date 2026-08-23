"use client";
import Link from "next/link";
import { isStaleCheckoutMessage } from "@/lib/medusa-checkout-errors";

/**
 * Recovery copy when checkout or payment session is no longer valid (PRD: StaleSessionNotice).
 */
export function StaleSessionNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const looksStale = isStaleCheckoutMessage(trimmed);

  if (!looksStale) {
    return (
      <div className="mt-4 space-y-2">
        <p className="text-sm text-red-600 font-medium" role="alert">
          {trimmed}
        </p>
        <RecoveryActions onDismiss={onDismiss} />
      </div>
    );
  }

  return (
    <div
      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
      role="alert"
    >
      <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-red-900">
        Session needs review
      </p>
      <p className="mt-1 font-medium leading-relaxed">{trimmed}</p>
      <RecoveryActions onDismiss={onDismiss} />
    </div>
  );
}

function RecoveryActions({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/cart"
        className="inline-flex min-h-11 items-center rounded-md border border-red-300 px-3 text-xs font-semibold uppercase tracking-wider text-red-800 underline"
      >
        Review bag
      </Link>
      <Link
        href="/contact?topic=checkout"
        className="inline-flex min-h-11 items-center rounded-md border border-red-300 px-3 text-xs font-semibold uppercase tracking-wider text-red-800 underline"
      >
        Contact support
      </Link>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-11 items-center px-3 text-xs font-semibold uppercase tracking-wider text-red-700 underline"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
