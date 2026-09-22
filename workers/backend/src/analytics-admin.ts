import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import type { WorkerDatabaseClient } from "./database.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type ClvRow = {
  customer_email: string;
  total_spent: string | number;
  order_count: string | number;
  first_order_at: string | null;
  last_order_at: string | null;
};
type TrendRow = {
  period: string;
  revenue: string | number;
  order_count: string | number;
};
type RetentionRow = {
  period: string;
  new_customers: string | number;
  returning_customers: string | number;
  retention_rate: string | number;
};

const COMPLETED = "('paid', 'shipped', 'delivered')";

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function canRead(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions)
    ? claims.permissions
    : [];
  return (
    claims.role === "owner" ||
    claims.role === "admin" ||
    permissions.some((value) => value === "*" || value === "analytics:read")
  );
}

function tenant(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function monthCount(url: URL): number | null {
  const value = url.searchParams.get("months");
  if (value === null) return 6;
  if (!/^\d{1,3}$/.test(value)) return null;
  return Math.min(24, Math.max(1, Number(value)));
}

function finiteNumber(value: string | number): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function responseDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function handleAdminAnalyticsRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    {
      secret: env.CMS_ADMIN_JWT_SECRET,
      supabaseUrl: env.SUPABASE_URL,
    },
  );
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId)
    return json({ error: "organization_scope_required" }, 403);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");
  if (path === "/admin/analytics/clv") {
    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "invalid_email" }, 400);
    const result = await database.query<ClvRow>(
      `SELECT lower(trim(o.email)) AS customer_email,
              COALESCE(SUM(ot.total), 0)::numeric / 100 AS total_spent,
              COUNT(*)::int AS order_count,
              to_char(MIN(o.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS first_order_at,
              to_char(MAX(o.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_order_at
         FROM public."order" o
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total
             FROM public.order_item oi
            WHERE oi.order_id = o.id AND oi.deleted_at IS NULL
         ) ot ON true
        WHERE o.deleted_at IS NULL
          AND o.metadata->>'organization_id' = $1
          AND lower(trim(o.email)) = $2
          AND COALESCE(NULLIF(o.metadata->>'oms_status', ''), o.status::text) IN ${COMPLETED}
        GROUP BY lower(trim(o.email))`,
      [organizationId, email],
    );
    const row = result.rows[0];
    if (!row) return json({ error: "not_found" }, 404);
    const total = money(finiteNumber(row.total_spent));
    const count = finiteNumber(row.order_count);
    return json({
      data: {
        customer_email: row.customer_email,
        total_spent: total,
        order_count: count,
        avg_order_value: count ? money(total / count) : 0,
        first_order_at: responseDate(row.first_order_at),
        last_order_at: responseDate(row.last_order_at),
      },
    });
  }

  const months = monthCount(url);
  if (months === null) return json({ error: "invalid_months" }, 400);
  if (path === "/admin/analytics/sales-trends") {
    const result = await database.query<TrendRow>(
      `WITH month_window AS (
         SELECT date_trunc('month', now() AT TIME ZONE 'UTC') - (n * interval '1 month') AS month_start
           FROM generate_series($2::int - 1, 0, -1) AS gs(n)
       ), completed_orders AS (
         SELECT o.created_at AT TIME ZONE 'UTC' AS created_utc, ot.total
           FROM public."order" o
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total
               FROM public.order_item oi
              WHERE oi.order_id = o.id AND oi.deleted_at IS NULL
           ) ot ON true
          WHERE o.deleted_at IS NULL AND o.metadata->>'organization_id' = $1
            AND COALESCE(NULLIF(o.metadata->>'oms_status', ''), o.status::text) IN ${COMPLETED}
       )
       SELECT to_char(m.month_start, 'YYYY-MM') AS period,
              COALESCE(SUM(o.total), 0)::numeric / 100 AS revenue,
              COUNT(o.total)::int AS order_count
         FROM month_window m
         LEFT JOIN completed_orders o ON o.created_utc >= m.month_start
          AND o.created_utc < m.month_start + interval '1 month'
        GROUP BY m.month_start ORDER BY m.month_start`,
      [organizationId, months],
    );
    return json({
      data: result.rows.map((row) => {
        const revenue = money(finiteNumber(row.revenue));
        const count = finiteNumber(row.order_count);
        return {
          period: row.period,
          revenue,
          order_count: count,
          avg_order_value: count ? money(revenue / count) : 0,
        };
      }),
    });
  }
  if (path === "/admin/analytics/retention") {
    const result = await database.query<RetentionRow>(
      `WITH month_window AS (
         SELECT date_trunc('month', now() AT TIME ZONE 'UTC') - (n * interval '1 month') AS month_start
           FROM generate_series($2::int - 1, 0, -1) AS gs(n)
       ), completed_orders AS (
         SELECT lower(trim(o.email)) AS email, o.created_at AT TIME ZONE 'UTC' AS created_utc
           FROM public."order" o
          WHERE o.deleted_at IS NULL AND o.metadata->>'organization_id' = $1
            AND o.email IS NOT NULL AND trim(o.email) <> ''
            AND COALESCE(NULLIF(o.metadata->>'oms_status', ''), o.status::text) IN ${COMPLETED}
       ), monthly AS (
         SELECT m.month_start,
                COUNT(DISTINCT o.email)::int AS current_customers,
                COUNT(DISTINCT o.email) FILTER (WHERE EXISTS (
                  SELECT 1 FROM completed_orders prior
                   WHERE prior.email = o.email AND prior.created_utc < m.month_start
                ))::int AS returning_customers
           FROM month_window m
           LEFT JOIN completed_orders o ON o.created_utc >= m.month_start
            AND o.created_utc < m.month_start + interval '1 month'
          GROUP BY m.month_start
       )
       SELECT to_char(month_start, 'YYYY-MM') AS period,
              current_customers - returning_customers AS new_customers,
              returning_customers,
              CASE WHEN current_customers = 0 THEN 0::numeric
                   ELSE returning_customers::numeric / current_customers END AS retention_rate
         FROM monthly ORDER BY month_start`,
      [organizationId, months],
    );
    return json({
      data: result.rows.map((row) => ({
        period: row.period,
        new_customers: finiteNumber(row.new_customers),
        returning_customers: finiteNumber(row.returning_customers),
        retention_rate: finiteNumber(row.retention_rate),
      })),
    });
  }
  return json({ error: "not_found" }, 404);
}
