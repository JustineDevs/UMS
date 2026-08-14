"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  staffHasPermission,
  staffPermissionListForSession,
} from "@universal-music-store/platform-data";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@universal-music-store/ui";
import {
  ADMIN_COMMAND_CMS_GROUPS,
  ADMIN_NAV_GROUPS,
  flattenAdminNavItems,
} from "@/config/admin-nav";

const ALL_GROUPS = [...ADMIN_NAV_GROUPS, ...ADMIN_COMMAND_CMS_GROUPS];

export function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (_isOpen: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const perms = staffPermissionListForSession(session);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const groupNodes: ReactNode[] = [];
  let firstVisible = true;
  for (const group of ALL_GROUPS) {
    const items = flattenAdminNavItems(group.items).filter((item) =>
      staffHasPermission(perms, item.permission),
    );
    if (items.length === 0) continue;
    if (!firstVisible) {
      groupNodes.push(
        <CommandSeparator key={`sep-${group.label}`} className="my-1" />,
      );
    }
    firstVisible = false;
    groupNodes.push(
      <CommandGroup key={group.label} heading={group.label}>
        {items.map((item) => (
          <CommandItem
            key={item.href}
            value={`${item.label} ${group.label} ${item.href}`}
            onSelect={() => go(item.href)}
          >
            <span className="material-symbols-outlined text-lg text-on-surface-variant">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </CommandItem>
        ))}
      </CommandGroup>,
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groupNodes}
      </CommandList>
    </CommandDialog>
  );
}
