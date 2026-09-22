import assert from "node:assert/strict";
import test from "node:test";
import { campaignScheduleMatches, runCampaignSweep } from "./campaigns-cron.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function database(responder: (_sql: string, _values: readonly unknown[]) => Record<string, unknown>[] = () => []): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      const rows = responder(sql, values) as T[];
      return { rows, rowCount: rows.length };
    },
    async end() {},
  };
}

test("campaign schedule parser uses UTC and rejects malformed/out-of-range cron fields", () => {
  const instant = new Date("2026-09-21T13:35:00.000Z");
  assert.equal(campaignScheduleMatches("35 13 * * 1", instant), true);
  assert.equal(campaignScheduleMatches("*/5 13 * * 1", instant), true);
  assert.equal(campaignScheduleMatches("36 13 * * 1", instant), false);
  assert.equal(campaignScheduleMatches("60 * * * *", instant), false);
  assert.equal(campaignScheduleMatches("* * *", instant), false);
});

test("campaign scheduler transactionally queues one due run and avoids campaigns already queued/running", async () => {
  const statements: string[] = [];
  const app = database((sql) => {
    statements.push(sql);
    if (sql.startsWith("SELECT id::text, organization_id, schedule_cron")) return [{
      id: "campaign-1", organization_id: "org-1", schedule_cron: "35 13 * * 1", last_run_at: null,
    }];
    if (sql.startsWith("SELECT id::text, last_run_at::text")) return [{ id: "campaign-1", last_run_at: null, execution_status: "idle" }];
    if (sql.startsWith("SELECT id::text FROM public.background_jobs")) return [];
    if (sql.startsWith("UPDATE public.campaigns SET execution_key")) return [{ id: "campaign-1" }];
    if (sql.startsWith("INSERT INTO public.background_jobs")) return [{ id: "job-scheduled" }];
    return [];
  });
  const result = await runCampaignSweep(app, {}, new Date("2026-09-21T13:35:00.000Z"));
  assert.deepEqual(result, { processed: 0, scheduled: 1, sent: 0, retrying: false, failed: false });
  const scan = statements.find((sql) => sql.startsWith("SELECT id::text, organization_id, schedule_cron"));
  assert.match(scan ?? "", /job\.status IN \('queued','running'\)/);
  assert.ok(statements.includes("BEGIN"));
  assert.ok(statements.includes("COMMIT"));
  assert.ok(statements.some((sql) => sql.startsWith("UPDATE public.campaigns SET execution_key")));
});

test("campaign job sends consented tenant recipients with per-execution idempotency then completes", async () => {
  const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
  const app = database((sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith("WITH candidate AS")) return [{
      id: "job-1", attempts: 1,
      payload: { campaignId: "campaign-1", organizationId: "org-1", executionKey: "execute-1" },
    }];
    if (sql.startsWith("SELECT id::text, organization_id, segment_id::text")) return [{
      id: "campaign-1", organization_id: "org-1", segment_id: "segment-1", name: "Winback",
      subject: "Come back", body_template: "<p>Offer</p>", execution_key: "execute-1",
    }];
    if (sql.startsWith("SELECT DISTINCT lower(trim(member.customer_email))")) return [{ customer_email: "buyer@example.test" }];
    if (sql.startsWith("SELECT EXISTS (")) return [{ exists: false }];
    return [];
  });
  const requests: Request[] = [];
  const result = await runCampaignSweep(app, { RESEND_API_KEY: "test-key" }, new Date("2026-09-21T13:35:00Z"), async (input, init) => {
    requests.push(new Request(input, init));
    return Response.json({ id: "email-1" });
  });

  assert.deepEqual(result, { processed: 1, scheduled: 0, sent: 1, retrying: false, failed: false });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers.get("Idempotency-Key"), "campaign:campaign-1:execute-1:buyer@example.test");
  const claim = statements.find(({ sql }) => sql.startsWith("WITH candidate AS"));
  assert.match(claim?.sql ?? "", /status='running'.*locked_at < now\(\) - interval '10 minutes'/s);
  const recipients = statements.find(({ sql }) => sql.startsWith("SELECT DISTINCT lower(trim(member.customer_email))"));
  assert.match(recipients?.sql ?? "", /member\.organization_id=\$2/);
  assert.match(recipients?.sql ?? "", /consent_status='subscribed'/);
  assert.deepEqual(recipients?.values, ["segment-1", "org-1", "campaign-1", 20, "execute-1"]);
  assert.ok(statements.some(({ sql }) => sql.includes("UPDATE public.background_jobs SET status='completed'")));
});

test("campaign database failure releases the durable job with bounded retry metadata", async () => {
  const updates: string[] = [];
  const app = database((sql) => {
    if (sql.startsWith("WITH candidate AS")) return [{
      id: "job-1", attempts: 2,
      payload: { campaignId: "campaign-1", organizationId: "org-1", executionKey: "execute-1" },
    }];
    if (sql.startsWith("SELECT id::text, organization_id, segment_id::text")) return [{
      id: "campaign-1", organization_id: "org-1", segment_id: "segment-1", name: "Winback",
      subject: "Come back", body_template: "<p>Offer</p>", execution_key: "execute-1",
    }];
    if (sql.startsWith("SELECT DISTINCT lower(trim(member.customer_email))")) throw new Error("database unavailable");
    if (sql.startsWith("UPDATE public.background_jobs SET status='queued'")) updates.push(sql);
    return [];
  });
  const result = await runCampaignSweep(app, { RESEND_API_KEY: "test-key" }, new Date(), async () => {
    throw new Error("must not reach provider after database failure");
  });
  assert.deepEqual(result, { processed: 1, scheduled: 0, sent: 0, retrying: true, failed: false });
  assert.equal(updates.length, 1);
  assert.match(updates[0], /next_run_at=now\(\)/);
  assert.match(updates[0], /last_error='Campaign execution failed'/);
});

test("malformed campaign jobs fail closed without sending", async () => {
  let sent = 0;
  let failed = false;
  const app = database((sql) => {
    if (sql.startsWith("WITH candidate AS")) return [{ id: "job-1", attempts: 1, payload: { campaignId: 9 } }];
    if (sql.startsWith("UPDATE public.background_jobs SET status='failed'")) failed = true;
    return [];
  });
  const result = await runCampaignSweep(app, { RESEND_API_KEY: "test-key" }, new Date(), async () => {
    sent += 1;
    return Response.json({ id: "unexpected" });
  });
  assert.deepEqual(result, { processed: 1, scheduled: 0, sent: 0, retrying: false, failed: false });
  assert.equal(sent, 0);
  assert.equal(failed, true);
});
