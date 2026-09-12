export type ComponentTreeNode = {
  id?: string;
  name: string;
  image?: string;
  title?: string | null;
  node: unknown;
  children: ComponentTreeNode[];
};

export type TreeDomElement = {
  className: string;
  textContent: string;
  dataset: Record<string, string>;
  style: { backgroundImage: string };
  treeNode?: unknown;
  append(...children: TreeDomElement[]): void;
};

export type TreeDomFactory = {
  createElement(tagName: "ol" | "li" | "label" | "input"): TreeDomElement;
};

function friendlyName(value: string): string {
  return value.replaceAll("--bs-", "").replace(/[-_]/g, " ").trim();
}

/** Mirrors the original builder.drawComponentsTree (builder.js:3506-3554). */
export function drawComponentsTree(
  tree: readonly ComponentTreeNode[],
  dom: TreeDomFactory,
  imageBaseUrl = "",
  prefix = 0,
): TreeDomElement {
  let sequence = 1;

  function draw(nodes: readonly ComponentTreeNode[]): TreeDomElement {
    const list = dom.createElement("ol");
    sequence += 1;

    nodes.forEach((node, index) => {
      const id = node.id || `${prefix}-${sequence}-${index}`;
      const item = dom.createElement("li");
      item.dataset.component = node.name;
      item.className = node.children.length > 0 ? "" : "file";
      const label = dom.createElement("label");
      label.style.backgroundImage = `url(${imageBaseUrl}${node.image ?? ""})`;
      label.textContent = node.title ? `${node.name} - ${friendlyName(node.title.slice(0, 21))}` : node.name;
      const checkbox = dom.createElement("input");
      checkbox.dataset.id = `id${id}`;
      item.append(label, checkbox);
      if (node.children.length > 0) item.append(draw(node.children));
      item.treeNode = node.node;
      list.append(item);
    });

    return list;
  }

  return draw(tree);
}
