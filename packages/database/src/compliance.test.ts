/**
 * Database/platform-data compliance tests.
 * Verifies active Supabase platform schema and compliance query behavior.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  exportDataSubjectByEmail,
  anonymizeStaleOrderAddresses,
} from "@universal-music-store/platform-data";

function createMockSupabase(opts: {
  userByEmail?: Record<string, unknown> | null;
  insertError?: Error;
}): SupabaseClient {
  const { userByEmail = null, insertError } = opts;

  const makeSelectChain = (data: unknown[] = []) => ({
    select: (_cols?: string) => makeSelectChain(data),
    eq: (_col: string, _val: unknown) => makeSelectChain(data),
    lt: (_col: string, _val: unknown) => makeSelectChain(data),
    neq: (_col: string, _val: unknown) => makeSelectChain(data),
    in: (_col: string, _vals: unknown[]) => Promise.resolve({ data, error: null }),
    update: (_vals: unknown) => makeUpdateChain(),
    maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  });

  const makeUpdateChain = () => ({
    in: (_col: string, _vals: unknown[]) => Promise.resolve({ data: null, error: null }),
  });

  const from = (table: string) => {
    if (table === "users") {
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({
              data: userByEmail !== undefined ? userByEmail : { id: "u1", email: val },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "compliance_requests") {
      return {
        insert: async () => {
          if (insertError) throw insertError;
          return { data: null, error: null };
        },
      };
    }
    return makeSelectChain([]);
  };
  return { from } as unknown as SupabaseClient;
}

test("exportDataSubjectByEmail: returns null when user not found", async () => {
  const mock = createMockSupabase({ userByEmail: null });
  const out = await exportDataSubjectByEmail(mock, "nobody@example.com");
  assert.equal(out, null);
});

test("exportDataSubjectByEmail: returns user bundle when found", async () => {
  const user = { id: "u1", email: "test@example.com", name: "Test" };
  const mock = createMockSupabase({ userByEmail: user });
  const out = await exportDataSubjectByEmail(mock, "test@example.com");
  assert.ok(out !== null);
  assert.deepEqual(out!.user, user);
  assert.ok(Array.isArray(out!.addresses) && out!.addresses.length === 0);
  assert.ok(Array.isArray(out!.orders) && out!.orders.length === 0);
  assert.ok(Array.isArray(out!.orderItems) && out!.orderItems.length === 0);
  assert.ok(Array.isArray(out!.payments) && out!.payments.length === 0);
});

test("anonymizeStaleOrderAddresses: returns zero (Medusa owns commerce)", async () => {
  const mock = createMockSupabase({});
  const out = await anonymizeStaleOrderAddresses(
    mock,
    new Date("2020-01-01").toISOString(),
  );
  assert.equal(out.addressesUpdated, 0);
});
