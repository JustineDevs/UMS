"use client";

import type { ReactNode } from "react";

type Variant = "info" | "warning" | "amber";

const shell: Record<Variant, string> = {
  info: "border-outline-variant/20 bg-surface-container-low/50 text-on-surface",
  warning: "border-amber-200/90 bg-amber-50/95 text-amber-950",
  amber: "border-amber-200/90 bg-amber-50/95 text-amber-950",
};

/**
 * Cross-app commerce reassurance banner (PRD: CommerceStateBanner).
 */
export function CommerceStateBanner({
  variant = "info",
  title,
  children,
  role = "status",
}: {
  variant?: Variant;
  title: string;
  children: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      className={`mb-8 rounded-lg border px-4 py-3 text-sm ${shell[variant]}`}
      role={role}
    >
      <p
        className={`font-headline text-[10px] font-bold uppercase tracking-widest ${
          variant === "info" ? "text-primary" : "text-amber-900"
        }`}
      >
        {title}
      </p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}
