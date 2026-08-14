"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollContextValue {
  lenis: Lenis | null;
  setScrollLocked: (_locked: boolean) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
  setScrollLocked: () => {},
});

function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

/**
 * Global smooth-scroll provider (Infiner pattern):
 * - Creates Lenis imperatively (`new Lenis`)
 * - Drives Lenis from GSAP's ticker (single animation loop for both Lenis + GSAP tweens)
 * - Syncs ScrollTrigger on every Lenis scroll frame
 * - Scrolls to top on route change
 * - Exposes lock/unlock for modals and mobile menus
 * - Skipped entirely when the user prefers reduced motion
 */
export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [scrollLocked, setScrollLockedRaw] = useState(false);
  const pathname = usePathname();

  const setScrollLocked = useCallback((value: boolean) => {
    setScrollLockedRaw(value);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const instance = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      orientation: "vertical",
      gestureOrientation: "vertical",
    });

    setLenis(instance);

    const unsubScroll = instance.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => {
      instance.raf(time * 1000);
    };
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      unsubScroll();
      gsap.ticker.remove(onTick);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  useEffect(() => {
    if (!lenis) return;
    lenis.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  useEffect(() => {
    if (scrollLocked) {
      lenis?.stop();
    } else {
      lenis?.start();
    }
  }, [scrollLocked, lenis]);

  return (
    <SmoothScrollContext.Provider value={{ lenis, setScrollLocked }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
