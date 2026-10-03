import type { Item, Node, Root } from "fumadocs-core/page-tree";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/config/admin-nav";

function toPage(item: AdminNavItem, id: string): Item {
  return {
    type: "page",
    name: item.label,
    url: item.href,
    $id: id,
  };
}

function toNode(item: AdminNavItem, id: string): Node {
  if (!item.children?.length) return toPage(item, id);

  const hasDuplicateIndexRoute = item.children.some((child) => child.href === item.href);

  return {
    type: "folder",
    name: item.label,
    $id: `${id}:folder`,
    ...(hasDuplicateIndexRoute ? {} : { index: toPage(item, `${id}:index`) }),
    children: item.children.map((child, index) =>
      toNode(child, `${id}:child-${index}-${child.label}`),
    ),
    defaultOpen: true,
  };
}

/**
 * Fumadocs inventory for the operator guide.
 *
 * The admin navigation remains the single source of truth; this tree only
 * adapts that inventory to Fumadocs' sidebar model.
 */
export const adminDocsInventory: Root = {
  name: "Admin guide",
  $id: "admin-guide",
  children: ADMIN_NAV_GROUPS.flatMap((group) => [
    {
      type: "separator" as const,
      name: group.label,
      $id: `admin-group:${group.label.toLowerCase()}`,
    },
    ...group.items.map((item, index) =>
      toNode(item, `admin:${group.label}:${index}-${item.label}`),
    ),
  ]),
};
