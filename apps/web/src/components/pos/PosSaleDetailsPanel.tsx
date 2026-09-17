"use client";

import { POS_FEATURE_MAPPINGS, type PosSaleFeatureMetadata } from "@universal-music-store/platform-data";

export function PosSaleDetailsPanel({
  value,
  onChange,
}: {
  value: PosSaleFeatureMetadata;
  onChange: (_value: PosSaleFeatureMetadata) => void;
}) {
  return (
    <details className="group rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="flex items-center gap-2 text-sm font-bold text-primary">
            <span className="material-symbols-outlined text-base">tune</span>
            Sale details
          </span>
          <span className="mt-1 block text-xs text-on-surface-variant">
            Add information that should follow this sale into orders, receipts, and customer records.
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
      </summary>
      <div className="grid gap-4 border-t border-outline-variant/15 p-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Order tag
            <input
              value={value.orderTag ?? ""}
              onChange={(e) => onChange({ ...value, orderTag: e.target.value })}
              placeholder="Example: showroom, reserved, delivery"
              maxLength={80}
              className="mt-2 w-full rounded-lg border border-outline-variant/25 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/15 bg-surface-container-low p-3 text-sm">
            <input
              type="checkbox"
              checked={value.eInvoiceRequested ?? false}
              onChange={(e) => onChange({ ...value, eInvoiceRequested: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-semibold text-primary">Customer requested an e-invoice</span>
              <span className="mt-1 block text-xs text-on-surface-variant">The request is saved with the order for the invoicing workflow.</span>
            </span>
          </label>
          {value.eInvoiceRequested ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="email" value={value.eInvoiceCustomerEmail ?? ""} onChange={(e) => onChange({ ...value, eInvoiceCustomerEmail: e.target.value })} placeholder="Invoice email" className="rounded-lg border border-outline-variant/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
              <input value={value.eInvoiceCustomerTin ?? ""} onChange={(e) => onChange({ ...value, eInvoiceCustomerTin: e.target.value })} placeholder="Tax ID (optional)" className="rounded-lg border border-outline-variant/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {POS_FEATURE_MAPPINGS.map((mapping) => (
            <div key={mapping.key} className="rounded-lg border border-outline-variant/15 bg-white p-3">
              <p className="text-xs font-bold text-primary">{mapping.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{mapping.description}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
