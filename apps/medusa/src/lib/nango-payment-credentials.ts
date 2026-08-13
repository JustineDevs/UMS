type NangoCredentialPayload = {
  credentials?: Record<string, unknown>;
  data?: { credentials?: Record<string, unknown> };
  connection_id?: string;
  provider_config_key?: string;
};

export type NangoPaymentContext = {
  nango_connection_id?: string;
  nango_provider_config_key?: string;
};

export function nangoPaymentProviderConfigured(
  providerConfigKeys: string | readonly string[],
): boolean {
  const keys = Array.isArray(providerConfigKeys) ? providerConfigKeys : [providerConfigKeys];
  const configured = new Set(
    (process.env.NANGO_PAYMENT_INTEGRATIONS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  return Boolean(process.env.NANGO_API_KEY?.trim()) && keys.some((key) => configured.has(key.toLowerCase()));
}

export function nangoPaymentProxyConfigured(
  context: NangoPaymentContext | undefined,
): boolean {
  return Boolean(
    process.env.NANGO_API_KEY?.trim() &&
      (context?.nango_connection_id?.trim() || process.env.NANGO_PAYMENT_CONNECTION_ID?.trim()) &&
      (context?.nango_provider_config_key?.trim() || process.env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY?.trim()),
  );
}

/** Fetches a short-lived provider credential from Nango; raw credentials never enter logs or persistence. */
export async function getNangoPaymentCredentials(
  context: NangoPaymentContext | undefined,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.NANGO_API_KEY?.trim();
  const connectionId = context?.nango_connection_id?.trim() || process.env.NANGO_PAYMENT_CONNECTION_ID?.trim();
  const providerConfigKey = context?.nango_provider_config_key?.trim() || process.env.NANGO_PAYMENT_PROVIDER_CONFIG_KEY?.trim();
  if (!apiKey || !connectionId || !providerConfigKey) return null;
  const response = await fetch(
    `https://api.nango.dev/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(providerConfigKey)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Nango payment connection unavailable: ${response.status}`);
  const payload = (await response.json()) as NangoCredentialPayload;
  const credentials = payload.credentials ?? payload.data?.credentials;
  if (!credentials || typeof credentials !== "object") throw new Error("Nango payment connection returned no credentials.");
  return credentials;
}

export function nangoContextFrom(value: unknown): NangoPaymentContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const connection = typeof record.nango_connection_id === "string" ? record.nango_connection_id.trim() : undefined;
  const provider = typeof record.nango_provider_config_key === "string" ? record.nango_provider_config_key.trim() : undefined;
  return connection || provider ? { nango_connection_id: connection, nango_provider_config_key: provider } : undefined;
}
