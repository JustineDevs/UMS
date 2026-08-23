"use client";

import { useEffect, useState } from "react";

type AccountSection = readonly [string, string, string];

export function AccountSectionNav({ sections }: { sections: readonly AccountSection[] }) {
  const [active, setActive] = useState(sections[0]?.[0] ?? "");

  useEffect(() => {
    const nodes = sections
      .map(([id]) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-28% 0px -55%", threshold: [0, 0.25, 0.75] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => {
      nodes.forEach((node) => observer.unobserve(node));
      observer.disconnect();
    };
  }, [sections]);

  return (
    <nav aria-label="Account sections" className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
      {sections.map(([id, label, icon]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "location" : undefined}
          className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-surface-container-low hover:text-primary lg:w-full ${active === id ? "bg-surface-container-low text-primary" : "text-on-surface-variant"}`}
        >
          <span className="material-symbols-outlined text-[19px]" aria-hidden="true">{icon}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}
