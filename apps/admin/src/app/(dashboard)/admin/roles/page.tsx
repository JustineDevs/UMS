"use client";

import * as React from "react";
import { Roles } from "@/components/reference-roles/_components/roles";
import type { Role } from "@/components/reference-roles/_components/roles-table/data";

export default function RolesPage() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    void fetch("/api/admin/roles")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load roles");
        return (await response.json()) as { data?: Role[] };
      })
      .then((body) => { if (active) setRoles(body.data ?? []); })
      .catch(() => { if (active) setRoles([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <div className="text-muted-foreground py-16 text-center text-sm">Loading roles...</div>;
  return <Roles roles={roles} />;
}
