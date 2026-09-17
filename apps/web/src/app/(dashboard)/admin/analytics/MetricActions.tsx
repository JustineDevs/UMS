"use client";

import { ArrowUpRight, Copy, MoreHorizontal } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@universal-music-store/ui";

export function MetricActions({ label, value }: { label: string; value: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Open actions for ${label}`} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => { window.location.href = "/admin/analytics"; }}>View details <ArrowUpRight className="ml-auto size-3.5" /></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(value)}><Copy className="size-3.5" />Copy value</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
