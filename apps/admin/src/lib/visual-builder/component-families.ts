import { ComponentRegistry, type ComponentDefinition } from "./component-registry";

type Family = ComponentDefinition & { sourceFile: string; group: string };

const sourceFiles: Record<string, string> = {
  "html/": "components-html.js", "elements/": "components-elements.js", "widgets/": "components-widgets.js",
  "embeds/": "components-embeds.js", "ecommerce/": "components-ecommerce.js", "components/": "components-server.js",
  "config/": "components-common.js", "_base": "components-common.js",
};

const ids = [
  "_base", "config/bootstrap",
  "html/alert", "html/audio", "html/badge", "html/blockquote", "html/breadcrumbitem", "html/breadcrumbs", "html/btn", "html/button", "html/buttongroup", "html/buttontoolbar", "html/card", "html/checkbox", "html/container", "html/embed", "html/fileinput", "html/form", "html/gridcolumn", "html/gridrow", "html/heading", "html/hr", "html/html", "html/iframe", "html/image", "html/label", "html/link", "html/list", "html/list-item", "html/listgroup", "html/listitem", "html/navbar", "html/pageitem", "html/pagination", "html/paragraph", "html/pdf", "html/preformatted", "html/progress", "html/radiobutton", "html/selectinput", "html/table", "html/tablebody", "html/tablecell", "html/tablefooter", "html/tablehead", "html/tableheadercell", "html/tablerow", "html/textareainput", "html/textinput", "html/video",
  "elements/Icon box", "elements/Image box", "elements/accordion", "elements/animated-headline", "elements/carousel", "elements/code", "elements/counter", "elements/divider", "elements/figure", "elements/flip-box", "elements/font-icon", "elements/gallery", "elements/icon-list", "elements/image-compare", "elements/price-list", "elements/price-table", "elements/rating", "elements/reviews", "elements/separator", "elements/slider", "elements/social-icons", "elements/svg-element", "elements/svg-image", "elements/tab", "elements/tabs", "elements/testimonial",
  "widgets/chartjs", "widgets/embed-video", "widgets/facebookcomments", "widgets/facebookpage", "widgets/googlemaps", "widgets/instagram", "widgets/lottie", "widgets/openstreetmap", "widgets/paypal", "widgets/twitter",
  "embeds/embed", "embeds/youtube", "embeds/vimeo", "embeds/dailymotion", "embeds/flickr", "embeds/smugmug", "embeds/scribd", "embeds/twitter", "embeds/soundcloud", "embeds/slideshare", "embeds/spotify", "embeds/imgur", "embeds/issuu", "embeds/mixcloud", "embeds/ted", "embeds/animoto", "embeds/tumblr", "embeds/kickstarter", "embeds/reverbnation", "embeds/reddit", "embeds/speakerdeck", "embeds/screencast", "embeds/amazon", "embeds/someecards", "embeds/tiktok", "embeds/pinterest", "embeds/wolfram", "embeds/anghami",
  "ecommerce/cart", "ecommerce/categories", "ecommerce/checkout", "ecommerce/filters", "ecommerce/manufacturers", "ecommerce/product", "ecommerce/productGallery", "ecommerce/products",
  "components/cart", "components/categories", "components/checkout", "components/filters", "components/manufacturers", "components/product", "components/product_gallery", "components/products", "components/search", "components/slide", "components/slider", "components/user",
] as const;

function family(type: string): Family {
  const prefix = Object.keys(sourceFiles).find((key) => type.startsWith(key)) ?? "";
  const sourceFile = sourceFiles[prefix] ?? "components-html.js";
  const name = type === "_base" ? "Base" : type.split("/").at(-1)?.replaceAll("-", " ") ?? type;
  const nodes = type.startsWith("html/") ? [name === "heading" ? "h1" : name] : undefined;
  return { type, name, sourceFile: `internal/admin/Vvveb/public/js/vvvebjs/${sourceFile}`, group: prefix.replace("/", "") || "Base", nodes };
}

export const UVS_CONCRETE_COMPONENTS: readonly Family[] = ids.map(family);

export function registerVisualBuilderConcreteComponents(registry = new ComponentRegistry()): ComponentRegistry {
  for (const definition of UVS_CONCRETE_COMPONENTS) registry.register(definition.type, definition);
  return registry;
}
