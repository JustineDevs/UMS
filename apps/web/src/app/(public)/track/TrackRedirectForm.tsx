"use client";

import { useState, type FormEvent } from "react";
import { StorefrontActionButton, StorefrontField } from "@/components/storefront/StorefrontPagePrimitives";
import { resolveTrackingPath } from "@/lib/tracking-link-resolve";

export function TrackRedirectForm() {
  const [trackingUrl, setTrackingUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = resolveTrackingPath(trackingUrl, `${window.location.origin}/track`);
    if (!path) {
      setError("Enter a complete secure tracking link, such as https://your-store.example/track/cap_…");
      return;
    }
    window.location.assign(path);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <StorefrontField
        id="tracking-link"
        type="url"
        name="trackingUrl"
        label="Full secure tracking link"
        placeholder="https://…/track/cap_…"
        value={trackingUrl}
        onChange={(event) => {
          setTrackingUrl(event.target.value);
          if (error) setError(null);
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "tracking-link-error" : undefined}
        required
      />
      {error ? (
        <p id="tracking-link-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <StorefrontActionButton type="submit" variant="primary">
        Track
      </StorefrontActionButton>
    </form>
  );
}
