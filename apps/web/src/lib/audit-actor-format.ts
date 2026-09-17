type AuditActorSource = {
  users?: { email?: string | null; name?: string | null } | null;
  details: Record<string, unknown> | null;
};

/**
 * Resolves a short label for who performed an audit action: joined `users` row,
 * then `details.actor_email` from `insertStaffAuditLog`.
 */
export function formatAuditActorLabel(entry: AuditActorSource): string {
  const u = entry.users;
  if (u && typeof u === "object") {
    const email = typeof u.email === "string" ? u.email.trim() : "";
    if (email) {
      const name = typeof u.name === "string" ? u.name.trim() : "";
      return name ? `${name} (${email})` : email;
    }
  }
  const d = entry.details;
  if (d && typeof d === "object") {
    const em = (d as { actor_email?: unknown }).actor_email;
    if (typeof em === "string" && em.trim()) return em.trim();
  }
  return "Unknown";
}

export function auditActorCsvCell(entry: AuditActorSource): string {
  return formatAuditActorLabel(entry);
}
