export const POLICY_VERSION = "2026.08";
export const POLICY_EFFECTIVE_DATE = "2026-08-15";
export const POLICY_LAST_UPDATED = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${POLICY_EFFECTIVE_DATE}T00:00:00Z`));
export const POLICY_AUDIT_EVENT = "ums-policy-consent-recorded";
