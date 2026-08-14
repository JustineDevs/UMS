"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isPhilippinesMobilePhone,
  type StorefrontShippingAddress,
} from "@universal-music-store/validation";

type Initial = {
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  shippingAddresses: StorefrontShippingAddress[];
};

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

export function AccountProfilePanel({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [addresses, setAddresses] = useState<StorefrontShippingAddress[]>(() =>
    initial.shippingAddresses.length > 0
      ? initial.shippingAddresses
      : [],
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addAddress() {
    if (addresses.length >= 5) return;
    setAddresses((a) => [...a, emptyAddress()]);
  }

  function updateAddress(
    i: number,
    patch: Partial<StorefrontShippingAddress>,
  ) {
    setAddresses((prev) =>
      prev.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    );
  }

  function removeAddress(i: number) {
    setAddresses((prev) => prev.filter((_, j) => j !== i));
  }

  async function save() {
    setErr(null);
    setMsg(null);
    const ph = phone.trim();
    if (ph && !isPhilippinesMobilePhone(ph)) {
      setErr("Use a Philippine mobile (+63 or 09XXXXXXXXX).");
      return;
    }
    for (let i = 0; i < addresses.length; i++) {
      const a = addresses[i];
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
          displayName: displayName.trim() || undefined,
          phone: ph || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          shippingAddresses: addresses,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Save failed.");
        return;
      }
      setMsg("Saved.");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 md:col-span-2">
      <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
        Profile &amp; saved addresses
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        We validate Philippine mobile numbers. Saved addresses speed up checkout
        copy-paste; the payment step may still ask you to confirm details with
        your provider.
      </p>

      {err ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-4 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Display name (optional)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            placeholder="How we greet you in emails"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Avatar URL (optional)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            maxLength={500}
            placeholder="https://..."
            inputMode="url"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Mobile (Philippines)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
            Saved addresses (max 5)
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

        {addresses.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            No saved addresses yet. Add one for faster checkout notes.
          </p>
        ) : (
          <ul className="mt-4 space-y-8">
            {addresses.map((a, i) => (
              <li
                key={a.id ?? i}
                className="rounded-lg border border-outline-variant/15 p-4"
              >
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeAddress(i)}
                    className="text-xs text-on-surface-variant underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Full name
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.fullName}
                      onChange={(e) =>
                        updateAddress(i, { fullName: e.target.value })
                      }
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Phone
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.phone}
                      onChange={(e) =>
                        updateAddress(i, { phone: e.target.value })
                      }
                      maxLength={40}
                      inputMode="tel"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Label (optional)
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.label ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { label: e.target.value })
                      }
                      maxLength={60}
                      placeholder="Home, Office…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Address line 1
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.line1}
                      onChange={(e) =>
                        updateAddress(i, { line1: e.target.value })
                      }
                      maxLength={200}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Address line 2 (optional)
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.line2 ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { line2: e.target.value })
                      }
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Barangay
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.barangay ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { barangay: e.target.value })
                      }
                      maxLength={120}
                      placeholder="Required for PH couriers"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      City / municipality
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.city}
                      onChange={(e) =>
                        updateAddress(i, { city: e.target.value })
                      }
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Province
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.province}
                      onChange={(e) =>
                        updateAddress(i, { province: e.target.value })
                      }
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Postal code (optional)
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.postalCode ?? ""}
                      onChange={(e) =>
                        updateAddress(i, { postalCode: e.target.value })
                      }
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Country
                    </label>
                    <select
                      className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
                      value={a.country}
                      onChange={(e) =>
                        updateAddress(i, {
                          country: e.target.value.toUpperCase().slice(0, 2),
                        })
                      }
                    >
                      <option value="PH">PH</option>
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 p-4">
        <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
          How you pay
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          Cards and wallets are handled on your payment partner&apos;s secure page.
          We do not store full card numbers in your profile. Use checkout to pay
          with the options enabled for this store.
        </p>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-8 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </section>
  );
}
