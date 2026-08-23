export type ReservationTenantRow = { tenant_id?: unknown };

/** Collect every active reservation tenant without silently truncating large stores. */
export async function collectActiveReservationTenants(
  fetchPage: (from: number, to: number) => Promise<ReservationTenantRow[]>,
  pageSize = 1_000,
): Promise<string[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("pageSize must be a positive integer");
  }

  const tenants = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    const rows = await fetchPage(from, from + pageSize - 1);
    for (const row of rows) {
      if (typeof row.tenant_id === "string" && row.tenant_id.trim()) {
        tenants.add(row.tenant_id.trim());
      }
    }
    if (rows.length < pageSize) return [...tenants];
  }
}
