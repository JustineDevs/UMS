/**
 * Maps Medusa / catalog color option labels (e.g. "White", "Charcoal") to CSS colors for PDP swatches.
 * Supports raw #hex pasted in the label. Unknown labels get a stable distinct HSL so swatches never all look identical.
 */

const NAMED: Record<string, string> = {
  white: "#ffffff",
  "off-white": "#f5f5f4",
  "off white": "#f5f5f4",
  offwhite: "#f5f5f4",
  cream: "#fffdd0",
  ivory: "#fffff0",
  beige: "#d4c4a8",
  tan: "#d2b48c",
  black: "#0a0a0a",
  grey: "#9ca3af",
  gray: "#9ca3af",
  charcoal: "#374151",
  silver: "#c0c0c0",
  gold: "#d4af37",
  navy: "#1e3a5f",
  blue: "#2563eb",
  red: "#b91c1c",
  green: "#15803d",
  yellow: "#eab308",
  orange: "#ea580c",
  pink: "#db2777",
  purple: "#7c3aed",
  brown: "#78350f",
  maroon: "#7f1d1d",
  khaki: "#c3b091",
  olive: "#6b7c3f",
  burgundy: "#722f37",
  teal: "#0d9488",
  mint: "#98f5e1",
  coral: "#ff7f50",
  lavender: "#e6e6fa",
  rose: "#fecdd3",
  denim: "#1560bd",
  "light grey": "#d1d5db",
  "light gray": "#d1d5db",
  "dark grey": "#4b5563",
  "dark gray": "#4b5563",
  "heather grey": "#9ca3af",
  "heather gray": "#9ca3af",
};

function hslFromLabel(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i) * (i + 17)) % 360;
  }
  return `hsl(${h}, 38%, 48%)`;
}

/**
 * Returns a CSS color value safe for `backgroundColor` on swatch buttons.
 */
export function cssColorForVariantColorLabel(label: string): string {
  const raw = label.trim();
  if (!raw) return "#94a3b8";

  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) return raw;

  const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (NAMED[key]) return NAMED[key];

  if (key.includes("light") && (key.includes("grey") || key.includes("gray"))) {
    return "#d1d5db";
  }
  if (key.includes("dark") && (key.includes("grey") || key.includes("gray"))) {
    return "#4b5563";
  }
  if (key.includes("black")) return "#0a0a0a";
  if (key.includes("white")) return "#ffffff";
  if (key.includes("navy")) return "#1e3a5f";

  return hslFromLabel(key);
}

/** True when the swatch fill is very light (needs a visible stroke on white PDP backgrounds). */
export function swatchNeedsLightStroke(cssColor: string): boolean {
  const c = cssColor.trim().toLowerCase();
  if (c.startsWith("#")) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (c.length === 4) {
      r = parseInt(c[1] + c[1], 16);
      g = parseInt(c[2] + c[2], 16);
      b = parseInt(c[3] + c[3], 16);
    } else if (c.length >= 7) {
      r = parseInt(c.slice(1, 3), 16);
      g = parseInt(c.slice(3, 5), 16);
      b = parseInt(c.slice(5, 7), 16);
    }
    if (r || g || b) {
      const lum = (r * 299 + g * 587 + b * 114) / 1000;
      return lum >= 210;
    }
  }
  if (c.startsWith("hsl")) {
    const m = c.match(/hsl\s*\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)/);
    if (m) return Number(m[1]) >= 82;
  }
  return false;
}
