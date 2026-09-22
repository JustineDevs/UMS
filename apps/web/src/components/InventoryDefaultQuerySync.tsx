"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readAdminPreferences } from "@universal-music-store/user-preferences";

/**
 * When visiting /admin/inventory with no query, apply saved default page size from local preferences.
 */
export function InventoryDefaultQuerySync() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  useEffect(() => {
    if (page || pageSize) return;
    const { inventoryPageSize } = readAdminPreferences();
    if (inventoryPageSize === 25) return;
    router.replace(`/admin/inventory?page=1&pageSize=${inventoryPageSize}`);
  }, [page, pageSize, router]);

  return null;
}
