/** No Node-only imports: safe for modules used on the client (e.g. checkout error formatting). */

export class MedusaAdminConfigurationError extends Error {
  readonly diagnosticCode = "STORE_MEDUSA_ADMIN_SECRET_MISSING" as const;

  constructor() {
    super(
      "Medusa Admin API secret is not configured (set MEDUSA_SECRET_API_KEY or MEDUSA_ADMIN_API_SECRET on the server)",
    );
    this.name = "MedusaAdminConfigurationError";
  }
}

export function isMedusaAdminConfigurationError(
  err: unknown,
): err is MedusaAdminConfigurationError {
  return err instanceof MedusaAdminConfigurationError;
}
