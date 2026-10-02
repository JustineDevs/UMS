"use client";

import { ArrowUpRight, Copy, MoreHorizontal } from "lucide-react";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@universal-music-store/ui";

export function MetricActions({ label, value }: { label: string; value: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Open actions for ${label}`} className="text-muted-foreground hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => { window.location.href = "/admin/analytics"; }}>View details <ArrowUpRight className="ml-auto size-3.5" /></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(value)}><Copy className="size-3.5" />Copy value</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
