export type GeoPoint = { latitude: number; longitude: number };

export type PackageSpec = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  actualWeightKg: number;
  volumetricDivisor?: number;
};

export type DeliverySla = "immediate_1h" | "same_day" | "next_day";

export type CourierCapacity = {
  slug: string;
  label: string;
  location: GeoPoint;
  maxWeightKg: number;
  maxVolumeCm3: number;
  rating: number;
  available: boolean;
};

export type DeliveryStop = {
  id: string;
  location: GeoPoint;
  weightKg: number;
  volumeCm3: number;
  windowStart?: string;
  windowEnd?: string;
};

export type DeliveryProofInput = {
  method: "signature" | "photo" | "otp" | "contactless";
  recipientName?: string;
  otp?: string;
  expectedOtp?: string;
  latitude?: number;
  longitude?: number;
  destination?: GeoPoint;
  photoUrl?: string;
  signature?: string;
  contactLog?: string;
};

const EARTH_RADIUS_KM = 6371;

function finitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
  return value;
}

export function normalizeAddress(address: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(address)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : String(value ?? "").trim()])
      .filter(([, value]) => value.length > 0),
  );
}

export function validateGeoPoint(point: GeoPoint): GeoPoint {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new Error("longitude must be between -180 and 180");
  }
  return point;
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  validateGeoPoint(from);
  validateGeoPoint(to);
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculatePackageMetrics(spec: PackageSpec): { volumeCm3: number; volumetricWeightKg: number; chargeableWeightKg: number } {
  const lengthCm = finitePositive(spec.lengthCm, "lengthCm");
  const widthCm = finitePositive(spec.widthCm, "widthCm");
  const heightCm = finitePositive(spec.heightCm, "heightCm");
  const actualWeightKg = finitePositive(spec.actualWeightKg, "actualWeightKg");
  const divisor = spec.volumetricDivisor ?? 5000;
  if (!Number.isFinite(divisor) || divisor <= 0) throw new Error("volumetricDivisor must be positive");
  const volumeCm3 = lengthCm * widthCm * heightCm;
  const volumetricWeightKg = volumeCm3 / divisor;
  return { volumeCm3, volumetricWeightKg, chargeableWeightKg: Math.max(actualWeightKg, volumetricWeightKg) };
}

export function assignDeliverySla(input: { distanceKm: number; requestedAt?: Date; cutoffHour?: number; immediateDistanceKm?: number }): { code: DeliverySla; label: string } {
  const distance = finitePositive(input.distanceKm, "distanceKm");
  const hour = (input.requestedAt ?? new Date()).getUTCHours();
  const cutoff = input.cutoffHour ?? 15;
  if (distance <= (input.immediateDistanceKm ?? 8) && hour < cutoff) return { code: "immediate_1h", label: "Immediate, within 1 hour" };
  if (hour < cutoff) return { code: "same_day", label: "Same day" };
  return { code: "next_day", label: "Next day" };
}

export function selectCourier(input: { origin: GeoPoint; stop: DeliveryStop; couriers: readonly CourierCapacity[]; radiusKm?: number }): CourierCapacity {
  const eligible = input.couriers
    .filter((courier) => courier.available)
    .filter((courier) => courier.maxWeightKg >= input.stop.weightKg && courier.maxVolumeCm3 >= input.stop.volumeCm3)
    .map((courier) => ({ courier, distance: distanceKm(input.origin, courier.location) }))
    .filter(({ distance }) => distance <= (input.radiusKm ?? 25))
    .sort((a, b) => b.courier.rating - a.courier.rating || a.distance - b.distance);
  if (!eligible[0]) throw new Error("No available courier meets the delivery constraints");
  return eligible[0].courier;
}

export function optimizeRoute(origin: GeoPoint, stops: readonly DeliveryStop[]): DeliveryStop[] {
  const remaining = [...stops];
  const ordered: DeliveryStop[] = [];
  let current = origin;
  while (remaining.length) {
    remaining.sort((a, b) => distanceKm(current, a.location) - distanceKm(current, b.location) || (a.windowStart ?? "").localeCompare(b.windowStart ?? ""));
    const next = remaining.shift()!;
    ordered.push(next);
    current = next.location;
  }
  return ordered;
}

export function buildBatches(stops: readonly DeliveryStop[], maxWeightKg: number, maxVolumeCm3: number): DeliveryStop[][] {
  const batches: DeliveryStop[][] = [];
  for (const stop of stops) {
    let batch = batches.find((candidate) => candidate.reduce((sum, item) => sum + item.weightKg, 0) + stop.weightKg <= maxWeightKg && candidate.reduce((sum, item) => sum + item.volumeCm3, 0) + stop.volumeCm3 <= maxVolumeCm3);
    if (!batch) { batch = []; batches.push(batch); }
    batch.push(stop);
  }
  return batches;
}

export function estimateEtaMinutes(distance: number, averageKph = 25, delayMinutes = 0): number {
  const km = finitePositive(distance, "distance");
  if (!Number.isFinite(averageKph) || averageKph <= 0) throw new Error("averageKph must be positive");
  return Math.ceil((km / averageKph) * 60 + Math.max(0, delayMinutes));
}

export function verifyDeliveryProof(input: DeliveryProofInput): { valid: boolean; reason?: string } {
  if (input.method === "otp" && (!input.otp || !input.expectedOtp || input.otp !== input.expectedOtp)) return { valid: false, reason: "OTP does not match" };
  if (input.method === "photo" && !input.photoUrl) return { valid: false, reason: "Photo proof is required" };
  if (input.method === "signature" && !input.signature) return { valid: false, reason: "Signature proof is required" };
  if (input.method === "contactless" && (!input.photoUrl || !input.contactLog)) return { valid: false, reason: "Photo and contact log are required" };
  if (input.destination && (input.latitude == null || input.longitude == null)) return { valid: false, reason: "Device location is required" };
  if (input.destination && distanceKm(input.destination, { latitude: input.latitude!, longitude: input.longitude! }) > 0.25) return { valid: false, reason: "Delivery location is outside the allowed geofence" };
  return { valid: true };
}

export function calculateDeliveryPrice(input: { base: number; distanceKm: number; perKm: number; surge?: number; remoteZoneFee?: number; tolls?: number; tip?: number }): { deliveryFee: number; driverEarnings: number; tolls: number; tip: number } {
  const distanceKmValue = finitePositive(input.distanceKm, "distanceKm");
  const surge = input.surge ?? 1;
  if (!Number.isFinite(surge) || surge <= 0) throw new Error("surge must be positive");
  const tolls = finitePositive(input.tolls ?? 0, "tolls");
  const tip = finitePositive(input.tip ?? 0, "tip");
  const deliveryFee = Math.round((input.base + distanceKmValue * input.perKm + (input.remoteZoneFee ?? 0)) * surge * 100) / 100;
  return { deliveryFee, driverEarnings: Math.round((deliveryFee - tolls + tip) * 100) / 100, tolls, tip };
}
