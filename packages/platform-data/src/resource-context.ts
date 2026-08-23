export type ResourceContext = {
  staffId: string;
  tenantId: string;
  storeId?: string | null;
  channelId?: string | null;
  provider?: string | null;
};

export type ResourceContextGrant = ResourceContext & {
  permission?: string | null;
};

function value(value: string | null | undefined, field: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return field === "provider" ? normalized.toLowerCase() : normalized;
}

export function normalizeResourceContext(input: ResourceContext): ResourceContext {
  const staffId = value(input.staffId, "staffId");
  if (!staffId) throw new Error("staffId is required");
  const tenantId = value(input.tenantId, "tenantId");
  if (!tenantId) throw new Error("tenantId is required");
  return {
    staffId,
    tenantId,
    storeId: value(input.storeId, "storeId") ?? null,
    channelId: value(input.channelId, "channelId") ?? null,
    provider: value(input.provider, "provider") ?? null,
  };
}

/** A null grant dimension is an explicit wildcard, never an implicit fallback. */
export function resourceContextAllows(
  grant: ResourceContextGrant,
  requested: ResourceContext,
  permission?: string,
): boolean {
  const allowed = normalizeResourceContext(grant);
  const resource = normalizeResourceContext(requested);
  if (allowed.staffId !== resource.staffId || allowed.tenantId !== resource.tenantId) return false;
  if (permission && grant.permission !== "*" && grant.permission !== permission) return false;
  for (const field of ["storeId", "channelId", "provider"] as const) {
    if (resource[field] !== null && allowed[field] !== null && allowed[field] !== resource[field]) return false;
  }
  return true;
}

export function authorizeResourceContext(
  grants: readonly ResourceContextGrant[],
  requested: ResourceContext,
  permission?: string,
): ResourceContextGrant | null {
  return grants.find((grant) => resourceContextAllows(grant, requested, permission)) ?? null;
}
