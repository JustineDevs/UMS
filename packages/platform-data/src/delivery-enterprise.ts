import { distanceKm, type GeoPoint } from "./delivery-logistics-operations.js";

export function assertDeliveryGeofence(destination: GeoPoint, actual: GeoPoint, radiusKm = 0.25): void {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || distanceKm(destination, actual) > radiusKm) throw new Error("Delivery location is outside the allowed geofence");
}

export type CourierCashLedgerEntry = { courierId: string; shipmentId: string; amount: number; direction: "collect" | "remit" | "adjust"; idempotencyKey: string };

export function validateCourierCashEntry(entry: CourierCashLedgerEntry): CourierCashLedgerEntry {
  const value = { ...entry, courierId: entry.courierId.trim(), shipmentId: entry.shipmentId.trim(), idempotencyKey: entry.idempotencyKey.trim() };
  if (!value.courierId || !value.shipmentId || !value.idempotencyKey || !Number.isFinite(value.amount) || value.amount < 0) throw new Error("Invalid courier cash ledger entry");
  return value;
}

export function calculateDriverEarnings(input: { deliveryFee: number; tip?: number; tolls?: number; commissionRate?: number }): number {
  const commissionRate = input.commissionRate ?? 0;
  if (![input.deliveryFee, input.tip ?? 0, input.tolls ?? 0, commissionRate].every(Number.isFinite) || input.deliveryFee < 0 || commissionRate < 0 || commissionRate > 1) throw new Error("Invalid driver earnings inputs");
  return Math.round((input.deliveryFee * (1 - commissionRate) + (input.tip ?? 0) - (input.tolls ?? 0)) * 100) / 100;
}

export function buildRoutingRequest(stops: readonly GeoPoint[]): { coordinates: string; annotations: string } {
  if (!stops.length || stops.length > 100) throw new Error("Route must contain between 1 and 100 stops");
  return { coordinates: stops.map((point) => `${point.longitude},${point.latitude}`).join(";"), annotations: "distance,duration" };
}
