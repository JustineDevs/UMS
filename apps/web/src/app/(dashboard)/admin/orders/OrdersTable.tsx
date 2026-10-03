"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Check, ChevronDown, Columns3, Filter, MoreHorizontal, Package, Plus } from "lucide-react";
import type { WorkerAdminOrder } from "@/lib/worker-admin-bridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "shipped" | "delivered" | "cancelled";
type OrderFilter = "all" | "with_customer" | "with_email";
type ColumnKey = "order" | "channel" | "customer" | "type" | "total" | "date" | "status";

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const orderFilters: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "All orders" },
  { value: "with_customer", label: "With customer" },
  { value: "with_email", label: "With email" },
];

const columnLabels: Record<ColumnKey, string> = {
  order: "Order",
  channel: "Product / channel",
  customer: "Customer",
  type: "Type",
  total: "Price",
  date: "Date",
  status: "Status",
};

const initialColumns: Record<ColumnKey, boolean> = {
  order: true,
  channel: true,
  customer: true,
  type: true,
  total: true,
  date: true,
  status: true,
};

function normalizedStatus(status: string): StatusFilter {
  const value = status.toLowerCase();
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("deliver") || value === "fulfilled" || value === "completed") return "delivered";
  if (value.includes("ship") || value === "partially_fulfilled") return "shipped";
  return "pending";
}

function statusLabel(status: string) {
  return status.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  switch (normalizedStatus(status)) {
    case "delivered":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "shipped":
      return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "cancelled":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    default:
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}

function channelLabel(channel: string) {
  return channel.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Online store";
}

const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
function formatDate(value: string) { return ORDER_DATE_FORMATTER.format(new Date(value)); }

function formatTotal(order: WorkerAdminOrder) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: order.currency || "PHP", maximumFractionDigits: 2 }).format(Number(order.grand_total) || 0);
}

export function OrdersTable({ orders, total }: { orders: WorkerAdminOrder[]; total: number }) {
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
  const [columns, setColumns] = useState(initialColumns);
  const [selected, setSelected] = useState<string[]>([]);

  const filteredOrders = useMemo(() => {
    const byStatus = activeStatus === "all"
      ? orders
      : orders.filter((order) => normalizedStatus(order.status) === activeStatus);
    if (activeFilter === "with_customer") return byStatus.filter((order) => Boolean(order.customer_id));
    if (activeFilter === "with_email") return byStatus.filter((order) => Boolean(order.email));
    return byStatus;
  }, [activeFilter, activeStatus, orders]);
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedIds.has(order.id));
  const showingLabel = activeStatus === "all" && activeFilter === "all"
    ? `Showing ${filteredOrders.length} of ${total} orders`
    : `${filteredOrders.length} matching orders`;

  function toggleColumn(column: ColumnKey) {
    setColumns((current) => ({ ...current, [column]: !current[column] }));
  }

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected((current) => current.filter((id) => !filteredOrders.some((order) => order.id === id)));
    } else {
      setSelected((current) => Array.from(new Set([...current, ...filteredOrders.map((order) => order.id)])));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1" aria-label="Order status filters">
          {statusFilters.map((filter) => (
            <Button
              variant={activeStatus === filter.value ? "secondary" : "ghost"}
              size="sm"
              key={filter.value}
              type="button"
              aria-pressed={activeStatus === filter.value}
              onClick={() => setActiveStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label="Filter orders">
                <Filter className="size-3.5" /> Filters <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Filter orders</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orderFilters.map((filter) => (
                <DropdownMenuItem
                  key={filter.value}
                  onSelect={(event) => { event.preventDefault(); setActiveFilter(filter.value); }}
                >
                  <span className="grid size-4 place-items-center">{activeFilter === filter.value ? <Check className="size-3.5" /> : null}</span>
                  {filter.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label="Choose visible order columns">
                <Columns3 className="size-3.5" /> Columns <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(columnLabels) as ColumnKey[]).map((column) => (
                <DropdownMenuItem key={column} onSelect={(event) => { event.preventDefault(); toggleColumn(column); }}>
                  <span className="grid size-4 place-items-center">{columns[column] ? <Check className="size-3.5" /> : null}</span>
                  {columnLabels[column]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10 px-4"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Select all visible orders" /></TableHead>
              {columns.order ? <TableHead><span className="inline-flex items-center gap-1">Order <ArrowUpDown className="size-3 text-muted-foreground" /></span></TableHead> : null}
              {columns.channel ? <TableHead>{columnLabels.channel}</TableHead> : null}
              {columns.customer ? <TableHead>Customer</TableHead> : null}
              {columns.type ? <TableHead>Type</TableHead> : null}
              {columns.total ? <TableHead>Price</TableHead> : null}
              {columns.date ? <TableHead>Date</TableHead> : null}
              {columns.status ? <TableHead>Status</TableHead> : null}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="h-40 text-center text-muted-foreground">No orders match this status.</TableCell></TableRow>
            ) : filteredOrders.map((order) => (
              <TableRow key={order.id} className="group">
                <TableCell className="px-4"><Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelected(order.id)} aria-label={`Select order ${order.order_number}`} /></TableCell>
                {columns.order ? <TableCell><Link href={`/admin/orders/${order.id}`} className="font-medium text-foreground hover:underline">#{order.order_number}</Link></TableCell> : null}
                {columns.channel ? <TableCell><div className="flex items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Package className="size-4" aria-hidden="true" /></span><span className="font-medium">{channelLabel(order.channel)}</span></div></TableCell> : null}
                {columns.customer ? <TableCell><div className="max-w-52 truncate font-medium">{order.email ?? (order.customer_id ? "Customer" : "Guest")}</div><div className="text-xs text-muted-foreground">{order.customer_id ? "Registered customer" : "Guest checkout"}</div></TableCell> : null}
                {columns.type ? <TableCell className="text-muted-foreground">Sale</TableCell> : null}
                {columns.total ? <TableCell className="font-medium tabular-nums">{formatTotal(order)}</TableCell> : null}
                {columns.date ? <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell> : null}
                {columns.status ? <TableCell><Badge variant="outline" className={cn("capitalize", statusClass(order.status))}>{statusLabel(order.status)}</Badge></TableCell> : null}
                <TableCell className="w-14 pr-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Actions for order ${order.order_number}`}
                        aria-haspopup="menu"
                        className="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-48 p-1.5">
                      <DropdownMenuLabel>Order actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link href={`/admin/orders/${order.id}`}>View order</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={`/admin/receipts?order_id=${encodeURIComponent(order.id)}`}>Digital receipt</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{selected.length ? `${selected.length} selected` : showingLabel}</span>
          <span>Rows per page <span className="font-medium text-foreground">50</span></span>
        </div>
      </div>
    </div>
  );
}

export function CreateOrderButton() {
  return (
    <Button
      asChild
      size="lg"
      className="h-9 rounded-lg bg-slate-950 px-3.5 text-white shadow-sm hover:bg-slate-800 hover:text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:hover:text-slate-950"
    >
      <Link href="/admin/pos"><Plus className="size-4" /> Create Order</Link>
    </Button>
  );
}
