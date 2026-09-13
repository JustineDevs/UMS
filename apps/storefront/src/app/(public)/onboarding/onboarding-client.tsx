"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  isPhilippinesMobilePhone,
  type StorefrontShippingAddress,
} from "@universal-music-store/validation";
import { PhilippineAddressFields } from "@/components/PhilippineAddressFields";
import { useEffect, useState } from "react";

function emptyAddress(): StorefrontShippingAddress {
  return {
    id: crypto.randomUUID(),
    fullName: "",
    phone: "",
    line1: "",
    barangay: "",
    city: "",
    province: "",
    country: "PH",
  };
}

export function OnboardingClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextSafe = (() => {
    const n = searchParams?.get("next");
    if (typeof n === "string" && n.startsWith("/") && !n.startsWith("//")) return n;
    return "/account";
  })();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState<StorefrontShippingAddress>(() => emptyAddress());
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent("/onboarding?next=" + encodeURIComponent(nextSafe))}`);
    }
  }, [status, router, nextSafe]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void fetch("/api/account/profile/status", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Profile status request failed (${r.status})`);
        const j = (await r.json()) as {
          complete?: boolean;
          profile?: {
            displayName: string | null;
            phone: string | null;
            shippingAddresses: StorefrontShippingAddress[];
          };
        };
        if (j.complete) {
          router.replace(nextSafe);
          return;
        }
        const p = j.profile;
        if (p) {
          setDisplayName(p.displayName ?? session?.user?.name ?? "");
          setPhone(p.phone ?? "");
          const first = p.shippingAddresses?.[0];
          if (first) setAddr({ ...first });
          else {
            setAddr({
              ...emptyAddress(),
              fullName: p.displayName ?? session?.user?.name ?? "",
              phone: p.phone ?? "",
            });
          }
        } else {
          setDisplayName(session?.user?.name ?? "");
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, [status, router, nextSafe, session?.user?.name]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const dn = displayName.trim();
    if (dn.length < 2) {
      setErr("Please enter your full name.");
      return;
    }
    if (!phone.trim() || !isPhilippinesMobilePhone(phone)) {
      setErr("Enter a Philippine mobile number (+63 or 09XXXXXXXXX).");
      return;
    }
    if (
      !addr.line1.trim() ||
      !addr.barangay?.trim() ||
      !addr.city.trim() ||
      !addr.province.trim()
    ) {
      setErr(
        "Fill in the delivery contact, street, barangay, city, and province.",
      );
      return;
    }
    setSaving(true);
    const r = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: dn,
        phone: phone.trim(),
        shippingAddresses: [
          {
            ...addr,
            fullName: dn,
            phone: phone.trim(),
          },
        ],
      }),
    });
    setSaving(false);
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string; reauthUrl?: string };
      if (j.code === "RECENT_AUTH_REQUIRED" && j.reauthUrl) {
        router.replace(`/sign-in?callbackUrl=${encodeURIComponent(`/onboarding?next=${nextSafe}`)}&reauth=1`);
        return;
      }
      setErr(j.error ?? "Could not save. Try again.");
      return;
    }
    router.replace(nextSafe);
  }

  if (status === "loading" || !hydrated) {
    return <p className="text-sm text-on-surface-variant">Loading…</p>;
  }
  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  const email = session.user.email ?? "";

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <h1 className="font-headline text-2xl font-bold text-primary">Welcome</h1>
      <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
        A few details help us deliver your orders and reach you if something comes up.
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-5">
        <label className="block text-xs font-medium text-on-surface-variant">
          Full name
          <input
            required
            className="mt-1 w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            name="name"
            autoComplete="name"
          />
        </label>
        <label className="block text-xs font-medium text-on-surface-variant">
          Email
          <input
            readOnly
            className="mt-1 w-full cursor-not-allowed rounded border border-outline-variant/20 bg-surface-container-high/50 px-3 py-2 text-sm text-on-surface-variant"
            value={email}
          />
        </label>
        <label className="block text-xs font-medium text-on-surface-variant">
          Mobile number
          <input
            required
            className="mt-1 w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            name="tel"
            placeholder="+63… or 09…"
            autoComplete="tel"
          />
        </label>

        <fieldset className="space-y-3 rounded-lg border border-outline-variant/15 p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-primary">
            Primary delivery address
          </legend>
          <PhilippineAddressFields address={addr} onChange={setAddr} />
        </fieldset>

        {err ? (
          <p className="text-sm text-red-600" role="alert">
            {err}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-primary py-3 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
        <p className="text-center text-xs text-on-surface-variant">
          You can update these anytime under{" "}
          <Link href="/account" className="text-primary underline">
            Account
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
