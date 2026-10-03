"use client";

import { CatalogMediaManager } from "@/components/catalog/CatalogMediaManager";
import { AdminPageShell } from "@/components/admin-console";

export default function CatalogMediaPage() {
  return (
    <AdminPageShell hideHeader>
      <CatalogMediaManager />
    </AdminPageShell>
  );
}
