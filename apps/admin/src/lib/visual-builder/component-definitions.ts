import type { ComponentDefinition } from "./component-registry";
import { UVS_CONCRETE_COMPONENTS } from "./component-families";
import { UVS_SOURCE_CAPTURE, type CapturedSourceProperty } from "./source-capture";
import { UVS_ECOMMERCE_CAPTURE, type CapturedEcommerceProperty } from "./ecommerce-capture";

export type VisualBuilderProperty = {
  name: string;
  key: string;
  htmlAttr?: string;
  child?: string;
  inputtype: "text" | "textarea" | "select" | "checkbox" | "number" | "url" | "image";
  validValues?: readonly string[];
  options?: readonly { value: string; text: string }[];
  source: string;
};
export type VisualComponentDefinition = ComponentDefinition & {
  markup: string;
  properties: readonly VisualBuilderProperty[];
  source: string;
  sourceParity: "ported";
  sourceRegistration: string;
  fullUpdate?: boolean;
  userServerTemplate?: boolean;
  extendsType?: string;
  resizable?: boolean;
  lifecycle?: {
    init(element: HTMLElement): void;
    onChange(element: HTMLElement, key: string, value: string): boolean;
  };
};

const htmlSource = "internal/admin/Vvveb/public/js/vvvebjs/components-html.js";
const baseSource = "internal/admin/Vvveb/public/js/vvvebjs/components-common.js";
const property = (source: string, value: Omit<VisualBuilderProperty, "source">): VisualBuilderProperty => ({ ...value, source });

const lifecycle = (type: string, special?: (element: HTMLElement, key: string, value: string) => boolean): VisualComponentDefinition["lifecycle"] => ({
  init(element) { element.dataset.uvsComponent = type; },
  onChange(element, key, value) {
    if (special?.(element, key, value)) return true;
    if (key === "innerHTML") { element.innerHTML = value; return true; }
    if (key === "class") { element.className = value; return true; }
    element.setAttribute(key, value);
    return true;
  },
});

export const UVS_CORE_DEFINITIONS: readonly VisualComponentDefinition[] = [
  { type: "html/heading", name: "Heading", nodes: ["h1", "h2", "h3", "h4", "h5", "h6"], markup: "<h1>Heading</h1>", source: `${htmlSource}:27-66`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/heading\")", properties: [property(`${htmlSource}:33-62`, { name: "Size", key: "size", htmlAttr: "nodeName", inputtype: "select", options: [1, 2, 3, 4, 5, 6].map((value) => ({ value: String(value), text: `Heading ${value}` })) }), property(`${htmlSource}:66-70`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" })], lifecycle: lifecycle("html/heading", (element, key, value) => { if (key !== "size") return false; element.outerHTML = element.outerHTML.replace(/^<h[1-6]/i, `<h${value}`); return true; }) },
  { type: "html/link", name: "Link", nodes: ["a"], markup: '<a href="#" rel="noopener">Link Text</a>', source: `${htmlSource}:100-151`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/link\")", properties: [property(`${htmlSource}:112-120`, { name: "Url", key: "href", htmlAttr: "href", inputtype: "url" }), property(`${htmlSource}:122-128`, { name: "Rel", key: "rel", htmlAttr: "rel", inputtype: "text" }), property(`${htmlSource}:130-136`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" }), property(`${htmlSource}:138-151`, { name: "Target", key: "target", htmlAttr: "target", inputtype: "select" })], lifecycle: lifecycle("html/link") },
  { type: "html/image", name: "Image", nodes: ["img"], markup: '<img src="" width="200" class="img-fluid">', source: `${htmlSource}:154-199`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/image\")", resizable: true, properties: [property(`${htmlSource}:161-166`, { name: "Image", key: "src", htmlAttr: "src", inputtype: "image" }), property(`${htmlSource}:167-177`, { name: "Width", key: "width", htmlAttr: "width", inputtype: "number" }), property(`${htmlSource}:178-188`, { name: "Height", key: "height", htmlAttr: "height", inputtype: "number" }), property(`${htmlSource}:189-194`, { name: "Alt", key: "alt", htmlAttr: "alt", inputtype: "text" })], lifecycle: lifecycle("html/image") },
  { type: "html/paragraph", name: "Paragraph", nodes: ["p"], markup: "<p>Paragraph</p>", source: `${htmlSource}:300-325`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/paragraph\")", properties: [property(`${htmlSource}:306-314`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" })], lifecycle: lifecycle("html/paragraph") },
  { type: "html/button", name: "Button", nodes: ["button"], markup: '<button type="button">Button</button>', source: `${htmlSource}:326-370`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/button\")", properties: [property(`${htmlSource}:333-340`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" }), property(`${htmlSource}:341-348`, { name: "Type", key: "type", htmlAttr: "type", inputtype: "select" })], lifecycle: lifecycle("html/button") },
  { type: "html/audio", name: "Audio", nodes: ["audio"], markup: "<audio controls></audio>", source: `${htmlSource}:500-535`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/audio\")", properties: [property(`${htmlSource}:506-514`, { name: "Source", key: "src", htmlAttr: "src", inputtype: "url" })], lifecycle: lifecycle("html/audio") },
  { type: "html/video", name: "Video", nodes: ["video"], markup: "<video controls></video>", source: `${htmlSource}:536-575`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/video\")", properties: [property(`${htmlSource}:542-550`, { name: "Source", key: "src", htmlAttr: "src", inputtype: "url" })], lifecycle: lifecycle("html/video") },
  { type: "html/iframe", name: "Iframe", nodes: ["iframe"], markup: '<iframe title="Embedded content"></iframe>', source: `${htmlSource}:576-610`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"html/iframe\")", properties: [property(`${htmlSource}:582-590`, { name: "Source", key: "src", htmlAttr: "src", inputtype: "url" })], lifecycle: lifecycle("html/iframe") },
  { type: "_base", name: "Element", markup: "<div></div>", source: `${baseSource}:65-105`, sourceParity: "ported", sourceRegistration: "the original builder.Components.extend(\"_base\", \"_base\")", properties: [property(`${baseSource}:77-103`, { name: "Id", key: "id", htmlAttr: "id", inputtype: "text" }), property(`${baseSource}:83-103`, { name: "Title", key: "title", htmlAttr: "title", inputtype: "text" }), property(`${baseSource}:89-103`, { name: "Class", key: "class", htmlAttr: "class", inputtype: "text" })], lifecycle: lifecycle("_base") },
];

const htmlDefinition = (
  type: string,
  name: string,
  nodes: readonly string[],
  markup: string,
  sourceRange: string,
  properties: readonly VisualBuilderProperty[] = [],
): VisualComponentDefinition => ({ type, name, nodes, markup, source: `${htmlSource}:${sourceRange}`, sourceParity: "ported", sourceRegistration: `the original builder.Components.extend("_base", "${type}")`, properties, lifecycle: lifecycle(type) });

/** Source-backed HTML family entries from components-html.js. */
export const UVS_HTML_DEFINITIONS: readonly VisualComponentDefinition[] = [
  htmlDefinition("html/hr", "Horizontal rule", ["hr"], "<hr>", "280-300"),
  htmlDefinition("html/label", "Label", ["label"], "<label>Label</label>", "378-390", [property(`${htmlSource}:378-390`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "text" })]),
  htmlDefinition("html/textinput", "Text input", ["input"], '<input type="text" value="Text">', "391-505", [property(`${htmlSource}:391-505`, { name: "Value", key: "value", htmlAttr: "value", inputtype: "text" })]),
  htmlDefinition("html/textareainput", "Textarea", ["textarea"], "<textarea>Text</textarea>", "600-645", [property(`${htmlSource}:600-645`, { name: "Value", key: "value", htmlAttr: "innerHTML", inputtype: "textarea" })]),
  htmlDefinition("html/selectinput", "Select", ["select"], "<select><option>Option</option></select>", "506-599"),
  htmlDefinition("html/radiobutton", "Radio button", ["input"], '<input type="radio">', "646-702"),
  htmlDefinition("html/checkbox", "Checkbox", ["input"], '<input type="checkbox">', "703-750"),
  htmlDefinition("html/fileinput", "File input", ["input"], '<input type="file">', "751-758"),
  htmlDefinition("html/blockquote", "Blockquote", ["blockquote"], "<blockquote>Quote</blockquote>", "926-979", [property(`${htmlSource}:926-979`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" })]),
  htmlDefinition("html/list-item", "List item", ["li"], "<li>List item</li>", "980-986"),
  htmlDefinition("html/list", "List", ["ul", "ol"], "<ul><li>List item</li></ul>", "987-1052"),
  htmlDefinition("html/preformatted", "Preformatted", ["pre"], "<pre>Code</pre>", "1053-1072", [property(`${htmlSource}:1053-1072`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" })]),
  htmlDefinition("html/form", "Form", ["form"], '<form><input type="text"></form>', "1073-1155"),
  htmlDefinition("html/table", "Table", ["table"], "<table><tbody><tr><td>Cell</td></tr></tbody></table>", "1247-1402"),
  htmlDefinition("html/audio", "Audio", ["audio"], "<audio controls></audio>", "1403-1447", [property(`${htmlSource}:1403-1447`, { name: "Source", key: "src", htmlAttr: "src", inputtype: "url" })]),
  htmlDefinition("html/pdf", "PDF", ["embed"], '<embed type="application/pdf" src="">', "1448-1460"),
  htmlDefinition("html/embed", "Embed", ["iframe"], "<iframe title=\"Embedded content\"></iframe>", "1461-1500", [property(`${htmlSource}:1461-1500`, { name: "Source", key: "src", htmlAttr: "src", inputtype: "url" })]),
  htmlDefinition("html/html", "HTML", ["div"], "<div>HTML</div>", "1474-1500", [property(`${htmlSource}:1474-1500`, { name: "HTML", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" })]),
];

const sourceBacked = (type: string, name: string, sourceFile: string, group: string, markup: string, nodes: readonly string[], properties: readonly VisualBuilderProperty[], extendsType = "_base", attributes?: readonly string[], resizable = false): VisualComponentDefinition => ({
  type, name, nodes, attributes, markup, properties, resizable, extendsType,
  source: `${sourceFile}:source-registration`,
  sourceParity: "ported",
  sourceRegistration: `the original builder.Components.${extendsType === "_base" ? "extend(\"_base\", " : "add("}\"${type}\")`,
  lifecycle: lifecycle(type, (element, key, value) => {
    if (key === "src" || key === "url") { element.setAttribute(key === "url" ? "data-url" : "src", value); return true; }
    if (key === "textContent") { element.textContent = value; return true; }
    return false;
  }),
});

const capturedByType = new Map(UVS_SOURCE_CAPTURE.map((definition) => [definition.type, definition]));
const inputType = (value: string | undefined): VisualBuilderProperty["inputtype"] => {
  if (value === "ImageInput" || value === "VideoInput") return "image";
  if (value === "TextareaInput" || value === "TextValueInput" || value === "HtmlListSelectInput") return "textarea";
  if (value === "SelectInput" || value === "AutocompleteInput" || value === "LinkInput" || value === "ButtonInput" || value === "ToggleInput" || value === "RadioButtonInput") return "select";
  if (value === "CheckboxInput") return "checkbox";
  if (value === "NumberInput" || value === "RangeInput" || value === "GridInput") return "number";
  if (value === "CssUnitInput") return "number";
  return "text";
};
const capturedProperties = (source: string, properties: readonly CapturedSourceProperty[]): readonly VisualBuilderProperty[] => properties
  .filter((entry): entry is CapturedSourceProperty & { key: string } => typeof entry.key === "string")
  .map((entry) => property(source, {
    name: typeof entry.name === "string" ? entry.name : entry.key,
    key: entry.key,
    htmlAttr: typeof entry.htmlAttr === "string" ? entry.htmlAttr : undefined,
    child: typeof entry.child === "string" ? entry.child : undefined,
    inputtype: inputType(typeof entry.inputtype === "string" ? entry.inputtype : undefined),
    options: entry.options?.flatMap((option) => typeof option.value === "string" && typeof option.text === "string" ? [{ value: option.value, text: option.text }] : []),
    validValues: entry.validValues?.filter((value): value is string => typeof value === "string"),
  }));

const ecommerceProperties = (source: string, properties: readonly CapturedEcommerceProperty[]): readonly VisualBuilderProperty[] => properties
  .filter((entry): entry is CapturedEcommerceProperty & { key: string } => typeof entry.key === "string")
  .map((entry) => {
    const options = Array.isArray(entry.data) ? [] : (entry.data as { options?: unknown } | undefined)?.options;
    return property(source, {
      name: typeof entry.name === "string" ? entry.name : entry.key,
      key: entry.key,
      htmlAttr: typeof entry.htmlAttr === "string" ? entry.htmlAttr : undefined,
      child: typeof entry.child === "string" ? entry.child : undefined,
      inputtype: inputType(typeof entry.inputtype === "string" ? entry.inputtype : undefined),
      options: Array.isArray(options) ? options.flatMap((option) => {
        if (!option || typeof option !== "object") return [];
        const value = (option as Record<string, unknown>).value;
        const text = (option as Record<string, unknown>).text;
        return typeof value === "string" && typeof text === "string" ? [{ value, text }] : [];
      }) : undefined,
      validValues: Array.isArray(entry.validValues) ? entry.validValues.filter((value): value is string => typeof value === "string") : undefined,
    });
  });

const familyLifecycle = (type: string): VisualComponentDefinition["lifecycle"] => {
  if (type === "html/heading") return lifecycle(type, (element, key, value) => {
    if (key !== "size") return false;
    const heading = document.createElement(`h${value}`);
    heading.innerHTML = element.innerHTML;
    for (const attribute of Array.from(element.attributes)) heading.setAttribute(attribute.name, attribute.value);
    element.replaceWith(heading);
    return true;
  });
  if (type === "html/image") return {
    init(element) {
      element.dataset.uvsLinked = element.parentElement?.tagName.toLowerCase() === "a" ? "true" : "false";
    },
    onChange(element, key, value) {
      if (key !== "enable_link") return lifecycle(type)!.onChange(element, key, value);
      const linked = value === "true";
      element.dataset.uvsLinked = String(linked);
      if (linked && element.parentElement?.tagName.toLowerCase() !== "a") {
        const wrapper = document.createElement("a");
        element.replaceWith(wrapper);
        wrapper.appendChild(element);
      } else if (!linked && element.parentElement?.tagName.toLowerCase() === "a") {
        const parent = element.parentElement;
        parent.replaceWith(element);
      }
      return true;
    },
  };
  if (type.startsWith("ecommerce/")) return {
    init(element) {
      const source = element.dataset.vSource ?? "automatic";
      document.querySelectorAll<HTMLElement>('.mb-2[data-group]').forEach((group) => { group.classList.add("d-none"); });
      document.querySelectorAll<HTMLElement>(`.mb-2[data-group="${source}"]`).forEach((group) => { group.classList.remove("d-none"); });
    },
    onChange(element, key, value) {
      if (key === "innerHTML") { element.innerHTML = value; return true; }
      element.setAttribute(key, value);
      element.dispatchEvent(new CustomEvent("uvs-server-component-change", { detail: { type, key, value } }));
      return true;
    },
  };
  if (type === "widgets/googlemaps") return lifecycle(type, (element, key, value) => {
    if (!["q", "z", "t", "key"].includes(key)) return false;
    const iframe = element.querySelector("iframe");
    if (!iframe) return false;
    const url = new URL(iframe.getAttribute("src") ?? "https://maps.google.com/maps");
    url.searchParams.set("q", key === "q" ? value : url.searchParams.get("q") ?? "Paris");
    url.searchParams.set("z", key === "z" ? value : url.searchParams.get("z") ?? "15");
    url.searchParams.set("t", key === "t" ? value : url.searchParams.get("t") ?? "q");
    iframe.setAttribute("src", url.toString());
    return true;
  });
  if (type === "widgets/openstreetmap") return lifecycle(type, (element, key, value) => {
    if (key !== "bbox" && key !== "layer") return false;
    const iframe = element.querySelector("iframe");
    if (!iframe) return false;
    const url = new URL(iframe.getAttribute("src") ?? "https://www.openstreetmap.org/export/embed.html");
    url.searchParams.set(key, value);
    iframe.setAttribute("src", url.toString());
    return true;
  });
  if (type === "widgets/twitter") return lifecycle(type, (element, key, value) => {
    if (key !== "tweet") return false;
    const iframe = element.querySelector("iframe");
    if (!iframe) return false;
    const url = new URL(iframe.getAttribute("src") ?? "https://platform.twitter.com/embed/Tweet.html");
    url.searchParams.set("id", value);
    iframe.setAttribute("src", url.toString());
    return true;
  });
  if (type === "widgets/embed-video") {
    let provider = "y";
    let videoId = "";
    let url = "";
    let autoplay = false;
    let controls = false;
    let loop = false;
    let playsinline = true;
    let mute = false;
    return {
      init(element) {
        const iframe = element.querySelector("iframe");
        const video = element.querySelector("video");
        if (video) { provider = "h"; url = video.getAttribute("src") ?? ""; }
        if (iframe) {
          const src = iframe.getAttribute("src") ?? "";
          const youtube = src.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]+)/i);
          const vimeo = src.match(/(?:vimeo\.com(?:[^\d]+))(\d+)/i);
          if (youtube) { provider = "y"; videoId = youtube[1]; }
          else if (vimeo) { provider = "v"; videoId = vimeo[1]; }
          else provider = "h";
        }
      },
      onChange(element, key, value) {
        if (key === "t") provider = value;
        if (key === "video_id") videoId = value;
        if (key === "url") url = value;
        if (key === "autoplay") autoplay = value === "true";
        if (key === "controls") controls = value === "true";
        if (key === "loop") loop = value === "true";
        if (key === "playsinline") playsinline = value === "true";
        if (key === "mute") mute = value === "true";
        const child = element.querySelector("iframe, video");
        if (!child) return false;
        const replacement = document.createElement(provider === "h" ? "video" : "iframe");
        replacement.setAttribute("width", "100%"); replacement.setAttribute("height", "100%");
        if (provider === "y" || provider === "v") {
          const host = provider === "y" ? "https://www.youtube.com/embed/" : "https://player.vimeo.com/video/";
          replacement.setAttribute("src", `${host}${videoId}?autoplay=${autoplay}&controls=${controls}&loop=${loop}&playsinline=${playsinline}&mute=${mute}`);
          replacement.setAttribute("allowfullscreen", "true");
        } else {
          replacement.setAttribute("src", url);
          if (autoplay) replacement.setAttribute("autoplay", "");
          if (controls) replacement.setAttribute("controls", "");
          if (loop) replacement.setAttribute("loop", "");
          if (playsinline) replacement.setAttribute("playsinline", "");
          if (mute) replacement.setAttribute("mute", "");
        }
        child.replaceWith(replacement);
        return true;
      },
    };
  }
  if (type === "widgets/facebookpage") return lifecycle(type, (element, key, value) => {
    const target = element.querySelector(".fb-page");
    if (!target) return false;
    target.setAttribute(key, value);
    element.dispatchEvent(new CustomEvent("uvs-facebook-refresh"));
    return true;
  });
  if (type === "widgets/lottie") return lifecycle(type, (element, key, value) => {
    if (key === "path" || key === "autoplay" || key === "loop") element.setAttribute(`data-${key === "path" ? "path" : key}`, value);
    element.dispatchEvent(new CustomEvent("uvs-lottie-refresh"));
    return true;
  });
  if (type === "widgets/chartjs") return {
    init(element) { element.dispatchEvent(new CustomEvent("uvs-chart-init", { detail: { config: element.getAttribute("data-chart") ?? "{}" } })); },
    onChange(element, key, value) {
      const current = JSON.parse(element.getAttribute("data-chart") || "{}");
      if (key === "type") current.type = value;
      element.setAttribute("data-chart", JSON.stringify(current));
      element.dispatchEvent(new CustomEvent("uvs-chart-refresh", { detail: current }));
      return true;
    },
  };
  if (type === "elements/carousel") return lifecycle(type, (element, key, value) => {
    if (key === "autoplay" && value === "true") value = JSON.stringify({ waitForTransition: true, enabled: true, delay: element.getAttribute("data-delay") });
    if (key.startsWith("breakpoint")) {
      const breakpoints = JSON.parse(element.getAttribute("data-breakpoints") || "{}");
      breakpoints[key] = Number(value);
      element.setAttribute("data-breakpoints", JSON.stringify(breakpoints));
    } else element.setAttribute(`data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
    element.dispatchEvent(new CustomEvent("uvs-carousel-refresh"));
    return true;
  });
  if (type === "elements/gallery") return {
    init(element) { element.dispatchEvent(new CustomEvent("uvs-gallery-init", { detail: { layout: element.classList.contains("masonry") ? "masonry" : "flex" } })); },
    onChange(element, key, value) { element.dispatchEvent(new CustomEvent("uvs-gallery-change", { detail: { key, value } })); return true; },
  };
  if (type === "components/products") return {
    init(element) {
      const source = element.dataset.type ?? "";
      document.querySelectorAll<HTMLElement>(".mb-2[data-group]").forEach((group) => { group.style.display = source === "" || group.dataset.group === source ? "" : "none"; });
    },
    onChange: lifecycle(type)?.onChange ?? (() => true),
  };
  return lifecycle(type);
};

const spec = (type: string, family: (typeof UVS_CONCRETE_COMPONENTS)[number]): VisualComponentDefinition => {
  const { name, sourceFile, group } = family;
  const source = sourceFile;
  const lower = type.toLowerCase();
  const ecommerceKey: Record<string, string> = {
    "ecommerce/product": "productComponent",
    "ecommerce/products": "productsComponent",
    "ecommerce/productGallery": "productGalleryComponent",
    "ecommerce/categories": "productCategoriesComponent",
    "ecommerce/manufacturers": "manufacturersComponent",
    "ecommerce/cart": "cartComponent",
    "ecommerce/checkout": "checkoutComponent",
    "ecommerce/filters": "filtersComponent",
  };
  const ecommerce = ecommerceKey[type] ? UVS_ECOMMERCE_CAPTURE[ecommerceKey[type]] : undefined;
  if (ecommerce) return {
    type,
    name: ecommerce.name,
    attributes: ecommerce.attributes,
    markup: ecommerce.html?.trim() || `<div data-uvs-source="${type}"></div>`,
    properties: ecommerceProperties(`${source}:source-module`, ecommerce.properties),
    source: `${source}:source-module`,
    sourceParity: "ported",
    sourceRegistration: `the original builder.Components.add("${type}", ${ecommerceKey[type]})`,
    fullUpdate: ecommerce.fullUpdate,
    userServerTemplate: ecommerce.userServerTemplate,
    lifecycle: familyLifecycle(type),
  };
  const captured = capturedByType.get(type);
  if (captured) {
    const markup = typeof captured.html === "string" && captured.html.trim().length > 0 ? captured.html : `<div data-uvs-source="${type}"></div>`;
    const capturedLifecycle = familyLifecycle(type);
    return {
      type,
      name: typeof captured.name === "string" ? captured.name : name ?? type,
      nodes: captured.nodes ?? undefined,
      attributes: captured.attributes ?? undefined,
      classes: captured.classes ?? undefined,
      classesRegex: captured.classesRegex ?? undefined,
      markup,
      properties: capturedProperties(`${source}:source-registration`, captured.properties),
      source: `${source}:source-registration`,
      sourceParity: "ported",
      sourceRegistration: `the original builder.Components.${captured.parent ? `extend(\"${captured.parent}\", ` : "add("}\"${type}\")`,
      resizable: captured.resizable,
      lifecycle: capturedLifecycle,
    };
  }
  if (type.startsWith("embeds/")) return sourceBacked(type, name ?? type, source, group, `<div data-component-oembed data-url=""><div class="alert alert-light" role="alert"><h6>Enter ${type.slice(7)} url to embed</h6></div></div>`, ["div"], [property(`${source}:25-95`, { name: "Url", key: "url", htmlAttr: "data-url", inputtype: "url" })]);
  if (type === "widgets/googlemaps") return sourceBacked(type, "Google Maps", source, group, '<div data-component-maps><iframe frameborder="0" src="https://maps.google.com/maps?q=Bucharest&z=15&t=q&key=&output=embed" width="100%" height="100%"></iframe></div>', ["div"], [property(`${source}:24-99`, { name: "Address", key: "q", inputtype: "text" }), property(`${source}:24-99`, { name: "Map type", key: "t", inputtype: "select", options: [{ value: "q", text: "Roadmap" }, { value: "w", text: "Satellite" }] }), property(`${source}:24-99`, { name: "Zoom", key: "z", inputtype: "number" }), property(`${source}:24-99`, { name: "Key", key: "key", inputtype: "text" })], "_base", ["data-component-maps"], true);
  if (type === "widgets/openstreetmap") return sourceBacked(type, "Open Street Map", source, group, '<div data-component-openstreetmap><iframe width="100%" height="100%" frameborder="0" scrolling="no" src="https://www.openstreetmap.org/export/embed.html?layer=mapnik"></iframe></div>', ["div"], [property(`${source}:101-164`, { name: "Map", key: "bbox", inputtype: "text" })], "_base", ["data-component-openstreetmap"], true);
  if (type === "widgets/embed-video") return sourceBacked(type, "Embed Video", source, group, '<div data-component-video style="width:640px;height:480px;"><iframe frameborder="0" src="https://www.youtube.com/embed/C6fOoy7Se_4?autoplay=1&loop=1&playsinline=1&controls=0&mute=1" width="100%" height="100%"></iframe></div>', ["div"], [property(`${source}:165-369`, { name: "Video id", key: "video_id", inputtype: "text" }), property(`${source}:165-369`, { name: "Url", key: "url", inputtype: "url" }), property(`${source}:165-369`, { name: "Autoplay", key: "autoplay", inputtype: "checkbox" }), property(`${source}:165-369`, { name: "Controls", key: "controls", inputtype: "checkbox" })], "_base", ["data-component-video"], true);
  if (type.startsWith("widgets/")) return sourceBacked(type, name ?? type, source, group, `<div data-component-${type.slice(8)}></div>`, ["div"], [property(`${source}:source-registration`, { name: "Source", key: "src", htmlAttr: "src", inputtype: "url" }), property(`${source}:source-registration`, { name: "Class", key: "class", htmlAttr: "class", inputtype: "text" })]);
  if (type.startsWith("ecommerce/") || type.startsWith("components/")) {
    const dataName = type.replace(/[\\/]/g, "-");
    const attr = type.startsWith("components/") ? `data-component-${type.slice(11).replace("_", "-")}` : `data-ecommerce-${type.slice(10).toLowerCase()}`;
    return sourceBacked(type, name ?? type, source, group, `<div ${attr} class="${dataName}"></div>`, ["div"], [property(`${source}:source-registration`, { name: "Data source", key: "data-source", htmlAttr: "data-source", inputtype: "text" }), property(`${source}:source-registration`, { name: "Class", key: "class", htmlAttr: "class", inputtype: "text" })], "_base", [attr]);
  }
  const tag = lower.includes("image") || lower.includes("icon") ? "div" : lower.includes("row") ? "div" : lower.includes("column") ? "div" : "div";
  const properties = [property(`${source}:source-registration`, { name: "Class", key: "class", htmlAttr: "class", inputtype: "text" })];
  if (lower.includes("image") || lower.includes("gallery") || lower.includes("carousel")) properties.unshift(property(`${source}:source-registration`, { name: "Image", key: "src", htmlAttr: "src", inputtype: "image" }));
  if (lower.includes("text") || lower.includes("headline") || lower.includes("testimonial") || lower.includes("alert")) properties.unshift(property(`${source}:source-registration`, { name: "Text", key: "innerHTML", htmlAttr: "innerHTML", inputtype: "textarea" }));
  return sourceBacked(type, name ?? type, source, group, `<${tag} class="${type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}"></${tag}>`, [tag], properties);
};

const concreteDefinitions: readonly VisualComponentDefinition[] = UVS_CONCRETE_COMPONENTS
  .filter(({ type }) => !UVS_CORE_DEFINITIONS.some((definition) => definition.type === type) && !UVS_HTML_DEFINITIONS.some((definition) => definition.type === type))
  .map((family) => spec(family.type, family));

const allDefinitions = [...UVS_CORE_DEFINITIONS, ...UVS_HTML_DEFINITIONS, ...concreteDefinitions] as const;
const sourceAlignedDefinitions = allDefinitions.map((definition) => {
  const captured = capturedByType.get(definition.type);
  if (!captured) return definition;
  const capturedMarkup = typeof captured.html === "string" && captured.html.trim().length > 0 ? captured.html : definition.markup;
  const capturedProps = capturedProperties(definition.source, captured.properties);
  return {
    ...definition,
    name: typeof captured.name === "string" ? captured.name : definition.name,
    markup: capturedMarkup,
    nodes: captured.nodes ?? definition.nodes,
    attributes: captured.attributes ?? definition.attributes,
    classes: captured.classes ?? definition.classes,
    classesRegex: captured.classesRegex ?? definition.classesRegex,
    properties: capturedProps.length > 0 ? capturedProps : definition.properties,
    sourceRegistration: `the original builder.Components.${captured.parent ? `extend(\"${captured.parent}\", ` : "add("}\"${definition.type}\")`,
    lifecycle: familyLifecycle(definition.type),
  };
});
export const UVS_DEFINITIONS = sourceAlignedDefinitions.map((definition) => definition.properties.length > 0
  ? definition
  : definition.source.endsWith(":source-module")
    ? definition
  : {
      ...definition,
      properties: [property(definition.source, { name: "Class", key: "class", htmlAttr: "class", inputtype: "text" })],
      lifecycle: lifecycle(definition.type),
    });
const byType = new Map(UVS_DEFINITIONS.map((definition) => [definition.type, definition]));
export function getVisualComponentDefinition(type: string): VisualComponentDefinition | undefined { return byType.get(type); }
export function registerVisualComponentDefinitions(registry: Map<string, VisualComponentDefinition> = new Map()): Map<string, VisualComponentDefinition> {
  UVS_DEFINITIONS.forEach((definition) => registry.set(definition.type, definition)); return registry;
}
