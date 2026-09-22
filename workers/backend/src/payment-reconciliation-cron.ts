import type { WorkerDatabaseClient, WorkerDatabaseEnv } from "./database.ts";

type Provider = "stripe" | "paypal" | "xendit";
type Job = { id: string; payload: unknown; attempts: number };
type Connection = { provider_config_key: string; nango_connection_id: string; merchant_identity: string };
type Attempt = {
  correlation_id: string;
  order_id: string | null;
  medusa_order_id: string | null;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  status: string;
  amount_minor: number | string | null;
  currency: string | null;
};
type Settlement = {
  externalId: string;
  paymentId: string | null;
  correlationId: string | null;
  orderId: string | null;
  amountMinor: number | null;
  feeMinor: number;
  netMinor: number | null;
  currency: string | null;
  status: string;
  occurredAt: string | null;
};
type Payload = { organizationId: string; provider: Provider; periodStart: string; periodEnd: string; idempotencyKey: string };
type Env = WorkerDatabaseEnv & { NANGO_API_KEY?: string; fetch?: typeof fetch };

const MAX_PROVIDER_ROWS = 2500;
const PAGE_SIZE = 100;
const MAX_ATTEMPTS = 8;
const TERMINAL_ATTEMPTS = new Set(["paid", "completed", "captured", "partially_refunded", "refunded"]);
const PROVIDER_SETTLED = new Set(["succeeded"]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
function isProvider(value: unknown): value is Provider { return value === "stripe" || value === "paypal" || value === "xendit"; }
function parsePayload(value: unknown): Payload | null {
  const row = record(value);
  if (!row || typeof row.organizationId !== "string" || !row.organizationId.trim() || !isProvider(row.provider) ||
      typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim() || row.idempotencyKey.length > 200 ||
      typeof row.periodStart !== "string" || typeof row.periodEnd !== "string") return null;
  const start = Date.parse(row.periodStart); const end = Date.parse(row.periodEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 93 * 24 * 60 * 60 * 1000) return null;
  return { organizationId: row.organizationId.trim(), provider: row.provider, periodStart: new Date(start).toISOString(), periodEnd: new Date(end).toISOString(), idempotencyKey: row.idempotencyKey.trim() };
}

function currencyMinor(value: unknown, currencyValue: unknown): number | null {
  const amount = finite(value); const currency = str(currencyValue)?.toUpperCase();
  if (amount === null || !currency) return null;
  const zero = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
  const exponent = zero.has(currency) ? 0 : three.has(currency) ? 3 : 2;
  const minor = Math.round(amount * 10 ** exponent);
  return Number.isSafeInteger(minor) ? minor : null;
}

function mappedRows(provider: Provider, body: unknown): { rows: Settlement[]; hasMore: boolean; next: string | null } {
  const root = record(body); if (!root) throw new Error("provider_report_invalid");
  const data = Array.isArray(root.data) ? root.data : Array.isArray(root.transaction_details) ? root.transaction_details : null;
  if (!data) throw new Error("provider_report_invalid");
  const rows: Settlement[] = [];
  for (const item of data) {
    const row = record(item); if (!row) throw new Error("provider_report_invalid");
    if (provider === "stripe") {
      const balance = record(row.balance_transaction);
      const metadata = record(row.metadata);
      const paid = row.paid === true || row.status === "succeeded";
      if (!paid) continue;
      rows.push({
        externalId: str(balance?.id) ?? str(row.id) ?? "",
        paymentId: str(row.payment_intent) ?? str(row.id),
        correlationId: str(metadata?.worker_payment_correlation_id) ?? str(metadata?.correlation_id),
        orderId: str(metadata?.order_id),
        amountMinor: finite(row.amount_captured) ?? finite(row.amount),
        feeMinor: finite(balance?.fee) ?? 0,
        netMinor: finite(balance?.net),
        currency: str(row.currency),
        status: paid ? "succeeded" : String(row.status ?? "unknown"),
        occurredAt: finite(row.created) === null ? null : new Date(Number(row.created) * 1000).toISOString(),
      });
    } else if (provider === "paypal") {
      const info = record(row.transaction_info);
      const amount = record(info?.transaction_amount); const fee = record(info?.fee_amount);
      const status = str(info?.transaction_status) ?? "unknown";
      rows.push({
        externalId: str(info?.transaction_id) ?? "",
        paymentId: str(info?.paypal_reference_id) ?? str(info?.transaction_id),
        correlationId: str(info?.invoice_id) ?? str(info?.custom_field),
        orderId: str(info?.paypal_reference_id),
        amountMinor: currencyMinor(amount?.value, amount?.currency_code),
        feeMinor: currencyMinor(fee?.value, fee?.currency_code) ?? 0,
        netMinor: null,
        currency: str(amount?.currency_code),
        status: status === "S" ? "succeeded" : status === "V" ? "reversed" : status === "P" ? "pending" : status === "D" ? "denied" : "unknown",
        occurredAt: str(info?.transaction_initiation_date),
      });
    } else {
      const productData = record(row.product_data); const fee = record(row.fee);
      const status = str(row.status) ?? "unknown";
      if (str(row.type)?.toUpperCase() !== "PAYMENT" || status.toUpperCase() !== "SUCCESS") continue;
      rows.push({
        externalId: str(row.id) ?? "",
        paymentId: str(row.payment_request_id) ?? str(row.payment_id) ?? str(productData?.payment_id) ?? str(row.id),
        correlationId: str(row.reference_id),
        orderId: str(row.reference_id),
        amountMinor: currencyMinor(row.amount, row.currency),
        feeMinor: currencyMinor(fee?.xendit_fee, row.currency) ?? 0,
        netMinor: currencyMinor(row.net_amount, row.net_amount_currency ?? row.currency),
        currency: str(row.currency),
        status: status.toUpperCase() === "SUCCESS" ? "succeeded" : status.toLowerCase(),
        occurredAt: str(row.created),
      });
    }
  }
  if (provider === "stripe") return { rows, hasMore: root.has_more === true, next: str(record(data.at(-1))?.id) };
  if (provider === "paypal") {
    const currentPage = finite(root.page);
    const totalPages = finite(root.total_pages);
    const hasMore = currentPage !== null && totalPages !== null
      ? currentPage < totalPages
      : data.length === PAGE_SIZE;
    return { rows, hasMore, next: hasMore && currentPage !== null ? String(currentPage + 1) : hasMore ? "next" : null };
  }
  const links = Array.isArray(root.links) ? root.links.map(record).filter(Boolean) : [];
  const nextLink = links.find((link) => link?.rel === "next");
  const href = str(nextLink?.href);
  const nextId = href ? new URL(href).searchParams.get("after_id") : null;
  return { rows, hasMore: root.has_more === true, next: nextId };
}

function providerPath(provider: Provider, payload: Payload, cursor: string | null, page: number): string {
  const start = new Date(payload.periodStart); const end = new Date(payload.periodEnd);
  if (provider === "stripe") {
    const query = new URLSearchParams({ "created[gte]": String(Math.floor(start.getTime() / 1000)), "created[lte]": String(Math.floor(end.getTime() / 1000)), limit: String(PAGE_SIZE), "expand[]": "data.balance_transaction" });
    if (cursor) query.set("starting_after", cursor);
    return `/v1/charges?${query}`;
  }
  if (provider === "paypal") {
    const query = new URLSearchParams({ start_date: start.toISOString(), end_date: end.toISOString(), fields: "all", page_size: String(PAGE_SIZE), page: String(page) });
    return `/v1/reporting/transactions?${query}`;
  }
  const query = new URLSearchParams({ types: "PAYMENT", statuses: "SUCCESS", "created[gte]": start.toISOString(), "created[lte]": end.toISOString(), limit: String(PAGE_SIZE) });
  if (cursor) query.set("after_id", cursor);
  return `/transactions?${query}`;
}

async function fetchProviderPage(provider: Provider, connection: Connection, payload: Payload, cursor: string | null, page: number, env: Env): Promise<ReturnType<typeof mappedRows>> {
  if (!env.NANGO_API_KEY?.trim()) throw new Error("provider_connection_unavailable");
  const path = providerPath(provider, payload, cursor, page);
  const response = await (env.fetch ?? fetch)(`https://api.nango.dev/proxy${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.NANGO_API_KEY.trim()}`, "Connection-Id": connection.nango_connection_id, "Provider-Config-Key": connection.provider_config_key, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`provider_report_http_${response.status}`);
  return mappedRows(provider, await response.json());
}

function settlementMatch(attempt: Attempt | undefined, row: Settlement): { status: "matched" | "discrepancy" | "needs_review"; reason: string | null } {
  if (!attempt) return { status: "needs_review", reason: "local_payment_attempt_not_found" };
  const expectedAmount = finite(attempt.amount_minor);
  const mismatches: string[] = [];
  const ref = attempt.provider_payment_id || attempt.provider_session_id;
  if (!ref || ref !== row.paymentId && ref !== row.correlationId) mismatches.push("payment_reference_mismatch");
  if (expectedAmount === null || row.amountMinor === null || expectedAmount !== row.amountMinor) mismatches.push("amount_mismatch");
  if (!attempt.currency || !row.currency || attempt.currency.toUpperCase() !== row.currency.toUpperCase()) mismatches.push("currency_mismatch");
  if (!TERMINAL_ATTEMPTS.has(attempt.status.toLowerCase())) mismatches.push("local_attempt_not_settled");
  if (!PROVIDER_SETTLED.has(row.status.toLowerCase())) mismatches.push("provider_not_settled");
  if (!mismatches.length) return { status: "matched", reason: null };
  return { status: mismatches.some((value) => value.endsWith("mismatch")) ? "discrepancy" : "needs_review", reason: mismatches.join(",") };
}

async function fetchReport(provider: Provider, connection: Connection, payload: Payload, env: Env): Promise<{ rows: Settlement[]; complete: boolean }> {
  const output: Settlement[] = []; let cursor: string | null = null; let page = 1;
  for (let index = 0; index < 25; index += 1) {
    const result = await fetchProviderPage(provider, connection, payload, cursor, page, env);
    output.push(...result.rows);
    if (!result.hasMore) return { rows: output, complete: true };
    if (!result.next || output.length >= MAX_PROVIDER_ROWS) return { rows: output, complete: false };
    cursor = result.next; page += 1;
  }
  return { rows: output, complete: false };
}

async function persistSettlement(database: WorkerDatabaseClient, payload: Payload, merchantIdentity: string, row: Settlement, attempt: Attempt | undefined): Promise<void> {
  if (!row.externalId) throw new Error("provider_report_missing_external_id");
  const match = settlementMatch(attempt, row);
  const key = `${payload.idempotencyKey}:${merchantIdentity}:${row.externalId}`.slice(0, 255);
  await database.query(
    `INSERT INTO public.payment_settlement_records
       (organization_id,provider,merchant_identity,external_id,artifact_type,payment_external_id,medusa_order_id,amount_minor,fee_minor,net_minor,currency,status,provider_occurred_at,idempotency_key,mismatch_reason,metadata)
     VALUES ($1,$2,$3,$4,'settlement',$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13,$14,$15::jsonb)
     ON CONFLICT (organization_id,provider,artifact_type,external_id) DO UPDATE SET
       merchant_identity=EXCLUDED.merchant_identity,payment_external_id=EXCLUDED.payment_external_id,medusa_order_id=EXCLUDED.medusa_order_id,
       amount_minor=EXCLUDED.amount_minor,fee_minor=EXCLUDED.fee_minor,net_minor=EXCLUDED.net_minor,currency=EXCLUDED.currency,
       status=EXCLUDED.status,provider_occurred_at=EXCLUDED.provider_occurred_at,idempotency_key=EXCLUDED.idempotency_key,
       mismatch_reason=EXCLUDED.mismatch_reason,metadata=EXCLUDED.metadata,updated_at=now()`,
    [payload.organizationId, payload.provider, merchantIdentity, row.externalId, row.paymentId, attempt?.medusa_order_id ?? row.orderId, row.amountMinor, row.feeMinor, row.netMinor, row.currency?.toUpperCase() ?? null, match.status, row.occurredAt, key, match.reason, JSON.stringify({ period_start: payload.periodStart, period_end: payload.periodEnd, correlation_id: attempt?.correlation_id ?? row.correlationId })],
  );
}

async function claimJob(database: WorkerDatabaseClient): Promise<Job | null> {
  const result = await database.query<Job>(
    `WITH candidate AS (
       SELECT id FROM public.background_jobs WHERE job_type='reconcile_payment'
         AND ((status='queued' AND (next_run_at IS NULL OR next_run_at<=now()) AND (locked_at IS NULL OR locked_at<now()-interval '10 minutes'))
           OR (status='running' AND locked_at<now()-interval '10 minutes'))
       ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
     ) UPDATE public.background_jobs j SET status='running',attempts=COALESCE(j.attempts,0)+1,locked_at=now(),locked_by='cloudflare-worker',started_at=COALESCE(j.started_at,now())
       FROM candidate WHERE j.id=candidate.id RETURNING j.id::text,j.payload,j.attempts`,
  );
  return result.rows[0] ?? null;
}

async function finishJob(database: WorkerDatabaseClient, job: Job, result: Record<string, unknown>): Promise<void> {
  await database.query("UPDATE public.background_jobs SET status='completed',progress=100,result=$2::jsonb,completed_at=now(),locked_at=NULL,locked_by=NULL,error=NULL WHERE id=$1", [job.id, JSON.stringify(result)]);
}

async function retryJob(database: WorkerDatabaseClient, job: Job, error: string): Promise<void> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await database.query("UPDATE public.background_jobs SET status='failed',error=$2,last_error=$2,completed_at=now(),locked_at=NULL,locked_by=NULL WHERE id=$1", [job.id, error]);
    return;
  }
  const seconds = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
  await database.query("UPDATE public.background_jobs SET status='queued',locked_at=NULL,locked_by=NULL,last_error=$2,next_run_at=now()+($3::text || ' seconds')::interval WHERE id=$1", [job.id, error, seconds]);
}

function findAttempt(attempts: Attempt[], settlement: Settlement): Attempt | undefined {
  return attempts.find((candidate) => {
    const references = [candidate.provider_payment_id, candidate.provider_session_id].filter(Boolean);
    return references.includes(settlement.paymentId) || references.includes(settlement.externalId) ||
      Boolean(settlement.correlationId && candidate.correlation_id === settlement.correlationId);
  });
}

export async function runPaymentReconciliationSweep(database: WorkerDatabaseClient, env: Env): Promise<{ processed: number; result?: Record<string, unknown>; failed?: true }> {
  const job = await claimJob(database);
  if (!job) return { processed: 0 };
  const payload = parsePayload(job.payload);
  if (!payload) {
    await database.query("UPDATE public.background_jobs SET status='failed',error='Invalid reconciliation payload',last_error='Invalid reconciliation payload',completed_at=now(),locked_at=NULL,locked_by=NULL WHERE id=$1", [job.id]);
    return { processed: 1, failed: true };
  }
  try {
    const connections = await database.query<Connection>(
      `SELECT provider_config_key,nango_connection_id,merchant_identity FROM public.payment_nango_connections
       WHERE organization_id=$1 AND provider=$2 AND active=true ORDER BY updated_at DESC LIMIT 2`,
      [payload.organizationId, payload.provider],
    );
    if (!connections.rows.length) throw new Error("provider_connection_unavailable");
    if (connections.rows.length !== 1) throw new Error("provider_connection_ambiguous");
    const attempts = await database.query<Attempt>(
      `SELECT correlation_id::text,order_id,medusa_order_id,provider_session_id,provider_payment_id,status,amount_minor,currency
       FROM public.payment_attempts WHERE organization_id=$1 AND provider=$2 AND created_at >= $3::timestamptz AND created_at <= $4::timestamptz ORDER BY created_at ASC LIMIT 5000`,
      [payload.organizationId, payload.provider, payload.periodStart, payload.periodEnd],
    );
    if (attempts.rows.length >= 5000) throw new Error("reconciliation_attempt_limit_exceeded");
    const settlements: Settlement[] = []; let providerRowsComplete = true;
    for (const connection of connections.rows) {
      if (!connection.provider_config_key || !connection.nango_connection_id || !connection.merchant_identity) throw new Error("provider_connection_invalid");
      const report = await fetchReport(payload.provider, connection, payload, env);
      providerRowsComplete &&= report.complete;
      for (const settlement of report.rows) {
        const attempt = findAttempt(attempts.rows, settlement);
        await persistSettlement(database, payload, connection.merchant_identity, settlement, attempt);
        settlements.push(settlement);
      }
    }
    const matchedAttemptIds = new Set(settlements.flatMap((settlement) => {
      const attempt = findAttempt(attempts.rows, settlement);
      return attempt && settlementMatch(attempt, settlement).status === "matched" ? [attempt.correlation_id] : [];
    }));
    const settledAttempts = attempts.rows.filter((attempt) => TERMINAL_ATTEMPTS.has(attempt.status.toLowerCase()));
    const unmatchedAttempts = settledAttempts.filter((attempt) => !matchedAttemptIds.has(attempt.correlation_id));
    const unresolvedRows = settlements.filter((settlement) => {
      const attempt = findAttempt(attempts.rows, settlement);
      return settlementMatch(attempt, settlement).status !== "matched";
    });
    const status = providerRowsComplete && unmatchedAttempts.length === 0 && unresolvedRows.length === 0 ? "matched" : "review";
    const result = { source: "provider_api", provider: payload.provider, period_start: payload.periodStart, period_end: payload.periodEnd, provider_api_pull: true, connection_count: connections.rows.length, provider_settlement_rows: settlements.length, provider_rows_complete: providerRowsComplete, settled_attempts: settledAttempts.length, matched_attempts: matchedAttemptIds.size, unmatched_attempts: unmatchedAttempts.length, unresolved_provider_rows: unresolvedRows.length, status, execution_owner: "cloudflare_worker" };
    const externalId = `reconciliation:${payload.provider}:${payload.idempotencyKey}`;
    await database.query(
      `INSERT INTO public.payment_provider_artifacts (organization_id,merchant_identity,provider,artifact_type,external_id,status,idempotency_key,metadata,last_error)
       VALUES ($1,$2,$3,'reconciliation',$4,$5,$6,$7::jsonb,NULL)
       ON CONFLICT (organization_id,provider,artifact_type,external_id) DO UPDATE SET status=EXCLUDED.status,idempotency_key=EXCLUDED.idempotency_key,metadata=EXCLUDED.metadata,last_error=NULL,updated_at=now()`,
      [payload.organizationId, connections.rows[0]!.merchant_identity, payload.provider, externalId, status, payload.idempotencyKey, JSON.stringify(result)],
    );
    await finishJob(database, job, result);
    return { processed: 1, result };
  } catch (error) {
    const message = error instanceof Error && /^[a-z0-9_:-]{1,120}$/i.test(error.message) ? error.message : "provider_reconciliation_failed";
    await retryJob(database, job, message);
    await database.query(
      `UPDATE public.payment_provider_artifacts SET status=$3,last_error=$4,
         metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{latest_attempt_error}',to_jsonb($4::text),true),updated_at=now()
       WHERE organization_id=$1 AND provider=$2 AND artifact_type='reconciliation' AND idempotency_key=$5`,
      [payload.organizationId, payload.provider, job.attempts >= MAX_ATTEMPTS ? "failed" : "queued", message, payload.idempotencyKey],
    );
    return { processed: 1, failed: true };
  }
}
