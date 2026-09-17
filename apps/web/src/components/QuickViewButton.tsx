"use client";

import { useState } from "react";
import { ProductQuickViewModal } from "@/components/ProductQuickViewModal";

export function QuickViewButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="mt-3 w-full rounded border border-primary/40 bg-white py-2 text-center text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-on-primary"
      >
        Quick view
      </button>
      <ProductQuickViewModal slug={slug} open={open} onOpenChange={setOpen} />
    </>
  );
}
