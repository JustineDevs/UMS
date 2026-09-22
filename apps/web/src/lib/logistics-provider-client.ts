import { buildRoutingRequest, validateGeoPoint } from "@universal-music-store/platform-data";
import { readResponseJson } from "./read-response-json";

export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number; label: string }> {
  const base = process.env.GEOCODING_BASE_URL?.trim();
  if (!base) throw new Error("GEOCODING_BASE_URL is not configured");
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error("GEOCODING_BASE_URL is invalid");
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error("GEOCODING_BASE_URL must use HTTP(S)");
  url.searchParams.set("q", address.trim());
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Geocoding provider request failed");
  const payload = await readResponseJson<{
    latitude?: unknown;
    longitude?: unknown;
    display_name?: unknown;
    label?: unknown;
    results?: Array<{ latitude?: unknown; longitude?: unknown; label?: unknown; display_name?: unknown }>;
  }> (response, {});
  const candidate = payload.results?.[0] ?? payload;
  const latitude = Number(candidate.latitude); const longitude = Number(candidate.longitude);
  validateGeoPoint({ latitude, longitude });
  return { latitude, longitude, label: String(candidate.display_name ?? candidate.label ?? address).slice(0, 500) };
}

export async function optimizeRouteWithProvider(points: readonly { latitude: number; longitude: number }[]): Promise<unknown> {
  const base = process.env.OSRM_BASE_URL?.trim();
  if (!base) throw new Error("OSRM_BASE_URL is not configured");
  const request = buildRoutingRequest(points);
  let url: URL;
  try {
    url = new URL(`${base.replace(/\/$/, "")}/route/v1/driving/${request.coordinates}`);
  } catch {
    throw new Error("OSRM_BASE_URL is invalid");
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error("OSRM_BASE_URL must use HTTP(S)");
  url.searchParams.set("overview", "full"); url.searchParams.set("steps", "true"); url.searchParams.set("annotations", request.annotations);
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Routing provider request failed");
  return readResponseJson(response, {});
}
