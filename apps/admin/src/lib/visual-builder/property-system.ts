import type { ComponentDefinition } from "./component-registry";

export type PropertySection = "content" | "style" | "advanced";
export type PropertyDefinition = {
  key: string;
  label: string;
  section?: PropertySection;
  htmlAttr?: string;
  defaultValue?: unknown;
  validValues?: readonly string[];
};

export type EditableElement = {
  innerHTML: string;
  textContent: string | null;
  outerHTML: string;
  style: Record<string, string>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  classList: { add(...names: string[]): void; remove(...names: string[]): void };
};

export type PropertyMutation = {
  type: "attributes" | "style";
  attributeName: string;
  oldValue: unknown;
  newValue: unknown;
};

export abstract class Input<T> extends EventTarget {
  value: T | undefined;
  constructor(initial?: T) { super(); this.value = initial; }
  setValue(value: T | undefined): void { this.value = value; }
  change(value: T): void {
    this.value = value;
    this.dispatchEvent(new CustomEvent("propertyChange", { detail: { value, input: this } }));
  }
}

export class TextInput extends Input<string> {}
export class TextareaInput extends Input<string> {}
export class CheckboxInput extends Input<boolean> {}
export class SelectInput extends Input<string> {}

export type PropertyControl = { property: PropertyDefinition; input: Input<unknown> };

export function renderPropertyPanel(
  component: Pick<ComponentDefinition, "name"> & { properties?: readonly PropertyDefinition[] },
): { title: string; sections: Record<PropertySection, PropertyControl[]> } {
  const sections: Record<PropertySection, PropertyControl[]> = { content: [], style: [], advanced: [] };
  for (const property of component.properties ?? []) {
    const input = new TextInput(property.defaultValue === undefined ? undefined : String(property.defaultValue)) as Input<unknown>;
    sections[property.section ?? "content"].push({ property, input });
  }
  return { title: component.name ?? "", sections };
}

export function applyPropertyChange(
  element: EditableElement,
  property: PropertyDefinition,
  value: unknown,
  setStyle: (element: EditableElement, key: string, value: string) => void = (target, key, next) => { target.style[key] = next; },
): PropertyMutation {
  const next = value === null || value === undefined ? "" : String(value);
  const htmlAttr = property.htmlAttr;
  if (htmlAttr === "class" && property.validValues) {
    const oldValue = element.getAttribute("class");
    element.classList.remove(...property.validValues);
    if (next) element.classList.add(...next.split(" "));
    return { type: "attributes", attributeName: htmlAttr, oldValue, newValue: next };
  }
  if (htmlAttr === "style") {
    const oldValue = element.style[property.key] ?? "";
    setStyle(element, property.key, next);
    return { type: "style", attributeName: htmlAttr, oldValue, newValue: next };
  }
  if (htmlAttr === "innerHTML") {
    const oldValue = element.innerHTML;
    element.innerHTML = next;
    return { type: "attributes", attributeName: htmlAttr, oldValue, newValue: next };
  }
  if (htmlAttr === "innerText") {
    const oldValue = element.textContent ?? "";
    element.textContent = next;
    return { type: "attributes", attributeName: htmlAttr, oldValue, newValue: next };
  }
  const oldValue = htmlAttr ? element.getAttribute(htmlAttr) : undefined;
  if (htmlAttr) next ? element.setAttribute(htmlAttr, next) : element.removeAttribute(htmlAttr);
  return { type: "attributes", attributeName: htmlAttr ?? property.key, oldValue, newValue: next };
}

export type PaletteItem = { type: string; name: string; image?: string };
export function renderPaletteGroups<T extends PaletteItem>(groups: Readonly<Record<string, readonly string[]>>, items: ReadonlyMap<string, T>) {
  return Object.entries(groups).map(([name, types]) => ({ name, items: types.flatMap((type) => { const item = items.get(type); return item ? [item] : []; }) }));
}
