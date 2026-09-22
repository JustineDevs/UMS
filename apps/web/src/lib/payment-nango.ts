export type PaymentNangoIntegration = {
  id: string;
  label: string;
};

export type PaymentNangoConnection = {
  provider_config_key: string;
  nango_connection_id: string;
  provider: string | null;
  active: boolean;
  status: "connected" | "needs_attention";
  error: string | null;
  updated_at: string;
};
