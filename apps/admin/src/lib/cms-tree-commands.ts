import {
  getCmsComponentDefinition,
  type CmsBlock,
  type CmsComponentInstance,
} from "@universal-music-store/platform-data";

export type CmsMutation =
  | { type: "set-prop" | "set-style"; nodeId: string; key: string; before?: unknown; after?: unknown }
  | { type: "set-attribute" | "set-text" | "set-html"; nodeId: string; key?: string; before?: unknown; after?: unknown }
  | {
      type: "insert" | "remove" | "move";
      nodeId?: string;
      parentId?: string | null;
      beforeParentId?: string | null;
      slot?: string;
      beforeSlot?: string | null;
      index?: number;
      beforeIndex?: number;
      node?: CmsBlock | CmsComponentInstance;
    };
export type CmsCommandState = { before: CmsBlock[]; after: CmsBlock[]; mutation?: CmsMutation };
export type CmsHistory = { past: CmsCommandState[]; future: CmsCommandState[] };

export function createCmsHistory(): CmsHistory {
  return { past: [], future: [] };
}

export function recordCmsCommand(history: CmsHistory, before: CmsBlock[], after: CmsBlock[], mutation?: CmsMutation, limit = 100): CmsHistory {
  return { past: [...history.past, { before, after, mutation: enrichStructuralMutation(before, after, mutation) }].slice(-limit), future: [] };
}

export function undoCmsCommand(history: CmsHistory, current: CmsBlock[]) {
  const command = history.past.at(-1);
  if (!command) return { state: current, history };
  const state = command.mutation ? applyCmsMutation(current, command.mutation, "before") : null;
  return command
    ? { state: state ?? command.before, history: { past: history.past.slice(0, -1), future: [...history.future, { before: command.before, after: current, mutation: command.mutation }] } }
    : { state: current, history };
}

export function redoCmsCommand(history: CmsHistory, current: CmsBlock[]) {
  const command = history.future.at(-1);
  if (!command) return { state: current, history };
  const state = command.mutation ? applyCmsMutation(current, command.mutation, "after") : null;
  return command
    ? { state: state ?? command.after, history: { past: [...history.past, { before: current, after: command.after, mutation: command.mutation }], future: history.future.slice(0, -1) } }
    : { state: current, history };
}

type Location = { parentId: string | null; slot: string | null; index: number };

function findLocation(blocks: CmsBlock[], nodeId: string): Location | null {
  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index].id === nodeId) return { parentId: null, slot: null, index };
    for (const [slot, children] of Object.entries(blocks[index].slots ?? {})) {
      const found = findInstanceLocation(children, blocks[index].id, slot, nodeId);
      if (found) return found;
    }
  }
  return null;
}

function findInstanceLocation(items: CmsComponentInstance[], parentId: string, slot: string, nodeId: string): Location | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.id === nodeId) return { parentId, slot, index };
    for (const [childSlot, children] of Object.entries(item.slots ?? {})) {
      const found = findInstanceLocation(children, item.id, childSlot, nodeId);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(blocks: CmsBlock[], nodeId: string): { blocks: CmsBlock[]; node?: CmsBlock | CmsComponentInstance; location?: Location } {
  const rootIndex = blocks.findIndex((block) => block.id === nodeId);
  if (rootIndex >= 0) return { blocks: blocks.filter((_, index) => index !== rootIndex), node: blocks[rootIndex], location: { parentId: null, slot: null, index: rootIndex } };
  let removed: CmsComponentInstance | undefined;
  let location: Location | undefined;
  const next = blocks.map((block) => ({
    ...block,
    slots: Object.fromEntries(Object.entries(block.slots ?? {}).map(([slot, children]) => {
      const result = removeInstanceNode(children, block.id, slot, nodeId);
      if (result.node) { removed = result.node; location = result.location; }
      return [slot, result.items];
    })),
  }));
  return { blocks: removed && location ? next : blocks, node: removed, location };
}

function removeInstanceNode(items: CmsComponentInstance[], parentId: string, slot: string, nodeId: string): { items: CmsComponentInstance[]; node?: CmsComponentInstance; location?: Location } {
  const index = items.findIndex((item) => item.id === nodeId);
  if (index >= 0) return { items: items.filter((_, candidate) => candidate !== index), node: items[index], location: { parentId, slot, index } };
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    for (const [childSlot, children] of Object.entries(item.slots ?? {})) {
      const result = removeInstanceNode(children, item.id, childSlot, nodeId);
      if (result.node) return { items: items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, slots: { ...candidate.slots, [childSlot]: result.items } } : candidate), node: result.node, location: result.location };
    }
  }
  return { items };
}

function insertNode(blocks: CmsBlock[], location: Location, node: CmsBlock | CmsComponentInstance): CmsBlock[] | null {
  const index = Math.max(0, location.index);
  if (!location.parentId) {
    const roots = [...blocks];
    roots.splice(Math.min(index, roots.length), 0, node as CmsBlock);
    return roots;
  }
  let inserted = false;
  const next = blocks.map((block) => {
    const update = (items: CmsComponentInstance[]): CmsComponentInstance[] => items.map((item) => {
      if (item.id === location.parentId) {
        const children = [...(item.slots?.[location.slot ?? ""] ?? [])];
        children.splice(Math.min(index, children.length), 0, node as CmsComponentInstance);
        inserted = true;
        return { ...item, slots: { ...item.slots, [location.slot ?? ""]: children } };
      }
      return { ...item, slots: Object.fromEntries(Object.entries(item.slots ?? {}).map(([slot, children]) => [slot, update(children)])) };
    });
    if (block.id === location.parentId) {
      const children = [...(block.slots?.[location.slot ?? ""] ?? [])];
      children.splice(Math.min(index, children.length), 0, node as CmsComponentInstance);
      inserted = true;
      return { ...block, slots: { ...block.slots, [location.slot ?? ""]: children } };
    }
    return { ...block, slots: Object.fromEntries(Object.entries(block.slots ?? {}).map(([slot, children]) => [slot, update(children)])) };
  });
  return inserted ? next : null;
}

function enrichStructuralMutation(before: CmsBlock[], after: CmsBlock[], mutation?: CmsMutation): CmsMutation | undefined {
  if (!mutation || (mutation.type !== "insert" && mutation.type !== "remove" && mutation.type !== "move")) return mutation;
  const beforeLocation = mutation.nodeId ? findLocation(before, mutation.nodeId) : null;
  const afterLocation = mutation.nodeId ? findLocation(after, mutation.nodeId) : null;
  return {
    ...mutation,
    node: mutation.node ?? (mutation.nodeId ? findNode(before, mutation.nodeId) ?? findNode(after, mutation.nodeId) : undefined),
    beforeParentId: mutation.beforeParentId ?? beforeLocation?.parentId,
    beforeSlot: mutation.beforeSlot ?? beforeLocation?.slot,
    beforeIndex: mutation.beforeIndex ?? beforeLocation?.index,
    parentId: mutation.parentId ?? afterLocation?.parentId,
    slot: mutation.slot ?? afterLocation?.slot ?? undefined,
    index: mutation.index ?? afterLocation?.index,
  };
}

export function applyCmsMutation(blocks: CmsBlock[], mutation: CmsMutation, direction: "before" | "after"): CmsBlock[] | null {
  if (mutation.type === "set-prop" || mutation.type === "set-style" || mutation.type === "set-attribute" || mutation.type === "set-text" || mutation.type === "set-html") {
    const value = direction === "before" ? mutation.before : mutation.after;
    if (value === undefined) return null;
    const setSpecialProp = (props: Record<string, unknown>) => {
      if (mutation.type === "set-attribute") {
        const attributes = { ...(props.attributes as Record<string, unknown> | undefined), [mutation.key ?? "value"]: value };
        return { ...props, attributes };
      }
      const key = mutation.key ?? (mutation.type === "set-text" ? "text" : "html");
      return { ...props, [key]: value };
    };
    const updateInstance = (node: CmsComponentInstance): CmsComponentInstance => {
      if (node.id === mutation.nodeId) {
        if (mutation.type === "set-prop") { const key = mutation.key ?? ""; return { ...node, props: key === "__props" ? value as Record<string, unknown> : { ...node.props, [key]: value } }; }
        if (mutation.type === "set-text" || mutation.type === "set-html" || mutation.type === "set-attribute") return { ...node, props: setSpecialProp(node.props) };
        const key = mutation.key ?? "";
        const styles = key === "__styles" ? value as Record<string, string> : { ...(node.styleOverrides ?? {}), [key]: String(value) };
        return { ...node, styleOverrides: styles };
      }
      return { ...node, slots: Object.fromEntries(Object.entries(node.slots ?? {}).map(([slot, children]) => [slot, children.map(updateInstance)])) };
    };
    const updateBlock = (block: CmsBlock): CmsBlock => {
      if (block.id === mutation.nodeId) {
        if (mutation.type === "set-prop") { const key = mutation.key ?? ""; return { ...block, props: key === "__props" ? value as Record<string, unknown> : { ...block.props, [key]: value } }; }
        if (mutation.type === "set-text" || mutation.type === "set-html" || mutation.type === "set-attribute") return { ...block, props: setSpecialProp(block.props) };
        const key = mutation.key ?? "";
        const styles = key === "__styles" ? value as Record<string, string> : { ...(block.styleOverrides ?? {}), [key]: String(value) };
        return { ...block, styleOverrides: styles };
      }
      return { ...block, slots: Object.fromEntries(Object.entries(block.slots ?? {}).map(([slot, children]) => [slot, children.map(updateInstance)])) };
    };
    return blocks.map(updateBlock);
  }
  const structural = mutation as Extract<CmsMutation, { type: "insert" | "remove" | "move" }>;
  const location: Location = direction === "before"
    ? { parentId: structural.beforeParentId ?? null, slot: structural.beforeSlot ?? null, index: structural.beforeIndex ?? 0 }
    : { parentId: structural.parentId ?? null, slot: structural.slot ?? null, index: structural.index ?? 0 };
  if (structural.type === "insert") {
    if (direction === "before") return structural.nodeId ? removeNode(blocks, structural.nodeId).blocks : blocks;
    return structural.node ? insertNode(blocks, location, structural.node) : null;
  }
  if (structural.type === "remove") {
    if (direction === "before") return structural.node ? insertNode(blocks, location, structural.node) : null;
    return structural.nodeId ? removeNode(blocks, structural.nodeId).blocks : blocks;
  }
  if (!structural.nodeId) return null;
  const removed = removeNode(blocks, structural.nodeId);
  return removed.node ? insertNode(removed.blocks, location, removed.node) : null;
}

function findNode(blocks: CmsBlock[], id: string): CmsBlock | CmsComponentInstance | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    const visit = (items: CmsComponentInstance[]): CmsComponentInstance | undefined => {
      for (const item of items) {
        if (item.id === id) return item;
        const nested = visit(Object.values(item.slots ?? {}).flat());
        if (nested) return nested;
      }
      return undefined;
    };
    const found = visit(Object.values(block.slots ?? {}).flat());
    if (found) return found;
  }
  return undefined;
}

function removeInstance(
  items: CmsComponentInstance[],
  id: string,
): { items: CmsComponentInstance[]; removed?: CmsComponentInstance } {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.id === id) {
      return { items: items.filter((_, itemIndex) => itemIndex !== index), removed: item };
    }
    for (const [slot, children] of Object.entries(item.slots ?? {})) {
      const result = removeInstance(children, id);
      if (result.removed) {
        return {
          items: items.map((candidate, itemIndex) =>
            itemIndex === index
              ? { ...candidate, slots: { ...candidate.slots, [slot]: result.items } }
              : candidate,
          ),
          removed: result.removed,
        };
      }
    }
  }
  return { items };
}

function insertInstance(
  items: CmsComponentInstance[],
  ownerId: string,
  slotName: string,
  child: CmsComponentInstance,
  index: number,
): { items: CmsComponentInstance[]; inserted: boolean } {
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    if (item.id === ownerId) {
      const children = [...(item.slots?.[slotName] ?? [])];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, child);
      return {
        items: items.map((candidate, candidateIndex) =>
          candidateIndex === itemIndex
            ? { ...candidate, slots: { ...candidate.slots, [slotName]: children } }
            : candidate,
        ),
        inserted: true,
      };
    }
    for (const [slot, children] of Object.entries(item.slots ?? {})) {
      const result = insertInstance(children, ownerId, slotName, child, index);
      if (result.inserted) {
        return {
          items: items.map((candidate, candidateIndex) =>
            candidateIndex === itemIndex
              ? { ...candidate, slots: { ...candidate.slots, [slot]: result.items } }
              : candidate,
          ),
          inserted: true,
        };
      }
    }
  }
  return { items, inserted: false };
}

function contains(root: CmsComponentInstance, id: string): boolean {
  return root.id === id || Object.values(root.slots ?? {}).flat().some((child) => contains(child, id));
}

export function validateCmsSlot(
  blocks: CmsBlock[], ownerId: string, slotName: string, child: CmsComponentInstance, movingId?: string,
): string | null {
  const owner = findNode(blocks, ownerId);
  if (!owner) return "Target component no longer exists.";
  const definition = getCmsComponentDefinition("componentId" in owner ? owner.componentId : owner.componentId ?? owner.type);
  if (!definition) return "The target component definition is unavailable.";
  const slot = definition?.slots.find((candidate) => candidate.name === slotName);
  if (!slot) return "The target component does not define that slot.";
  if (contains(child, ownerId)) return "A component cannot be moved into its own descendant.";
  if (slot.allowedComponentIds?.length && !slot.allowedComponentIds.includes(child.componentId)) {
    return `${definition.name} does not allow ${child.componentId} in ${slot.label}.`;
  }
  const existing = "slots" in owner ? owner.slots?.[slotName] ?? [] : [];
  if (!slot.multiple && existing.some((item) => item.id !== movingId)) return `${slot.label} accepts one component.`;
  return null;
}

export function insertCmsInstance(blocks: CmsBlock[], ownerId: string, slotName: string, child: CmsComponentInstance, index = 0) {
  const error = validateCmsSlot(blocks, ownerId, slotName, child);
  if (error) return { blocks, error };
  const add = (items: CmsComponentInstance[]) => {
    const next = [...items];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, child);
    return next;
  };
  const update = (items: CmsComponentInstance[]): CmsComponentInstance[] => items.map((item) => item.id === ownerId
    ? { ...item, slots: { ...item.slots, [slotName]: add(item.slots?.[slotName] ?? []) } }
    : { ...item, slots: Object.fromEntries(Object.entries(item.slots ?? {}).map(([slot, children]) => [slot, update(children)])) });
  const next = blocks.map((block) => block.id === ownerId
    ? { ...block, slots: { ...block.slots, [slotName]: add(block.slots?.[slotName] ?? []) } }
    : { ...block, slots: Object.fromEntries(Object.entries(block.slots ?? {}).map(([slot, children]) => [slot, update(children)])) });
  return { blocks: next, error: null };
}

export function moveCmsInstance(
  blocks: CmsBlock[],
  sourceId: string,
  targetOwnerId: string,
  slotName: string,
  index = 0,
) {
  const source = findNode(blocks, sourceId);
  if (!source || !("componentId" in source) || typeof source.componentId !== "string") return { blocks, error: "Source component no longer exists." };
  const error = validateCmsSlot(blocks, targetOwnerId, slotName, source as CmsComponentInstance, sourceId);
  if (error) return { blocks, error };
  let removed: CmsComponentInstance | undefined;
  const withoutSource = blocks.map((block) => {
    const result = removeInstance(Object.values(block.slots ?? {}).flat(), sourceId);
    if (!result.removed) return block;
    removed = result.removed;
    const slots = Object.fromEntries(
      Object.entries(block.slots ?? {}).map(([slot, children]) => {
        const next = removeInstance(children, sourceId);
        return [slot, next.removed ? next.items : children];
      }),
    );
    return { ...block, slots };
  });
  if (!removed) return { blocks, error: "Source component no longer exists." };
  let inserted = false;
  const next = withoutSource.map((block) => {
    if (block.id === targetOwnerId) {
      const children = [...(block.slots?.[slotName] ?? [])];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, removed!);
      inserted = true;
      return { ...block, slots: { ...block.slots, [slotName]: children } };
    }
    const result = insertInstance(Object.values(block.slots ?? {}).flat(), targetOwnerId, slotName, removed!, index);
    if (!result.inserted) return block;
    inserted = true;
    const slots = Object.fromEntries(
      Object.entries(block.slots ?? {}).map(([slot, children]) => {
        const inserted = insertInstance(children, targetOwnerId, slotName, removed!, index);
        return [slot, inserted.inserted ? inserted.items : children];
      }),
    );
    return { ...block, slots };
  });
  return !inserted
    ? { blocks, error: "Target component no longer exists." }
    : { blocks: next, error: null };
}
