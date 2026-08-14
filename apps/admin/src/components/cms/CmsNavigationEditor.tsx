"use client";

import { useSession } from "next-auth/react";
import type { CmsNavigationPayload } from "@universal-music-store/platform-data";
import { staffHasPermission } from "@universal-music-store/platform-data";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useState } from "react";

type NavPayload = CmsNavigationPayload;

function newDragId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type FooterLinkRow = { href: string; label: string; lid: string };
type HeaderRow = {
  href: string;
  label: string;
  hid: string;
  badge?: string;
  iconKey?: string;
  children: FooterLinkRow[];
};
type FooterColRow = { title: string; links: FooterLinkRow[]; cid: string };
type SocialRow = { href: string; label: string; network?: string; sid: string };

type EditorNav = {
  headerLinks: HeaderRow[];
  headerLinksMobile: FooterLinkRow[];
  footerBottomLinks: FooterLinkRow[];
  footerColumns: FooterColRow[];
  socialLinks: SocialRow[];
};

function emptyEditorNav(): EditorNav {
  return {
    headerLinks: [
      { href: "/shop", label: "Shop", hid: newDragId(), children: [] },
    ],
    headerLinksMobile: [],
    footerBottomLinks: [],
    footerColumns: [
      {
        cid: newDragId(),
        title: "Shop",
        links: [{ href: "/shop", label: "All products", lid: newDragId() }],
      },
      {
        cid: newDragId(),
        title: "Support",
        links: [{ href: "/help", label: "Help", lid: newDragId() }],
      },
    ],
    socialLinks: [],
  };
}

function toApiPayload(e: EditorNav): NavPayload {
  return {
    headerLinks: e.headerLinks.map(({ href, label, badge, iconKey, children }) => ({
      href,
      label,
      badge: badge?.trim() || undefined,
      iconKey: iconKey?.trim() || undefined,
      children:
        children.length > 0
          ? children.map(({ href: h, label: lab }) => ({ href: h, label: lab }))
          : undefined,
    })),
    headerLinksMobile: e.headerLinksMobile.map(({ href, label }) => ({ href, label })),
    footerBottomLinks: e.footerBottomLinks.map(({ href, label }) => ({ href, label })),
    footerColumns: e.footerColumns.map((c) => ({
      title: c.title,
      links: c.links.map(({ href, label }) => ({ href, label })),
    })),
    socialLinks: e.socialLinks.map(({ href, label, network }) => ({
      href,
      label,
      network,
    })),
  };
}

function normalizeNavToEditor(raw: unknown): EditorNav {
  const e = emptyEditorNav();
  if (!raw || typeof raw !== "object") return e;
  const o = raw as Record<string, unknown>;
  const headerLinks = Array.isArray(o.headerLinks)
    ? (
        o.headerLinks as {
          href?: string;
          label?: string;
          badge?: string;
          iconKey?: string;
          children?: { href?: string; label?: string }[];
        }[]
      )
        .filter((x) => x && typeof x.href === "string" && typeof x.label === "string")
        .map((x) => ({
          href: x.href!,
          label: x.label!,
          hid: newDragId(),
          badge: typeof x.badge === "string" ? x.badge : undefined,
          iconKey: typeof x.iconKey === "string" ? x.iconKey : undefined,
          children: Array.isArray(x.children)
            ? x.children
                .filter((c) => c && typeof c.href === "string" && typeof c.label === "string")
                .map((c) => ({
                  href: c.href!,
                  label: c.label!,
                  lid: newDragId(),
                }))
            : [],
        }))
    : e.headerLinks;
  const headerLinksMobile = Array.isArray(o.headerLinksMobile)
    ? (o.headerLinksMobile as { href?: string; label?: string }[])
        .filter((x) => x && typeof x.href === "string" && typeof x.label === "string")
        .map((x) => ({ href: x.href!, label: x.label!, lid: newDragId() }))
    : e.headerLinksMobile;
  const footerBottomLinks = Array.isArray(o.footerBottomLinks)
    ? (o.footerBottomLinks as { href?: string; label?: string }[])
        .filter((x) => x && typeof x.href === "string" && typeof x.label === "string")
        .map((x) => ({ href: x.href!, label: x.label!, lid: newDragId() }))
    : e.footerBottomLinks;
  const footerColumns = Array.isArray(o.footerColumns)
    ? (o.footerColumns as { title?: string; links?: unknown }[]).map((col) => ({
        cid: newDragId(),
        title: typeof col.title === "string" ? col.title : "Links",
        links: Array.isArray(col.links)
          ? (col.links as { href?: string; label?: string }[])
              .filter((l) => l && typeof l.href === "string" && typeof l.label === "string")
              .map((l) => ({ href: l.href!, label: l.label!, lid: newDragId() }))
          : [],
      }))
    : e.footerColumns;
  const socialLinks = Array.isArray(o.socialLinks)
    ? (o.socialLinks as { href?: string; label?: string; network?: string }[])
        .filter((x) => x && typeof x.href === "string" && typeof x.label === "string")
        .map((x) => ({
          href: x.href!,
          label: x.label!,
          network: typeof x.network === "string" ? x.network : undefined,
          sid: newDragId(),
        }))
    : [];
  return { headerLinks, headerLinksMobile, footerBottomLinks, footerColumns, socialLinks };
}

function SortableHeaderRow({
  id,
  link,
  onChange,
  onRemove,
  disabled,
}: {
  id: string;
  link: HeaderRow;
  onChange: (_l: HeaderRow) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 ${
        isDragging ? "opacity-80 shadow-md ring-2 ring-primary/25" : ""
      }`}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 touch-none hover:bg-slate-100 disabled:opacity-40"
        disabled={disabled}
        aria-label="Drag header link"
        {...attributes}
        {...listeners}
      >
        <span className="text-lg leading-none" aria-hidden>
          ::
        </span>
      </button>
      <label className="min-w-[120px] flex-1 text-xs font-medium text-slate-600">
        Label
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.label}
          onChange={(e) => onChange({ ...link, label: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label className="min-w-[160px] flex-[2] text-xs font-medium text-slate-600">
        URL
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.href}
          onChange={(e) => onChange({ ...link, href: e.target.value })}
          disabled={disabled}
          placeholder="/shop"
        />
      </label>
      <label className="w-20 text-xs font-medium text-slate-600">
        Badge
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.badge ?? ""}
          onChange={(e) =>
            onChange({ ...link, badge: e.target.value.trim() || undefined })
          }
          disabled={disabled}
          placeholder="New"
        />
      </label>
      <label className="w-28 text-xs font-medium text-slate-600">
        Icon key
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.iconKey ?? ""}
          onChange={(e) =>
            onChange({ ...link, iconKey: e.target.value.trim() || undefined })
          }
          disabled={disabled}
          placeholder="star"
        />
      </label>
      <button
        type="button"
        className="mb-0.5 text-xs text-red-600 hover:underline"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove
      </button>
      <div className="w-full basis-full border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">Mega menu links (optional)</p>
        <div className="space-y-2">
          {link.children.map((c, ci) => (
            <div key={c.lid} className="flex flex-wrap items-end gap-2 rounded border border-slate-100 bg-slate-50/80 p-2">
              <label className="min-w-[100px] flex-1 text-xs text-slate-600">
                Label
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                  value={c.label}
                  onChange={(e) => {
                    const children = [...link.children];
                    children[ci] = { ...c, label: e.target.value };
                    onChange({ ...link, children });
                  }}
                  disabled={disabled}
                />
              </label>
              <label className="min-w-[120px] flex-[2] text-xs text-slate-600">
                URL
                <input
                  className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                  value={c.href}
                  onChange={(e) => {
                    const children = [...link.children];
                    children[ci] = { ...c, href: e.target.value };
                    onChange({ ...link, children });
                  }}
                  disabled={disabled}
                />
              </label>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...link,
                    children: link.children.filter((_, j) => j !== ci),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...link,
                children: [
                  ...link.children,
                  { href: "/", label: "Sub link", lid: newDragId() },
                ],
              })
            }
          >
            + Add submenu link
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSocialRow({
  id,
  link,
  onChange,
  onRemove,
  disabled,
}: {
  id: string;
  link: SocialRow;
  onChange: (_l: SocialRow) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 ${
        isDragging ? "opacity-80 shadow-md ring-2 ring-primary/25" : ""
      }`}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 touch-none hover:bg-slate-100 disabled:opacity-40"
        disabled={disabled}
        aria-label="Drag social link"
        {...attributes}
        {...listeners}
      >
        <span className="text-lg leading-none" aria-hidden>
          ::
        </span>
      </button>
      <label className="min-w-[100px] flex-1 text-xs font-medium text-slate-600">
        Label
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.label}
          onChange={(e) => onChange({ ...link, label: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label className="min-w-[120px] flex-1 text-xs font-medium text-slate-600">
        URL
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.href}
          onChange={(e) => onChange({ ...link, href: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label className="w-24 text-xs font-medium text-slate-600">
        Network
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={link.network ?? ""}
          onChange={(e) =>
            onChange({ ...link, network: e.target.value.trim() || undefined })
          }
          disabled={disabled}
          placeholder="instagram"
        />
      </label>
      <button
        type="button"
        className="mb-0.5 text-xs text-red-600 hover:underline"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}

function SortableFooterLinkRow({
  id,
  link,
  colIndex,
  dragAriaLabel,
  onChange,
  onRemove,
  disabled,
}: {
  id: string;
  link: FooterLinkRow;
  colIndex: number;
  dragAriaLabel?: string;
  onChange: (_l: FooterLinkRow) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-end gap-2 rounded border border-slate-100 bg-slate-50/80 p-2 ${
        isDragging ? "opacity-80 shadow-sm ring-1 ring-primary/30" : ""
      }`}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 touch-none hover:bg-slate-100 disabled:opacity-40"
        disabled={disabled}
        aria-label={dragAriaLabel ?? `Drag link in column ${colIndex + 1}`}
        {...attributes}
        {...listeners}
      >
        <span className="text-lg leading-none" aria-hidden>
          ::
        </span>
      </button>
      <label className="min-w-[100px] flex-1 text-xs font-medium text-slate-600">
        Label
        <input
          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm"
          value={link.label}
          onChange={(e) => onChange({ ...link, label: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label className="min-w-[140px] flex-[2] text-xs font-medium text-slate-600">
        URL
        <input
          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm"
          value={link.href}
          onChange={(e) => onChange({ ...link, href: e.target.value })}
          disabled={disabled}
        />
      </label>
      <button
        type="button"
        className="mb-0.5 text-xs text-red-600 hover:underline"
        disabled={disabled}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}

function SortableFooterColumnCard({
  column,
  colIndex,
  onChangeColumn,
  onRemoveColumn,
  disabled,
}: {
  column: FooterColRow;
  colIndex: number;
  onChangeColumn: (_c: FooterColRow) => void;
  onRemoveColumn: () => void;
  disabled: boolean;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: column.cid,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const linkIds = column.links.map((l) => l.lid);

  const updateLink = (li: number, l: FooterLinkRow) => {
    const links = [...column.links];
    links[li] = l;
    onChangeColumn({ ...column, links });
  };
  const removeLink = (li: number) => {
    onChangeColumn({ ...column, links: column.links.filter((_, i) => i !== li) });
  };
  const addLink = () => {
    onChangeColumn({
      ...column,
      links: [...column.links, { href: "/", label: "New link", lid: newDragId() }],
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-slate-200 bg-white p-4 ${
        isDragging ? "opacity-90 shadow-lg ring-2 ring-primary/25" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-500 touch-none hover:bg-slate-100 disabled:opacity-40"
          disabled={disabled}
          aria-label="Drag footer column"
          {...attributes}
          {...listeners}
        >
          <span className="text-lg leading-none" aria-hidden>
            ::
          </span>
        </button>
        <label className="min-w-[160px] flex-1 text-xs font-medium text-slate-600">
          Column title
          <input
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-semibold"
            value={column.title}
            onChange={(e) => onChangeColumn({ ...column, title: e.target.value })}
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          className="text-xs text-red-600 hover:underline"
          disabled={disabled}
          onClick={onRemoveColumn}
        >
          Remove column
        </button>
      </div>

      <SortableContext items={linkIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {column.links.map((link, li) => (
            <SortableFooterLinkRow
              key={link.lid}
              id={link.lid}
              colIndex={colIndex}
              link={link}
              disabled={disabled}
              onChange={(l) => updateLink(li, l)}
              onRemove={() => removeLink(li)}
            />
          ))}
        </div>
      </SortableContext>

      <button
        type="button"
        className="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        disabled={disabled}
        onClick={addLink}
      >
        + Add link in this column
      </button>
    </div>
  );
}

function findFooterLinkLocation(
  n: EditorNav,
  lid: string,
): { ci: number; li: number } | null {
  for (let ci = 0; ci < n.footerColumns.length; ci++) {
    const li = n.footerColumns[ci].links.findIndex((l) => l.lid === lid);
    if (li >= 0) return { ci, li };
  }
  return null;
}

function findHeaderMobileIndex(n: EditorNav, lid: string): number {
  return n.headerLinksMobile.findIndex((l) => l.lid === lid);
}

function findFooterBottomIndex(n: EditorNav, lid: string): number {
  return n.footerBottomLinks.findIndex((l) => l.lid === lid);
}

function navigationValidationHints(e: EditorNav): string[] {
  const hints: string[] = [];
  const check = (label: string, links: { href: string; label: string }[]) => {
    links.forEach((l, i) => {
      if (!l.href.trim()) hints.push(`${label} row ${i + 1}: URL is empty`);
      if (!l.label.trim()) hints.push(`${label} row ${i + 1}: Label is empty`);
    });
  };
  check("Header", e.headerLinks);
  check("Mobile header", e.headerLinksMobile);
  check("Footer bottom", e.footerBottomLinks);
  e.footerColumns.forEach((col, ci) => {
    check(`Footer column "${col.title || `#${ci + 1}`}"`, col.links);
  });
  check("Social", e.socialLinks);
  e.headerLinks.forEach((h, _hi) => {
    h.children.forEach((c, ci) => {
      if (!c.href.trim())
        hints.push(`Header "${h.label}" submenu ${ci + 1}: URL is empty`);
      if (!c.label.trim())
        hints.push(`Header "${h.label}" submenu ${ci + 1}: Label is empty`);
    });
  });
  return hints;
}

export function CmsNavigationEditor() {
  const { data: session, status } = useSession();
  const perms = session?.user?.permissions ?? [];
  const canWrite = staffHasPermission(perms, "content:write");
  const canPublish =
    staffHasPermission(perms, "content:publish") || staffHasPermission(perms, "content:write");
  const [nav, setNav] = useState<EditorNav>(() => emptyEditorNav());
  const [hasDraft, setHasDraft] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const applyNavigationResponse = useCallback(
    (j: { data?: NavPayload; meta?: { hasDraft?: boolean }; error?: string }) => {
      if (j.data !== undefined) {
        const n = normalizeNavToEditor(j.data);
        setNav(n);
        setJsonText(JSON.stringify(toApiPayload(n), null, 2));
      }
      if (typeof j.meta?.hasDraft === "boolean") setHasDraft(j.meta.hasDraft);
    },
    [],
  );

  const load = useCallback(() => {
    fetch("/api/admin/cms/navigation")
      .then(async (r) => {
        const j = (await r.json()) as {
          data?: NavPayload;
          meta?: { hasDraft?: boolean };
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j;
      })
      .then((j) => {
        applyNavigationResponse(j);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load content"));
  }, [applyNavigationResponse]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showAdvancedJson) setJsonText(JSON.stringify(toApiPayload(nav), null, 2));
  }, [nav, showAdvancedJson]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);

    setNav((n) => {
      const hi = n.headerLinks.findIndex((h) => h.hid === a);
      const hj = n.headerLinks.findIndex((h) => h.hid === o);
      if (hi >= 0 && hj >= 0) {
        return { ...n, headerLinks: arrayMove(n.headerLinks, hi, hj) };
      }

      const mi = findHeaderMobileIndex(n, a);
      const mj = findHeaderMobileIndex(n, o);
      if (mi >= 0 && mj >= 0) {
        return { ...n, headerLinksMobile: arrayMove(n.headerLinksMobile, mi, mj) };
      }

      const bi = findFooterBottomIndex(n, a);
      const bj = findFooterBottomIndex(n, o);
      if (bi >= 0 && bj >= 0) {
        return { ...n, footerBottomLinks: arrayMove(n.footerBottomLinks, bi, bj) };
      }

      const si = n.socialLinks.findIndex((s) => s.sid === a);
      const sj = n.socialLinks.findIndex((s) => s.sid === o);
      if (si >= 0 && sj >= 0) {
        return { ...n, socialLinks: arrayMove(n.socialLinks, si, sj) };
      }

      const pa = findFooterLinkLocation(n, a);
      const po = findFooterLinkLocation(n, o);
      if (pa && po && pa.ci === po.ci) {
        const cols = [...n.footerColumns];
        const col = cols[pa.ci];
        if (!col) return n;
        const links = arrayMove(col.links, pa.li, po.li);
        cols[pa.ci] = { ...col, links };
        return { ...n, footerColumns: cols };
      }

      const ci = n.footerColumns.findIndex((c) => c.cid === a);
      const cj = n.footerColumns.findIndex((c) => c.cid === o);
      if (ci >= 0 && cj >= 0) {
        return { ...n, footerColumns: arrayMove(n.footerColumns, ci, cj) };
      }

      return n;
    });
  };

  const getPayloadFromEditor = (): NavPayload => {
    return showAdvancedJson ? (JSON.parse(jsonText) as NavPayload) : toApiPayload(nav);
  };

  const saveDraft = async () => {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = getPayloadFromEditor();
      const r = await fetch("/api/admin/cms/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "draft", payload }),
      });
      const j = (await r.json()) as {
        data?: NavPayload;
        meta?: { hasDraft?: boolean };
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      applyNavigationResponse(j);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Draft save did not complete");
    } finally {
      setSaving(false);
    }
  };

  const saveLive = async () => {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = getPayloadFromEditor();
      const hints = navigationValidationHints(
        showAdvancedJson ? normalizeNavToEditor(payload) : nav,
      );
      if (hints.length > 0) {
        setError(`Fix before publishing live: ${hints.slice(0, 5).join("; ")}${hints.length > 5 ? "…" : ""}`);
        return;
      }
      const r = await fetch("/api/admin/cms/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as {
        data?: NavPayload;
        meta?: { hasDraft?: boolean };
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      applyNavigationResponse(j);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save did not complete");
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch("/api/admin/cms/navigation/publish", { method: "POST" });
      const j = (await r.json()) as {
        data?: NavPayload;
        meta?: { hasDraft?: boolean };
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      applyNavigationResponse(j);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish did not complete");
    } finally {
      setPublishing(false);
    }
  };

  const headerIds = nav.headerLinks.map((h) => h.hid);
  const mobileIds = nav.headerLinksMobile.map((l) => l.lid);
  const footerBottomIds = nav.footerBottomLinks.map((l) => l.lid);
  const colIds = nav.footerColumns.map((c) => c.cid);
  const socialIds = nav.socialLinks.map((s) => s.sid);

  if (status === "loading") return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="max-w-5xl space-y-10">
      <p className="text-sm text-slate-600">
        Drag <strong>::</strong> handles to reorder header links, mobile header strip, footer bottom
        row, footer columns, links inside a column, and social icons. Save a <strong>draft</strong> to
        stage changes, then <strong>publish draft</strong> to copy the draft to the live storefront
        navigation, or use <strong>save to live</strong> to write the editor state directly to live
        and clear any draft.
      </p>
      {hasDraft ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A navigation draft exists. Publish it to update live navigation, or save to live to replace
          live from this editor and discard the draft.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="text-sm text-green-700">Saved.</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-headline text-base font-bold text-primary">Header navigation</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={!canWrite}
              onClick={() =>
                setNav((n) => ({
                  ...n,
                  headerLinks: [
                    ...n.headerLinks,
                    { href: "/", label: "New link", hid: newDragId(), children: [] },
                  ],
                }))
              }
            >
              + Add header link
            </button>
          </div>
          <SortableContext items={headerIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {nav.headerLinks.map((link, i) => (
                <SortableHeaderRow
                  key={link.hid}
                  id={link.hid}
                  link={link}
                  disabled={!canWrite}
                  onChange={(l) =>
                    setNav((n) => {
                      const headerLinks = [...n.headerLinks];
                      headerLinks[i] = l;
                      return { ...n, headerLinks };
                    })
                  }
                  onRemove={() =>
                    setNav((n) => ({
                      ...n,
                      headerLinks: n.headerLinks.filter((_, j) => j !== i),
                    }))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-headline text-base font-bold text-primary">Mobile header links</h3>
              <p className="mt-1 text-xs text-slate-500">
                Optional. When empty, the storefront falls back to the desktop header list.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={!canWrite}
              onClick={() =>
                setNav((n) => ({
                  ...n,
                  headerLinksMobile: [
                    ...n.headerLinksMobile,
                    { href: "/", label: "New link", lid: newDragId() },
                  ],
                }))
              }
            >
              + Add mobile link
            </button>
          </div>
          <SortableContext items={mobileIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {nav.headerLinksMobile.map((link, i) => (
                <SortableFooterLinkRow
                  key={link.lid}
                  id={link.lid}
                  colIndex={0}
                  dragAriaLabel="Drag mobile header link"
                  link={link}
                  disabled={!canWrite}
                  onChange={(l) =>
                    setNav((n) => {
                      const headerLinksMobile = [...n.headerLinksMobile];
                      headerLinksMobile[i] = l;
                      return { ...n, headerLinksMobile };
                    })
                  }
                  onRemove={() =>
                    setNav((n) => ({
                      ...n,
                      headerLinksMobile: n.headerLinksMobile.filter((_, j) => j !== i),
                    }))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-headline text-base font-bold text-primary">Footer bottom row</h3>
              <p className="mt-1 text-xs text-slate-500">
                Small links below the main footer columns (legal, policies, etc.).
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={!canWrite}
              onClick={() =>
                setNav((n) => ({
                  ...n,
                  footerBottomLinks: [
                    ...n.footerBottomLinks,
                    { href: "/", label: "New link", lid: newDragId() },
                  ],
                }))
              }
            >
              + Add bottom link
            </button>
          </div>
          <SortableContext items={footerBottomIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {nav.footerBottomLinks.map((link, i) => (
                <SortableFooterLinkRow
                  key={link.lid}
                  id={link.lid}
                  colIndex={0}
                  dragAriaLabel="Drag footer bottom link"
                  link={link}
                  disabled={!canWrite}
                  onChange={(l) =>
                    setNav((n) => {
                      const footerBottomLinks = [...n.footerBottomLinks];
                      footerBottomLinks[i] = l;
                      return { ...n, footerBottomLinks };
                    })
                  }
                  onRemove={() =>
                    setNav((n) => ({
                      ...n,
                      footerBottomLinks: n.footerBottomLinks.filter((_, j) => j !== i),
                    }))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-headline text-base font-bold text-primary">Footer columns</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={!canWrite}
              onClick={() =>
                setNav((n) => ({
                  ...n,
                  footerColumns: [
                    ...n.footerColumns,
                    {
                      cid: newDragId(),
                      title: "New column",
                      links: [{ href: "/", label: "Link", lid: newDragId() }],
                    },
                  ],
                }))
              }
            >
              + Add column
            </button>
          </div>
          <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
            <div className="grid gap-4 md:grid-cols-2">
              {nav.footerColumns.map((col, ci) => (
                <SortableFooterColumnCard
                  key={col.cid}
                  colIndex={ci}
                  column={col}
                  disabled={!canWrite}
                  onChangeColumn={(c) =>
                    setNav((n) => {
                      const footerColumns = [...n.footerColumns];
                      footerColumns[ci] = c;
                      return { ...n, footerColumns };
                    })
                  }
                  onRemoveColumn={() =>
                    setNav((n) => ({
                      ...n,
                      footerColumns: n.footerColumns.filter((_, j) => j !== ci),
                    }))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-headline text-base font-bold text-primary">Social links</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              disabled={!canWrite}
              onClick={() =>
                setNav((n) => ({
                  ...n,
                  socialLinks: [
                    ...n.socialLinks,
                    {
                      href: "https://",
                      label: "Social",
                      network: "",
                      sid: newDragId(),
                    },
                  ],
                }))
              }
            >
              + Add social link
            </button>
          </div>
          <SortableContext items={socialIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {nav.socialLinks.map((link, i) => (
                <SortableSocialRow
                  key={link.sid}
                  id={link.sid}
                  link={link}
                  disabled={!canWrite}
                  onChange={(l) =>
                    setNav((n) => {
                      const socialLinks = [...n.socialLinks];
                      socialLinks[i] = l;
                      return { ...n, socialLinks };
                    })
                  }
                  onRemove={() =>
                    setNav((n) => ({
                      ...n,
                      socialLinks: n.socialLinks.filter((_, j) => j !== i),
                    }))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </section>
      </DndContext>

      <div className="border-t border-slate-200 pt-6">
        <button
          type="button"
          className="text-sm font-medium text-slate-600 underline"
          onClick={() => setShowAdvancedJson((v) => !v)}
        >
          {showAdvancedJson ? "Hide" : "Show"} advanced JSON (import / power users)
        </button>
        {showAdvancedJson ? (
          <textarea
            className="mt-3 w-full min-h-[240px] rounded-lg border border-slate-200 p-4 font-mono text-sm"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canWrite || saving || publishing}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          onClick={() => void saveDraft()}
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={!canWrite || saving || publishing}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void saveLive()}
        >
          {saving ? "Saving…" : "Save to live"}
        </button>
        <button
          type="button"
          disabled={!canPublish || !hasDraft || saving || publishing}
          className="rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          onClick={() => void publishDraft()}
        >
          {publishing ? "Publishing…" : "Publish draft to live"}
        </button>
      </div>
    </div>
  );
}
