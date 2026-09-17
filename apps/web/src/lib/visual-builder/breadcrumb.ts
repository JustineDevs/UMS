export type BreadcrumbElement = {
  parentElement: BreadcrumbElement | null;
};

export type BreadcrumbItem = {
  name: string;
  className: string;
  element: BreadcrumbElement;
};

export type ElementType = readonly [type: string, tagName: string];

/** Mirrors the original builder.Breadcrumb.loadBreadcrumb (builder.js:4482-4497). */
export function loadBreadcrumb(
  element: BreadcrumbElement | null | undefined,
  getElementType: (element: BreadcrumbElement) => ElementType,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  let current = element ?? null;

  while (current?.parentElement) {
    const [type, tagName] = getElementType(current);
    const tag = tagName.toLowerCase();
    items.unshift({ name: `${tag} ${type}`, className: `el-${tag}`, element: current });
    current = current.parentElement;
  }

  return items;
}
