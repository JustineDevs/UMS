import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProductReview,
  listProductReviews,
  updateProductReview,
} from "./product-reviews.js";

type QueryCapture = {
  payload?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
  row?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
};

function createSupabaseStub(capture: QueryCapture): SupabaseClient {
  const chain = {
    select() {
      capture.filters.push({ method: "select", args: [] });
      return chain;
    },
    order(...args: unknown[]) {
      capture.filters.push({ method: "order", args });
      return chain;
    },
    limit(...args: unknown[]) {
      capture.filters.push({ method: "limit", args });
      return chain;
    },
    eq(...args: unknown[]) {
      capture.filters.push({ method: "eq", args });
      return chain;
    },
    or(...args: unknown[]) {
      capture.filters.push({ method: "or", args });
      return chain;
    },
    insert(payload: unknown) {
      capture.payload = payload;
      capture.filters.push({ method: "insert", args: [payload] });
      return {
        select() {
          return {
            single: async () => ({
              data: capture.row ?? null,
              error: null,
            }),
          };
        },
      };
    },
    update(payload: unknown) {
      capture.payload = payload;
      capture.filters.push({ method: "update", args: [payload] });
      return chain;
    },
    maybeSingle: async () => ({
      data: capture.row ?? null,
      error: null,
    }),
    single: async () => ({
      data: capture.row ?? null,
      error: null,
    }),
    is(...args: unknown[]) {
      capture.filters.push({ method: "is", args });
      return chain;
    },
    contains(...args: unknown[]) {
      capture.filters.push({ method: "contains", args });
      return chain;
    },
    ilike(...args: unknown[]) {
      capture.filters.push({ method: "ilike", args });
      return chain;
    },
  };

  return {
    from() {
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("product review helpers", () => {
  it("creates trimmed pending reviews and keeps unlinked placeholders", async () => {
    const capture: QueryCapture = {
      filters: [],
      row: {
        id: "review_1",
        product_slug: "unlinked",
        medusa_product_id: null,
        rating: 5,
        author_name: "Justine",
        body: "Great guitar",
        status: "pending",
        created_at: "2026-08-01T00:00:00.000Z",
        customer_email: null,
        medusa_customer_id: null,
        is_verified_buyer: false,
        verified_medusa_order_id: null,
        verified_at: null,
        moderated_by_staff_email: null,
        moderated_at: null,
        moderation_note: null,
        helpful_votes: 0,
      },
    };
    const supabase = createSupabaseStub(capture);

    const row = await createProductReview(supabase, {
      product_slug: "  unlinked  ",
      rating: 5,
      author_name: "  Justine  ",
      body: "  Great guitar  ",
    });

    assert.equal(row?.status, "pending");
    assert.equal(row?.product_slug, "unlinked");
    assert.equal(row?.author_name, "Justine");
    assert.equal(capture.payload && typeof capture.payload === "object", true);
    assert.deepEqual(
      capture.payload,
      {
        product_slug: "unlinked",
        medusa_product_id: null,
        rating: 5,
        author_name: "Justine",
        image_url: null,
        body: "Great guitar",
        status: "pending",
        customer_email: null,
        medusa_customer_id: null,
        is_verified_buyer: false,
        verified_medusa_order_id: null,
        verified_at: null,
        moderated_by_staff_email: null,
        moderated_at: null,
        moderation_note: null,
      },
    );
  });

  it("updates fields and allows later product linkage", async () => {
    const capture: QueryCapture = {
      filters: [],
      row: {
        id: "review_1",
        product_slug: "stratocaster",
        medusa_product_id: "prod_123",
        rating: 4,
        author_name: "Cara",
        body: "Updated review",
        status: "approved",
        created_at: "2026-08-01T00:00:00.000Z",
        customer_email: "cara@example.com",
        medusa_customer_id: null,
        is_verified_buyer: true,
        verified_medusa_order_id: "order_1",
        verified_at: "2026-08-01T00:00:00.000Z",
        moderated_by_staff_email: "staff@example.com",
        moderated_at: "2026-08-01T00:00:00.000Z",
        moderation_note: null,
        helpful_votes: 1,
      },
    };
    const supabase = createSupabaseStub(capture);

    const row = await updateProductReview(supabase, "review_1", {
      product_slug: "  stratocaster  ",
      medusa_product_id: "  prod_123  ",
      rating: 4,
      author_name: "Cara",
      body: "Updated review",
      status: "approved",
      customer_email: "cara@example.com",
      is_verified_buyer: true,
      verified_medusa_order_id: "order_1",
      verified_at: "2026-08-01T00:00:00.000Z",
      moderated_by_staff_email: "staff@example.com",
      moderated_at: "2026-08-01T00:00:00.000Z",
      moderation_note: "linked later",
    });

    assert.equal(row?.product_slug, "stratocaster");
    assert.equal(row?.medusa_product_id, "prod_123");
    assert.equal(capture.payload && typeof capture.payload === "object", true);
    assert.deepEqual(
      capture.payload,
      {
        product_slug: "stratocaster",
        medusa_product_id: "prod_123",
        rating: 4,
        author_name: "Cara",
        body: "Updated review",
        status: "approved",
        customer_email: "cara@example.com",
        is_verified_buyer: true,
        verified_medusa_order_id: "order_1",
        verified_at: "2026-08-01T00:00:00.000Z",
        moderated_by_staff_email: "staff@example.com",
        moderated_at: "2026-08-01T00:00:00.000Z",
        moderation_note: "linked later",
      },
    );
  });

  it("filters review searches by text and status", async () => {
    const capture: QueryCapture = {
      filters: [],
      rows: [],
    };
    const supabase = createSupabaseStub(capture);

    await listProductReviews(supabase, {
      status: "approved",
      productSlug: "stratocaster",
      medusaProductId: "prod_123",
      q: "Guitar",
      limit: 10,
    });

    assert.deepEqual(
      capture.filters.map((entry) => entry.method),
      ["select", "order", "limit", "eq", "eq", "eq", "or"],
    );
  });
});
