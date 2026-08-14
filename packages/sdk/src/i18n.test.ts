/**
 * PH-17: SDK i18n parity and coverage tests.
 * Ensures formatCurrency, formatDate, detectLocale, and t() behave correctly
 * for all supported locales.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  t,
  formatCurrency,
  formatDate,
  formatNumber,
  detectLocale,
  registerTranslations,
} from "./i18n.js";

const CORE_KEYS = [
  "cart.empty",
  "cart.add",
  "cart.checkout",
  "product.outOfStock",
  "product.inStock",
  "order.status.pending",
  "order.status.processing",
  "order.status.shipped",
  "order.status.delivered",
  "order.status.cancelled",
  "search.placeholder",
  "search.noResults",
  "account.orders",
  "account.addresses",
  "account.profile",
];

describe("i18n — t()", () => {
  it("returns en-PH value for known key", () => {
    const val = t("cart.empty", "en-PH");
    assert.ok(val.length > 0);
    assert.notStrictEqual(val, "cart.empty");
  });

  it("returns fil-PH value for known key", () => {
    const val = t("cart.empty", "fil-PH");
    assert.ok(val.length > 0);
    assert.notStrictEqual(val, "cart.empty");
  });

  it("falls back to en-PH for unknown locale key missing from fil-PH", () => {
    registerTranslations("fil-PH", {});
    const val = t("cart.checkout", "fil-PH");
    assert.ok(val.length > 0);
  });

  it("returns the raw key when not registered in any locale", () => {
    const val = t("totally.unknown.key.xyz");
    assert.strictEqual(val, "totally.unknown.key.xyz");
  });

  it("interpolates variables", () => {
    registerTranslations("en-PH", { "test.count": "You have {count} items" });
    const val = t("test.count", "en-PH", { count: 3 });
    assert.strictEqual(val, "You have 3 items");
  });

  it("all core keys exist in en-PH and are not raw key strings", () => {
    for (const key of CORE_KEYS) {
      const val = t(key, "en-PH");
      assert.notStrictEqual(val, key, `en-PH is missing key: ${key}`);
    }
  });

  it("all core keys exist in fil-PH and are not raw key strings", () => {
    for (const key of CORE_KEYS) {
      const val = t(key, "fil-PH");
      assert.notStrictEqual(val, key, `fil-PH is missing key: ${key}`);
    }
  });
});

describe("i18n — formatCurrency()", () => {
  it("formats PHP in en-PH", () => {
    const result = formatCurrency(1250, "PHP", "en-PH");
    assert.ok(result.includes("1,250") || result.includes("1250"), `unexpected: ${result}`);
    assert.ok(result.toLowerCase().includes("php") || result.includes("₱"), `missing currency: ${result}`);
  });

  it("formats USD in en-US", () => {
    const result = formatCurrency(99.99, "USD", "en-US");
    assert.ok(result.includes("99.99") || result.includes("100"), `unexpected: ${result}`);
    assert.ok(result.includes("$") || result.toLowerCase().includes("usd"), `missing $: ${result}`);
  });

  it("formats PHP in fil-PH", () => {
    const result = formatCurrency(500, "PHP", "fil-PH");
    assert.ok(result.length > 0);
    assert.ok(!result.includes("NaN"));
  });

  it("falls back gracefully for unknown currency code", () => {
    const result = formatCurrency(100, "XYZ", "en-PH");
    assert.ok(result.includes("100") || result.includes("XYZ"));
  });
});

describe("i18n — formatDate()", () => {
  const dateStr = "2024-06-15T00:00:00.000Z";

  it("formats date in en-PH short style", () => {
    const result = formatDate(dateStr, "en-PH", "short");
    assert.ok(result.includes("2024"), `missing year: ${result}`);
  });

  it("formats date in en-PH long style", () => {
    const result = formatDate(dateStr, "en-PH", "long");
    assert.ok(result.includes("2024"), `missing year: ${result}`);
  });

  it("formats date in fil-PH", () => {
    const result = formatDate(dateStr, "fil-PH");
    assert.ok(result.includes("2024"), `missing year: ${result}`);
  });

  it("formats date in en-US", () => {
    const result = formatDate(dateStr, "en-US");
    assert.ok(result.includes("2024"), `missing year: ${result}`);
  });

  it("accepts a Date object", () => {
    const d = new Date("2024-01-01T00:00:00Z");
    const result = formatDate(d, "en-PH");
    assert.ok(result.includes("2024"));
  });
});

describe("i18n — formatNumber()", () => {
  it("formats en-PH with comma thousands separator", () => {
    const result = formatNumber(1000000, "en-PH");
    assert.ok(result.includes("1") && result.includes("000"));
  });

  it("handles zero", () => {
    assert.strictEqual(formatNumber(0, "en-PH"), "0");
  });
});

describe("i18n — detectLocale()", () => {
  it("returns en-PH for Accept-Language: en", () => {
    assert.strictEqual(detectLocale("en"), "en-PH");
  });

  it("returns en-PH for Accept-Language: en-PH,en;q=0.9", () => {
    assert.strictEqual(detectLocale("en-PH,en;q=0.9"), "en-PH");
  });

  it("returns fil-PH for Accept-Language: fil-PH", () => {
    assert.strictEqual(detectLocale("fil-PH"), "fil-PH");
  });

  it("returns fil-PH for Accept-Language: tl", () => {
    assert.strictEqual(detectLocale("tl"), "fil-PH");
  });

  it("returns en-US for Accept-Language: en-US", () => {
    assert.strictEqual(detectLocale("en-US"), "en-US");
  });

  it("returns DEFAULT_LOCALE when no header", () => {
    assert.strictEqual(detectLocale(undefined), "en-PH");
  });

  it("returns DEFAULT_LOCALE for unrecognized language", () => {
    assert.strictEqual(detectLocale("ja"), "en-PH");
  });
});
