export const RECENT_AUTH_MAX_AGE_MS = 30 * 60 * 1000;

type RecentAuthSession = {
  authenticatedAt?: number;
} | null;

export function hasRecentAuthentication(
  session: RecentAuthSession,
  now = Date.now(),
  maxAgeMs = RECENT_AUTH_MAX_AGE_MS,
): boolean {
  const authenticatedAt = session?.authenticatedAt;
  if (typeof authenticatedAt !== "number" || !Number.isFinite(authenticatedAt)) return false;
  const age = now - authenticatedAt * 1000;
  return age >= 0 && age <= maxAgeMs;
}
