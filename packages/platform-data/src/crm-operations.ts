export type LeadProfile = { email: string; name?: string; company?: string; source?: string; totalSpent?: number; orderCount?: number; lastActivityAt?: string };
export type CrmActivity = { type: "email" | "call" | "meeting" | "note" | "task"; occurredAt: string; ownerEmail: string; subject: string; completed?: boolean };

export function normalizeCrmEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("A valid customer email is required");
  return normalized;
}

export function crmDeduplicationKey(input: { email: string; company?: string }): string {
  return `${normalizeCrmEmail(input.email)}:${(input.company ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export function scoreLead(profile: LeadProfile): number {
  const spend = Math.min(40, Math.round((profile.totalSpent ?? 0) / 2500));
  const orders = Math.min(25, (profile.orderCount ?? 0) * 5);
  const source = ["referral", "wholesale", "contact_form"].includes(profile.source ?? "") ? 20 : 10;
  const recency = profile.lastActivityAt ? Math.max(0, 15 - Math.floor((Date.now() - Date.parse(profile.lastActivityAt)) / 86_400_000)) : 0;
  return Math.max(0, Math.min(100, spend + orders + source + recency));
}

export function routeLead(score: number, owners: readonly string[]): string | null {
  if (!owners.length) return null;
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Lead score must be between 0 and 100");
  return owners[Math.floor(score) % owners.length] ?? null;
}

export function forecastPipeline(deals: readonly { value: number; probability: number; closeDate: string }[], asOf = new Date()): { weightedValue: number; openValue: number; dueThisMonth: number } {
  let weightedValue = 0;
  let openValue = 0;
  let dueThisMonth = 0;
  for (const deal of deals) {
    if (!Number.isFinite(deal.value) || deal.value < 0 || deal.probability < 0 || deal.probability > 1) throw new Error("Deal values and probabilities must be valid");
    weightedValue += deal.value * deal.probability;
    openValue += deal.value;
    const date = new Date(deal.closeDate);
    if (date.getUTCFullYear() === asOf.getUTCFullYear() && date.getUTCMonth() === asOf.getUTCMonth()) dueThisMonth += deal.value * deal.probability;
  }
  return { weightedValue, openValue, dueThisMonth };
}

export function activityMetrics(activities: readonly CrmActivity[]): Record<string, { total: number; completed: number; overdue: number }> {
  const now = Date.now();
  return activities.reduce<Record<string, { total: number; completed: number; overdue: number }>>((result, activity) => {
    const bucket = result[activity.ownerEmail] ?? { total: 0, completed: 0, overdue: 0 };
    bucket.total += 1;
    if (activity.completed) bucket.completed += 1;
    if (!activity.completed && Date.parse(activity.occurredAt) < now) bucket.overdue += 1;
    result[activity.ownerEmail] = bucket;
    return result;
  }, {});
}
