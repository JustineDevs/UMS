import assert from "node:assert/strict";
import test from "node:test";
import { assignDeliverySla, buildBatches, calculateDeliveryPrice, calculatePackageMetrics, distanceKm, optimizeRoute, selectCourier, verifyDeliveryProof } from "./delivery-logistics-operations.js";

test("delivery operations enforce package, routing, proof, and settlement rules", () => {
  assert.equal(calculatePackageMetrics({ lengthCm: 100, widthCm: 20, heightCm: 10, actualWeightKg: 2 }).chargeableWeightKg, 4);
  assert.equal(assignDeliverySla({ distanceKm: 4, requestedAt: new Date("2026-08-08T08:00:00Z") }).code, "immediate_1h");
  const origin = { latitude: 14.5995, longitude: 120.9842 };
  const stop = { id: "a", location: origin, weightKg: 2, volumeCm3: 1000 };
  assert.equal(selectCourier({ origin, stop, couriers: [{ slug: "c1", label: "Courier", location: origin, maxWeightKg: 5, maxVolumeCm3: 2000, rating: 5, available: true }] }).slug, "c1");
  assert.equal(optimizeRoute(origin, [stop]).length, 1);
  assert.equal(buildBatches([stop, { ...stop, id: "b" }], 3, 5000).length, 2);
  assert.equal(verifyDeliveryProof({ method: "otp", otp: "1234", expectedOtp: "1234" }).valid, true);
  assert.equal(verifyDeliveryProof({ method: "otp", otp: "1234", expectedOtp: "0000" }).valid, false);
  assert.equal(calculateDeliveryPrice({ base: 50, distanceKm: 10, perKm: 5, tip: 10 }).driverEarnings, 110);
  assert.ok(distanceKm(origin, { latitude: 14.6, longitude: 120.99 }) > 0);
});
