import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);

type ExportConfig = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  medusaUrl: string;
  medusaApiKey: string;
  outputDir: string;
};

type ExportTable = {
  name: string;
  source: "supabase" | "medusa";
  endpoint: string;
  pageSize: number;
};

const EXPORT_TABLES: ExportTable[] = [
  { name: "orders", source: "medusa", endpoint: "/admin/orders", pageSize: 100 },
  { name: "products", source: "medusa", endpoint: "/admin/products", pageSize: 100 },
  { name: "customers", source: "medusa", endpoint: "/admin/customers", pageSize: 100 },
  { name: "reviews", source: "supabase", endpoint: "/rest/v1/reviews", pageSize: 500 },
  { name: "analytics_events", source: "supabase", endpoint: "/rest/v1/analytics_events", pageSize: 500 },
  { name: "audit_logs", source: "supabase", endpoint: "/rest/v1/audit_logs", pageSize: 500 },
];

async function fetchMedusaPage(config: ExportConfig, table: ExportTable, offset: number): Promise<unknown[]> {
  const url = `${config.medusaUrl}${table.endpoint}?limit=${table.pageSize}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { "x-medusa-access-token": config.medusaApiKey },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const key = table.name;
  return (json as Record<string, unknown[]>)[key] ?? [];
}

async function fetchSupabasePage(config: ExportConfig, table: ExportTable, offset: number): Promise<unknown[]> {
  const url = `${config.supabaseUrl}${table.endpoint}?select=*&limit=${table.pageSize}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      apikey: config.supabaseServiceKey,
      Authorization: `Bearer ${config.supabaseServiceKey}`,
    },
  });
  if (!res.ok) return [];
  return (await res.json()) as unknown[];
}

async function exportTable(config: ExportConfig, table: ExportTable): Promise<number> {
  const allRows: unknown[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = table.source === "medusa"
      ? await fetchMedusaPage(config, table, offset)
      : await fetchSupabasePage(config, table, offset);

    allRows.push(...page);
    hasMore = page.length === table.pageSize;
    offset += table.pageSize;

    if (offset > 10000) break;
  }

  const ndjson = allRows.map((row) => JSON.stringify(row)).join("\n");
  const fs = await import("fs/promises");
  const path = await import("path");

  await fs.mkdir(config.outputDir, { recursive: true });
  const filename = path.join(config.outputDir, `${table.name}_${new Date().toISOString().slice(0, 10)}.ndjson`);
  await fs.writeFile(filename, ndjson, "utf-8");

  console.log(`Exported ${allRows.length} rows to ${filename}`);
  return allRows.length;
}

async function main() {
  const config: ExportConfig = {
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    medusaUrl: process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000",
    medusaApiKey: process.env.MEDUSA_SECRET_API_KEY ?? "",
    outputDir: process.env.EXPORT_DIR ?? "./exports",
  };

  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log(`Starting nightly warehouse export at ${new Date().toISOString()}`);
  let totalRows = 0;

  for (const table of EXPORT_TABLES) {
    try {
      const count = await exportTable(config, table);
      totalRows += count;
    } catch (err) {
      console.error(`Failed to export ${table.name}:`, err);
    }
  }

  console.log(`Export complete. Total rows: ${totalRows}`);
}

main().catch(console.error);
