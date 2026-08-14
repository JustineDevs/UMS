import { getMedusaStoreBaseUrl } from "@universal-music-store/sdk";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";

export type MedusaPaymentProviderRow = {
  id: string;
  regionId: string;
  regionName: string;
};

export type MedusaPaymentProvidersBundle = {
  /** Providers linked to a region (what checkout uses). */
  byRegion: MedusaPaymentProviderRow[];
  /** Providers registered in the Medusa payment module (medusa-config). */
  systemRegisteredIds: string[];
  medusaUrl: string;
  regionsError: string | null;
  systemError: string | null;
};

function parseRegionProviderRows(regions: unknown): MedusaPaymentProviderRow[] {
  if (!Array.isArray(regions)) return [];
  const providers: MedusaPaymentProviderRow[] = [];
  for (const r of regions) {
    const row = r as {
      id?: string;
      name?: string;
      payment_providers?: Array<{ id?: string } | null>;
    };
    const rid = String(row.id ?? "");
    const rname = String(row.name ?? rid);
    for (const p of row.payment_providers ?? []) {
      if (!p) continue;
      const pid = String(p.id ?? "");
      if (pid) {
        providers.push({ id: pid, regionId: rid, regionName: rname });
      }
    }
  }
  return providers;
}

/**
 * Loads region-linked providers and all payment providers registered in Medusa.
 * Env keys in medusa-config only register providers; each region must still list them
 * (seed, or Medusa Admin → Settings → Regions → region → payment providers).
 */
function networkHint(medusaUrl: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
    return `Cannot reach the store API at ${medusaUrl}. Start the commerce backend or wait until it has finished booting.`;
  }
  return msg;
}

/** Explains 401 from admin routes: almost always wrong secret key type or wrong DB. */
function unauthorizedHint(): string {
  return (
    " Hint: 401 means the secret API key was rejected. " +
    "Set MEDUSA_SECRET_API_KEY to a secret key from the store Admin (Settings → Secret API keys). " +
    "Use the secret key (for example sk_…), not the publishable storefront key (pk_…)."
  );
}

function formatHttpError(status: number, body: string): string {
  const snippet = body.slice(0, 400);
  if (status === 401) {
    return `${snippet}${unauthorizedHint()}`;
  }
  return snippet;
}

export async function fetchMedusaPaymentProvidersBundle(): Promise<MedusaPaymentProvidersBundle> {
  const medusaUrl = getMedusaStoreBaseUrl();
  let regionsError: string | null = null;
  let systemError: string | null = null;
  let byRegion: MedusaPaymentProviderRow[] = [];
  let systemRegisteredIds: string[] = [];

  const regionQs = new URLSearchParams({
    limit: "50",
    fields: "id,name,currency_code,*payment_providers,*countries",
  });

  try {
    const regionsRes = await medusaAdminFetch(
      `/admin/regions?${regionQs.toString()}`,
      { method: "GET" },
    );

    if (regionsRes.ok) {
      const json = (await regionsRes.json()) as { regions?: unknown };
      byRegion = parseRegionProviderRows(json.regions);
    } else {
      const t = await regionsRes.text();
      regionsError = `Regions API ${regionsRes.status}: ${formatHttpError(regionsRes.status, t)}`;
    }
  } catch (e) {
    regionsError = networkHint(medusaUrl, e);
  }

  try {
    const systemQs = new URLSearchParams({
      limit: "100",
      fields: "id,is_enabled",
    });
    const systemRes = await medusaAdminFetch(
      `/admin/payments/payment-providers?${systemQs.toString()}`,
      { method: "GET" },
    );

    if (systemRes.ok) {
      const json = (await systemRes.json()) as {
        payment_providers?: Array<{ id?: string } | null>;
      };
      for (const p of json.payment_providers ?? []) {
        if (!p) continue;
        const id = String(p.id ?? "");
        if (id) systemRegisteredIds.push(id);
      }
      systemRegisteredIds = [...new Set(systemRegisteredIds)].sort();
    } else {
      const t = await systemRes.text();
      systemError = `Payment providers API ${systemRes.status}: ${formatHttpError(systemRes.status, t)}`;
    }
  } catch (e) {
    systemError = networkHint(medusaUrl, e);
  }

  return {
    byRegion,
    systemRegisteredIds,
    medusaUrl,
    regionsError,
    systemError,
  };
}

export async function fetchMedusaPaymentProvidersFromRegions(): Promise<
  MedusaPaymentProviderRow[]
> {
  const bundle = await fetchMedusaPaymentProvidersBundle();
  return bundle.byRegion;
}
