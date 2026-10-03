"use client";

import * as React from "react";
import { Button } from "@universal-music-store/ui";
import { Roles } from "@/components/reference-roles/_components/roles";
import type { Role } from "@/components/reference-roles/_components/roles-table/data";
import { AdminPageShell } from "@/components/admin-console";

export default function RolesPage() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetch("/api/admin/roles", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load roles");
        return (await response.json()) as { data?: Role[] };
      })
      .then((body) => { if (active) setRoles(body.data ?? []); })
      .catch((reason) => {
        if (active && !(reason instanceof DOMException && reason.name === "AbortError")) {
          setRoles([]);
          setError("Roles could not be loaded. Try again.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [reloadToken]);
  return (
    <AdminPageShell
      hideHeader
    >
      {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading roles...</div> : null}
      {error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => setReloadToken((value) => value + 1)}>Retry</Button>
        </div>
      ) : null}
      {!loading && !error ? <Roles roles={roles} /> : null}
    </AdminPageShell>
  );
}
