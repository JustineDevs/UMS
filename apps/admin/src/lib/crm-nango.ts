import { NANGO_CRM_SUPPORTED_APPS } from "@universal-music-store/platform-data";

export type CrmNangoIntegration = {
  id: string;
  label: string;
  category: string;
  description: string;
};

export type CrmNangoConnection = {
  provider_config_key: string;
  nango_connection_id: string;
  provider: string | null;
  active: boolean;
  status: "connected" | "needs_attention";
  error: string | null;
  updated_at: string;
};

export function configuredCrmIntegrations(): CrmNangoIntegration[] {
  const configured = (process.env.NANGO_CRM_INTEGRATIONS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = configured.length > 0
    ? new Set(configured)
    : new Set(NANGO_CRM_SUPPORTED_APPS.map((app) => app.provider_config_key));
  return NANGO_CRM_SUPPORTED_APPS
    .filter((app) => allowed.has(app.provider_config_key))
    .map((app) => ({
      id: app.provider_config_key,
      label: app.label,
      category: app.category,
      description: app.description,
    }));
}

export function crmIntegrationLabel(id: string): string {
  return NANGO_CRM_SUPPORTED_APPS.find((app) => app.provider_config_key === id)?.label ?? id;
}

export function nangoCrmErrorMessage(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0] as Record<string, unknown> | null;
  if (!first || typeof first !== "object") return "Nango reported an authorization error";
  const message = first.message ?? first.type ?? first.error;
  return typeof message === "string" ? message : "Nango reported an authorization error";
}
