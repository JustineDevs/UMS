"use client";

import { useState } from "react";
import {
  CATALOG_COLOR_PRESETS,
  CATALOG_SIZE_PRESETS,
} from "./catalog-variant-presets";

type Props = {
  sizes: string[];
  colors: string[];
  onSizesChange: (_next: string[]) => void;
  onColorsChange: (_next: string[]) => void;
  disabled?: boolean;
};

function toggle(list: string[], value: string, on: boolean): string[] {
  const t = value.trim();
  if (!t) return list;
  if (on) {
    if (list.includes(t)) return list;
    return [...list, t];
  }
  return list.filter((x) => x !== t);
}

export function VariantMatrixField({
  sizes,
  colors,
  onSizesChange,
  onColorsChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-6 rounded-lg border border-outline-variant/25 bg-surface-container-low px-4 py-4">
      <p className="text-sm font-medium text-on-surface">Variants on create</p>
      <p className="text-xs leading-relaxed text-on-surface-variant">
        Pick one or more sizes and one or more colors. Each size and color pair becomes a sellable
        variant with the same price and stock each. Use one size and one color for a simple product.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-outline-variant/30 bg-white px-2 py-1 text-xs font-medium text-on-surface disabled:opacity-50"
          onClick={() => onSizesChange([...CATALOG_SIZE_PRESETS])}
        >
          All preset sizes
        </button>
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-outline-variant/30 bg-white px-2 py-1 text-xs font-medium text-on-surface disabled:opacity-50"
          onClick={() => onColorsChange([...CATALOG_COLOR_PRESETS])}
        >
          All preset colors
        </button>
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-outline-variant/30 bg-white px-2 py-1 text-xs font-medium text-on-surface disabled:opacity-50"
          onClick={() =>
            onColorsChange([
              "Black",
              "White",
              "Gray",
              "Navy",
              "Beige",
              "Khaki",
            ])
          }
        >
          Common colors bundle
        </button>
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-outline-variant/30 bg-white px-2 py-1 text-xs font-medium text-on-surface disabled:opacity-50"
          onClick={() => {
            onSizesChange(["S", "M", "L", "XL"]);
            onColorsChange(["Black", "White"]);
          }}
        >
          S–XL × Black, White
        </button>
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-outline-variant/30 bg-white px-2 py-1 text-xs font-medium text-on-surface disabled:opacity-50"
          onClick={() => onSizesChange([])}
        >
          Clear sizes
        </button>
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-outline-variant/30 bg-white px-2 py-1 text-xs font-medium text-on-surface disabled:opacity-50"
          onClick={() => onColorsChange([])}
        >
          Clear colors
        </button>
      </div>

      {sizes.length === 0 || colors.length === 0 ? (
        <p className="rounded-md border border-dashed border-outline-variant/40 bg-white/80 px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
          {sizes.length === 0 && colors.length === 0
            ? "Choose every size and color you sell using the checkboxes below, or use a shortcut button above. Example: tick S, M, L and Black, White to create six variants."
            : sizes.length === 0
              ? "Select at least one size (you already picked colors)."
              : "Select at least one color (you already picked sizes)."}
        </p>
      ) : null}

      <div>
        <span className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Size (variant) — multi-select
        </span>
        <ul className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-outline-variant/20 bg-white p-3 sm:grid-cols-3">
          {CATALOG_SIZE_PRESETS.map((p) => (
            <li key={p}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={sizes.includes(p)}
                  onChange={(e) =>
                    onSizesChange(toggle(sizes, p, e.target.checked))
                  }
                />
                <span>{p}</span>
              </label>
            </li>
          ))}
        </ul>
        <CustomLabelAdd
          disabled={disabled}
          label="Add custom size"
          onAdd={(raw) => {
            const t = raw.trim().slice(0, 100);
            if (!t) return;
            onSizesChange(toggle(sizes, t, true));
          }}
        />
      </div>

      <div>
        <span className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Color (variant) — multi-select
        </span>
        <ul className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-outline-variant/20 bg-white p-3 sm:grid-cols-3">
          {CATALOG_COLOR_PRESETS.map((p) => (
            <li key={p}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={colors.includes(p)}
                  onChange={(e) =>
                    onColorsChange(toggle(colors, p, e.target.checked))
                  }
                />
                <span>{p}</span>
              </label>
            </li>
          ))}
        </ul>
        <CustomLabelAdd
          disabled={disabled}
          label="Add custom color"
          onAdd={(raw) => {
            const t = raw.trim().slice(0, 100);
            if (!t) return;
            onColorsChange(toggle(colors, t, true));
          }}
        />
      </div>

      <p className="text-xs text-on-surface-variant">
        {sizes.length} size{sizes.length === 1 ? "" : "s"} × {colors.length} color
        {colors.length === 1 ? "" : "s"} = {sizes.length * colors.length} variant
        {sizes.length * colors.length === 1 ? "" : "s"} (max 80).
      </p>
    </div>
  );
}

function CustomLabelAdd({
  label,
  disabled,
  onAdd,
}: {
  label: string;
  disabled?: boolean;
  onAdd: (_raw: string) => void;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    onAdd(draft);
    setDraft("");
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="text"
        disabled={disabled}
        className="min-w-[12rem] flex-1 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
        placeholder={label}
        maxLength={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          commit();
        }}
        aria-label={label}
      />
      <button
        type="button"
        disabled={disabled}
        className="rounded-lg border border-outline-variant/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide"
        onClick={() => commit()}
      >
        Add
      </button>
    </div>
  );
}
