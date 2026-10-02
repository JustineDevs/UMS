#!/usr/bin/env node

/**
 * Generate the canonical machine-readable map used by browser agents.
 *
 * The output is a JSON-RPC 2.0 response envelope so an agent can consume the
 * file as a response from `application.map.get`, while the result contains the
 * complete route, component, link, and form-control inventory.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "apps", "web");
const appRoot = path.join(webRoot, "src", "app");
const componentRoots = [
  path.join(webRoot, "src", "components"),
  path.join(root, "packages", "ui"),
];
const storybookRoot = path.join(webRoot, ".storybook");
const storybookBuildIndex = path.join(webRoot, "storybook-static", "index.json");
const output = path.join(webRoot, "public", "application-map.json");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const routeExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const controlPattern = /<(button|Button|[A-Z][A-Za-z0-9]*(?:Button|Link|Action|Control))\b((?:=>|[^>])*?)(?:\/>|>)/g;
const nativeControlPattern = /<(input|select|textarea)\b((?:=>|[^>])*?)(?:\/>|>)/g;
const linkPattern = /<(?:a|Link)\b([^>]*?)(?:\/>|>)/g;
function attributeValue(attributes, name) {
  const quoted = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`));
  if (quoted) return quoted[1];

  const start = attributes.search(new RegExp(`\\b${name}\\s*=\\s*\\{`));
  if (start < 0) return null;
  const open = attributes.indexOf("{", start);
  let depth = 0;
  let quote = null;
  for (let index = open; index < attributes.length; index += 1) {
    const character = attributes[index];
    if (quote) {
      if (character === quote && attributes[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        const expression = attributes.slice(open + 1, index).trim();
        if (expression.startsWith("`") && expression.endsWith("`")) {
          return expression.slice(1, -1).replace(/\$\{([^}]+)\}/g, "{$1}");
        }
        const literals = [...expression.matchAll(/(["'])(.*?)\1/g)].map((match) => match[2]);
        return literals.length ? literals.join(" / ") : expression || null;
      }
    }
  }
  return null;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", "storybook-static"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function relative(absolute) {
  return path.relative(root, absolute).split(path.sep).join("/");
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function cleanSegment(segment) {
  if (/^\(.*\)$/.test(segment) || segment.startsWith("@")) return null;
  if (/^\[\.\.\.(.+)\]$/.test(segment)) return `*${segment.slice(4, -1)}`;
  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) return `*${segment.slice(5, -2)}?`;
  if (/^\[(.+)\]$/.test(segment)) return `:${segment.slice(1, -1)}`;
  return segment;
}

function routePathForDirectory(directory) {
  const rel = path.relative(appRoot, directory).split(path.sep).filter(Boolean);
  const segments = rel.map(cleanSegment).filter(Boolean);
  return `/${segments.join("/")}`.replace(/\/+/g, "/") || "/";
}

function exportedHttpMethods(source) {
  const methods = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
    methods.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+(?:const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
    methods.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const exported of match[1].split(",")) {
      const method = exported.trim().match(/(?:\bas\s+)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/);
      if (method) methods.add(method[1]);
    }
  }
  return [...methods].sort();
}

function appFileKind(file) {
  const basename = path.basename(file, path.extname(file));
  if (basename === "page") return "page";
  if (basename === "route") return "endpoint";
  if (basename === "layout" || basename === "template") return "layout";
  if (basename === "loading" || basename === "error" || basename === "not-found") return "state";
  return "module";
}

function appFileRecord(file) {
  const source = fileText(file);
  const kind = appFileKind(file);
  return {
    kind,
    path: routePathForDirectory(path.dirname(file)),
    source: relative(file),
    methods: kind === "endpoint" ? exportedHttpMethods(source) : [],
    controls: extractControls(source, relative(file)),
  };
}

function readStorybookIndex() {
  if (!fs.existsSync(storybookBuildIndex)) {
    return { available: false, source: null, entries: [] };
  }
  try {
    const index = JSON.parse(fs.readFileSync(storybookBuildIndex, "utf8"));
    return {
      available: true,
      source: relative(storybookBuildIndex),
      version: index.v ?? null,
      entries: Object.values(index.entries ?? {}),
    };
  } catch {
    return { available: false, source: relative(storybookBuildIndex), entries: [] };
  }
}

function routeForFile(file) {
  const rel = path.relative(appRoot, path.dirname(file)).split(path.sep).filter(Boolean);
  const segments = rel.map(cleanSegment).filter(Boolean);
  const pathname = `/${segments.join("/")}`.replace(/\/+/g, "/") || "/";
  const basename = path.basename(file).replace(path.extname(file), "");
  const isEndpoint = basename === "route";
  const methods = isEndpoint ? exportedHttpMethods(fileText(file)) : [];
  return { path: pathname, kind: isEndpoint ? "endpoint" : "page", source: relative(file), methods };
}

function fileText(file) {
  return fs.readFileSync(file, "utf8");
}

function childText(source, match, element) {
  const start = (match.index ?? 0) + match[0].length;
  if (match[0].endsWith("/>") || !source.slice(start - 1).startsWith(">")) return null;
  const end = source.indexOf(`</${element}>`, start);
  if (end < start || end - start > 600) return null;
  const value = source
    .slice(start, end)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{([^{}]*)\}/g, (_, expression) => [...expression.matchAll(/(['"])(.*?)\1/g)].map((part) => part[2]).join(" "))
    .replace(/\s+/g, " ")
    .trim();
  return value || null;
}

function extractControls(source, sourcePath) {
  const controls = [];
  const add = (match, element, attributes) => {
    const label = attributeValue(attributes, "aria-label") ?? attributeValue(attributes, "title") ?? attributeValue(attributes, "placeholder") ?? attributeValue(attributes, "name") ?? attributeValue(attributes, "id") ?? childText(source, match, element);
    const href = attributeValue(attributes, "href");
    const type = attributeValue(attributes, "type");
    controls.push({
      id: `${sourcePath}:${lineNumber(source, match.index ?? 0)}:${element}`,
      element,
      role: element.toLowerCase().includes("button") || element === "button" ? "button" : element.toLowerCase().includes("link") ? "link" : element,
      label,
      href,
      type,
      disabled: /\bdisabled(?:\s|=|\/|>)/.test(attributes),
      source: sourcePath,
      line: lineNumber(source, match.index ?? 0),
    });
  };
  for (const match of source.matchAll(controlPattern)) add(match, match[1], match[2]);
  for (const match of source.matchAll(nativeControlPattern)) add(match, match[1], match[2]);
  for (const match of source.matchAll(linkPattern)) {
    const href = attributeValue(match[1], "href");
    if (href) add(match, "link", match[1]);
  }
  return controls;
}

function componentRecord(file) {
  const source = fileText(file);
  const sourcePath = relative(file);
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:default\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const name of match[1].split(",")) names.add(name.trim().split(/\s+as\s+/).pop());
  }
  if (!names.size) names.add(path.basename(file, path.extname(file)));
  const controls = extractControls(source, sourcePath);
  return { names: [...names].filter(Boolean).sort(), source: sourcePath, controls };
}

const routeFiles = walk(appRoot).filter((file) => routeExtensions.has(path.extname(file)) && /(^|[/\\])(page|route)\.[^.]+$/.test(file));
const applicationFiles = walk(appRoot).map(appFileRecord).sort((a, b) => a.source.localeCompare(b.source));
const routes = routeFiles.map((file) => ({ ...routeForFile(file), controls: extractControls(fileText(file), relative(file)) })).sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
const componentFiles = [...new Set(componentRoots.flatMap(walk))].sort();
const components = componentFiles.map(componentRecord).sort((a, b) => a.source.localeCompare(b.source));
const storyFiles = walk(storybookRoot).filter((file) => /\.(stories|story)\.[^.]+$/.test(file)).map(relative).sort();
const storybook = {
  devUrl: "http://localhost:6006",
  indexPath: "/index.json",
  storiesJsonPath: "/stories.json",
  sourceFiles: storyFiles,
  build: readStorybookIndex(),
};
const controls = [...applicationFiles.flatMap((file) => file.controls), ...components.flatMap((component) => component.controls)].sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line || a.id.localeCompare(b.id));
const uniqueControls = [...new Map(controls.map((control) => [control.id, control])).values()];

const result = {
  schema: "uvs.application-map/v1",
  application: { name: "Universal Music Store", framework: "Next.js App Router", sourceRoot: "apps/web" },
  generatedAt: process.env.APPLICATION_MAP_GENERATED_AT ?? null,
  counts: {
    routes: routes.length,
    endpoints: routes.filter((route) => route.kind === "endpoint").length,
    applicationFiles: applicationFiles.length,
    components: components.length,
    controls: uniqueControls.length,
    storybookStories: storybook.build.entries.length,
  },
  storybook,
  coverage: {
    sourceFiles: true,
    routeSpecialFiles: true,
    staticControls: true,
    storybookIndex: storybook.build.available,
    runtimeDom: false,
    dynamicProps: false,
    authenticatedStates: false,
    responsiveStates: false,
  },
  rpcMethods: [
    { name: "application.map.get", description: "Return this complete application map." },
    { name: "application.routes.list", description: "List navigable page and API routes." },
    { name: "application.controls.find", description: "Find buttons, links, and form controls by label, role, or route." },
  ],
  routes,
  applicationFiles,
  components,
  controls: uniqueControls,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ jsonrpc: "2.0", id: "uvs-application-map", result }, null, 2)}\n`);
console.log(`Generated ${relative(output)} (${routes.length} routes, ${components.length} components, ${uniqueControls.length} controls).`);
