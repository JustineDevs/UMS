import { addSelectorState, getSelectorForElement, type SelectorElement } from "./style-selector";

export type StyleElement = SelectorElement & { style: Record<string, string> };
export type Breakpoint = "none" | "sm" | "md" | "lg" | "xl" | "xxl";
export type StyleBuckets = Record<Breakpoint, Record<string, Record<string, string>>>;
export type StyleTheme = "light" | "dark" | null;

export class StyleManager {
  readonly breakpoints: Record<Exclude<Breakpoint, "none">, string> = { sm: "575.98px", md: "767.98px", lg: "991.98px", xl: "1199.98px", xxl: "1399.98px" };
  readonly styles: StyleBuckets = { none: {}, sm: {}, md: {}, lg: {}, xl: {}, xxl: {} };
  currentBreakpoint: Breakpoint = "none";
  state = "";
  theme: StyleTheme = null;
  themeMode: "attribute" | "media" = "attribute";
  inlineCSS = false;
  cssText = "";

  setStyle(element: StyleElement | string, property: string, value: string): StyleElement | string {
    if (typeof element !== "string" && element.style[property]) { element.style[property] = value; return element; }
    if (this.inlineCSS && typeof element !== "string") { element.style[property] = value; return element; }
    const selector = addSelectorState(this.getSelector(element), this.state);
    (this.styles[this.currentBreakpoint][selector] ??= {})[property] = value;
    this.cssText = this.generateCss();
    return element;
  }

  getStyle(element: StyleElement, property: string, computed?: (_element: StyleElement, _property: string) => string): string {
    if (element.style[property]) return element.style[property];
    const selector = addSelectorState(this.getSelector(element), this.state);
    return this.styles[this.currentBreakpoint][selector]?.[property] ?? computed?.(element, property) ?? "";
  }

  setState(state: string): void {
    this.state = state;
  }

  setTheme(theme: StyleTheme = null): void {
    this.theme = theme;
    this.cssText = this.generateCss();
  }

  private getSelector(element: StyleElement | string): string {
    const selector = typeof element === "string" ? element : getSelectorForElement(element);
    return this.themeMode === "attribute" && (this.theme === "light" || this.theme === "dark")
      ? `[data-bs-theme="${this.theme}"] ${selector}`
      : selector;
  }

  generateCss(): string {
    let css = "";
    for (const media of Object.keys(this.styles) as Breakpoint[]) {
      let mediaQuery = "";
      if (this.themeMode === "media" && (this.theme === "light" || this.theme === "dark")) {
        mediaQuery = `(prefers-color-scheme: ${this.theme})`;
      }
      if (media !== "none") {
        mediaQuery += `${mediaQuery ? " and " : ""}(max-width: ${this.breakpoints[media]})`;
      }
      if (mediaQuery) css += `@media ${mediaQuery}{\n\n`;
      for (const [selector, properties] of Object.entries(this.styles[media])) {
        css += `${selector} {\n`;
        for (const [property, value] of Object.entries(properties)) css += `\t${property}: ${value};\n`;
        css += "}\n\n";
      }
      if (mediaQuery) css += "}\n\n";
    }
    return css;
  }
}
