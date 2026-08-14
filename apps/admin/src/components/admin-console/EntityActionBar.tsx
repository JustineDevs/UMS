"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type EntityActionBarButton = {
  key: string;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

export type EntityActionBarProps = {
  actions: EntityActionBarButton[];
  trailing?: ReactNode;
};

export function EntityActionBar({ actions, trailing }: EntityActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/15 pt-4">
      {actions.map((a) => {
        const variant: "default" | "outline" | "destructive" = a.variant === "danger" ? "destructive" : a.variant === "primary" ? "default" : "outline";
        if (a.href) {
          return (
            <Button key={a.key} asChild variant={variant} disabled={a.disabled}>
              <a href={a.href}>{a.label}</a>
            </Button>
          );
        }
        return (
          <Button
            key={a.key}
            type="button"
            variant={variant}
            onClick={a.onClick}
            disabled={a.disabled}
          >
            {a.label}
          </Button>
        );
      })}
      {trailing}
    </div>
  );
}
