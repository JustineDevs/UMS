"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
};

/**
 * Light motion on every navigation so the storefront doesn’t feel “dead” outside the home GSAP blocks.
 */
export function GlobalRouteMotion({ children }: Props) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ScrollTrigger.refresh();
      return;
    }

    const el = mainRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    gsap.fromTo(
      el,
      { autoAlpha: 0.88, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        ease: "power2.out",
        overwrite: "auto",
      },
    );
  }, [pathname]);

  return (
    <div ref={mainRef} className="min-w-0">
      {children}
    </div>
  );
}
