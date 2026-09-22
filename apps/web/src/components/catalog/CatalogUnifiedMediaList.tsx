"use client";

import {
  inferCatalogGalleryMediaKind,
  isDirectVideoFileUrl,
  normalizeCatalogAssetUrl,
} from "@/lib/catalog-asset-url";
import { useCallback, useEffect, useState } from "react";

type Props = {
  items: string[];
  mainImageCount: number;
  onItemsChange: (_items: string[]) => void;
  onMainCountChange: (_n: number) => void;
  disabled?: boolean;
};

const SECTION_LABELS = {
  main: "Main photos",
  gallery: "Gallery (photos and clips)",
} as const;

function MediaThumb({ address }: { address: string }) {
  const normalized = normalizeCatalogAssetUrl(address);
  if (!normalized) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-outline-variant/25 bg-surface-container-high text-[10px] text-on-surface-variant">
        Empty
      </div>
    );
  }
  const kind = inferCatalogGalleryMediaKind(normalized);
  if (kind === "image") {
    return (
      // Catalog media may be hosted on customer-configured storage/CDN origins.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={normalized}
        alt=""
        className="h-14 w-14 shrink-0 rounded-md border border-outline-variant/20 object-cover"
      />
    );
  }
  if (isDirectVideoFileUrl(normalized)) {
    return (
      <video
        src={normalized}
        muted
        playsInline
        className="h-14 w-14 shrink-0 rounded-md border border-outline-variant/20 object-cover"
        aria-hidden
      />
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-outline-variant/25 bg-surface-container-high text-[10px] font-medium text-on-surface-variant">
      Clip
    </div>
  );
}

export function CatalogUnifiedMediaList({
  items,
  mainImageCount,
  onItemsChange,
  onMainCountChange,
  disabled,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < items.length) next.add(i);
      }
      return next;
    });
  }, [items.length]);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((_, i) => i)));
    }
  }, [selected.size, items]);

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= items.length) return;
      const next = [...items];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      let mc = mainImageCount;
      if (from < mainImageCount && to >= mainImageCount) mc -= 1;
      else if (from >= mainImageCount && to < mainImageCount) mc += 1;
      onMainCountChange(mc);
      onItemsChange(next);
      setSelected(new Set());
    },
    [items, mainImageCount, onItemsChange, onMainCountChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      let mc = mainImageCount;
      if (index < mainImageCount) mc -= 1;
      mc = Math.min(mc, next.length);
      mc = Math.max(0, mc);
      onMainCountChange(mc);
      onItemsChange(next);
      setSelected((prev) => {
        const out = new Set<number>();
        for (const i of prev) {
          if (i === index) continue;
          out.add(i > index ? i - 1 : i);
        }
        return out;
      });
    },
    [items, mainImageCount, onItemsChange, onMainCountChange],
  );

  const removeSelected = useCallback(() => {
    if (selected.size === 0) return;
    const drop = [...selected].sort((a, b) => b - a);
    let next = [...items];
    let mc = mainImageCount;
    for (const i of drop) {
      if (i < mc) mc -= 1;
      next.splice(i, 1);
    }
    mc = Math.min(Math.max(0, mc), next.length);
    onMainCountChange(mc);
    onItemsChange(next);
    setSelected(new Set());
  }, [selected, items, mainImageCount, onItemsChange, onMainCountChange]);

  const moveOneToGallery = useCallback(
    (index: number) => {
      if (index >= mainImageCount) return;
      const next = [...items];
      const [row] = next.splice(index, 1);
      next.push(row);
      onMainCountChange(mainImageCount - 1);
      onItemsChange(next);
      setSelected(new Set());
    },
    [items, mainImageCount, onItemsChange, onMainCountChange],
  );

  const moveOneToMain = useCallback(
    (index: number) => {
      if (index < mainImageCount) return;
      const next = [...items];
      const [row] = next.splice(index, 1);
      next.splice(mainImageCount, 0, row);
      onMainCountChange(mainImageCount + 1);
      onItemsChange(next);
      setSelected(new Set());
    },
    [items, mainImageCount, onItemsChange, onMainCountChange],
  );

  const addEmpty = useCallback(() => {
    onItemsChange([...items, ""]);
  }, [items, onItemsChange]);

  const selectedCount = selected.size;
  const allSelected = items.length > 0 && selected.size === items.length;

  const rowRegion = useCallback(
    (index: number): "main" | "gallery" =>
      index < mainImageCount ? "main" : "gallery",
    [mainImageCount],
  );

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface disabled:opacity-50"
            disabled={disabled || items.length === 0}
            onClick={selectAll}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 disabled:opacity-50"
            disabled={disabled || selectedCount === 0}
            onClick={removeSelected}
          >
            Remove selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">
          No media yet. Add rows, upload files, or pick from your catalog library.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((line, index) => {
          const region = rowRegion(index);
          const showMainHeader = index === 0 && mainImageCount > 0;
          const showGalleryHeader =
            index === mainImageCount && mainImageCount < items.length;
          return (
            <li key={`${line}-${region}`} className="space-y-2">
              {showMainHeader ? (
                <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {SECTION_LABELS.main}
                </p>
              ) : null}
              {showGalleryHeader ? (
                <p className="pt-1 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {SECTION_LABELS.gallery}
                </p>
              ) : null}
              <div className="flex flex-wrap items-start gap-3 rounded-lg border border-outline-variant/25 bg-surface-container-high/40 p-3">
                <label className="flex cursor-pointer items-start pt-1">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-outline-variant"
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                    disabled={disabled}
                    aria-label={`Select item ${index + 1}`}
                  />
                </label>
                <MediaThumb address={line} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-on-surface">
                      {region === "main" ? "Photo" : "Item"} {index + 1}
                    </span>
                    {index === 0 && region === "main" ? (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Shop preview
                      </span>
                    ) : null}
                    {region === "gallery" && index === mainImageCount ? (
                      <span className="rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                        First in gallery
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-md border border-outline-variant/30 px-2 py-1.5 text-sm"
                    value={line}
                    onChange={(e) => {
                      const v = e.target.value;
                      const next = [...items];
                      next[index] = v;
                      onItemsChange(next);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      const pieces = v
                        .split(/[,\n]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (pieces.length > 1) {
                        const next = [...items];
                        next.splice(index, 1, ...pieces);
                        onItemsChange(next);
                        if (index < mainImageCount) {
                          onMainCountChange(
                            Math.min(
                              mainImageCount + pieces.length - 1,
                              next.length,
                            ),
                          );
                        }
                      } else {
                        const next = [...items];
                        next[index] = v.trim();
                        onItemsChange(next);
                      }
                    }}
                    placeholder="Paste or type a web address"
                    disabled={disabled}
                    aria-label={`Item ${index + 1} web address`}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {region === "main" ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-secondary hover:underline disabled:opacity-50"
                        disabled={disabled || mainImageCount <= 1}
                        onClick={() => moveOneToGallery(index)}
                      >
                        Send to gallery
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => moveOneToMain(index)}
                      >
                        Send to main photos
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="rounded border border-outline-variant/30 px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move item ${index + 1} up`}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="rounded border border-outline-variant/30 px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                    disabled={disabled || index >= items.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move item ${index + 1} down`}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => removeAt(index)}
                    aria-label={`Remove item ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        disabled={disabled}
        onClick={addEmpty}
      >
        Add row
      </button>
    </div>
  );
}
