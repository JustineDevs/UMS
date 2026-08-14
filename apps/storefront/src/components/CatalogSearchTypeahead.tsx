"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Suggestion = { slug: string; name: string; minPrice: number };

export function CatalogSearchTypeahead({
  initialQ,
  category,
  type,
  finish,
  brand,
  pickupConfig,
  bodyWood,
  condition,
  skillLevel,
  shippingSpeed,
  minPrice,
  maxPrice,
  sort,
}: {
  initialQ?: string;
  category?: string;
  type?: string;
  finish?: string;
  brand?: string;
  pickupConfig?: string;
  bodyWood?: string;
  condition?: string;
  skillLevel?: string;
  shippingSpeed?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const runSuggest = useCallback(
    async (term: string) => {
      const t = term.trim();
      if (t.length < 2) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/shop/search-suggest?q=${encodeURIComponent(t)}`,
        );
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setItems(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSuggest(q);
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, runSuggest]);

  useEffect(() => {
    function close(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function buildShopUrl(search: string) {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (type) p.set("type", type);
    if (finish) p.set("finish", finish);
    if (brand) p.set("brand", brand);
    if (pickupConfig) p.set("pickupConfig", pickupConfig);
    if (bodyWood) p.set("bodyWood", bodyWood);
    if (condition) p.set("condition", condition);
    if (skillLevel) p.set("skillLevel", skillLevel);
    if (shippingSpeed) p.set("shippingSpeed", shippingSpeed);
    if (minPrice != null) p.set("minPrice", String(minPrice));
    if (maxPrice != null) p.set("maxPrice", String(maxPrice));
    if (sort && sort !== "newest") p.set("sort", sort);
    if (search.trim()) p.set("q", search.trim());
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <label htmlFor="catalog-typeahead" className="sr-only">
        Search catalog
      </label>
      <input
        id="catalog-typeahead"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search products…"
        maxLength={80}
        autoComplete="off"
        className="w-full rounded-lg border border-outline-variant/30 bg-white px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
      />
      {loading ? (
        <p className="mt-1 text-[10px] text-on-surface-variant">Searching…</p>
      ) : null}
      {open && items.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-outline-variant/20 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {items.map((it) => (
            <li key={it.slug} role="option" aria-selected={false}>
              <Link
                href={`/shop/${it.slug}`}
                className="block px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium text-primary">{it.name}</span>
                <span className="ml-2 text-xs text-on-surface-variant">
                  PHP {it.minPrice.toLocaleString("en-PH")}
                </span>
              </Link>
            </li>
          ))}
          <li className="border-t border-outline-variant/15">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-primary hover:bg-surface-container-low"
              onClick={() => {
                router.push(buildShopUrl(q));
                setOpen(false);
              }}
            >
              View all results for &quot;{q.trim()}&quot;
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
