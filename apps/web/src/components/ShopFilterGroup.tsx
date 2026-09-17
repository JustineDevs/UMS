import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export function ShopFilterGroup({ title, children }: Props) {
  return (
    <details open className="group/filter">
      <summary className="mb-6 flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold uppercase tracking-[0.2em] text-primary [&::-webkit-details-marker]:hidden">
        <span role="heading" aria-level={2}>
          {title}
        </span>
        <span
          aria-hidden="true"
          className="ml-3 text-lg leading-none transition-transform group-open/filter:rotate-45"
        >
          +
        </span>
      </summary>
      {children}
    </details>
  );
}
