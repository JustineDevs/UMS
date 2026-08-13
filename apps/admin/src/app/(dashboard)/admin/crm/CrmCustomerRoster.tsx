"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Customer = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_account: boolean;
  created_at: string;
};

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" });
const pageSize = 20;

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function CrmCustomerRoster({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
      const haystack = `${customer.email ?? ""} ${name}`.toLowerCase();
      const created = customer.created_at.slice(0, 10);
      return (!needle || haystack.includes(needle)) && (!from || created >= from) && (!to || created <= to);
    });
  }, [customers, from, query, to]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function exportCsv() {
    const rows = [
      ["email", "name", "account", "created_at"],
      ...filtered.map((customer) => [
        customer.email ?? "",
        [customer.first_name, customer.last_name].filter(Boolean).join(" "),
        customer.has_account ? "registered" : "guest",
        customer.created_at,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crm-customers.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-52 flex-1 text-xs font-medium text-muted-foreground">
          Search customers
          <Input className="mt-1" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name or email" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          From
          <Input className="mt-1" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          To
          <Input className="mt-1" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        </label>
        <Button type="button" variant="outline" onClick={exportCsv}>Export</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground"><th className="px-4 py-3">Email</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody>
            {visible.map((customer) => {
              const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—";
              return <tr key={customer.id} className="border-b border-outline-variant/10 transition-colors duration-200 hover:bg-muted/40 motion-reduce:transition-none"><td className="px-4 py-3 font-medium">{customer.email ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{name}</td><td className="px-4 py-3 text-muted-foreground">{customer.has_account ? "Registered" : "Guest"}</td><td className="px-4 py-3 text-muted-foreground">{dateFormat.format(new Date(customer.created_at))}</td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-3"><Link className="font-semibold text-primary hover:underline" href={`/admin/crm/${encodeURIComponent(customer.id)}`}>View</Link><Link className="text-primary hover:underline" href={`/admin/crm/${encodeURIComponent(customer.id)}#notes`}>Notes</Link><Link className="text-primary hover:underline" href={`/admin/orders?customer_id=${encodeURIComponent(customer.id)}`}>Orders</Link></div></td></tr>;
            })}
            {visible.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No customers match the current filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
        <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
      </div>
    </>
  );
}
