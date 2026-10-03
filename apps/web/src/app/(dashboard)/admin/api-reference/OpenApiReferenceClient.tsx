"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { OpenApiOperation } from "@/lib/admin-openapi-document";

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  POST: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  PUT: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  PATCH: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  DELETE: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export function OpenApiReferenceClient({ operations }: { operations: OpenApiOperation[] }) {
  const [query, setQuery] = useState("");
  const [copyState, setCopyState] = useState<{ key: string; status: "copied" | "failed" } | null>(null);
  const copyRoute = async (operation: OpenApiOperation) => {
    const key = operation.method + "-" + operation.path;
    const value = `${operation.method} ${operation.path}`;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      const fallback = document.createElement("textarea");
      fallback.value = value;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      try {
        copied = document.execCommand("copy");
      } finally {
        fallback.remove();
      }
    }

    setCopyState({ key, status: copied ? "copied" : "failed" });
    window.setTimeout(() => setCopyState((current) => current?.key === key ? null : current), 1600);
  };
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return operations;
    return operations.filter((operation) =>
      [operation.method, operation.path, operation.summary, ...operation.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [operations, query]);

  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-headline text-lg font-semibold text-foreground">Endpoint directory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by route, method, summary, or tag. The downloadable YAML remains the source contract.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="openapi-search" className="sr-only">Search API endpoints</label>
          <Input
            id="openapi-search"
            name="openapi-search"
            type="search"
            autoComplete="off"
            placeholder="Search endpoints…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="max-h-[42rem] overflow-auto">
        <ul className="divide-y divide-border/70" aria-label="OpenAPI endpoints">
          {filtered.map((operation) => (
            <li key={operation.method + "-" + operation.path} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
              <span className={"w-fit rounded px-2 py-1 text-[10px] font-bold tracking-wider " + (methodStyles[operation.method] ?? "bg-muted text-muted-foreground")}>
                {operation.method}
              </span>
              <div className="min-w-0 flex-1">
                <code className="break-all text-sm font-semibold text-foreground">{operation.path}</code>
                <p className="mt-1 text-sm text-muted-foreground">{operation.summary}</p>
                {operation.tags.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Tags: {operation.tags.join(", ")}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Auth: {operation.authenticationClass}</span>
                  <span aria-hidden>·</span>
                  <span>Permission: {operation.permission}</span>
                  {operation.tenantScoped ? <><span aria-hidden>·</span><span>Tenant scoped</span></> : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyRoute(operation)}
              >
                {copyState?.key === operation.method + "-" + operation.path
                  ? copyState.status === "copied" ? "Copied" : "Copy unavailable"
                  : "Copy route"}
              </Button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No endpoints match that search.</p>
        ) : null}
      </div>
    </section>
  );
}
