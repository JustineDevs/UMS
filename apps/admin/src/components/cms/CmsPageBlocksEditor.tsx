"use client";

import type { CmsBlock, CmsPageBlockPresetRow } from "@universal-music-store/platform-data";
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

const BLOCK_TYPES = [
  { type: "hero", label: "Hero banner" },
  { type: "rich_text", label: "Rich text" },
  { type: "image", label: "Image" },
  { type: "cta_row", label: "Button (CTA)" },
  { type: "divider", label: "Divider (spacing)" },
  { type: "two_column", label: "Two column (image + HTML)" },
  { type: "faq", label: "FAQ accordion" },
  { type: "video", label: "Video (YouTube or file URL)" },
  { type: "trust_strip", label: "Trust strip (3 columns)" },
  { type: "contact_strip", label: "Contact strip" },
  { type: "newsletter", label: "Newsletter signup" },
  { type: "featured_products", label: "Featured products (slugs)" },
] as const;

function newBlockId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneBlocksWithNewIds(blocks: CmsBlock[]): CmsBlock[] {
  return blocks.map((b) => ({
    ...b,
    id: newBlockId(),
    props: { ...b.props },
  }));
}

function defaultPropsForType(type: string): Record<string, unknown> {
  switch (type) {
    case "hero":
      return {
        title: "",
        subtitle: "",
        imageUrl: "",
        href: "",
        ctaLabel: "Learn more",
      };
    case "rich_text":
      return { html: "<p></p>" };
    case "image":
      return { src: "", alt: "" };
    case "cta_row":
      return { label: "Continue", href: "/" };
    case "divider":
      return { heightPx: 24 };
    case "two_column":
      return { html: "<p></p>", imageUrl: "", imageAlt: "", reverse: false };
    case "faq":
      return { items: [{ q: "Question?", a: "<p>Answer.</p>" }] };
    case "video":
      return { url: "", title: "Video" };
    case "trust_strip":
      return {
        col1Title: "Secure checkout",
        col1Body: "",
        col2Title: "Shipping",
        col2Body: "",
        col3Title: "Returns",
        col3Body: "",
      };
    case "contact_strip":
      return { phone: "", email: "", hours: "" };
    case "newsletter":
      return { heading: "Newsletter", subtitle: "", actionUrl: "" };
    case "featured_products":
      return { slugs: "" };
    default:
      return {};
  }
}

function parseFaqItemsEditor(raw: unknown): { q: string; a: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ q: "", a: "" }];
  const out: { q: string; a: string }[] = [];
  for (const x of raw) {
    if (x && typeof x === "object") {
      const r = x as Record<string, unknown>;
      out.push({ q: String(r.q ?? ""), a: String(r.a ?? "") });
    }
  }
  return out.length ? out : [{ q: "", a: "" }];
}

function SortableBlockRow({
  block,
  onChange,
  onRemove,
  disabled,
}: {
  block: CmsBlock;
  onChange: (_b: CmsBlock) => void;
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
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const setProp = (key: string, value: string) => {
    onChange({
      ...block,
      props: { ...block.props, [key]: value },
    });
  };

  const setPropNum = (key: string, value: number) => {
    onChange({
      ...block,
      props: { ...block.props, [key]: value },
    });
  };

  const setPropBool = (key: string, value: boolean) => {
    onChange({
      ...block,
      props: { ...block.props, [key]: value },
    });
  };

  const faqItems = parseFaqItemsEditor(block.props.items);
  const setFaqItems = (items: { q: string; a: string }[]) => {
    onChange({ ...block, props: { ...block.props, items } });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-slate-200 bg-slate-50/80 p-4 ${
        isDragging ? "z-10 opacity-90 shadow-lg ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 touch-none hover:bg-slate-100 disabled:opacity-40"
          disabled={disabled}
          aria-label="Drag to reorder block"
          {...attributes}
          {...listeners}
        >
          <span className="text-lg leading-none" aria-hidden>
            ::
          </span>
        </button>
        <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {block.type.replace(/_/g, " ")}
        </span>
        <button
          type="button"
          disabled={disabled}
          className="ml-auto text-xs font-medium text-red-600 hover:underline"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>

      {block.type === "hero" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Title
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.title ?? "")}
              onChange={(e) => setProp("title", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Subtitle
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.subtitle ?? "")}
              onChange={(e) => setProp("subtitle", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Image URL
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.imageUrl ?? "")}
              onChange={(e) => setProp("imageUrl", e.target.value)}
              disabled={disabled}
              placeholder="https://"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Button link
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.href ?? "")}
              onChange={(e) => setProp("href", e.target.value)}
              disabled={disabled}
              placeholder="/shop"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Button label
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.ctaLabel ?? "Learn more")}
              onChange={(e) => setProp("ctaLabel", e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}

      {block.type === "rich_text" ? (
        <label className="block text-xs font-medium text-slate-600">
          HTML content
          <textarea
            className="mt-1 w-full min-h-[100px] rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm"
            value={String(block.props.html ?? "")}
            onChange={(e) => setProp("html", e.target.value)}
            disabled={disabled}
          />
        </label>
      ) : null}

      {block.type === "image" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Image URL
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.src ?? "")}
              onChange={(e) => setProp("src", e.target.value)}
              disabled={disabled}
              placeholder="https://"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Alt text
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.alt ?? "")}
              onChange={(e) => setProp("alt", e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}

      {block.type === "cta_row" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Label
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.label ?? "")}
              onChange={(e) => setProp("label", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Link
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.href ?? "")}
              onChange={(e) => setProp("href", e.target.value)}
              disabled={disabled}
              placeholder="/shop"
            />
          </label>
        </div>
      ) : null}

      {block.type === "divider" ? (
        <label className="block text-xs font-medium text-slate-600">
          Vertical spacing (px)
          <input
            type="number"
            min={0}
            className="mt-1 w-32 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
            value={Number(block.props.heightPx ?? 24)}
            onChange={(e) => setPropNum("heightPx", Number(e.target.value) || 0)}
            disabled={disabled}
          />
        </label>
      ) : null}

      {block.type === "two_column" ? (
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(block.props.reverse)}
              onChange={(e) => setPropBool("reverse", e.target.checked)}
              disabled={disabled}
            />
            Reverse column order on desktop (image on right)
          </label>
          <label className="block text-xs font-medium text-slate-600">
            HTML column
            <textarea
              className="mt-1 w-full min-h-[100px] rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm"
              value={String(block.props.html ?? "")}
              onChange={(e) => setProp("html", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Image URL
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.imageUrl ?? "")}
              onChange={(e) => setProp("imageUrl", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Image alt
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.imageAlt ?? "")}
              onChange={(e) => setProp("imageAlt", e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}

      {block.type === "faq" ? (
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div key={i} className="rounded border border-slate-200 bg-white p-3">
              <label className="block text-xs font-medium text-slate-600">
                Question
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  value={item.q}
                  onChange={(e) => {
                    const next = [...faqItems];
                    next[i] = { ...item, q: e.target.value };
                    setFaqItems(next);
                  }}
                  disabled={disabled}
                />
              </label>
              <label className="mt-2 block text-xs font-medium text-slate-600">
                Answer (HTML)
                <textarea
                  className="mt-1 w-full min-h-[72px] rounded border border-slate-200 px-2 py-1.5 font-mono text-sm"
                  value={item.a}
                  onChange={(e) => {
                    const next = [...faqItems];
                    next[i] = { ...item, a: e.target.value };
                    setFaqItems(next);
                  }}
                  disabled={disabled}
                />
              </label>
              <button
                type="button"
                className="mt-2 text-xs text-red-600 hover:underline"
                disabled={disabled || faqItems.length <= 1}
                onClick={() => setFaqItems(faqItems.filter((_, j) => j !== i))}
              >
                Remove pair
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            disabled={disabled}
            onClick={() => setFaqItems([...faqItems, { q: "", a: "" }])}
          >
            + Add FAQ item
          </button>
        </div>
      ) : null}

      {block.type === "video" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Video URL (YouTube watch URL or direct .mp4 / .webm)
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.url ?? "")}
              onChange={(e) => setProp("url", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Title (iframe / accessibility)
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.title ?? "Video")}
              onChange={(e) => setProp("title", e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}

      {block.type === "trust_strip" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="space-y-2 rounded border border-slate-200 bg-white p-2">
              <label className="block text-xs font-medium text-slate-600">
                Column {n} title
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  value={String(block.props[`col${n}Title`] ?? "")}
                  onChange={(e) => setProp(`col${n}Title`, e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Column {n} body
                <textarea
                  className="mt-1 w-full min-h-[60px] rounded border border-slate-200 px-2 py-1 text-sm"
                  value={String(block.props[`col${n}Body`] ?? "")}
                  onChange={(e) => setProp(`col${n}Body`, e.target.value)}
                  disabled={disabled}
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}

      {block.type === "contact_strip" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Phone
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.phone ?? "")}
              onChange={(e) => setProp("phone", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Email
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              onChange={(e) => setProp("email", e.target.value)}
              value={String(block.props.email ?? "")}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            Hours / note
            <textarea
              className="mt-1 w-full min-h-[60px] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.hours ?? "")}
              onChange={(e) => setProp("hours", e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
      ) : null}

      {block.type === "newsletter" ? (
        <div className="grid gap-3">
          <label className="block text-xs font-medium text-slate-600">
            Heading
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.heading ?? "")}
              onChange={(e) => setProp("heading", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Subtitle
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.subtitle ?? "")}
              onChange={(e) => setProp("subtitle", e.target.value)}
              disabled={disabled}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Form action URL
            <input
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(block.props.actionUrl ?? "")}
              onChange={(e) => setProp("actionUrl", e.target.value)}
              disabled={disabled}
              placeholder="https://"
            />
          </label>
        </div>
      ) : null}

      {block.type === "featured_products" ? (
        <label className="block text-xs font-medium text-slate-600">
          Product handles (comma or space separated, max 8)
          <textarea
            className="mt-1 w-full min-h-[72px] rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm"
            value={String(block.props.slugs ?? "")}
            onChange={(e) => setProp("slugs", e.target.value)}
            disabled={disabled}
            placeholder="classic-tee, summer-hat"
          />
        </label>
      ) : null}

      {!KNOWN_BLOCK_TYPES.has(block.type) ? (
        <p className="text-xs text-amber-800">
          Block type <code className="rounded bg-amber-50 px-1">{block.type}</code> has no visual
          form. Remove it or edit under &quot;Advanced: blocks JSON&quot; on this page.
        </p>
      ) : null}
    </div>
  );
}

function normalizeBlocks(raw: unknown): CmsBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const id =
      typeof r.id === "string" && r.id.trim()
        ? r.id
        : newBlockId();
    const type = typeof r.type === "string" ? r.type : "rich_text";
    const props =
      r.props && typeof r.props === "object" && r.props !== null
        ? (r.props as Record<string, unknown>)
        : {};
    return { id, type, props };
  });
}

const KNOWN_BLOCK_TYPES = new Set(BLOCK_TYPES.map((t) => t.type as string));

export function CmsPageBlocksEditor({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (_blocks: CmsBlock[]) => void;
  disabled: boolean;
}) {
  const blocks = normalizeBlocks(value);
  const [presets, setPresets] = useState<CmsPageBlockPresetRow[]>([]);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const refreshPresets = useCallback(() => {
    void fetch("/api/admin/cms/block-presets")
      .then(async (r) => {
        const j = (await r.json()) as { data?: CmsPageBlockPresetRow[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        setPresets(Array.isArray(j.data) ? j.data : []);
      })
      .catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(blocks, oldIndex, newIndex));
    },
    [blocks, onChange],
  );

  const addBlock = (type: string) => {
    const t = BLOCK_TYPES.find((x) => x.type === type)?.type ?? "rich_text";
    onChange([
      ...blocks,
      { id: newBlockId(), type: t, props: defaultPropsForType(t) },
    ]);
  };

  const updateBlock = (index: number, b: CmsBlock) => {
    const next = [...blocks];
    next[index] = b;
    onChange(next);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const appendPresetBlocks = () => {
    const row = presets.find((p) => p.id === selectedPresetId);
    if (!row?.blocks?.length) {
      setPresetMessage("Choose a preset with blocks.");
      return;
    }
    setPresetMessage(null);
    onChange([...blocks, ...cloneBlocksWithNewIds(row.blocks)]);
  };

  const saveCurrentAsPreset = async () => {
    const name = presetName.trim();
    if (!name) {
      setPresetMessage("Enter a preset name.");
      return;
    }
    if (!blocks.length) {
      setPresetMessage("Add at least one block before saving a preset.");
      return;
    }
    setPresetMessage(null);
    const r = await fetch("/api/admin/cms/block-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, blocks }),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setPresetMessage(j.error ?? "Could not save preset");
      return;
    }
    setPresetName("");
    refreshPresets();
    setPresetMessage("Preset saved.");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-700">Block presets</p>
        <p className="mt-1 text-xs text-slate-500">
          Save the current stack as a reusable preset, or append a preset below your existing
          blocks (new IDs are generated).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            Preset
            <select
              className="mt-1 block min-w-[200px] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              disabled={disabled}
            >
              <option value="">Select…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={disabled || !selectedPresetId}
            onClick={appendPresetBlocks}
          >
            Append to page
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <label className="text-xs font-medium text-slate-600">
            New preset name
            <input
              className="mt-1 block w-56 rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              disabled={disabled}
              placeholder="e.g. Legal bundle"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            disabled={disabled}
            onClick={() => void saveCurrentAsPreset()}
          >
            Save current blocks as preset
          </button>
          <button
            type="button"
            className="text-xs text-slate-600 underline"
            onClick={() => void refreshPresets()}
          >
            Refresh list
          </button>
        </div>
        {presetMessage ? <p className="mt-2 text-xs text-slate-600">{presetMessage}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Add block:</span>
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            disabled={disabled}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => addBlock(t.type)}
          >
            + {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Drag the handle to reorder. These blocks render on the live site below the page body.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {blocks.map((b, i) => (
              <SortableBlockRow
                key={b.id}
                block={b}
                disabled={disabled}
                onChange={(nb) => updateBlock(i, nb)}
                onRemove={() => removeBlock(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
          No blocks yet. Add a block above or append a preset.
        </p>
      ) : null}
    </div>
  );
}
