import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { listCmsFormSubmissions } from "@universal-music-store/platform-data";
import { staffSessionAllows } from "@universal-music-store/database";

import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
  parseAdminJson,
  verifySignedRequest,
} from "./admin-api-security";
import { validateChannelScope } from "./channel-security";
import {
  organizationCanManagePayments,
  resolveStaffOrganization,
} from "./staff-organization";

type Row = {
  id: string;
  actor_key: string;
  action_key: string;
  idempotency_key: string;
  request_hash: string;
  status: "processing" | "completed" | "failed";
  response_status?: number;
  response_body?: Record<string, unknown>;
  expires_at: string;
};

class FakeSupabase {
  rows: Row[] = [];
  nextId = 1;

  from(table: string) {
    assert.equal(table, "admin_api_idempotency");
    return new FakeQuery(this);
  }
}

class FakeQuery {
  private filters: Record<string, unknown> = {};
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private insertRow?: Row;
  private updateValues?: Partial<Row>;

  constructor(private readonly db: FakeSupabase) {}

  select() {
    if (this.operation === "select") this.operation = "select";
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }

  maybeSingle = async () => {
    const matches = this.db.rows.filter((row) =>
      Object.entries(this.filters).every(([key, value]) => row[key as keyof Row] === value),
    );
    return { data: matches[0] ?? null, error: null };
  };

  insert(row: Row) {
    this.operation = "insert";
    this.insertRow = row;
    return this;
  }

  single = async () => {
    if (this.operation === "insert" && this.insertRow) {
      const duplicate = this.db.rows.some((row) =>
        row.actor_key === this.insertRow?.actor_key &&
        row.action_key === this.insertRow?.action_key &&
        row.idempotency_key === this.insertRow?.idempotency_key,
      );
      if (duplicate) return { data: null, error: { code: "23505" } };
      const row = {
        ...this.insertRow,
        id: `id_${this.db.nextId++}`,
        status: "processing" as const,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      };
      this.db.rows.push(row);
      return { data: { id: row.id }, error: null };
    }
    return { data: null, error: null };
  };

  delete() {
    this.operation = "delete";
    return this;
  }

  update(values: Partial<Row>) {
    this.operation = "update";
    this.updateValues = values;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    try {
      if (this.operation === "delete") {
        this.db.rows = this.db.rows.filter((row) =>
          !Object.entries(this.filters).every(([key, value]) => row[key as keyof Row] === value),
        );
      }
      if (this.operation === "update") {
        for (const row of this.db.rows) {
          if (Object.entries(this.filters).every(([key, value]) => row[key as keyof Row] === value)) {
            Object.assign(row, this.updateValues);
          }
        }
      }
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(undefined, onrejected);
    }
  }
}

function fakeMembershipClient(rows: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      assert.ok(["users", "organization_memberships"].includes(table));
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        limit: () => query,
        maybeSingle: async () => ({
          data: rows.find((row) => Object.entries(filters).every(([key, value]) => row[key] === value)) ?? null,
          error: null,
        }),
        then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) =>
          Promise.resolve({
            data: rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)),
            error: null,
          }).then(resolve),
      };
      return query;
    },
  };
}

describe("negative API security coverage", () => {
  it("rejects organization membership when the membership belongs to another user", async () => {
    const client = fakeMembershipClient([
      { id: "user_a", email: "a@example.com" },
      { organization_id: "tenant_a", role: "staff", auth_user_id: "user_b", active: true },
    ]);
    assert.equal(await resolveStaffOrganization(client as never, "a@example.com"), null);
  });

  it("does not allow non-owners to manage payment connections", () => {
    assert.equal(organizationCanManagePayments("admin"), false);
    assert.equal(organizationCanManagePayments("manager"), false);
    assert.equal(organizationCanManagePayments("staff"), false);
  });

  it("denies a staff session that lacks the requested permission", () => {
    assert.equal(
      staffSessionAllows({ user: { role: "staff", permissions: ["catalog:read"] } }, "catalog:write"),
      false,
    );
  });

  it("replays a completed request with the same idempotency key and body", async () => {
    const db = new FakeSupabase();
    const input = {
      actorKey: "tenant_a:staff@example.com",
      actionKey: "inventory.adjust:variant_a",
      idempotencyKey: "idem-1234",
      requestHash: getRequestHash({ delta: 1 }),
    };
    const first = await claimAdminIdempotency(db as never, input);
    assert.equal(first.kind, "claimed");
    if (first.kind !== "claimed") return;
    await completeAdminIdempotency(db as never, first.id, 200, { ok: true });
    assert.deepEqual(await claimAdminIdempotency(db as never, input), {
      kind: "replay",
      status: 200,
      body: { ok: true },
    });
  });

  it("rejects an idempotency-key reuse with a different request body", async () => {
    const db = new FakeSupabase();
    const base = {
      actorKey: "tenant_a:staff@example.com",
      actionKey: "inventory.adjust:variant_a",
      idempotencyKey: "idem-1234",
    };
    assert.equal(
      (await claimAdminIdempotency(db as never, { ...base, requestHash: getRequestHash({ delta: 1 }) })).kind,
      "claimed",
    );
    assert.equal(
      (await claimAdminIdempotency(db as never, { ...base, requestHash: getRequestHash({ delta: 2 }) })).kind,
      "conflict",
    );
  });

  it("rejects oversized JSON before parsing the request body", async () => {
    const result = await parseAdminJson(
      new Request("http://admin.test", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "1001" },
        body: JSON.stringify({ value: "x" }),
      }),
      undefined,
      1000,
    );
    assert.deepEqual(result, { ok: false, status: 413, error: "Request body too large" });
  });

  it("caps form export reads even when the caller requests an unbounded limit", async () => {
    const ranges: Array<[number, number]> = [];
    const query = {
      select: () => query,
      order: () => query,
      range: (from: number, to: number) => {
        ranges.push([from, to]);
        return query;
      },
      eq: () => query,
      gte: () => query,
      lte: () => query,
      then: (resolve: (value: { data: never[]; count: number; error: null }) => unknown) =>
        Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
    };
    await listCmsFormSubmissions({ from: () => ({ select: () => query }) } as never, { limit: 500_000 });
    assert.deepEqual(ranges, [[0, 199]]);
  });

  it("rejects a webhook signature signed for a different tenant", () => {
    const secret = "webhook-secret";
    const body = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(`${timestamp}.tenant_a:${body}`).digest("hex");
    assert.equal(verifySignedRequest(`tenant_b:${body}`, secret, signature, timestamp), false);
  });

  it("rejects a webhook channel outside the configured tenant allow-list", () => {
    assert.equal(validateChannelScope({ requested: "tenant_b", allowed: ["tenant_a"] }), false);
  });

  it("accepts only a syntactically valid idempotency key", () => {
    assert.equal(getIdempotencyKey(new Request("http://admin.test", { headers: { "idempotency-key": "short" } })), null);
    assert.equal(getIdempotencyKey(new Request("http://admin.test", { headers: { "idempotency-key": "idem-1234" } })), "idem-1234");
  });
});
