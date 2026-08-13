"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Bubble,
  BubbleContent,
  BubbleGroup,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InputGroup,
  InputGroupButton,
  InputGroupTextarea,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@universal-music-store/ui";
import { ChevronDown, Filter, MoreHorizontal, Search } from "lucide-react";

type ChatOrderRow = {
  id: string;
  source: string;
  status: string;
  phone: string | null;
  raw_text: string | null;
  address: string | null;
  created_at: string;
  draftHref: string | null;
  medusaOrderId: string | null;
  medusaOrderDisplayId: string | null;
  medusaOrderPaymentStatus: string | null;
  paymentProvider: string | null;
  paymentExternalId: string | null;
  paymentStatus: string | null;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CO";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function ChatOrdersWorkspace({ rows }: { rows: ChatOrderRow[] }) {
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "closed">("all");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; body: string; author_email: string | null; created_at: string }>>([]);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "paypal" | "xendit">("xendit");
  const [paymentExternalId, setPaymentExternalId] = useState("");
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0], [rows, selectedId]);
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !needle || [row.phone, row.source, row.raw_text, row.status].some((value) => value?.toLowerCase().includes(needle));
      const matchesFilter = filter === "all" || (filter === "pending" ? row.status.toLowerCase().includes("pending") : ["completed", "cancelled"].includes(row.status));
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, rows]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void fetch(`/api/admin/operator-notes?entity_type=chat_order&entity_id=${encodeURIComponent(selected.id)}`)
      .then((response) => response.json())
      .then((body) => { if (!cancelled) setNotes(Array.isArray(body.notes) ? body.notes : []); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [selected]);

  async function saveNote() {
    if (!selected || !note.trim()) return;
    setNoteStatus("Saving...");
    const response = await fetch("/api/admin/operator-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity_type: "chat_order", entity_id: selected.id, body: note.trim() }) });
    if (!response.ok) { setNoteStatus("Unable to save note"); return; }
    setNote("");
    setNoteStatus("Saved");
    const refreshed = await fetch(`/api/admin/operator-notes?entity_type=chat_order&entity_id=${encodeURIComponent(selected.id)}`);
    const body = await refreshed.json().catch(() => ({}));
    setNotes(Array.isArray(body.notes) ? body.notes : []);
  }

  async function updateStatus(status: "processing" | "completed" | "cancelled") {
    if (!selected) return;
    const response = await fetch(`/api/admin/chat-orders/${encodeURIComponent(selected.id)}/status`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `chat-status-${crypto.randomUUID()}` }, body: JSON.stringify({ status }) });
    if (response.ok) window.location.reload();
  }

  async function settlePayment() {
    if (!selected || !paymentExternalId.trim()) return;
    setPaymentStatus("Settling...");
    const response = await fetch(`/api/admin/chat-orders/${encodeURIComponent(selected.id)}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `chat-settle-${crypto.randomUUID()}` },
      body: JSON.stringify({ provider: paymentProvider, payment_external_id: paymentExternalId.trim(), ...(paymentProvider === "xendit" && paymentRequestId.trim() ? { payment_request_id: paymentRequestId.trim() } : {}) }),
    });
    const body = await response.json().catch(() => ({}));
    setPaymentStatus(response.ok ? `Payment ${body.data?.payment_status ?? "updated"}` : body.error ?? "Unable to settle payment");
    if (response.ok) window.location.reload();
  }

  if (!selected) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No chat order conversations yet.</CardContent></Card>;
  }
  const isTerminal = ["completed", "pending_payment", "cancelled"].includes(selected.status);

  return (
    <Card className="overflow-hidden rounded-xl shadow-xs ring-1 ring-foreground/10">
      <div className="grid min-h-[38rem] grid-cols-1 md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-medium text-base">Support tickets</h2>
              <p className="text-xs text-muted-foreground">Chat order intake</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Filter support tickets"><Filter /></Button>
          </div>
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets..." aria-label="Search chat orders" className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
          </div>
          <Separator />
          <Tabs defaultValue="all">
            <TabsList className="w-full justify-start border-b px-2">
              <TabsTrigger value="all" onClick={() => setFilter("all")}>All ({rows.length})</TabsTrigger>
              <TabsTrigger value="pending" onClick={() => setFilter("pending")}>Open ({rows.filter((row) => row.status.toLowerCase().includes("pending")).length})</TabsTrigger>
              <TabsTrigger value="closed" onClick={() => setFilter("closed")}>Closed</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="m-0 p-2">
              <div className="flex flex-col gap-1">
                {filteredRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`rounded-lg p-3 text-left transition-colors ${row.id === selected.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/70"}`}>
                    <div className="flex items-start gap-2.5">
                      <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(row.phone ?? row.source)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{row.phone || row.source}</span><span className="text-[11px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</span></div>
                        <p className="truncate text-xs text-muted-foreground">{row.raw_text || "No message text"}</p>
                        <Badge variant="outline" className="mt-1 text-[11px]">{statusLabel(row.status)}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="pending" className="m-0 p-2">
              <div className="flex flex-col gap-1">
                {filteredRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`rounded-lg p-3 text-left transition-colors ${row.id === selected.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/70"}`}><span className="block truncate text-sm font-medium">{row.phone || row.source}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{row.raw_text || "No message text"}</span></button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="closed" className="m-0 p-2">
              <div className="flex flex-col gap-1">
                {filteredRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`rounded-lg p-3 text-left transition-colors ${row.id === selected.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/70"}`}><span className="block truncate text-sm font-medium">{row.phone || row.source}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{statusLabel(row.status)}</span></button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <section className="flex min-h-0 flex-col">
          <CardHeader className="border-b p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar><AvatarFallback>{initials(selected.phone ?? selected.source)}</AvatarFallback></Avatar><div><CardTitle className="text-base">{selected.phone || selected.source}</CardTitle><p className="text-xs text-muted-foreground">{selected.source} order conversation</p></div></div><div className="flex items-center gap-1">{selected.draftHref && !selected.medusaOrderId ? <Button asChild variant="outline" size="sm"><a href={selected.draftHref} target="_blank" rel="noreferrer">Open draft</a></Button> : null}<Button type="button" variant="ghost" size="icon" aria-label="More ticket actions"><MoreHorizontal /></Button></div></div></CardHeader>
          <MessageScrollerProvider>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent>
                  <MessageScrollerItem><Message><MessageAvatar><Avatar><AvatarFallback>{initials(selected.phone ?? selected.source)}</AvatarFallback></Avatar></MessageAvatar><MessageContent><BubbleGroup><Bubble variant="muted"><BubbleContent>{selected.raw_text || "No message text was captured."}</BubbleContent></Bubble></BubbleGroup><MessageFooter>{new Date(selected.created_at).toLocaleString()}</MessageFooter></MessageContent></Message></MessageScrollerItem>
                  {notes.map((entry) => <MessageScrollerItem key={entry.id}><Message align="end"><MessageAvatar><Avatar><AvatarFallback className="bg-primary text-primary-foreground">AD</AvatarFallback></Avatar></MessageAvatar><MessageContent><BubbleGroup><Bubble align="end"><BubbleContent>{entry.body}</BubbleContent></Bubble></BubbleGroup><MessageFooter>{entry.author_email ?? "Admin"} · {new Date(entry.created_at).toLocaleString()}</MessageFooter></MessageContent></Message></MessageScrollerItem>)}
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          </MessageScrollerProvider>
          <div className="border-t p-3"><Tabs defaultValue="reply"><TabsList className="w-full justify-start border-b px-3"><TabsTrigger value="reply">Reply</TabsTrigger><TabsTrigger value="note">Internal note</TabsTrigger></TabsList><TabsContent value="reply" className="m-0"><InputGroup className="border-0 shadow-none"><InputGroupTextarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reply to this order thread..." rows={2} /><InputGroupButton aria-label="Send reply" disabled={!note.trim()} onClick={() => void saveNote()} className="bg-primary text-primary-foreground">Send</InputGroupButton></InputGroup></TabsContent><TabsContent value="note" className="m-0"><InputGroup className="border-0 shadow-none"><InputGroupTextarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write an internal note..." rows={2} /><InputGroupButton aria-label="Save internal note" disabled={!note.trim()} onClick={() => void saveNote()} className="bg-primary text-primary-foreground">Save</InputGroupButton></InputGroup></TabsContent></Tabs>{noteStatus ? <p className="mt-2 text-xs text-muted-foreground" role="status">{noteStatus}</p> : null}</div>
        </section>

        <aside className="hidden border-l p-4 xl:block"><div className="flex items-center justify-between gap-2"><div><p className="text-xs text-muted-foreground">Ticket details</p><h2 className="font-medium">Order profile</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Expand ticket details"><ChevronDown /></Button></div><Separator className="my-4" /><dl className="flex flex-col gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{selected.phone || "Not provided"}</dd></div><div><dt className="text-xs text-muted-foreground">Address</dt><dd>{selected.address || "Not provided"}</dd></div><div><dt className="text-xs text-muted-foreground">Status</dt><dd><Badge variant="outline">{statusLabel(selected.status)}</Badge></dd></div>{selected.medusaOrderId ? <div><dt className="text-xs text-muted-foreground">Medusa order</dt><dd>{selected.medusaOrderDisplayId || selected.medusaOrderId}</dd></div> : null}{selected.medusaOrderPaymentStatus ? <div><dt className="text-xs text-muted-foreground">Payment</dt><dd>{statusLabel(selected.medusaOrderPaymentStatus)}</dd></div> : null}<div><dt className="text-xs text-muted-foreground">Provider settlement</dt><dd>{selected.paymentStatus ? statusLabel(selected.paymentStatus) : "Not settled"}</dd></div><div><dt className="text-xs text-muted-foreground">Created</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div></dl><div className="mt-5 space-y-2"><label className="block text-xs font-medium">Payment provider<select value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value as typeof paymentProvider)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="xendit">Xendit</option><option value="paypal">PayPal</option><option value="stripe">Stripe</option></select></label><label className="block text-xs font-medium">Payment ID<input value={paymentExternalId} onChange={(event) => setPaymentExternalId(event.target.value)} placeholder={selected.paymentExternalId ?? "Provider payment ID"} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" /></label>{paymentProvider === "xendit" ? <label className="block text-xs font-medium">Payment request ID<input value={paymentRequestId} onChange={(event) => setPaymentRequestId(event.target.value)} placeholder="Xendit payment request ID" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" /></label> : null}<Button type="button" size="sm" className="w-full" onClick={() => void settlePayment()} disabled={!paymentExternalId.trim() || isTerminal}>Settle payment</Button>{paymentStatus ? <p className="text-xs text-muted-foreground" role="status">{paymentStatus}</p> : null}</div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void updateStatus("processing")} disabled={selected.status === "processing" || isTerminal}>Process</Button><Button type="button" size="sm" variant="outline" onClick={() => void updateStatus("completed")} disabled={isTerminal || selected.paymentStatus !== "settled"}>Complete</Button><Button type="button" size="sm" variant="destructive" onClick={() => void updateStatus("cancelled")} disabled={selected.status === "cancelled" || selected.status === "completed"}>Cancel</Button></div></aside>
      </div>
    </Card>
  );
}
