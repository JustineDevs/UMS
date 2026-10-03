"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import {
  isPhilippinesMobilePhone,
  type StorefrontShippingAddress,
} from "@universal-music-store/validation";
import { PhilippineAddressFields } from "./PhilippineAddressFields";

type Initial = {
  email: string;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  shippingAddresses: StorefrontShippingAddress[];
  updatedAt: string | null;
};

function emptyAddress(): StorefrontShippingAddress {
  return {
    id: crypto.randomUUID(),
    isDefault: false,
    fullName: "",
    phone: "",
    line1: "",
    barangay: "",
    city: "",
    province: "",
    country: "PH",
  };
}

export function AccountProfilePanel({
  initial,
  mode = "profile",
}: {
  initial: Initial;
  mode?: "profile" | "addresses";
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [avatarUrl] = useState(initial.avatarUrl ?? "");
  const [addresses, setAddresses] = useState<StorefrontShippingAddress[]>(() =>
    initial.shippingAddresses.length > 0
      ? initial.shippingAddresses
      : [],
  );
  const updatedAtRef = useRef(initial.updatedAt);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reauthUrl, setReauthUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const feedbackId = err ? "account-profile-error" : undefined;

  useEffect(() => {
    if (err) feedbackRef.current?.focus();
  }, [err]);

  function addAddress() {
    if (addresses.length >= 5) return;
    setAddresses((a) => [...a, emptyAddress()]);
  }

  function updateAddress(
    i: number,
    patch: Partial<StorefrontShippingAddress>,
  ) {
    setAddresses((prev) =>
      prev.map((row, j) =>
        j === i
          ? { ...row, ...patch }
          : patch.isDefault === true
            ? { ...row, isDefault: false }
            : row,
      ),
    );
  }

  function setDefaultAddress(index: number) {
    setAddresses((prev) => prev.map((address, i) => ({ ...address, isDefault: i === index })));
    setMsg(null);
  }

  function removeAddress(i: number) {
    setAddresses((prev) => {
      const wasDefault = prev[i]?.isDefault === true || (prev.every((address) => address.isDefault !== true) && i === 0);
      const next = prev.filter((_, j) => j !== i);
      if (!wasDefault || next.length === 0) return next;
      return next.map((address, index) => ({ ...address, isDefault: index === 0 }));
    });
    setMsg(null);
  }

  async function save() {
    setErr(null);
    setReauthUrl(null);
    setMsg(null);
    const ph = phone.trim();
    if (ph && !isPhilippinesMobilePhone(ph)) {
      setErr("Use a Philippine mobile (+63 or 09XXXXXXXXX).");
      return;
    }
    const defaultAddressIndex = Math.max(
      0,
      addresses.findIndex((address) => address.isDefault === true),
    );
    const normalizedAddresses = addresses.map((address, index) => ({
      ...address,
      isDefault: index === defaultAddressIndex,
    }));
    for (let i = 0; i < normalizedAddresses.length; i++) {
      const a = normalizedAddresses[i];
      if (
        !a.fullName.trim() ||
        !a.line1.trim() ||
        !(a.barangay?.trim() ?? "") ||
        !a.city.trim() ||
        !a.province.trim()
      ) {
        setErr(
          `Address ${i + 1}: full name, line 1, barangay, city, and province are required.`,
        );
        return;
      }
      if (!isPhilippinesMobilePhone(a.phone)) {
        setErr(
          `Address ${i + 1}: use a Philippine mobile for the contact phone.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updatedAt: updatedAtRef.current ?? undefined,
          displayName: displayName.trim() || undefined,
          phone: ph || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          shippingAddresses: normalizedAddresses,
        }),
      });
      const j = (await res.json()) as { error?: string; updatedAt?: string; reauthUrl?: string };
      if (!res.ok) {
        if (j.reauthUrl) {
          setErr(j.error ?? "Recent sign-in required.");
          setReauthUrl(j.reauthUrl);
          return;
        }
        setErr(j.error ?? "Save failed.");
        return;
      }
      if (j.updatedAt) updatedAtRef.current = j.updatedAt;
      setMsg("Saved.");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 sm:p-8 md:col-span-2">
      {mode === "profile" ? (
        <div>
          <h2 className="font-headline text-2xl font-bold tracking-tight text-primary">
            Profile information
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Keep your contact details current for order updates and delivery.
          </p>
        </div>
      ) : (
        <>
          <h2 className="font-headline text-2xl font-bold tracking-tight text-primary">
            Shipping addresses
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Save up to five delivery locations and choose a default for checkout.
          </p>
        </>
      )}

      {err ? (
        <p
          ref={feedbackRef}
          id="account-profile-error"
          className="mt-4 text-sm text-red-700"
          role="alert"
          tabIndex={-1}
        >
          {err}
          {reauthUrl ? (
            <>
              {" "}
              <a
                href={reauthUrl}
                className="font-semibold underline underline-offset-2"
              >
                Sign in again
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-4 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}

      {mode === "profile" ? (
        <div className="mt-8 space-y-8">
          <div className="flex items-center gap-4 border-b border-outline-variant/15 pb-6">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-container-low text-primary ring-1 ring-outline-variant/20">
              {avatarUrl ? <Image src={avatarUrl} alt="" width={80} height={80} className="size-full object-cover" unoptimized /> : <span className="text-2xl font-semibold">{(displayName || initial.email || "U").slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-primary">{displayName || "Your account"}</p>
              <p className="mt-1 text-sm text-on-surface-variant">Signed in with Google</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label htmlFor="account-email" className="block text-sm font-semibold text-primary">
                Email address
              </label>
              <div className="relative mt-2">
                <input
                  id="account-email"
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 pr-10 text-sm text-on-surface-variant"
                  value={initial.email}
                  readOnly
                  aria-readonly="true"
                />
                <LockKeyhole className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-label="Managed by Google" />
              </div>
            </div>
            <div>
              <label htmlFor="account-display-name" className="block text-sm font-semibold text-primary">
                Display name <span className="font-normal text-on-surface-variant">(optional)</span>
              </label>
              <input
                id="account-display-name"
                className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2.5 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-describedby={feedbackId}
                maxLength={120}
                placeholder="How we greet you in emails"
              />
            </div>
            <div>
              <label htmlFor="account-phone" className="block text-sm font-semibold text-primary">
                Mobile number <span className="font-normal text-on-surface-variant">(Philippines)</span>
              </label>
              <input
                id="account-phone"
                className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2.5 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-describedby={feedbackId}
                maxLength={40}
                placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>
        </div>
      ) : null}

      {mode === "addresses" ? <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
            Saved addresses <span className="font-normal tracking-normal text-on-surface-variant">({addresses.length} of 5)</span>
          </h3>
          <button
            type="button"
            onClick={addAddress}
            disabled={addresses.length >= 5}
            className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
          >
            Add address
          </button>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          Expand an address to edit, set it as your checkout default, or remove it. Changes apply when you save.
        </p>

        {addresses.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            No saved addresses yet. Add one for faster checkout notes.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
        {addresses.map((a, i) => (
              <li
                key={a.id ?? `${a.line1 ?? "address"}-${a.city ?? "city"}-${a.postalCode ?? "postal"}-${a.country ?? "country"}`}
                className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm"
              >
                <details open={i === 0}>
                  <summary className="flex flex-wrap cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="rounded-full border border-outline-variant/25 bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {a.label?.trim() || `Address ${i + 1}`}
                      </span>
                      {a.isDefault || (addresses.every((address) => address.isDefault !== true) && i === 0) ? (
                        <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-primary">
                          Default
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant">Edit address</span>
                  </summary>
                  <div className="border-t border-outline-variant/15 px-5 pb-5 pt-5">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-on-surface-variant">
                        {a.isDefault || (addresses.every((address) => address.isDefault !== true) && i === 0)
                          ? "Used automatically at checkout."
                          : "Choose this address for future checkouts."}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        {!a.isDefault && !(addresses.every((address) => address.isDefault !== true) && i === 0) ? (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(i)}
                            className="text-xs font-semibold text-primary underline underline-offset-2"
                          >
                            Set as default
                          </button>
                        ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Remove this saved address?")) removeAddress(i);
                        }}
                        className="text-xs font-semibold text-on-surface-variant underline underline-offset-2"
                        aria-label={`Remove ${a.label?.trim() || `Address ${i + 1}`}`}
                      >
                        Remove
                      </button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor={`account-address-${i}-full-name`} className="text-sm font-medium text-primary">
                      Full name
                    </label>
                    <input
                      id={`account-address-${i}-full-name`}
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.fullName}
                      onChange={(e) =>
                        updateAddress(i, { fullName: e.target.value })
                      }
                      aria-describedby={feedbackId}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label htmlFor={`account-address-${i}-phone`} className="text-sm font-medium text-primary">
                      Phone
                    </label>
                    <input
                      id={`account-address-${i}-phone`}
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.phone}
                      onChange={(e) =>
                        updateAddress(i, { phone: e.target.value })
                      }
                      aria-describedby={feedbackId}
                      maxLength={40}
                      inputMode="tel"
                    />
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-on-surface-variant sm:col-span-2">
                    <input
                      type="radio"
                      name="account-default-address"
                      checked={a.isDefault === true || (addresses.every((address) => address.isDefault !== true) && i === 0)}
                      onChange={() => updateAddress(i, { isDefault: true })}
                    />
                    Use as default delivery address
                  </label>
                  <div>
                    <label htmlFor={`account-address-${i}-label`} className="text-sm font-medium text-primary">
                      Label (optional)
                    </label>
                    <input
                      id={`account-address-${i}-label`}
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.label ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { label: e.target.value })
                      }
                      aria-describedby={feedbackId}
                      maxLength={60}
                      placeholder="Home, Office…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <PhilippineAddressFields
                      address={a}
                      idPrefix={`account-address-${i}`}
                      onChange={(next) => updateAddress(i, next)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`account-address-${i}-line2`} className="text-sm font-medium text-primary">
                      Address line 2 (optional)
                    </label>
                    <input
                      id={`account-address-${i}-line2`}
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.line2 ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { line2: e.target.value })
                      }
                      aria-describedby={feedbackId}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label htmlFor={`account-address-${i}-postal-code`} className="text-sm font-medium text-primary">
                      Postal code (optional)
                    </label>
                    <input
                      id={`account-address-${i}-postal-code`}
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.postalCode ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { postalCode: e.target.value })
                      }
                      aria-describedby={feedbackId}
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <label htmlFor={`account-address-${i}-country`} className="text-sm font-medium text-primary">
                      Country
                    </label>
                    <select
                      id={`account-address-${i}-country`}
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.country}
                      onChange={(e) =>
                        updateAddress(i, {
                          country: e.target.value.toUpperCase().slice(0, 2),
                        })
                      }
                      aria-describedby={feedbackId}
                    >
                      <option value="PH">PH</option>
                    </select>
                  </div>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div> : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-8 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : mode === "addresses" ? "Save addresses" : "Save changes"}
      </button>
    </section>
  );
}
