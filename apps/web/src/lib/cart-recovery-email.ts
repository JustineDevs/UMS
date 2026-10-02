import { generateOpaqueTrackingCapability } from "@universal-music-store/sdk";

export function buildCartRecoveryUrl(baseUrl: string, cartId: string): string | null {
  const id = cartId.trim();
  const token = generateOpaqueTrackingCapability(id);
  if (!id || !token) return null;
  return `${baseUrl.replace(/\/$/, "")}/checkout?token=${encodeURIComponent(token)}`;
}
