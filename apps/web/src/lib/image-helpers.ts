export function shouldUnoptimizeImage(src: string | null | undefined): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("//")) {
    return false;
  }

  try {
    const url = new URL(
      trimmed.startsWith("//") ? `https:${trimmed}` : trimmed,
    );
    const hostname = url.hostname.toLowerCase();
    return (
      (hostname === "fbcdn.net" || hostname.endsWith(".fbcdn.net")) ||
      (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) ||
      hostname.endsWith(".supabase.co")
    );
  } catch {
    return false;
  }
}

export function isKnownUnavailableExternalImage(
  src: string | null | undefined,
): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(
      trimmed.startsWith("//") ? `https:${trimmed}` : trimmed,
    );
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "medusa-public-images.s3.eu-west-1.amazonaws.com" ||
      // This Supabase project was decommissioned; catalog rows from the old
      // dataset can still reference its public storage URLs.
      hostname === "gvsyfyaqxfrunoghgqiq.supabase.co" ||
      hostname === "fbcdn.net" || hostname.endsWith(".fbcdn.net")
    );
  } catch {
    return false;
  }
}
