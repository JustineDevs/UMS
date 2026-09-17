"use client";

import dynamic from "next/dynamic";
import type { ProductEditorFormProps } from "./ProductEditorForm";

const ProductEditorForm = dynamic(
  () => import("./ProductEditorForm").then((module) => module.ProductEditorForm),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading product editor…
      </div>
    ),
  },
);

export function ProductEditorLoader(props: ProductEditorFormProps) {
  return <ProductEditorForm {...props} />;
}
