import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

type Promotion = {
  id: string;
  code: string;
  status: string;
  promotion_type: string;
  limit: number | null;
  used: number | null;
  method_id: string;
  value: string | number;
  method_type: string;
  target_type: string;
  allocation: string | null;
  max_quantity: number | null;
  buy_rules_min_quantity: number | null;
  apply_to_quantity: number | null;
  is_tax_inclusive: boolean;
  currency_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type CartContext = {
  id: string;
  currency_code: string;
  region_id: string | null;
  customer_id: string | null;
  sales_channel_id: string | null;
  email: string | null;
  metadata: unknown;
};

type PromotionRule = { attribute: string; operator: string; values: string[] };
type CartLine = {
  id: string;
  quantity: number;
  unit_price: string | number;
  promotion_discounted_amount: string | number;
  is_discountable: boolean;
  product_id: string | null;
  variant_id: string | null;
  product_title: string | null;
  product_type: string | null;
  product_collection: string | null;
  product_handle: string | null;
  variant_sku: string | null;
  variant_barcode: string | null;
  variant_title: string | null;
  variant_option_values: unknown;
  metadata: unknown;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseBody(value: unknown): { cartId: string; code: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const cartId = typeof input.cartId === "string" ? input.cartId.trim() : "";
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!cartId || cartId.length > 120 || !code || code.length > 64) return null;
  return { cartId, code };
}

async function readPromotion(
  transaction: WorkerDatabaseClient,
  cartId: string,
  code: string,
): Promise<Promotion | null> {
  const result = await transaction.query<Promotion>(
    `SELECT p.id, p.code, p.status, p.type AS promotion_type, p.is_tax_inclusive, p.limit, p.used,
            pam.id AS method_id, pam.value, pam.type AS method_type,
            pam.target_type, pam.currency_code, pam.allocation, pam.max_quantity,
            pam.buy_rules_min_quantity, pam.apply_to_quantity,
            pc.starts_at, pc.ends_at
     FROM public.cart c
     JOIN public.promotion p ON upper(p.code) = upper($2) AND p.deleted_at IS NULL
     LEFT JOIN public.promotion_campaign pc ON pc.id = p.campaign_id AND pc.deleted_at IS NULL
     JOIN public.promotion_application_method pam
       ON pam.promotion_id = p.id AND pam.deleted_at IS NULL
     WHERE c.id = $1 AND c.deleted_at IS NULL AND c.completed_at IS NULL
     ORDER BY pam.created_at DESC
     LIMIT 1`,
    [cartId, code],
  );
  return result.rows[0] ?? null;
}

async function readAppliedPromotions(
  transaction: WorkerDatabaseClient,
  cartId: string,
): Promise<Promotion[]> {
  const result = await transaction.query<Promotion>(
    `SELECT p.id, p.code, p.status, p.type AS promotion_type, p.is_tax_inclusive, p.limit, p.used,
            pam.id AS method_id, pam.value, pam.type AS method_type,
            pam.target_type, pam.currency_code, pam.allocation, pam.max_quantity,
            pam.buy_rules_min_quantity, pam.apply_to_quantity,
            pc.starts_at, pc.ends_at
     FROM public.cart_promotion cp
     JOIN public.promotion p ON p.id = cp.promotion_id AND p.deleted_at IS NULL
     JOIN public.promotion_application_method pam
       ON pam.promotion_id = p.id AND pam.deleted_at IS NULL
     LEFT JOIN public.promotion_campaign pc ON pc.id = p.campaign_id AND pc.deleted_at IS NULL
     WHERE cp.cart_id = $1 AND cp.deleted_at IS NULL
     ORDER BY cp.created_at, cp.id, pam.created_at DESC`,
    [cartId],
  );
  return result.rows;
}

function invalidPromotion(promotion: Promotion | null): string | null {
  if (!promotion) return "promotion_invalid";
  if (promotion.status.trim().toLowerCase() !== "active") return "promotion_inactive";
  if (promotion.promotion_type !== "standard" && promotion.promotion_type !== "buyget") return "promotion_type_unsupported";
  const now = Date.now();
  if (promotion.starts_at && Date.parse(promotion.starts_at) > now) return "promotion_not_started";
  if (promotion.ends_at && Date.parse(promotion.ends_at) <= now) return "promotion_expired";
  if (promotion.limit !== null && Number(promotion.used ?? 0) >= promotion.limit) return "promotion_limit_reached";
  if (!/^(fixed|percentage)$/i.test(promotion.method_type)) return "promotion_type_unsupported";
  const value = Number(promotion.value);
  if (!Number.isFinite(value) || value < 0 || (promotion.method_type.toLowerCase() === "percentage" && (value <= 0 || value > 100))) {
    return "promotion_value_invalid";
  }
  if (!/^(order|items)$/i.test(promotion.target_type)) return "promotion_target_unsupported";
  if (promotion.is_tax_inclusive) return "promotion_tax_inclusive_unsupported";
  if (promotion.promotion_type === "buyget") {
    const buyQuantity = Number(promotion.buy_rules_min_quantity);
    const targetQuantity = Number(promotion.apply_to_quantity);
    const maximumQuantity = Number(promotion.max_quantity);
    if (promotion.target_type.toLowerCase() !== "items" || promotion.allocation === null || !/^(each|across)$/.test(promotion.allocation)) {
      return "promotion_allocation_unsupported";
    }
    if (!Number.isSafeInteger(buyQuantity) || buyQuantity <= 0 || !Number.isSafeInteger(targetQuantity) || targetQuantity <= 0 ||
        !Number.isSafeInteger(maximumQuantity) || maximumQuantity < targetQuantity) {
      return "promotion_quantity_cap_invalid";
    }
    return null;
  }
  if (promotion.target_type.toLowerCase() === "order") {
    return promotion.allocation === null || /^(across|each|once)$/.test(promotion.allocation)
      ? null
      : "promotion_allocation_unsupported";
  }
  if (promotion.allocation === "across" || promotion.allocation === null) {
    if (promotion.max_quantity !== null) return "promotion_quantity_cap_unsupported";
  } else if (promotion.allocation === "each" || promotion.allocation === "once") {
    if (promotion.max_quantity === null || !Number.isFinite(Number(promotion.max_quantity)) || Number(promotion.max_quantity) <= 0) {
      return "promotion_quantity_cap_invalid";
    }
  } else {
    return "promotion_allocation_unsupported";
  }
  return null;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* Invalid persisted metadata is not eligible for rule matching. */ }
  }
  return {};
}

function valueAtPath(context: Record<string, unknown>, path: string): unknown {
  let value: unknown = context;
  for (const part of path.split(".")) {
    if (!part || part === "__proto__" || part === "prototype" || part === "constructor") return undefined;
    if (Array.isArray(value)) {
      value = value.map((entry) => entry && typeof entry === "object" ? (entry as Record<string, unknown>)[part] : undefined);
    } else if (value && typeof value === "object" && Object.hasOwn(value, part)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function ruleMatches(rule: PromotionRule, context: Record<string, unknown>, scope: "order" | "items"): boolean {
  if (!rule.attribute || !Array.isArray(rule.values) || rule.values.length === 0) return false;
  const attribute = scope === "items" ? rule.attribute.replace(/^items\./, "") : rule.attribute;
  const raw = valueAtPath(context, attribute);
  const candidates = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  const expected = new Set(rule.values);
  const strings = candidates.map((value) => String(value));
  switch (rule.operator) {
    case "eq": return strings.length > 0 && strings.every((value) => expected.has(value));
    case "in": return strings.some((value) => expected.has(value));
    case "ne": return strings.every((value) => !expected.has(value));
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (strings.length === 0) return false;
      const targets = rule.values.map(Number);
      const values = strings.map(Number);
      if (targets.some((value) => !Number.isFinite(value)) || values.some((value) => !Number.isFinite(value))) return false;
      return values.every((value) => targets.some((target) => rule.operator === "gt" ? value > target : rule.operator === "gte" ? value >= target : rule.operator === "lt" ? value < target : value <= target));
    }
    default: return false;
  }
}

function rulesMatch(rules: PromotionRule[], context: Record<string, unknown>, scope: "order" | "items"): boolean {
  return rules.every((rule) => ruleMatches(rule, context, scope));
}

async function readRules(
  transaction: WorkerDatabaseClient,
  promotionId: string,
  methodId: string,
): Promise<{ order: PromotionRule[]; target: PromotionRule[]; buy: PromotionRule[] }> {
  const read = async (
    joinTable: "promotion_promotion_rule" | "application_method_target_rules" | "application_method_buy_rules",
    ownerColumn: "promotion_id" | "application_method_id",
    ownerId: string,
  ) => {
    const result = await transaction.query<{ rule_id: string; attribute: string; operator: string; value: string }>(
      `SELECT pr.id AS rule_id, pr.attribute, pr.operator, prv.value
       FROM public.${joinTable} link
       JOIN public.promotion_rule pr ON pr.id = link.promotion_rule_id AND pr.deleted_at IS NULL
       LEFT JOIN public.promotion_rule_value prv ON prv.promotion_rule_id = pr.id AND prv.deleted_at IS NULL
       WHERE link.${ownerColumn} = $1
       ORDER BY pr.id, prv.id`,
      [ownerId],
    );
    const grouped = new Map<string, PromotionRule>();
    for (const row of result.rows) {
      const rule = grouped.get(row.rule_id) ?? { attribute: row.attribute, operator: row.operator, values: [] };
      if (typeof row.value === "string") rule.values.push(row.value);
      grouped.set(row.rule_id, rule);
    }
    return [...grouped.values()];
  };
  const order = await read("promotion_promotion_rule", "promotion_id", promotionId);
  const target = await read("application_method_target_rules", "application_method_id", methodId);
  const buy = await read("application_method_buy_rules", "application_method_id", methodId);
  return { order, target, buy };
}

function lineRuleContext(line: CartLine): Record<string, unknown> {
  return {
    ...line,
    subtotal: Number(line.unit_price) * line.quantity,
    product: {
      id: line.product_id,
      title: line.product_title,
      type: line.product_type,
      collection: line.product_collection,
      handle: line.product_handle,
    },
    variant: {
      id: line.variant_id,
      sku: line.variant_sku,
      barcode: line.variant_barcode,
      title: line.variant_title,
      option_values: parseJsonObject(line.variant_option_values),
    },
    metadata: parseJsonObject(line.metadata),
  };
}

function calculateDiscount(promotion: Promotion, subtotal: number, currency: string): number | null {
  if (promotion.method_type.toLowerCase() === "fixed" && promotion.currency_code && promotion.currency_code.toLowerCase() !== currency.toLowerCase()) return null;
  const value = Number(promotion.value);
  if (!Number.isFinite(value) || value < 0) return null;
  const discount = promotion.method_type.toLowerCase() === "percentage"
    ? Math.round(subtotal * value / 100)
    : Math.round(value);
  return Math.max(0, Math.min(subtotal, discount));
}

function allocateDiscount<T extends { id: string; quantity: number; unit_price: string | number }>(
  lines: T[],
  discount: number,
): Map<string, number> {
  const totals = lines.map((line) => {
    const lineTotal = Math.max(0, Math.round(Number(line.unit_price) * line.quantity));
    const appliedPromotionDiscount = "promotion_discounted_amount" in line
      ? Math.max(0, Math.round(Number(line.promotion_discounted_amount) || 0))
      : 0;
    return Math.max(0, lineTotal - appliedPromotionDiscount);
  });
  const subtotal = totals.reduce((sum, amount) => sum + amount, 0);
  const boundedDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const allocations = new Map<string, number>();
  if (subtotal === 0 || boundedDiscount === 0) return allocations;

  const shares = totals.map((lineTotal, index) => {
    const exact = boundedDiscount * lineTotal / subtotal;
    const amount = Math.min(lineTotal, Math.floor(exact));
    allocations.set(lines[index]!.id, amount);
    return { id: lines[index]!.id, remainder: exact - amount, capacity: lineTotal - amount };
  });
  let remaining = boundedDiscount - [...allocations.values()].reduce((sum, amount) => sum + amount, 0);
  shares.sort((left, right) => right.remainder - left.remainder || left.id.localeCompare(right.id));
  for (const share of shares) {
    if (remaining <= 0) break;
    if (share.capacity <= 0) continue;
    allocations.set(share.id, (allocations.get(share.id) ?? 0) + 1);
    remaining -= 1;
  }
  return allocations;
}

function allocateQuantityDiscount(
  promotion: Promotion,
  lines: CartLine[],
): Map<string, number> {
  const type = promotion.method_type.toLowerCase();
  const allocation = promotion.allocation;
  const maxQuantity = Number(promotion.max_quantity);
  const orderedLines = allocation === "once"
    ? [...lines].sort((left, right) => Number(left.unit_price) - Number(right.unit_price))
    : lines;
  let remainingQuantity = maxQuantity;
  const discounts = new Map<string, number>();

  for (const line of orderedLines) {
    if (allocation === "once" && remainingQuantity <= 0) break;
    const quantity = Math.min(
      Number(line.quantity),
      allocation === "once" ? remainingQuantity : maxQuantity,
    );
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const unitPrice = Math.max(0, Number(line.unit_price));
    const lineTotal = Math.max(0, Math.round(unitPrice * Number(line.quantity)));
    const appliedPromotionDiscount = Math.max(0, Math.round(Number(line.promotion_discounted_amount) || 0));
    const remainingLineAmount = Math.max(0, lineTotal - appliedPromotionDiscount);
    const eligibleAmount = Math.min(remainingLineAmount, Math.round(unitPrice * quantity));
    if (eligibleAmount <= 0) continue;
    const configuredValue = Number(promotion.value);
    const rawDiscount = type === "percentage"
      ? eligibleAmount * configuredValue / 100
      : quantity * configuredValue;
    const discount = Math.max(0, Math.min(eligibleAmount, Math.round(rawDiscount)));
    if (discount > 0) discounts.set(line.id, discount);
    if (allocation === "once") remainingQuantity -= quantity;
  }

  return discounts;
}

type PromotionAllocation = { item_id: string; quantity: number };

function sortPromotionStack(left: Promotion, right: Promotion): number {
  const leftIsBuyGet = left.promotion_type === "buyget";
  const rightIsBuyGet = right.promotion_type === "buyget";
  if (leftIsBuyGet !== rightIsBuyGet) return leftIsBuyGet ? -1 : 1;
  const valueOrder = Number(right.value) - Number(left.value);
  if (valueOrder !== 0) return valueOrder;
  if (leftIsBuyGet) {
    const buyQuantityOrder = Number(right.buy_rules_min_quantity) - Number(left.buy_rules_min_quantity);
    if (buyQuantityOrder !== 0) return buyQuantityOrder;
    return Number(right.apply_to_quantity) - Number(left.apply_to_quantity);
  }
  return 0;
}

function remainingQuantities(
  lines: CartLine[],
  allocationsByCode: Map<string, PromotionAllocation[]>,
  currentCode: string,
): Map<string, number> {
  return new Map(lines.map((line) => {
    const used = [...allocationsByCode.entries()]
      .filter(([code]) => code !== currentCode)
      .flatMap(([, allocations]) => allocations)
      .filter((allocation) => allocation.item_id === line.id)
      .reduce((total, allocation) => total + allocation.quantity, 0);
    return [line.id, Math.max(0, Number(line.quantity) - used)];
  }));
}

function updateRemainingQuantities(
  buyQuantities: Map<string, number>,
  targetQuantities: Map<string, number>,
  buyItems: PromotionAllocation[],
  targetItems: PromotionAllocation[],
): void {
  const consumed = new Map<string, number>();
  for (const allocation of [...buyItems, ...targetItems]) {
    consumed.set(allocation.item_id, (consumed.get(allocation.item_id) ?? 0) + allocation.quantity);
  }
  for (const [itemId, quantity] of consumed) {
    if (buyQuantities.has(itemId)) buyQuantities.set(itemId, Math.max(0, (buyQuantities.get(itemId) ?? 0) - quantity));
    if (targetQuantities.has(itemId)) targetQuantities.set(itemId, Math.max(0, (targetQuantities.get(itemId) ?? 0) - quantity));
  }
}

function addAllocations(target: Map<string, PromotionAllocation[]>, code: string, items: PromotionAllocation[]): void {
  const previous = target.get(code) ?? [];
  const combined = new Map(previous.map((item) => [item.item_id, item.quantity]));
  for (const item of items) combined.set(item.item_id, (combined.get(item.item_id) ?? 0) + item.quantity);
  target.set(code, [...combined].map(([item_id, quantity]) => ({ item_id, quantity })));
}

function calculateBuyGetDiscount(
  promotion: Promotion,
  lines: CartLine[],
  rules: { buy: PromotionRule[]; target: PromotionRule[] },
  buyAllocationsByCode: Map<string, PromotionAllocation[]>,
  targetAllocationsByCode: Map<string, PromotionAllocation[]>,
  discountByLine: Map<string, number>,
): Map<string, number> {
  if (rules.buy.length === 0) return new Map();
  const byDescendingSubtotal = (left: CartLine, right: CartLine) =>
    Number(right.unit_price) * Number(right.quantity) - Number(left.unit_price) * Number(left.quantity);
  const eligible = (line: CartLine, itemRules: PromotionRule[]) =>
    line.is_discountable && Number(line.quantity) > 0 && Number(line.unit_price) > 0 &&
    rulesMatch(itemRules, lineRuleContext(line), "items");
  const buyItems = lines.filter((line) => eligible(line, rules.buy)).sort(byDescendingSubtotal);
  const targetItems = lines.filter((line) => eligible(line, rules.target)).sort(byDescendingSubtotal);
  if (buyItems.length === 0 || targetItems.length === 0) return new Map();

  const minimumBuyQuantity = Number(promotion.buy_rules_min_quantity);
  const applyToQuantity = Number(promotion.apply_to_quantity);
  const maximumQuantity = Number(promotion.max_quantity);
  const remainingBuy = remainingQuantities(buyItems, buyAllocationsByCode, promotion.code);
  const remainingTarget = remainingQuantities(targetItems, targetAllocationsByCode, promotion.code);
  const targetIds = new Set(targetItems.map((line) => line.id));
  const buyReservationOrder = [
    ...buyItems.filter((line) => !targetIds.has(line.id)),
    ...buyItems.filter((line) => targetIds.has(line.id)),
  ];
  const totalDiscounts = new Map<string, number>();
  let appliedQuantity = 0;

  for (let iteration = 0; iteration < 1000; iteration += 1) {
    if ([...remainingBuy.values()].reduce((sum, quantity) => sum + quantity, 0) < minimumBuyQuantity) break;

    const buyItemsForApplication: PromotionAllocation[] = [];
    let accumulatedBuyQuantity = 0;
    for (const line of buyReservationOrder) {
      if (accumulatedBuyQuantity >= minimumBuyQuantity) break;
      const available = remainingBuy.get(line.id) ?? 0;
      const quantity = Math.min(available, minimumBuyQuantity - accumulatedBuyQuantity);
      if (quantity <= 0) continue;
      buyItemsForApplication.push({ item_id: line.id, quantity });
      accumulatedBuyQuantity += quantity;
    }
    if (accumulatedBuyQuantity < minimumBuyQuantity) break;

    const quantityUsedByBuy = new Map<string, number>();
    for (const allocation of buyItemsForApplication) {
      quantityUsedByBuy.set(allocation.item_id, (quantityUsedByBuy.get(allocation.item_id) ?? 0) + allocation.quantity);
    }
    const targetItemsForApplication: PromotionAllocation[] = [];
    let availableTargetQuantity = 0;
    for (const line of targetItems) {
      const available = (remainingTarget.get(line.id) ?? 0) - (quantityUsedByBuy.get(line.id) ?? 0);
      const quantityNeeded = applyToQuantity - availableTargetQuantity;
      const maximumAllowed = maximumQuantity - appliedQuantity;
      const quantity = Math.min(quantityNeeded, available, maximumAllowed);
      if (quantity <= 0) continue;
      targetItemsForApplication.push({ item_id: line.id, quantity });
      availableTargetQuantity += quantity;
      if (availableTargetQuantity >= applyToQuantity) break;
    }
    if (availableTargetQuantity < applyToQuantity) break;

    let remainingToDiscount = applyToQuantity;
    let quantityDiscounted = 0;
    for (const allocation of targetItemsForApplication) {
      if (remainingToDiscount <= 0) break;
      const line = lines.find((candidate) => candidate.id === allocation.item_id);
      if (!line) continue;
      const quantity = Math.min(allocation.quantity, remainingToDiscount);
      const eligibleAmount = Number(line.unit_price) * quantity;
      const configuredValue = Number(promotion.value);
      const amount = promotion.method_type.toLowerCase() === "fixed"
        ? Math.min(configuredValue * quantity, eligibleAmount)
        : Math.round(eligibleAmount * configuredValue / 100);
      if (amount <= 0) continue;
      remainingToDiscount -= quantity;
      quantityDiscounted += quantity;
      totalDiscounts.set(line.id, (totalDiscounts.get(line.id) ?? 0) + amount);
    }
    appliedQuantity += quantityDiscounted;
    updateRemainingQuantities(remainingBuy, remainingTarget, buyItemsForApplication, targetItemsForApplication);
    addAllocations(buyAllocationsByCode, promotion.code, buyItemsForApplication);
    addAllocations(targetAllocationsByCode, promotion.code, targetItemsForApplication);
    if (quantityDiscounted <= 0) break;
  }

  for (const [lineId, amount] of totalDiscounts) {
    discountByLine.set(lineId, (discountByLine.get(lineId) ?? 0) + amount);
  }
  return totalDiscounts;
}

function calculateStandardDiscount(
  promotion: Promotion,
  rules: { order: PromotionRule[]; target: PromotionRule[] },
  cart: CartContext,
  lines: CartLine[],
  discountsByLine: Map<string, number>,
): { error: string | null; discounts: Map<string, number> } {
  const orderContext = { ...cart, metadata: parseJsonObject(cart.metadata), items: lines.map(lineRuleContext) };
  if (!rulesMatch(rules.order, orderContext, "order")) return { error: null, discounts: new Map() };
  const eligibleLines = lines.filter((line) =>
    line.is_discountable && Number(line.quantity) > 0 && Number(line.unit_price) > 0 &&
    rulesMatch(rules.target, lineRuleContext(line), "items"));
  const pricedLines = eligibleLines.map((line) => ({
    ...line,
    promotion_discounted_amount: discountsByLine.get(line.id) ?? 0,
  }));
  const subtotal = pricedLines.reduce((sum, line) =>
    sum + Math.max(0, Math.round(Number(line.unit_price) * line.quantity) - Math.max(0, Math.round(Number(line.promotion_discounted_amount) || 0))), 0);
  if (subtotal <= 0) return { error: null, discounts: new Map() };

  const isQuantityAllocation = promotion.target_type.toLowerCase() !== "order" &&
    (promotion.allocation === "each" || promotion.allocation === "once");
  if (promotion.method_type.toLowerCase() === "fixed" && promotion.currency_code &&
      promotion.currency_code.toLowerCase() !== cart.currency_code.toLowerCase()) {
    return { error: "promotion_currency_mismatch", discounts: new Map() };
  }
  const discount = isQuantityAllocation ? null : calculateDiscount(promotion, subtotal, cart.currency_code);
  if (!isQuantityAllocation && discount === null) return { error: "promotion_currency_mismatch", discounts: new Map() };
  return {
    error: null,
    discounts: isQuantityAllocation
      ? allocateQuantityDiscount(promotion, pricedLines)
      : allocateDiscount(pricedLines, discount!),
  };
}

async function calculatePromotionStack(
  transaction: WorkerDatabaseClient,
  cart: CartContext,
  lines: CartLine[],
  promotions: Promotion[],
): Promise<{ error: string | null; discountsByCode: Map<string, Map<string, number>> }> {
  const discountsByCode = new Map<string, Map<string, number>>();
  const discountsByLine = new Map<string, number>();
  const buyAllocationsByCode = new Map<string, PromotionAllocation[]>();
  const targetAllocationsByCode = new Map<string, PromotionAllocation[]>();
  for (const promotion of [...promotions].sort(sortPromotionStack)) {
    const reason = invalidPromotion(promotion);
    if (reason === "promotion_limit_reached" || reason === "promotion_inactive" || reason === "promotion_not_started" || reason === "promotion_expired") {
      discountsByCode.set(promotion.code, new Map());
      continue;
    }
    if (reason) return { error: reason, discountsByCode };
    const rules = await readRules(transaction, promotion.id, promotion.method_id);
    const orderContext = { ...cart, metadata: parseJsonObject(cart.metadata), items: lines.map(lineRuleContext) };
    if (!rulesMatch(rules.order, orderContext, "order")) {
      discountsByCode.set(promotion.code, new Map());
      continue;
    }

    let discounts: Map<string, number>;
    if (promotion.promotion_type === "buyget") {
      if (promotion.method_type.toLowerCase() === "fixed" && promotion.currency_code &&
          promotion.currency_code.toLowerCase() !== cart.currency_code.toLowerCase()) {
        return { error: "promotion_currency_mismatch", discountsByCode };
      }
      discounts = calculateBuyGetDiscount(promotion, lines, rules, buyAllocationsByCode, targetAllocationsByCode, discountsByLine);
    } else {
      const result = calculateStandardDiscount(promotion, rules, cart, lines, discountsByLine);
      if (result.error) return { error: result.error, discountsByCode };
      discounts = result.discounts;
    }
    discountsByCode.set(promotion.code, discounts);
    for (const [lineId, amount] of discounts) {
      discountsByLine.set(lineId, (discountsByLine.get(lineId) ?? 0) + amount);
    }
  }

  return { error: null, discountsByCode };
}

export async function handlePromotionRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "POST" && request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const input = parseBody(body);
  if (!input) return json({ error: "cart_and_code_required" }, 400);

  try {
    return await withWorkerTransaction(database, async (transaction) => {
      const cart = await transaction.query<CartContext>(
        `SELECT id, currency_code, region_id, customer_id, sales_channel_id, email, metadata FROM public.cart
         WHERE id = $1 AND deleted_at IS NULL AND completed_at IS NULL
         FOR UPDATE`,
        [input.cartId],
      );
      const cartRow = cart.rows[0];
      if (!cartRow) return json({ error: "cart_not_available" }, 409);
      const lines = (await transaction.query<CartLine>(
        `SELECT li.id, li.quantity, li.unit_price, li.is_discountable, li.product_id, li.variant_id,
                product_title, product_type, product_collection, product_handle,
                variant_sku, variant_barcode, variant_title, variant_option_values, li.metadata,
                COALESCE((
                  SELECT SUM(a.amount) FROM public.cart_line_item_adjustment a
                  WHERE a.item_id = li.id AND a.promotion_id IS NOT NULL AND a.deleted_at IS NULL
                ), 0) AS promotion_discounted_amount
         FROM public.cart_line_item li
         WHERE li.cart_id = $1 AND li.deleted_at IS NULL ORDER BY li.created_at, li.id`,
        [input.cartId],
      )).rows;
      if (!lines.some((line) => Number(line.unit_price) > 0 && line.quantity > 0)) {
        return json({ error: "cart_not_available" }, 409);
      }

      const existingPromotions = await readAppliedPromotions(transaction, input.cartId);
      let requestedPromotion: Promotion | null = null;
      let desiredPromotions = existingPromotions;
      if (request.method === "POST") {
        requestedPromotion = await readPromotion(transaction, input.cartId, input.code);
        const reason = invalidPromotion(requestedPromotion);
        if (reason) return json({ error: reason }, 422);
        if (existingPromotions.some((promotion) => promotion.id === requestedPromotion!.id)) {
          return json({ error: "promotion_already_applied" }, 409);
        }
        desiredPromotions = [...existingPromotions, requestedPromotion!];
      } else {
        desiredPromotions = existingPromotions.filter((promotion) => promotion.code.toUpperCase() !== input.code);
      }

      const stack = await calculatePromotionStack(transaction, cartRow, lines, desiredPromotions);
      if (stack.error) return json({ error: stack.error }, 422);
      const requestedDiscounts = request.method === "POST"
        ? stack.discountsByCode.get(requestedPromotion!.code)
        : undefined;
      const requestedDiscount = requestedDiscounts
        ? [...requestedDiscounts.values()].reduce((sum, amount) => sum + amount, 0)
        : 0;
      if (request.method === "POST" && requestedDiscount <= 0) return json({ error: "promotion_not_eligible" }, 422);

      if (request.method === "POST") {
        await transaction.query(
          `INSERT INTO public.cart_promotion (id, cart_id, promotion_id, created_at, updated_at)
           VALUES ($1, $2, $3, now(), now())`,
          [`cp_${crypto.randomUUID().replaceAll("-", "")}`, input.cartId, requestedPromotion!.id],
        );
      } else {
        await transaction.query(
          `UPDATE public.cart_promotion cp SET deleted_at = now(), updated_at = now()
           WHERE cp.cart_id = $1 AND cp.promotion_id IN
             (SELECT id FROM public.promotion WHERE upper(code) = upper($2))
             AND cp.deleted_at IS NULL`,
          [input.cartId, input.code],
        );
      }
      await transaction.query(
        `UPDATE public.cart_line_item_adjustment a SET deleted_at = now(), updated_at = now()
         WHERE a.item_id IN (SELECT id FROM public.cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL)
           AND a.promotion_id IS NOT NULL AND a.deleted_at IS NULL`,
        [input.cartId],
      );
      for (const [code, discounts] of stack.discountsByCode) {
        const promotion = desiredPromotions.find((candidate) => candidate.code === code);
        if (!promotion) continue;
        for (const [lineId, amount] of discounts) {
          if (amount <= 0) continue;
          await transaction.query(
            `INSERT INTO public.cart_line_item_adjustment
               (id, description, promotion_id, code, amount, raw_amount, metadata, created_at, updated_at, item_id, is_tax_inclusive)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, '{}'::jsonb, now(), now(), $7, false)`,
            [`clia_${crypto.randomUUID().replaceAll("-", "")}`, `Promotion ${code}`, promotion.id, code, amount, JSON.stringify({ value: String(amount), precision: 20 }), lineId],
          );
        }
      }
      return json({ ok: true, discountAmount: requestedDiscount / 100 });
    });
  } catch {
    return json({ error: "promotion_unavailable" }, 503);
  }
}

export async function handleAdminPromotionCodesRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: { JWT_SECRET?: string; SUPABASE_URL?: string },
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  const permissions = Array.isArray(claims?.permissions) ? claims.permissions : [];
  const canRead = claims && (
    claims.role === "admin" || claims.role === "owner" || permissions.includes("*") ||
    permissions.includes("campaigns:read") || permissions.includes("campaigns:write") ||
    permissions.includes("campaigns:execute") || permissions.includes("promotions:read")
  );
  if (!canRead) return json({ error: "unauthorized" }, 401);
  const result = await database.query<{ code: string }>(
    `SELECT DISTINCT upper(trim(code)) AS code
     FROM public.promotion
     WHERE deleted_at IS NULL AND status = 'active' AND trim(code) <> ''
     ORDER BY code
     LIMIT 1000`,
  );
  return json({ codes: result.rows.map((row) => row.code), count: result.rows.length });
}
