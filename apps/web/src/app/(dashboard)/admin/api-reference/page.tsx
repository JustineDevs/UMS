import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@universal-music-store/ui";
import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { extractOpenApiOperations, readAdminOpenApiDocument } from "@/lib/admin-openapi-document";
import { requirePagePermission } from "@/lib/require-page-permission";
import { OpenApiReferenceClient } from "./OpenApiReferenceClient";

export const metadata: Metadata = {
  title: "API reference",
  description: "Searchable reference for the current UVS API contract.",
};

export const dynamic = "force-dynamic";

export default async function AdminApiReferencePage() {
  await requirePagePermission("content:read");
  const { yaml } = await readAdminOpenApiDocument();
  const operations = extractOpenApiOperations(yaml);
  const pathCount = [...yaml.matchAll(/^  (\/[^:\n]+):\s*$/gm)].length;

  return (
    <AdminPageShell
      title="API reference"
      subtitle="Search the generated UVS contract by route, method, or domain tag. Use the YAML download when you need the complete schema and examples."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "API reference" },
          ]}
        />
      }
      actions={
        <Button asChild>
          <Link href="/admin/api-reference/download">Download OpenAPI YAML</Link>
        </Button>
      }
    >
      <div className="space-y-6 pb-16">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paths</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{pathCount}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operations</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{operations.length}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contract</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Generated from route sources</p>
          </div>
        </div>
        <OpenApiReferenceClient operations={operations} />
      </div>
    </AdminPageShell>
  );
}
