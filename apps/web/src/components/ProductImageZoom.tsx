"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";

export function ProductImageZoom({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const previousOverflowRef = useRef("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    function keepFocusInside(e: FocusEvent) {
      if (open && dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        closeRef.current?.focus();
      }
    }
    if (open) {
      wasOpenRef.current = true;
      previousOverflowRef.current = document.body.style.overflow;
      document.addEventListener("keydown", onKey);
      document.addEventListener("focusin", keepFocusInside);
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => closeRef.current?.focus());
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflowRef.current;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setScale(1);
          setOpen(true);
        }}
        className="relative block h-full min-h-[inherit] w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`View larger: ${alt}`}
      >
        {isKnownUnavailableExternalImage(src) ? (
          <div className="flex h-full min-h-[inherit] w-full items-center justify-center bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high p-6 text-center">
            <div className="max-w-sm rounded-lg bg-white/85 px-4 py-3 text-sm text-on-surface shadow-sm">
              Image unavailable
            </div>
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-transform duration-700 hover:scale-105"
            unoptimized={shouldUnoptimizeImage(src)}
          />
        )}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal((
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged product image"
        >
          <div
            className="absolute inset-0 cursor-default"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[82vh] max-w-[min(88vw,960px)] items-center justify-center overflow-auto rounded-xl bg-black/20 p-2">
            {isKnownUnavailableExternalImage(src) ? (
              <div className="flex min-h-[28rem] min-w-[min(92vw,900px)] items-center justify-center rounded-2xl bg-surface-container-high p-10 text-center text-sm text-on-surface-variant">
                Image unavailable
              </div>
            ) : (
              <Image
                src={src}
                alt={alt}
                width={1200}
                height={1600}
                className="max-h-[76vh] max-w-[84vw] origin-center object-contain transition-transform duration-200"
                style={{ transform: `scale(${scale})` }}
                sizes="84vw"
                unoptimized={shouldUnoptimizeImage(src)}
              />
            )}
          </div>
          {!isKnownUnavailableExternalImage(src) ? (
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/65 p-1 text-white shadow-lg backdrop-blur">
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"
                onClick={() => setScale((value) => Math.max(1, value - 0.25))}
                disabled={scale <= 1}
                aria-label="Zoom out product image"
              >
                −
              </button>
              <button
                type="button"
                className="min-w-14 rounded-full px-2 py-1 text-xs tabular-nums hover:bg-white/15"
                onClick={() => setScale(1)}
                aria-label="Reset product image zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"
                onClick={() => setScale((value) => Math.min(2.5, value + 0.25))}
                disabled={scale >= 2.5}
                aria-label="Zoom in product image"
              >
                +
              </button>
            </div>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-20 rounded border border-white/40 bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10"
          >
            Close
          </button>
        </div>
        ), document.body)
        : null}
    </>
  );
}
