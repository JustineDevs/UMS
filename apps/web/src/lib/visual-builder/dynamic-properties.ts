import type { ColorPalette, PaletteVariableType } from "./color-palette";
import type { PropertyDefinition } from "./property-system";

export type DynamicProperty = PropertyDefinition & {
  name: string;
  data: { selector: string; type: PaletteVariableType; step: "any" };
  defaultValue: string;
};

export function generateCssVariableProperties(palette: ColorPalette): DynamicProperty[] {
  const properties: DynamicProperty[] = [];
  let index = 0;
  for (const type of ["font", "color", "dimensions"] as const) {
    properties.push({ key: `cssVars${type}`, label: type[0].toUpperCase() + type.slice(1), name: type, section: "advanced", defaultValue: "", data: { selector: "", type, step: "any" } });
    for (const [selector, variable] of Object.entries(palette[type])) {
      index += 1;
      const friendlyName = selector.replaceAll("--bs-", "").replaceAll("-", " ").trim();
      properties.push({ key: `cssvar${index}`, label: friendlyName[0]?.toUpperCase() + friendlyName.slice(1), name: friendlyName, section: "advanced", defaultValue: variable.value, data: { selector, type, step: "any" } });
    }
  }
  return properties;
}
