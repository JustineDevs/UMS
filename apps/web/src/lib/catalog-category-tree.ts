export type CatalogCategorySummary = {
  id: string;
  handle: string;
  category: string;
  count: number;
  parentId: string | null;
};

export type CatalogCategoryTreeNode = CatalogCategorySummary & {
  children: CatalogCategoryTreeNode[];
};

export function buildCatalogCategoryTree(
  summaries: CatalogCategorySummary[],
): CatalogCategoryTreeNode[] {
  const nodes = new Map<string, CatalogCategoryTreeNode>();
  for (const summary of summaries) nodes.set(summary.id, { ...summary, children: [] });
  const roots: CatalogCategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
