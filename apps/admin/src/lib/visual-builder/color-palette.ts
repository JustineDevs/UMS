export type PaletteVariableType = "font" | "color" | "dimensions";

export type PaletteVariable = {
  value: string;
  type: PaletteVariableType;
  friendlyName: string;
};

export type CssStyleDeclarationLike = {
  length: number;
  [index: number]: string;
  getPropertyValue(name: string): string;
};

export type CssRuleLike = {
  selectorText?: string;
  style?: CssStyleDeclarationLike;
};

export type CssStyleSheetLike = {
  cssRules: ArrayLike<CssRuleLike>;
};

export type ColorPalette = Record<PaletteVariableType, Record<string, PaletteVariable>>;

export function getAllCSSVariableNames(
  styleSheets: Iterable<CssStyleSheetLike>,
  selector?: string,
): ColorPalette {
  const cssVars: ColorPalette = { font: {}, color: {}, dimensions: {} };

  for (const styleSheet of styleSheets) {
    for (let ruleIndex = 0; ruleIndex < styleSheet.cssRules.length; ruleIndex += 1) {
      const rule = styleSheet.cssRules[ruleIndex];
      if (!rule || (selector && rule.selectorText && rule.selectorText !== selector) || !rule.style) continue;

      for (let propertyIndex = 0; propertyIndex < rule.style.length; propertyIndex += 1) {
        const name = rule.style[propertyIndex];
        const value = rule.style.getPropertyValue(name).trim();
        const type = classifyCssVariable(name, value);
        if (!type) continue;

        cssVars[type][name] = {
          value,
          type,
          friendlyName: name.replace("--bs-", "").replaceAll("-", " "),
        };
      }
    }
  }

  return cssVars;
}

function classifyCssVariable(name: string, value: string): PaletteVariableType | undefined {
  if (!name.startsWith("--") || name.endsWith("-rgb") || value.startsWith("var(")) return undefined;
  if (value.startsWith("#")) return "color";
  if (value.includes('"') || value.includes("'")) return "font";
  if (value.endsWith("em") || value.endsWith("px") || !Number.isNaN(Number.parseFloat(value))) return "dimensions";
  return undefined;
}
