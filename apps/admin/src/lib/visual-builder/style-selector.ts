export type SelectorElement = {
  parentElement: SelectorElement | null;
  tagName: string;
  id: string;
  classList: Iterable<string>;
};

export const VVWEB_DEFAULT_IGNORED_CLASSES = ["clearfix", "masonry", "has-shadow"] as const;

/** Mirrors the original builder.StyleManager.addSelectorState (builder.js:3266-3268). */
export function addSelectorState(selector: string, state: string): string {
  return selector + (state ? `:${state}` : "");
}

/** Mirrors the original builder.StyleManager.getSelectorForElement (builder.js:3218-3260). */
export function getSelectorForElement(
  element: SelectorElement | null | undefined,
  ignoredClasses: ReadonlySet<string> = new Set(VVWEB_DEFAULT_IGNORED_CLASSES),
): string {
  if (!element) return "";

  const selectors: string[] = [];
  let current: SelectorElement | null = element;

  while (current.parentElement) {
    const tag = current.tagName.toLowerCase();
    if (tag === "body" && selectors.length > 1) break;

    if (current.id) {
      selectors.push(`#${current.id}`);
      break;
    }

    const classSelector = [...current.classList]
      .filter((className) => !ignoredClasses.has(className))
      .map((className) => `.${className}`)
      .join("");
    selectors.push(classSelector || tag);
    current = current.parentElement;
  }

  return selectors.reverse().join(" > ");
}
