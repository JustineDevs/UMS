import assert from "node:assert/strict";
import test from "node:test";

import { buildCommerceInvalidationRevalidationPlan } from "./commerce-invalidation-plan";

test("buildCommerceInvalidationRevalidationPlan includes product, collection, and catalog tags", () => {
  const plan = buildCommerceInvalidationRevalidationPlan({
    productHandles: ["guitar"],
    collectionHandlesLowercase: ["summer-sale"],
    classification: "checkout_affecting",
  });
  assert.ok(plan.tags.includes("product:guitar"));
  assert.ok(plan.tags.includes("collection:summer-sale"));
  assert.ok(plan.tags.includes("catalog:list"));
  assert.ok(plan.tags.includes("storefront:home"));
  assert.ok(plan.paths.includes("/shop/guitar"));
  assert.ok(plan.paths.includes("/collections/summer-sale"));
  assert.ok(plan.paths.includes("/"));
});

test("buildCommerceInvalidationRevalidationPlan: editorial_only skips extra home revalidation duplicate handling via same set", () => {
  const plan = buildCommerceInvalidationRevalidationPlan({
    productHandles: [],
    collectionHandlesLowercase: [],
    classification: "editorial_only",
  });
  assert.ok(plan.tags.includes("storefront:home"));
});
