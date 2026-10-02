"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Bubble,
  BubbleContent,
  BubbleGroup,
  Button,
  Card,
  CardHeader,
  CardTitle,
  InputGroup,
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
import { ArrowLeft, ArrowRight, ChevronDown, Plus, Search } from "lucide-react";
import { readResponseJson } from "@/lib/read-response-json";

type ChatOrderRow = {
  id: string;
  source: string;
  status: string;
  phone: string | null;
  raw_text: string | null;
  address: string | null;
  created_at: string;
  commerceCartId: string | null;
  commerceOrderId: string | null;
  commerceOrderDisplayId: string | null;
  commercePaymentStatus: string | null;
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

const EMPTY_QUEUE = (
  <div className="px-3 py-10 text-center">
    <p className="text-sm font-medium">No tickets in this view</p>
    <p className="mt-1 text-xs text-muted-foreground">New customer requests will appear here.</p>
  </div>
);

export function ChatOrdersWorkspace({ rows, intakeForm }: { rows: ChatOrderRow[]; intakeForm?: ReactNode }) {
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "closed">("all");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; body: string; author_email: string | null; created_at: string }>>([]);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const [transitionStatus, setTransitionStatus] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);

  useEffect(() => {
    if (!intakeOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIntakeOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [intakeOpen]);
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
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((body) => { if (!cancelled) setNotes(Array.isArray(body?.notes) ? body.notes : []); })
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
    if (!refreshed.ok) {
      setNotes([]);
      return;
    }
    const body = await refreshed.json().catch(() => ({}));
    setNotes(Array.isArray(body.notes) ? body.notes : []);
  }

  async function updateStatus(status: "processing" | "completed" | "cancelled") {
    if (!selected) return;
    if (status === "completed") return;
    setTransitionStatus("Saving…");
    const response = await fetch(`/api/admin/chat-orders/${encodeURIComponent(selected.id)}/status`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `chat-status-${crypto.randomUUID()}` }, body: JSON.stringify({ status }) });
    const body = await readResponseJson(response, {} as { error?: string });
    if (!response.ok) { setTransitionStatus(body.error ?? "Unable to update ticket"); return; }
    setTransitionStatus("Ticket updated");
    window.location.reload();
  }

  const isTerminal = selected ? ["completed", "cancelled"].includes(selected.status) : false;
  const selectedIndex = selected ? filteredRows.findIndex((row) => row.id === selected.id) : -1;
  const active: ChatOrderRow = selected ?? {
    id: "",
    source: "",
    status: "pending",
    phone: null,
    raw_text: null,
    address: null,
    created_at: new Date(0).toISOString(),
    commerceCartId: null,
    commerceOrderId: null,
    commerceOrderDisplayId: null,
    commercePaymentStatus: null,
    paymentProvider: null,
    paymentExternalId: null,
    paymentStatus: null,
  };
  const ticketPosition = selectedIndex >= 0 ? selectedIndex + 1 : 1;
  const moveSelection = (offset: number) => {
    if (filteredRows.length < 2 || selectedIndex < 0) return;
    const next = (selectedIndex + offset + filteredRows.length) % filteredRows.length;
    setSelectedId(filteredRows[next].id);
  };

  return (
    <Card className="overflow-hidden rounded-xl shadow-xs">
      <div className="grid min-h-[38rem] grid-cols-1 md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-medium text-base">Support tickets</h2>
              <p className="text-xs text-muted-foreground">Chat order intake</p>
            </div>
            <Button type="button" size="sm" onClick={() => setIntakeOpen(true)} disabled={!intakeForm}><Plus /> New ticket</Button>
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
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`rounded-lg p-3 text-left transition-colors ${row.id === selected?.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/70"}`}>
                    <div className="flex items-start gap-2.5">
                      <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(row.phone ?? row.source)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{row.phone || row.source}</span><span className="text-[11px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</span></div>
                        <p className="truncate text-xs text-muted-foreground">{row.raw_text || "No message text"}</p>
                        <Badge variant="outline" className="mt-1 text-[11px]">{statusLabel(row.status)}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredRows.length === 0 ? EMPTY_QUEUE : null}
              </div>
            </TabsContent>
            <TabsContent value="pending" className="m-0 p-2">
              <div className="flex flex-col gap-1">
                {filteredRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`rounded-lg p-3 text-left transition-colors ${row.id === selected?.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/70"}`}><span className="block truncate text-sm font-medium">{row.phone || row.source}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{row.raw_text || "No message text"}</span></button>
                ))}
                {filteredRows.length === 0 ? EMPTY_QUEUE : null}
              </div>
            </TabsContent>
            <TabsContent value="closed" className="m-0 p-2">
              <div className="flex flex-col gap-1">
                {filteredRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`rounded-lg p-3 text-left transition-colors ${row.id === selected?.id ? "bg-muted ring-1 ring-border" : "hover:bg-muted/70"}`}><span className="block truncate text-sm font-medium">{row.phone || row.source}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{statusLabel(row.status)}</span></button>
                ))}
                {filteredRows.length === 0 ? EMPTY_QUEUE : null}
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <section className="flex min-h-0 flex-col">
          <CardHeader className="border-b p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Ticket #{active.id ? active.id.slice(0, 8) : "—"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar><AvatarFallback>{initials(active.phone ?? (active.source || "Ticket"))}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{active.phone || active.source || "Conversation tracker"}</CardTitle>
                    <p className="text-xs text-muted-foreground">{active.id ? `${active.source} order conversation · ${new Date(active.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : "Select a conversation from the inbox"}</p>
                  </div>
                </div>
              </div>
              {selected && filteredRows.length > 1 ? (
                <div className="flex items-center gap-1">
                  <span className="mr-2 text-xs text-muted-foreground">{ticketPosition} of {filteredRows.length}</span>
                  <Button type="button" variant="outline" size="icon" className="size-7" aria-label="Previous ticket" onClick={() => moveSelection(-1)}><ArrowLeft /></Button>
                  <Button type="button" variant="outline" size="icon" className="size-7" aria-label="Next ticket" onClick={() => moveSelection(1)}><ArrowRight /></Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <MessageScrollerProvider>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent>
                  {selected ? <MessageScrollerItem><Message><MessageAvatar><Avatar><AvatarFallback>{initials(active.phone ?? active.source)}</AvatarFallback></Avatar></MessageAvatar><MessageContent><BubbleGroup><Bubble variant="muted"><BubbleContent>{active.raw_text || "No message text was captured."}</BubbleContent></Bubble></BubbleGroup><MessageFooter>{new Date(active.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</MessageFooter></MessageContent></Message></MessageScrollerItem> : <MessageScrollerItem><div className="grid min-h-64 place-items-center p-8 text-center"><div><p className="font-medium">No conversations yet</p><p className="mt-1 text-sm text-muted-foreground">Select a ticket from the intake queue to begin routing.</p></div></div></MessageScrollerItem>}
                  {notes.map((entry) => <MessageScrollerItem key={entry.id}><Message align="end"><MessageAvatar><Avatar><AvatarFallback className="bg-primary text-primary-foreground">AD</AvatarFallback></Avatar></MessageAvatar><MessageContent><BubbleGroup><Bubble align="end"><BubbleContent>{entry.body}</BubbleContent></Bubble></BubbleGroup><MessageFooter>{entry.author_email ?? "Admin"} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</MessageFooter></MessageContent></Message></MessageScrollerItem>)}
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          </MessageScrollerProvider>
          {selected ? <div className="border-t p-3"><Tabs defaultValue="reply"><TabsList className="w-full justify-start border-b px-3"><TabsTrigger value="reply">Reply</TabsTrigger><TabsTrigger value="note">Internal note</TabsTrigger></TabsList><TabsContent value="reply" className="m-0"><InputGroup className="border-0 shadow-none"><InputGroupTextarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reply to this order thread..." rows={2} /><button type="button" aria-label="Send reply" disabled={!note.trim()} onClick={() => void saveNote()} className="min-h-9 shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50">Send</button></InputGroup></TabsContent><TabsContent value="note" className="m-0"><InputGroup className="border-0 shadow-none"><InputGroupTextarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write an internal note..." rows={2} /><button type="button" aria-label="Save internal note" disabled={!note.trim()} onClick={() => void saveNote()} className="min-h-9 shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50">Save</button></InputGroup></TabsContent></Tabs>{noteStatus ? <p className="mt-2 text-xs text-muted-foreground" role="status">{noteStatus}</p> : null}</div> : null}
        </section>

        <aside className="hidden border-l p-4 xl:block"><div className="flex items-center justify-between gap-2"><div><p className="text-xs text-muted-foreground">Ticket details</p><h2 className="font-medium">Order profile</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Expand ticket details"><ChevronDown /></Button></div><Separator className="my-4" /><dl className="flex flex-col gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{active.phone || "Not provided"}</dd></div><div><dt className="text-xs text-muted-foreground">Address</dt><dd>{active.address || "Not provided"}</dd></div><div><dt className="text-xs text-muted-foreground">Status</dt><dd><Badge variant="outline">{statusLabel(active.status)}</Badge></dd></div>{active.commerceCartId ? <div><dt className="text-xs text-muted-foreground">Commerce cart</dt><dd className="break-all font-mono text-xs">{active.commerceCartId}</dd></div> : null}{active.commerceOrderId ? <div><dt className="text-xs text-muted-foreground">Commerce order</dt><dd>{active.commerceOrderDisplayId || active.commerceOrderId}</dd></div> : null}{active.commercePaymentStatus ? <div><dt className="text-xs text-muted-foreground">Payment</dt><dd>{statusLabel(active.commercePaymentStatus)}</dd></div> : null}<div><dt className="text-xs text-muted-foreground">Provider settlement</dt><dd>{active.paymentStatus ? statusLabel(active.paymentStatus) : "Awaiting verified provider event"}</dd></div>{selected ? <div><dt className="text-xs text-muted-foreground">Created</dt><dd>{new Date(active.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</dd></div> : null}</dl><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void updateStatus("processing")} disabled={!selected || active.status === "processing" || isTerminal}>Process</Button><Button type="button" size="sm" variant="destructive" onClick={() => void updateStatus("cancelled")} disabled={!selected || active.status === "cancelled" || active.status === "completed"}>Cancel</Button></div>{transitionStatus ? <p className="mt-2 text-xs text-muted-foreground" role="status">{transitionStatus}</p> : null}<p className="mt-3 text-xs text-muted-foreground">Payment settlement and ticket completion are controlled by verified provider events, not manually entered payment IDs.</p></aside>
      </div>
      {intakeOpen && intakeForm && typeof document !== "undefined" ? createPortal(
        <dialog open className="fixed inset-0 z-[100] m-0 flex min-h-dvh w-full max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4" aria-labelledby="new-chat-ticket-title" onCancel={() => setIntakeOpen(false)}>
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-background p-1 shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Ticketing</p><h2 id="new-chat-ticket-title" className="text-lg font-semibold">New ticket</h2></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIntakeOpen(false)}>Close</Button>
            </div>
            <div className="max-h-[calc(100dvh_-_8rem)] overflow-y-auto p-5">{intakeForm}</div>
          </div>
        </dialog>,
        document.body,
      ) : null}
    </Card>
  );
}
