"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function AccountPrivacyControls() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [erasureState, setErasureState] = useState<"idle" | "loading" | "error">("idle");

  async function exportData() {
    setState("loading");
    try {
      const response = await fetch("/api/account/privacy/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error("export unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-account-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function eraseAccount() {
    if (!window.confirm("This permanently deletes your account data where legally permitted. Type DELETE in the next confirmation to continue.")) return;
    if (window.prompt("Type DELETE to confirm account erasure.") !== "DELETE") return;
    setErasureState("loading");
    try {
      const response = await fetch("/api/account/privacy/erasure", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (!response.ok) throw new Error("erasure unavailable");
      await signOut({ callbackUrl: "/" });
    } catch {
      setErasureState("error");
    }
  }

  return (
    <section className="mt-6 border-t border-outline-variant/15 pt-5" aria-labelledby="privacy-controls-heading">
      <h3 id="privacy-controls-heading" className="text-sm font-semibold text-primary">Privacy controls</h3>
      <p className="mt-2 max-w-xl text-xs leading-5 text-on-surface-variant">
        Download the account data currently associated with your signed-in account. Financial order records remain retained for legal and operational requirements.
      </p>
      <button
        type="button"
        onClick={() => void exportData()}
        disabled={state === "loading"}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low disabled:opacity-60"
      >
        {state === "loading" ? "Preparing export…" : "Download my data"}
      </button>
      {state === "error" ? <p className="mt-2 text-xs text-error" role="alert">The export is unavailable right now. Please try again later.</p> : null}
      <div className="mt-5 border-t border-outline-variant/15 pt-4">
        <p className="text-xs leading-5 text-on-surface-variant">Account deletion removes personal data where permitted; financial and fraud records may be retained by law.</p>
        <button
          type="button"
          onClick={() => void eraseAccount()}
          disabled={erasureState === "loading"}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-error/40 px-4 py-2 text-sm font-semibold text-error hover:bg-error/5 disabled:opacity-60"
        >
          {erasureState === "loading" ? "Deleting account…" : "Delete my account"}
        </button>
        {erasureState === "error" ? <p className="mt-2 text-xs text-error" role="alert">Account deletion is unavailable right now. No changes were saved.</p> : null}
      </div>
    </section>
  );
}
