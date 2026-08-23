import type { PaletteGroup, PaletteGroups, Registry } from "./registry";

export type PaletteDefinition = { type: string; name: string; image?: string; markup?: string };
export type PaletteDom = {
  createElement(tag: "section" | "h3" | "ul" | "li"): PaletteDomElement;
};
export type PaletteDomElement = {
  className: string;
  textContent: string;
  draggable: boolean;
  dataset: Record<string, string>;
  append(...children: PaletteDomElement[]): void;
  addEventListener(type: "dragstart", listener: (event: { dataTransfer?: { setData(type: string, value: string): void } }) => void): void;
};

export function paletteGroupsFromRegistry(
  groups: PaletteGroups,
  registry: Registry<PaletteDefinition>,
): PaletteGroup<PaletteDefinition>[] {
  return Object.entries(groups).map(([name, types]) => ({ name, items: registry.values(types) }));
}

/** Mirrors visual builder's draggable component palette (builder.js:930+). */
export function renderPalette(
  groups: readonly PaletteGroup<PaletteDefinition>[],
  dom: PaletteDom,
  onDragStart?: (type: string) => void,
): PaletteDomElement {
  const root = dom.createElement("section");
  root.className = "uvs-palette";
  groups.forEach((group) => {
    const section = dom.createElement("section");
    section.className = "uvs-palette-group";
    const heading = dom.createElement("h3"); heading.textContent = group.name; section.append(heading);
    const list = dom.createElement("ul");
    group.items.forEach((item) => {
      const entry = dom.createElement("li");
      entry.className = "uvs-palette-item"; entry.textContent = item.name; entry.draggable = true; entry.dataset.component = item.type;
      entry.addEventListener("dragstart", (event) => { event.dataTransfer?.setData("application/x-uvs-component", item.type); onDragStart?.(item.type); });
      list.append(entry);
    });
    section.append(list); root.append(section);
  });
  return root;
}
