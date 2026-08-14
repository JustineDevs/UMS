"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import type { MedusaPaymentSummary } from "@/lib/medusa-order-bridge";

function minorToMajor(minor: number): number {
  return Math.round(minor) / 100;
}

export function OrderRefundPanel({
  orderId,
  currency,
  payments,
}: {
  orderId: string;
  currency: string;
  payments: MedusaPaymentSummary[];
}) {
  const { data: session } = useSession();
  const perms = session?.user?.permissions;
  const canRefund = staffHasPermission(perms ?? [], "orders:write");

  const [paymentId, setPaymentId] = useState(payments[0]?.id ?? "");
  const [amountMajor, setAmountMajor] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = payments.find((p) => p.id === paymentId) ?? payments[0];
  const captured =
    selected?.captured_amount != null && Number.isFinite(selected.captured_amount)
      ? selected.captured_amount
      : selected?.amount ?? 0;
  const alreadyRefunded =
    selected?.refunded_amount != null && Number.isFinite(selected.refunded_amount)
      ? selected.refunded_amount
      : 0;
  const refundableMinor = Math.max(0, captured - alreadyRefunded);
  const refundableMajor = minorToMajor(refundableMinor);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canRefund || !paymentId) return;
    setBusy(true);
    setMessage(null);
    const major = amountMajor.trim() === "" ? refundableMajor : Number(amountMajor);
    if (!Number.isFinite(major) || major <= 0) {
      setMessage("Enter a valid amount.");
      setBusy(false);
      return;
    }
    const amountMinor = Math.round(major * 100);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          amount_minor: amountMinor,
          note: note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setMessage(body.error ?? "Refund did not complete");
        setBusy(false);
        return;
      }
      setMessage("Refund submitted. Refresh the page to see updated payment status.");
    } catch {
      setMessage("Request was not completed");
    }
    setBusy(false);
  }

  if (payments.length === 0) {
    return (
      <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
        <h2 className="mb-2 font-headline text-sm font-bold uppercase tracking-widest text-primary">
          Refunds
        </h2>
        <p className="text-sm text-on-surface-variant">No recorded payments on this order.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
      <h2 className="mb-4 font-headline text-sm font-bold uppercase tracking-widest text-primary">
        Refunds
      </h2>
      <p className="text-xs text-on-surface-variant mb-4">
        Refunds go through your payment provider. Refundable now:{" "}
        <span className="font-semibold text-on-surface">
          {currency} {refundableMajor.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </p>

      {!canRefund ? (
        <p className="text-sm text-on-surface-variant">Requires orders:write permission.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4 max-w-md">
          {payments.length > 1 ? (
            <label className="block text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wide">Payment</span>
              <select
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="mt-1 w-full rounded border border-outline-variant/30 bg-white px-3 py-2 text-sm"
              >
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} ({minorToMajor(p.amount).toFixed(2)} {p.currency_code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-on-surface-variant text-xs uppercase tracking-wide">
              Amount ({currency})
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={refundableMajor}
              value={amountMajor}
              onChange={(e) => setAmountMajor(e.target.value)}
              placeholder={refundableMajor.toFixed(2)}
              className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-on-surface-variant text-xs uppercase tracking-wide">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
            />
          </label>
          {message ? <p className="text-sm text-primary">{message}</p> : null}
          <button
            type="submit"
            disabled={busy || refundableMinor <= 0}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {busy ? "Processing…" : "Issue refund"}
          </button>
        </form>
      )}
    </section>
  );
}
