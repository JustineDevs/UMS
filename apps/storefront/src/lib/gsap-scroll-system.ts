/**
 * Shared ScrollTrigger patterns aligned with GSAP MCP scroll-system guidance:
 * batch reveals for performance and consistent easing.
 */
import type { default as GSAP } from "gsap";

/** Static ScrollTrigger plugin (class with `.batch`), not a trigger instance. */
type ScrollTriggerPlugin = Pick<
  typeof import("gsap/ScrollTrigger").ScrollTrigger,
  "batch"
>;

/**
 * Reveal child elements when they enter the viewport (batched ScrollTrigger).
 * Prefer over many individual `gsap.from` calls on long lists.
 */
export function batchScrollRevealChildren(
  gsapLib: GSAP,
  scrollTrigger: ScrollTriggerPlugin,
  container: HTMLElement | null,
  childSelector: string,
  opts: {
    ease?: string;
    y?: number;
    duration?: number;
    stagger?: number;
    start?: string;
  } = {},
): void {
  if (!container) return;
  const nodes = container.querySelectorAll<HTMLElement>(childSelector);
  if (!nodes.length) return;

  const ease = opts.ease ?? "power3.out";
  const y = opts.y ?? 50;
  const duration = opts.duration ?? 0.72;
  const stagger = opts.stagger ?? 0.12;
  const start = opts.start ?? "top 82%";

  scrollTrigger.batch(Array.from(nodes), {
    onEnter: (batch) => {
      gsapLib.from(batch, {
        y,
        opacity: 0,
        duration,
        stagger,
        ease,
      });
    },
    start,
  });
}
