"use client";

export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-outline-variant/60 bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Save / print receipt
    </button>
  );
}
