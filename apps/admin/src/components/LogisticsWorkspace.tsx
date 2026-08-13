"use client";

import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  MessageScroller,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@universal-music-store/ui";
import type {
  DeliveryLogisticsEventRow,
  DeliveryLogisticsShipmentRow,
} from "@universal-music-store/platform-data";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";

type ShipmentStatus = "Scheduled" | "In Transit" | "Out for Delivery" | "Delivered" | "Delayed" | "On Hold";
type TransportMode = "land" | "air" | "sea";

type WorkspaceShipment = {
  ledgerId: string;
  id: string;
  customer: { name: string; initials: string; id: string; tier: string; tierLabel: string };
  origin: { display: string; country: string; countryCode: string; coordinates: [number, number] };
  destination: { display: string; country: string; countryCode: string; coordinates: [number, number] };
  cargo: string;
  weight: string;
  eta: string;
  etaMeta: string;
  status: ShipmentStatus;
  progress: number;
  mode: TransportMode;
  routeType: string;
  transportNumber: string;
  handling: { label: string; note: string; tags: readonly string[] };
  trackingUrl: string | null;
  settlementStatus: string;
  updatedAt: string;
  eventCount: number;
};

type Props = {
  shipments: readonly DeliveryLogisticsShipmentRow[];
  events: readonly DeliveryLogisticsEventRow[];
};

const defaultCoordinates: Record<string, [number, number]> = {
  PH: [121, 14.6],
  ID: [106.8, -6.2],
  SG: [103.8, 1.3],
  MY: [101.7, 3.1],
  TH: [100.5, 13.7],
};

function valueFromRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function locationFromAddress(address: Record<string, unknown>, fallback: string) {
  const countryCode = (valueFromRecord(address, ["country_code", "countryCode", "country"]) ?? "PH").slice(0, 2).toUpperCase();
  const city = valueFromRecord(address, ["city", "municipality", "town", "province"]) ?? fallback;
  const country = valueFromRecord(address, ["country", "country_name"]) ?? countryCode;
  return { display: city, country, countryCode, coordinates: defaultCoordinates[countryCode] ?? defaultCoordinates.PH };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CU";
}

function normalizeStatus(status: DeliveryLogisticsShipmentRow["status"]): ShipmentStatus {
  if (status === "in_transit") return "In Transit";
  if (status === "delivered") return "Delivered";
  if (status === "assigned") return "Out for Delivery";
  if (status === "cancelled" || status === "returned") return "On Hold";
  return "Scheduled";
}

function shipmentProgress(status: ShipmentStatus) {
  return { Scheduled: 10, "In Transit": 65, "Out for Delivery": 85, Delivered: 100, Delayed: 45, "On Hold": 25 }[status];
}

function formatDate(value: string | null) {
  if (!value) return "Pending update";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toWorkspaceShipment(row: DeliveryLogisticsShipmentRow, eventCount: number): WorkspaceShipment {
  const status = normalizeStatus(row.status);
  const customerName = row.customer_email.split("@")[0]?.replace(/[._-]/g, " ") || "Customer";
  const mode: TransportMode = row.courier_slug?.toLowerCase().includes("air") ? "air" : row.courier_slug?.toLowerCase().includes("sea") ? "sea" : "land";
  const origin = locationFromAddress(row.origin_address, "Store");
  const destination = locationFromAddress(row.destination_address, "Customer destination");
  const cargo = valueFromRecord(row.metadata, ["cargo", "description", "product_name"]) ?? "Store shipment";
  const transportNumber = valueFromRecord(row.route_metadata, ["vehicle_number", "flight_number", "vessel_number", "tracking_number"]) ?? row.courier_label ?? "Unassigned";
  const handlingTags = row.hazard_flags.length ? row.hazard_flags : ["Standard handling"];

  return {
    ledgerId: row.id,
    id: row.order_display_id ?? row.id,
    customer: {
      name: customerName.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      initials: initials(customerName),
      id: row.order_id,
      tier: row.cod_amount ? "Priority" : "Standard",
      tierLabel: row.cod_amount ? "Cash-on-delivery shipment" : "Standard fulfillment shipment",
    },
    origin,
    destination,
    cargo,
    weight: valueFromRecord(row.package_dimensions, ["weight", "total_weight"]) ?? "Not recorded",
    eta: row.sla_label ?? "Pending",
    etaMeta: row.last_event_at ? formatDate(row.last_event_at) : "No event yet",
    status,
    progress: shipmentProgress(status),
    mode,
    routeType: mode === "air" ? "flight" : mode === "sea" ? "ship" : "road",
    transportNumber,
    handling: {
      label: row.hazard_flags.length ? "Special handling required" : "Standard shipment handling",
      note: row.hazard_flags.length ? "Review the handling flags before dispatch." : "Keep the package sealed until handoff.",
      tags: handlingTags,
    },
    trackingUrl: row.tracking_url,
    settlementStatus: row.settlement_status.replace(/_/g, " "),
    updatedAt: row.updated_at,
    eventCount,
  };
}

function Icon({ name, className }: { name: "search" | "copy" | "route" | "alert" | "truck"; className?: string }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    copy: <><rect x="8" y="8" width="10" height="10" rx="1" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>,
    route: <><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M7 17c5 0 2-8 10-10" /></>,
    alert: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  };
  return <svg aria-hidden="true" className={cn("size-4", className)} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function RouteMap({ shipment }: { shipment: WorkspaceShipment | null }) {
  const origin = shipment?.origin.coordinates ?? [106, 5];
  const destination = shipment?.destination.coordinates ?? [121, 14];
  const x1 = 120 + ((origin[0] + 180) / 360) * 760;
  const y1 = 280 - ((origin[1] + 90) / 180) * 210;
  const x2 = 120 + ((destination[0] + 180) / 360) * 760;
  const y2 = 280 - ((destination[1] + 90) / 180) * 210;
  const curve = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 90} ${x2} ${y2}`;

  return (
    <div className="size-full min-h-0 overflow-hidden bg-[#d4dadc] dark:bg-[#2C353C]">
      <svg aria-label="Shipment route map" className="block size-full" role="img" viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
        <rect width="1000" height="520" className="fill-[#d4dadc] dark:fill-[#2C353C]" />
        <path d="M0 100h1000M0 220h1000M0 340h1000M180 0v520M380 0v520M580 0v520M780 0v520" className="stroke-[#c0cacc] dark:stroke-[#3c484f]" strokeWidth="1" strokeDasharray="3 8" />
        <path d="M45 390C150 320 130 210 250 180S390 60 490 150s110 10 200-55 165 20 230 120" className="fill-[#fafaf8] stroke-[#ebd6d8] dark:fill-[#0e0e0e] dark:stroke-[#3c484f]" strokeWidth="2" />
        {shipment && <path d={curve} className="fill-none stroke-primary" strokeDasharray="8 8" strokeLinecap="round" strokeWidth="4" />}
        {shipment && <><circle cx={x1} cy={y1} r="9" className="fill-background stroke-primary" strokeWidth="3" /><circle cx={x1} cy={y1} r="3" className="fill-primary" /><circle cx={x2} cy={y2} r="9" className="fill-background stroke-primary" strokeWidth="3" /><circle cx={x2} cy={y2} r="3" className="fill-primary" /><text x={x1} y={y1 - 16} textAnchor="middle" className="fill-foreground text-[12px] font-medium">{shipment.origin.country}</text><text x={x2} y={y2 - 16} textAnchor="middle" className="fill-foreground text-[12px] font-medium">{shipment.destination.country}</text></>}
      </svg>
    </div>
  );
}

function ShipmentList({ shipments, selectedId, onSelect }: { shipments: WorkspaceShipment[]; selectedId: string | null; onSelect: (_id: string) => void }) {
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState("all");
  const filtered = shipments.filter((shipment) => {
    const matchesQuery = `${shipment.id} ${shipment.customer.name} ${shipment.cargo}`.toLowerCase().includes(query.toLowerCase());
    const matchesTab = tab === "all" || (tab === "in-transit" && shipment.status === "In Transit") || (tab === "delivered" && shipment.status === "Delivered") || (tab === "delayed" && ["Delayed", "On Hold"].includes(shipment.status));
    return matchesQuery && matchesTab;
  });

  return <Card className="h-full rounded-none ring-0">
    <CardHeader><CardTitle className="font-normal text-xl">Shipments</CardTitle></CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden px-0">
      <Tabs value={tab} onValueChange={setTab}><TabsList className="w-full justify-start border-b px-4"><TabsTrigger className="text-xs" value="all">All ({shipments.length})</TabsTrigger><TabsTrigger className="text-xs" value="in-transit">In Transit</TabsTrigger><TabsTrigger className="text-xs" value="delivered">Delivered</TabsTrigger><TabsTrigger className="text-xs" value="delayed">Delayed</TabsTrigger></TabsList></Tabs>
      <div className="px-4"><InputGroup className="h-8"><InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} className="h-8" aria-label="Search shipments" placeholder="Search shipments..." /><InputGroupAddon><Icon name="search" /></InputGroupAddon></InputGroup></div>
      <MessageScroller className="h-0 flex-1"><div className="flex flex-col gap-4 px-4 pb-4">{filtered.map((shipment) => <button key={shipment.id} type="button" aria-pressed={shipment.id === selectedId} onClick={() => onSelect(shipment.id)} className={cn("flex w-full flex-col gap-5 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", shipment.id === selectedId && "border-primary bg-muted/50")}>
        <div className="flex items-center justify-between"><div>#{shipment.id}</div><div className="flex items-center gap-1"><span className={cn("size-3 rounded-full border-2", shipment.status === "Delivered" ? "border-green-600" : shipment.status === "On Hold" ? "border-amber-500" : "border-primary")} /><span className="text-muted-foreground text-xs">{shipment.status}</span></div></div>
        <div className="flex items-center justify-between"><div><div className="font-medium text-xs leading-none">{shipment.origin.country},</div><div className="text-muted-foreground text-xs">{shipment.origin.display}</div></div><div className="text-right"><div className="font-medium text-xs leading-none">{shipment.destination.country},</div><div className="text-muted-foreground text-xs">{shipment.destination.display}</div></div></div>
        <div className="flex items-center gap-0.5"><span className="h-px min-w-0 flex-1 border-foreground border-t border-dashed" /><Icon name={shipment.mode === "land" ? "truck" : "route"} className="size-3.5" /><span className="h-px min-w-0 flex-1 border-border border-t border-dashed" /></div>
        <div className="flex items-center justify-between"><div><div className="text-muted-foreground text-xs leading-none">Cargo</div><div className="truncate text-sm tracking-tight">{shipment.cargo}</div></div><div className="text-right"><div className="text-muted-foreground text-xs leading-none">ETA</div><div className="text-sm tabular-nums tracking-tight">{shipment.eta}</div></div></div>
      </button>)}</div></MessageScroller>
    </CardContent>
  </Card>;
}

function ShipmentDetails({ shipment, events }: { shipment: WorkspaceShipment | null; events: readonly DeliveryLogisticsEventRow[] }) {
  const [copyMessage, setCopyMessage] = React.useState<string | null>(null);
  if (!shipment) return <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">Select a shipment to view details.</div>;
  const selectedShipment = shipment;
  const shipmentEvents = events.filter((event) => event.shipment_id === selectedShipment.ledgerId);
  async function copyShipmentId() {
    try {
      await navigator.clipboard.writeText(selectedShipment.id);
      setCopyMessage("Copied");
      window.setTimeout(() => setCopyMessage(null), 1600);
    } catch {
      setCopyMessage("Copy unavailable");
      window.setTimeout(() => setCopyMessage(null), 1600);
    }
  }
  function openTrackingUrl() {
    const safeTrackingUrl = sanitizeTrustedPublicUrl(selectedShipment.trackingUrl);
    if (safeTrackingUrl) window.open(safeTrackingUrl, "_blank", "noopener,noreferrer");
  }
  return <div className="grid h-full min-h-0 grid-rows-[320px_1fr] overflow-hidden lg:grid-rows-[420px_1fr]"><div className="min-h-0 overflow-hidden"><RouteMap shipment={shipment} /></div><div className="min-h-0 overflow-hidden"><div className="h-full min-h-0 gap-0 py-2"><Tabs defaultValue="overview"><TabsList className="w-full justify-start gap-2 border-b px-4 sm:gap-4"><TabsTrigger className="flex-none" value="overview">Overview</TabsTrigger><TabsTrigger className="flex-none" value="route">Route</TabsTrigger><TabsTrigger className="flex-none" value="cargo">Cargo</TabsTrigger><TabsTrigger className="flex-none" value="activity">Activity</TabsTrigger></TabsList>
    <TabsContent className="min-h-0 overflow-auto p-4" value="overview"><div className="flex flex-col gap-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><h1 className="font-medium text-lg tabular-nums tracking-tight sm:text-xl">#{shipment.id}</h1><Button aria-label="Copy shipment ID" onClick={() => void copyShipmentId()} size="icon" variant="ghost"><Icon name="copy" /></Button>{copyMessage ? <span className="text-muted-foreground text-xs" role="status">{copyMessage}</span> : null}</div><div className="flex items-center gap-2 text-xs sm:text-sm"><Badge variant="outline">{shipment.status}</Badge><span className="text-muted-foreground">·</span><span className="tabular-nums">{shipment.progress}% complete</span><span className="text-muted-foreground">·</span><span className="tabular-nums">ETA: {shipment.eta}</span></div></div><Separator /><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Avatar className="size-9"><AvatarFallback>{shipment.customer.initials}</AvatarFallback></Avatar><div><div className="font-medium text-sm leading-none">{shipment.customer.name}</div><div className="text-muted-foreground text-xs">{shipment.customer.id}</div></div></div><div className="text-right"><Badge variant="secondary">{shipment.customer.tier}</Badge><div className="text-muted-foreground text-xs">{shipment.customer.tierLabel}</div></div></div><Separator /><div className="flex flex-col gap-8"><div className="flex items-start justify-between gap-4"><h2 className="font-medium">Cargo details</h2><Button disabled={!shipment.trackingUrl} onClick={openTrackingUrl} size="sm" title={shipment.trackingUrl ? "Open live tracking" : "No tracking URL is recorded for this shipment."} variant="outline"><Icon name="truck" />Track shipment</Button></div><div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-5"><div className="col-span-2 flex flex-col gap-2 md:col-span-1"><div className="text-muted-foreground text-sm">Cargo</div><div className="text-sm">{shipment.cargo}</div></div><div><div className="text-muted-foreground text-sm">Total weight</div><div className="text-sm">{shipment.weight}</div></div><div><div className="text-muted-foreground text-sm">Transport mode</div><div className="text-sm capitalize">{shipment.mode} · {shipment.routeType}</div></div><div><div className="text-muted-foreground text-sm">Transport no.</div><div className="text-sm">{shipment.transportNumber}</div></div><div className="md:text-right"><div className="text-muted-foreground text-sm">Settlement</div><div className="text-sm capitalize">{shipment.settlementStatus}</div></div></div></div><Separator /><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50"><div className="flex items-center gap-2 font-medium"><Icon name="alert" />{shipment.handling.label}</div><p className="mt-2 text-sm">{shipment.handling.note}</p><Separator className="my-3 bg-amber-800 dark:bg-amber-50" /><div className="flex flex-wrap gap-2">{shipment.handling.tags.map((tag) => <Badge key={tag} className="border-amber-200 bg-background/50 text-amber-900 dark:border-amber-900 dark:text-amber-50" variant="outline">{tag}</Badge>)}</div></div></div></TabsContent>
    <TabsContent className="p-4" value="route"><div className="grid h-full place-items-center rounded-md border border-dashed text-muted-foreground text-sm">{sanitizeTrustedPublicUrl(shipment.trackingUrl) ? <a className="text-primary underline" href={sanitizeTrustedPublicUrl(shipment.trackingUrl) ?? undefined} rel="noreferrer" target="_blank">Open live tracking</a> : "Route tracking is not configured for this shipment."}</div></TabsContent>
    <TabsContent className="p-4" value="cargo"><div className="rounded-md border p-4 text-sm">{shipment.cargo}. Package dimensions and handling flags are recorded in the shipment ledger.</div></TabsContent>
    <TabsContent className="p-4" value="activity"><div className="flex flex-col gap-3">{shipmentEvents.length ? shipmentEvents.map((event) => <div className="rounded-md border p-3" key={event.id}><div className="font-medium text-sm capitalize">{event.event_type.replace(/_/g, " ")}</div><div className="text-muted-foreground text-xs">{formatDate(event.occurred_at)}</div></div>) : <div className="grid min-h-32 place-items-center rounded-md border border-dashed text-muted-foreground text-sm">No shipment events recorded.</div>}</div></TabsContent>
  </Tabs></div></div></div>;
}

export function LogisticsWorkspace({ shipments, events }: Props) {
  const workspaceShipments = React.useMemo(() => {
    const eventCounts = new Map<string, number>();
    for (const event of events) eventCounts.set(event.shipment_id, (eventCounts.get(event.shipment_id) ?? 0) + 1);
    return shipments.map((shipment) => toWorkspaceShipment(shipment, eventCounts.get(shipment.id) ?? 0));
  }, [events, shipments]);
  const [selectedId, setSelectedId] = React.useState<string | null>(workspaceShipments[0]?.id ?? null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const selectedShipment = workspaceShipments.find((shipment) => shipment.id === selectedId) ?? null;
  function selectShipment(id: string) { setSelectedId(id); if (window.innerWidth < 1024) setDetailsOpen(true); }
  return <><div data-content-padding="false" className="grid h-[calc(100dvh-var(--dashboard-header-height))] overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)] lg:divide-x"><div className="h-full overflow-hidden"><ShipmentList shipments={workspaceShipments} selectedId={selectedId} onSelect={selectShipment} /></div><div className="hidden h-full overflow-hidden lg:block"><ShipmentDetails shipment={selectedShipment} events={events} /></div></div><Sheet open={detailsOpen} onOpenChange={setDetailsOpen}><SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-3/4"><SheetHeader className="sr-only"><SheetTitle>{selectedShipment ? `Shipment ${selectedShipment.id}` : "Shipment details"}</SheetTitle><SheetDescription>Selected shipment details and route map.</SheetDescription></SheetHeader><ShipmentDetails shipment={selectedShipment} events={events} /></SheetContent></Sheet></>;
}
