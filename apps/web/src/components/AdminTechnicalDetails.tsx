"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown on the summary line before expanding. */
  label?: string;
  className?: string;
};

/**
 * Collapsible block for developers or IT. Keeps day-to-day UI plain;
 * technical notes stay one click away.
 */
export function AdminTechnicalDetails({
  children,
  label = "Details for IT or your developer",
  className = "",
}: Props) {
  return (
    <details className={`text-xs text-on-surface-variant ${className}`}>
      <summary className="cursor-pointer font-medium text-on-surface select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="underline decoration-outline-variant/50 underline-offset-2">
          {label}
        </span>
      </summary>
      <div className="mt-2 border-l-2 border-outline-variant/40 pl-3 leading-relaxed space-y-2 text-[11px] text-on-surface-variant [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-surface-container-high [&_code]:px-1 [&_code]:rounded">
        {children}
      </div>
    </details>
  );
}
