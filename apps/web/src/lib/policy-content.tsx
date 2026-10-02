import { POLICY_EFFECTIVE_DATE, POLICY_LAST_UPDATED, POLICY_VERSION } from "./policy-constants";

export { POLICY_AUDIT_EVENT, POLICY_EFFECTIVE_DATE, POLICY_LAST_UPDATED, POLICY_VERSION } from "./policy-constants";

export function PolicyMeta({ policy }: { policy: string }) {
  return (
    <p
      className="mt-3 text-sm text-on-surface-variant"
      data-policy-version={POLICY_VERSION}
      data-policy-effective-date={POLICY_EFFECTIVE_DATE}
    >
      Version {POLICY_VERSION} · Effective {POLICY_LAST_UPDATED}
      <span className="sr-only"> · {policy}</span>
    </p>
  );
}
