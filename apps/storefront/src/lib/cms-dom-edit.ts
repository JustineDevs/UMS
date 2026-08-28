const editableDomStyles = new Set([
  "display", "position", "width", "height", "margin", "padding", "color",
  "background-color", "font-size", "font-weight", "border-radius", "gap",
  "align-items", "justify-content", "grid-template-columns", "min-width",
  "max-width", "min-height", "max-height", "line-height", "letter-spacing",
  "border", "box-shadow", "object-fit", "object-position", "background-size",
  "background-position",
]);

export function normalizeCmsDomStyle(property: string, value: string): string | null {
  if (!property.startsWith("style.") || value.length > 200 || /[{};]/.test(value) || /url\s*\(/i.test(value)) return null;
  const cssProperty = property.slice(6) === "font-color" ? "color" : property.slice(6);
  return editableDomStyles.has(cssProperty) ? `style.${cssProperty}` : null;
}
