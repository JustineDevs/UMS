import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handlePromotionRequest } from "./promotions.ts";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

function makeDatabase(options: {
  promotion?: Record<string, unknown> | null;
  appliedPromotions?: Record<string, unknown>[];
  lines?: Array<Record<string, unknown> & { id: string; quantity: number; unit_price: number }>;
  orderRules?: Array<{ rule_id: string; attribute: string; operator: string; value: string }>;
  targetRules?: Array<{ rule_id: string; attribute: string; operator: string; value: string }>;
  buyRules?: Array<{ rule_id: string; attribute: string; operator: string; value: string }>;
}) {
  const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []): Promise<QueryResult & { rows: T[] }> {
      statements.push({ sql, values });
      let rows: Record<string, unknown>[] = [];
      if (sql.includes("SELECT id, currency_code, region_id")) rows = [{ id: "cart_1", currency_code: "php", region_id: "reg_1", customer_id: "cus_1", sales_channel_id: "sc_1", email: "buyer@example.com", metadata: { tier: "gold" } }];
      else if (sql.includes("FROM public.cart_line_item") && sql.includes("variant_option_values")) rows = (options.lines ?? []).map((line) => ({ is_discountable: true, product_id: null, variant_id: null, product_title: null, product_type: null, product_collection: null, product_handle: null, variant_sku: null, variant_barcode: null, variant_title: null, variant_option_values: {}, metadata: {}, promotion_discounted_amount: 0, ...line }));
      else if (sql.includes("FROM public.cart_promotion cp")) rows = options.appliedPromotions ?? [];
      else if (sql.includes("SELECT p.id, p.code")) rows = options.promotion ? [options.promotion] : [];
      else if (sql.includes("FROM public.promotion_promotion_rule link")) rows = options.orderRules ?? [];
      else if (sql.includes("FROM public.application_method_target_rules link")) rows = options.targetRules ?? [];
      else if (sql.includes("FROM public.application_method_buy_rules link")) rows = options.buyRules ?? [];
      return { rows: rows as T[], rowCount: rows.length };
    },
    async end() {},
  };
  return { database, statements };
}

function promotion(overrides: Record<string, unknown> = {}) {
  return {
    id: "promo_1", code: "SAVE10", status: "active", promotion_type: "standard", limit: null, used: 0,
    method_id: "method_1", value: "10", method_type: "percentage",
    target_type: "items", currency_code: null, allocation: "across", max_quantity: null,
    buy_rules_min_quantity: null, apply_to_quantity: null,
    is_tax_inclusive: false, starts_at: null, ends_at: null,
    ...overrides,
  };
}

function applyRequest() {
  return new Request("https://worker.test/api/store/promotions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartId: "cart_1", code: "SAVE10" }),
  });
}

test("promotion allocation persists exactly the discount returned, including fractional remainders", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion(),
    lines: [
      { id: "line_1", quantity: 1, unit_price: 105 },
      { id: "line_2", quantity: 1, unit_price: 105 },
      { id: "line_3", quantity: 1, unit_price: 105 },
    ],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const result = await response.json() as { discountAmount: number };
  const persisted = statements
    .filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"))
    .reduce((sum, { values }) => sum + Number(values[4]), 0);

  assert.equal(response.status, 200);
  assert.equal(result.discountAmount, 0.32);
  assert.equal(persisted, 32);
});

test("order rules are evaluated against persisted cart context before promotion mutation", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion(),
    lines: [{ id: "line_1", quantity: 1, unit_price: 1000 }],
    orderRules: [{ rule_id: "rule_tier", attribute: "metadata.tier", operator: "eq", value: "silver" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "promotion_not_eligible" });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion") || sql.includes("INSERT INTO public.cart_line_item_adjustment")), false);
  assert.equal(statements.at(-1)?.sql, "COMMIT");
});

test("distinct promotion rules on the same attribute remain conjunctive", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion(),
    lines: [{ id: "line_1", quantity: 1, unit_price: 1000 }],
    orderRules: [
      { rule_id: "rule_gold", attribute: "metadata.tier", operator: "eq", value: "gold" },
      { rule_id: "rule_silver", attribute: "metadata.tier", operator: "eq", value: "silver" },
    ],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "promotion_not_eligible" });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion")), false);
});

test("item target rules discount only matching discountable lines", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion(),
    lines: [
      { id: "line_match", quantity: 1, unit_price: 1000, product_id: "prod_match" },
      { id: "line_other", quantity: 1, unit_price: 3000, product_id: "prod_other" },
      { id: "line_nondiscountable", quantity: 1, unit_price: 5000, product_id: "prod_match", is_discountable: false },
    ],
    targetRules: [{ rule_id: "rule_product", attribute: "items.product.id", operator: "in", value: "prod_match" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 1);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0]?.values[6], "line_match");
});

test("Buy/Get rejects missing quantity configuration before mutation", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ promotion_type: "buyget" }),
    lines: [{ id: "line_1", quantity: 2, unit_price: 1000 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "promotion_quantity_cap_invalid" });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion") || sql.includes("INSERT INTO public.cart_line_item_adjustment")), false);
});

test("Buy/Get without buy rules cannot discount the cart", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({
      promotion_type: "buyget", value: 100, allocation: "each", max_quantity: 1,
      buy_rules_min_quantity: 1, apply_to_quantity: 1,
    }),
    lines: [{ id: "line_1", quantity: 2, unit_price: 1000 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "promotion_not_eligible" });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion") || sql.includes("INSERT INTO public.cart_line_item_adjustment")), false);
});

test("inactive promotion status is rejected exactly before any cart mutation", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ status: "inactive" }),
    lines: [{ id: "line_1", quantity: 1, unit_price: 1000 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "promotion_inactive" });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion") || sql.includes("INSERT INTO public.cart_line_item_adjustment")), false);
});

test("each allocation applies the discount to no more than max_quantity units on every eligible line", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ allocation: "each", max_quantity: 2 }),
    lines: [
      { id: "line_1", quantity: 3, unit_price: 1000 },
      { id: "line_2", quantity: 1, unit_price: 500 },
    ],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 2.5);
  assert.deepEqual(adjustments.map(({ values }) => [values[4], values[6]]), [[200, "line_1"], [50, "line_2"]]);
});

test("once allocation shares a single quantity quota, starting with the lowest unit price", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ allocation: "once", max_quantity: 2 }),
    lines: [
      { id: "line_expensive", quantity: 2, unit_price: 2000 },
      { id: "line_cheap", quantity: 3, unit_price: 500 },
    ],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 1);
  assert.deepEqual(adjustments.map(({ values }) => [values[4], values[6]]), [[100, "line_cheap"]]);
});

test("fixed each allocations apply the fixed amount per eligible unit", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ method_type: "fixed", value: 75, currency_code: "php", allocation: "each", max_quantity: 2 }),
    lines: [{ id: "line_1", quantity: 3, unit_price: 1000 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustment = statements.find(({ sql, values }) => sql.includes("INSERT INTO public.cart_line_item_adjustment") && values[3] === "SAVE10");

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 1.5);
  assert.equal(adjustment?.values[4], 150);
});

test("stacked promotions discount only the remaining item value", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ allocation: "each", max_quantity: 1 }),
    appliedPromotions: [promotion({ id: "promo_prior", code: "PRIOR", value: 95, allocation: "each", max_quantity: 1 })],
    lines: [{ id: "line_1", quantity: 1, unit_price: 1000, promotion_discounted_amount: 950 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustment = statements.find(({ sql, values }) => sql.includes("INSERT INTO public.cart_line_item_adjustment") && values[3] === "SAVE10");

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 0.05);
  assert.equal(adjustment?.values[4], 5);
});

test("a fully discounted line does not consume once quota or persist a zero-value promotion", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ allocation: "once", max_quantity: 1 }),
    appliedPromotions: [promotion({ id: "promo_prior", code: "PRIOR", value: 100, allocation: "once", max_quantity: 1 })],
    lines: [
      { id: "line_already_discounted", quantity: 1, unit_price: 500, promotion_discounted_amount: 500 },
      { id: "line_available", quantity: 1, unit_price: 1000 },
    ],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql, values }) => sql.includes("INSERT INTO public.cart_line_item_adjustment") && values[6] === "line_available" && values[3] === "SAVE10");

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 1);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0]?.values[6], "line_available");
});

test("rejects a promotion that cannot discount any remaining line value without writes", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ allocation: "each", max_quantity: 1 }),
    appliedPromotions: [promotion({ id: "promo_prior", code: "PRIOR", value: 100, allocation: "each", max_quantity: 1 })],
    lines: [{ id: "line_1", quantity: 1, unit_price: 1000, promotion_discounted_amount: 1000 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "promotion_not_eligible" });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion") || sql.includes("INSERT INTO public.cart_line_item_adjustment")), false);
});

test("quantity allocations reject missing, zero, and invalid caps before mutation", async () => {
  for (const maxQuantity of [null, 0, -1, Number.NaN]) {
    const { database, statements } = makeDatabase({
      promotion: promotion({ allocation: "each", max_quantity: maxQuantity }),
      lines: [{ id: "line_1", quantity: 2, unit_price: 1000 }],
    });

    const response = await handlePromotionRequest(applyRequest(), database);
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "promotion_quantity_cap_invalid" });
    assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.cart_promotion")), false);
  }
});

test("order target overrides once allocation instead of rejecting the promotion", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ target_type: "order", allocation: "once", max_quantity: 1 }),
    lines: [{ id: "line_1", quantity: 2, unit_price: 1000 }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustment = statements.find(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 2);
  assert.equal(adjustment?.values[4], 200);
});

test("order target forces global across allocation instead of per-line quantity caps", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ target_type: "order", allocation: "each", max_quantity: 1 }),
    lines: [
      { id: "line_1", quantity: 2, unit_price: 1000 },
      { id: "line_2", quantity: 2, unit_price: 500 },
    ],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 3);
  assert.deepEqual(adjustments.map(({ values }) => [values[4], values[6]]), [[200, "line_1"], [100, "line_2"]]);
});

test("order target promotions honor item target rules", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({ target_type: "order" }),
    lines: [
      { id: "line_match", quantity: 1, unit_price: 1000, product_id: "prod_match" },
      { id: "line_other", quantity: 1, unit_price: 2000, product_id: "prod_other" },
    ],
    targetRules: [{ rule_id: "rule_product", attribute: "items.product.id", operator: "in", value: "prod_match" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 1);
  assert.deepEqual(adjustments.map(({ values }) => [values[4], values[6]]), [[100, "line_match"]]);
});

test("Buy/Get applies a target discount after the minimum buy quantity is satisfied", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({
      promotion_type: "buyget", value: 50, allocation: "each", max_quantity: 1,
      buy_rules_min_quantity: 2, apply_to_quantity: 1,
    }),
    lines: [
      { id: "line_buy", quantity: 2, unit_price: 1000, product_id: "prod_buy" },
      { id: "line_target", quantity: 1, unit_price: 500, product_id: "prod_target" },
    ],
    buyRules: [{ rule_id: "buy_product", attribute: "items.product.id", operator: "in", value: "prod_buy" }],
    targetRules: [{ rule_id: "target_product", attribute: "items.product.id", operator: "in", value: "prod_target" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustment = statements.find(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 2.5);
  assert.deepEqual(adjustment?.values.slice(4, 5), [250]);
  assert.equal(adjustment?.values[6], "line_target");
});

test("Buy/Get reserves overlapping buy items before selecting target units", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({
      promotion_type: "buyget", value: 100, allocation: "each", max_quantity: 1,
      buy_rules_min_quantity: 2, apply_to_quantity: 1,
    }),
    lines: [{ id: "line_same_product", quantity: 3, unit_price: 1000, product_id: "prod_same" }],
    buyRules: [{ rule_id: "buy_product", attribute: "items.product.id", operator: "in", value: "prod_same" }],
    targetRules: [{ rule_id: "target_product", attribute: "items.product.id", operator: "in", value: "prod_same" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustment = statements.find(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 10);
  assert.equal(adjustment?.values[4], 1000);
});

test("Buy/Get repeats the buy-and-target cycle until the configured maximum quantity", async () => {
  const { database, statements } = makeDatabase({
    promotion: promotion({
      promotion_type: "buyget", value: 50, allocation: "each", max_quantity: 2,
      buy_rules_min_quantity: 2, apply_to_quantity: 1,
    }),
    lines: [
      { id: "line_buy", quantity: 4, unit_price: 1000, product_id: "prod_buy" },
      { id: "line_target", quantity: 2, unit_price: 500, product_id: "prod_target" },
    ],
    buyRules: [{ rule_id: "buy_product", attribute: "items.product.id", operator: "in", value: "prod_buy" }],
    targetRules: [{ rule_id: "target_product", attribute: "items.product.id", operator: "in", value: "prod_target" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 5);
  assert.deepEqual(adjustments.map(({ values }) => [values[4], values[6]]), [[500, "line_target"]]);
});

test("removing one code recomputes and preserves other cart promotion adjustments", async () => {
  const oldPromotion = promotion({ id: "promo_old", code: "REMOVE10", value: 10 });
  const keptPromotion = promotion({ id: "promo_kept", code: "KEEP5", value: 5 });
  const { database, statements } = makeDatabase({
    appliedPromotions: [oldPromotion, keptPromotion],
    lines: [{ id: "line_1", quantity: 1, unit_price: 1000 }],
  });
  const response = await handlePromotionRequest(new Request("https://worker.test/api/store/promotions", {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartId: "cart_1", code: "REMOVE10" }),
  }), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 0);
  assert.deepEqual(adjustments.map(({ values }) => [values[2], values[4], values[6]]), [["promo_kept", 50, "line_1"]]);
  assert.equal(statements.some(({ sql, values }) => sql.includes("UPDATE public.cart_promotion") && values[1] === "REMOVE10"), true);
});

test("stack recomputation allocates Buy/Get quantities across applied codes", async () => {
  const previous = promotion({
    id: "promo_previous", code: "OLDGET", promotion_type: "buyget", value: 20,
    allocation: "each", max_quantity: 1, buy_rules_min_quantity: 2, apply_to_quantity: 1,
  });
  const requested = promotion({
    promotion_type: "buyget", value: 10, allocation: "each", max_quantity: 1,
    buy_rules_min_quantity: 2, apply_to_quantity: 1,
  });
  const { database, statements } = makeDatabase({
    promotion: requested,
    appliedPromotions: [previous],
    lines: [
      { id: "line_buy", quantity: 4, unit_price: 1000, product_id: "prod_buy" },
      { id: "line_target", quantity: 2, unit_price: 500, product_id: "prod_target" },
    ],
    buyRules: [{ rule_id: "buy_product", attribute: "items.product.id", operator: "in", value: "prod_buy" }],
    targetRules: [{ rule_id: "target_product", attribute: "items.product.id", operator: "in", value: "prod_target" }],
  });

  const response = await handlePromotionRequest(applyRequest(), database);
  const body = await response.json() as { discountAmount: number };
  const adjustments = statements.filter(({ sql }) => sql.includes("INSERT INTO public.cart_line_item_adjustment"));

  assert.equal(response.status, 200);
  assert.equal(body.discountAmount, 0.5);
  assert.deepEqual(adjustments.map(({ values }) => [values[2], values[4], values[6]]), [
    ["promo_previous", 100, "line_target"],
    ["promo_1", 50, "line_target"],
  ]);
});
