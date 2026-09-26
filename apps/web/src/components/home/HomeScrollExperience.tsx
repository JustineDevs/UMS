"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@universal-music-store/ui";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { RatingBadge } from "@/components/foundations/rating-badge";
import type { Product } from "@universal-music-store/types";
import type { CmsBlock, StorefrontHomePayload, StorefrontHomeSectionLayout } from "@universal-music-store/platform-data";
import type { HomepageSocialProof } from "@/lib/homepage-social-proof";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef, useEffect, type CSSProperties } from "react";
import { batchScrollRevealChildren } from "@/lib/gsap-scroll-system";
import { normalizeCmsDomStyle } from "@/lib/cms-dom-edit";
import { sanitizeCmsHtml } from "@universal-music-store/validation";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  products: Product[];
  home: StorefrontHomePayload;
  socialProof: {
    customerCount: number;
    reviewSummary: HomepageSocialProof;
  };
  selectionMode?: boolean;
  visualBlocks?: CmsBlock[];
};

type Partner = {
  name: string;
  href: string;
  logo: string;
  imageClassName?: string;
};

type HeroStyle = StorefrontHomePayload["hero"]["style"];

function sectionStyle(layout?: StorefrontHomeSectionLayout): CSSProperties | undefined {
  if (!layout) return undefined;
  return {
    maxWidth: layout.maxWidth || undefined,
    minHeight: layout.minHeight || undefined,
    paddingBlock: layout.paddingBlock || undefined,
    paddingInline: layout.paddingInline || undefined,
    marginInline: layout.maxWidth ? "auto" : undefined,
  };
}

function heroLeadToneClass(style: HeroStyle["textTone"]): string {
  if (style === "neutral") return "text-on-surface-variant";
  if (style === "muted") return "text-on-surface-variant/90";
  return "text-primary/80";
}

function heroLeadWidthClass(style: HeroStyle["contentWidth"]): string {
  if (style === "extra") return "max-w-2xl";
  if (style === "wide") return "max-w-xl";
  return "max-w-md";
}

const PARTNERS: Partner[] = [
  {
    name: "Alesis",
    href: "https://www.alesis.com/",
    logo: "/UVS/partners/Alesis/Alesis.png",
  },
  {
    name: "BOSS Katana",
    href: "https://www.boss.info/global/categories/amplifiers/katana/",
    logo: "/UVS/partners/BOSS KATANA GEN/boss-katana-gen.png",
  },
  {
    name: "Blackstar",
    href: "https://blackstaramps.com/",
    logo: "/UVS/partners/Blackstar_Amps/Blackstar_Amps_id13CxzVOg_0.png",
  },
  {
    name: "Cort",
    href: "https://www.cortguitars.com/",
    logo: "/UVS/partners/Cort/Cort.png",
  },
  {
    name: "Davis",
    href: "https://www.davisguitars.com/",
    logo: "/UVS/partners/Davis/Davis_Logo_Black.png",
  },
  {
    name: "J&T Express",
    href: "https://www.jtexpress.ph/",
    logo: "/UVS/partners/JT_Express/JT_Express_idJtGBWzG2_0.png",
  },
  {
    name: "Jasmine",
    href: "https://www.jasmineguitars.com/",
    logo: "/UVS/partners/Jasmine/Jasmine.png",
  },
  {
    name: "Lyric",
    href: "https://www.lyric.ph/",
    logo: "/UVS/partners/Lyric/Lyric.png",
    imageClassName: "md:scale-[1.8]",
  },
  {
    name: "Marshall",
    href: "https://marshall.com/",
    logo: "/UVS/partners/Marshall/Marshal-Logo.svg",
  },
  {
    name: "NUX",
    href: "https://nuxaudio.com/",
    logo: "/UVS/partners/NUX/NUX-LOGO-B.png",
  },
  {
    name: "Roland",
    href: "https://www.roland.com/global/",
    logo: "/UVS/partners/Roland/Roland_idOYiKaf5__0.svg",
  },
  {
    name: "Severo",
    href: "https://www.facebook.com/SeveroGuitars/",
    logo: "/UVS/partners/Severo/Severo-guitars.png",
    imageClassName: "md:scale-[1.45]",
  },
  {
    name: "Squier by Fender",
    href: "https://www.fender.com/collections/squier",
    logo: "/UVS/partners/Squeir by Fender/squier-by-fender-logo.png",
    imageClassName: "md:scale-[1.5]",
  },
  {
    name: "Thomson",
    href: "https://www.thomson.ph/",
    logo: "/UVS/partners/Thomson/thomson-logo(0).png",
    imageClassName: "md:scale-[1.6]",
  },
  {
    name: "Yamaha",
    href: "https://www.yamaha.com/",
    logo: "/UVS/partners/Yamaha/yamaha-logo.png",
    imageClassName: "md:scale-[1.45]",
  },
];

const marqueePartners = [...PARTNERS, ...PARTNERS, ...PARTNERS];

/**
 * Home layout with hero stagger and scroll reveals (GSAP ScrollTrigger).
 * Copy and images come from admin CMS (Supabase).
 */
export function HomeScrollExperience({
  products,
  home,
  socialProof,
  selectionMode = false,
  visualBlocks = [],
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const partnersRef = useRef<HTMLDivElement>(null);
  const latestHeaderRef = useRef<HTMLDivElement>(null);
  const productsGridRef = useRef<HTMLDivElement>(null);

  const selectedTargetRef = useRef<HTMLElement | null>(null);
  const selectionRefreshFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectionMode) return;
    const parentOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : window.location.origin;
      } catch {
        return window.location.origin;
      }
    })();

    const getCmsTarget = (eventTarget: EventTarget | null) => {
      if (!(eventTarget instanceof Element)) {
        return null;
      }
      return eventTarget.closest<HTMLElement>("[data-cms-id]");
    };

    const decorateEditorNodes = () => {
      const rootIds = new Set([
        "storefront-header",
        "home-hero",
        "home-latest",
        "storefront-footer",
        "home-footer",
      ]);
      document.querySelectorAll<HTMLElement>("[data-cms-id]").forEach((node) => {
        if (rootIds.has(node.dataset.cmsId ?? "")) {
          node.dataset.cmsBlockId = node.dataset.cmsId;
        }
        node.dataset.uvsId ??= node.dataset.cmsId;
      });
      const nodes = Array.from(document.body.querySelectorAll<HTMLElement>("*:not(script):not(style)"));
      nodes.forEach((node) => {
        if (node.dataset.cmsId) return;
        const path: number[] = [];
        let current: Element | null = node;
        while (current && current !== document.body) {
          path.unshift(Array.prototype.indexOf.call(current.parentElement?.children ?? [], current));
          current = current.parentElement;
        }
        node.dataset.cmsId = `cms-dom-${path.join("-")}`;
        node.dataset.cmsLabel = node.tagName.toLowerCase();
        node.dataset.cmsGenerated = "true";
        node.dataset.uvsId = node.dataset.cmsId;
        const owner = node.closest<HTMLElement>("[data-cms-block-id]");
        if (owner?.dataset.cmsBlockId) {
          node.dataset.cmsBlockId = owner.dataset.cmsBlockId;
          if (owner.dataset.cmsBlockType === "visual_primitive") {
            const relativePath: number[] = [];
            let current: Element | null = node;
            while (current && current !== owner) {
              relativePath.unshift(Array.prototype.indexOf.call(current.parentElement?.children ?? [], current));
              current = current.parentElement;
            }
            node.dataset.cmsVisualPath = relativePath.join("-");
          }
        }
      });
    };
    decorateEditorNodes();
    document.body.dataset.uvsEditor = "true";
    const observer = new MutationObserver(decorateEditorNodes);
    observer.observe(document.body, { childList: true, subtree: true });

    let selectionOverlay: HTMLElement | null = null;
    const paintSelectionOverlay = (target: HTMLElement | null) => {
      selectionOverlay?.remove();
      selectionOverlay = null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.dataset.uvsOverlay = "true";
      Object.assign(overlay.style, {
        position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        minWidth: "2px", minHeight: "2px",
        pointerEvents: "none", outline: "2px solid #2563eb", zIndex: "2147483647",
      });
      const handle = document.createElement("button");
      handle.type = "button";
      handle.dataset.uvsHandle = "bottom-right";
      handle.setAttribute("aria-label", "Resize selected element");
      Object.assign(handle.style, {
        position: "absolute", right: "-5px", bottom: "-5px", width: "10px", height: "10px",
        padding: "0", border: "1px solid white", borderRadius: "2px", background: "#2563eb",
        cursor: "nwse-resize", pointerEvents: "auto",
      });
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      const onPointerMove = (event: PointerEvent) => {
        target.style.width = `${Math.max(0, startWidth + event.clientX - startX)}px`;
        target.style.height = `${Math.max(0, startHeight + event.clientY - startY)}px`;
        overlay.style.width = target.style.width;
        overlay.style.height = target.style.height;
      };
      const onPointerUp = () => {
        const owner = target.closest<HTMLElement>("[data-cms-block-id]");
        window.parent.postMessage({ source: "cms-builder-dom-mutation", id: target.dataset.cmsId, blockId: owner?.dataset.cmsBlockId ?? null, visualPath: target.dataset.cmsVisualPath, prop: "style.width", value: target.style.width }, parentOrigin);
        window.parent.postMessage({ source: "cms-builder-dom-mutation", id: target.dataset.cmsId, blockId: owner?.dataset.cmsBlockId ?? null, visualPath: target.dataset.cmsVisualPath, prop: "style.height", value: target.style.height }, parentOrigin);
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
      };
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = target.getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        startWidth = current.width;
        startHeight = current.height;
        handle.setPointerCapture?.(event.pointerId);
        handle.addEventListener("pointermove", onPointerMove);
        handle.addEventListener("pointerup", onPointerUp, { once: true });
      });
      overlay.append(handle);
      document.body.append(overlay);
      selectionOverlay = overlay;
    };

    const sendTarget = (source: "cms-builder-hover" | "cms-builder", target: HTMLElement | null) => {
      if (source === "cms-builder") selectedTargetRef.current = target;
      if (!target) {
        window.parent.postMessage({ source, id: null }, parentOrigin);
        return;
      }
      // React can replace preview nodes after the initial decoration pass. Keep
      // the selection bridge contract true at the point the node is reported.
      target.dataset.uvsId ??= target.dataset.cmsId;
      const rect = target.getBoundingClientRect();
      const block = target.closest<HTMLElement>("[data-cms-block-id]");
      const component = target.closest<HTMLElement>(
        "[data-cms-id]:not([data-cms-generated='true'])",
      );
      const componentId = component?.dataset.cmsId ?? "";
      const tileMatch = componentId.match(/^home-tile-(\d+)$/);
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const media = target.closest<HTMLImageElement>("img[src]");
      const style = ["display", "position", "width", "height", "margin", "padding", "color", "background-color", "font-size", "font-weight", "border-radius", "gap", "align-items", "justify-content", "grid-template-columns", "min-width", "max-width", "min-height", "max-height", "line-height", "letter-spacing", "border", "box-shadow", "object-fit", "object-position", "background-size", "background-position"]
        .reduce<Record<string, string>>((out, key) => {
          const value = target.style.getPropertyValue(key);
          if (value) out[key] = value;
          return out;
        }, {});
      window.parent.postMessage(
        {
          source,
          id: target.dataset.cmsId,
          label: target.dataset.cmsLabel ?? target.dataset.cmsId,
          blockId: block?.dataset.cmsBlockId ?? null,
          parentId: componentId && componentId !== target.dataset.cmsId ? componentId : null,
          propertyKey: tileMatch ? "tiles" : null,
          arrayIndex: tileMatch ? Number(tileMatch[1]) : null,
          tagName: target.tagName.toLowerCase(),
          text: target.children.length === 0 ? (target.textContent ?? "").slice(0, 2000) : "",
          href: anchor?.href ?? "",
          src: media?.src ?? "",
          visualPath: target.dataset.cmsVisualPath,
          style,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        },
        parentOrigin,
      );
    };

    const onMutation = (event: MessageEvent<{
      source?: string;
      id?: string;
      prop?: string;
      value?: string;
    }>) => {
      if (
        event.source !== window.parent ||
        event.origin !== parentOrigin ||
        event.data?.source !== "cms-builder-dom-edit"
      ) return;
      const target = selectedTargetRef.current;
      if (!target || event.data?.id !== target.dataset.cmsId) return;
      let prop = event.data?.prop;
      const value = typeof event.data?.value === "string" ? event.data.value : "";
      if (!prop || value.length > 100_000) return;
      if (prop === "textContent" && target.children.length === 0) target.textContent = value;
      else if (prop === "href" && target instanceof HTMLAnchorElement) target.href = value;
      else if (prop === "src" && target instanceof HTMLImageElement) target.src = value;
      else if (prop.startsWith("style.")) {
        const styleProperty = normalizeCmsDomStyle(prop, value);
        if (!styleProperty) return;
        target.style.setProperty(styleProperty.slice(6), value);
        prop = styleProperty;
      } else return;
      const block = target.closest<HTMLElement>("[data-cms-block-id]");
      window.parent.postMessage({ source: "cms-builder-dom-mutation", id: target.dataset.cmsId, blockId: block?.dataset.cmsBlockId ?? null, visualPath: target.dataset.cmsVisualPath, prop, value }, parentOrigin);
      sendTarget("cms-builder", target);
    };

    const onBuilderSelect = (event: MessageEvent<{ source?: string; id?: string | null }>) => {
      if (
        event.source !== window.parent ||
        event.origin !== parentOrigin ||
        event.data?.source !== "cms-builder-select"
      ) return;
      const id = event.data.id;
      const target = id
        ? Array.from(document.querySelectorAll<HTMLElement>("[data-cms-id]"))
            .find((node) => node.dataset.cmsId === id) ?? null
        : null;
      document.querySelectorAll<HTMLElement>("[data-cms-id]").forEach((node) => {
        node.dataset.selected = node === target ? "true" : "false";
      });
      selectedTargetRef.current = target;
      paintSelectionOverlay(target);
      sendTarget("cms-builder", target);
    };

    const onPointerOver = (event: PointerEvent) => {
      const target = getCmsTarget(event.target);
      const related = event.relatedTarget;
      if (target && related instanceof Node && target.contains(related)) return;
      sendTarget("cms-builder-hover", target);
    };

    const onPointerOut = (event: PointerEvent) => {
      const target = getCmsTarget(event.target);
      const related = event.relatedTarget;
      if (target && related instanceof Node && target.contains(related)) return;
      if (!getCmsTarget(related)) sendTarget("cms-builder-hover", null);
    };

    const onInput = (event: Event) => {
      const target = getCmsTarget(event.target);
      if (!target || target.children.length > 0 || target !== selectedTargetRef.current) return;
      const block = target.closest<HTMLElement>("[data-cms-block-id]");
      window.parent.postMessage({
        source: "cms-builder-dom-mutation",
        id: target.dataset.cmsId,
        blockId: block?.dataset.cmsBlockId ?? null,
        visualPath: target.dataset.cmsVisualPath,
        prop: "textContent",
        value: target.textContent ?? "",
      }, parentOrigin);
    };

    const onClick = (event: MouseEvent) => {
      const target = getCmsTarget(event.target);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll<HTMLElement>("[data-cms-id]").forEach((node) => {
        node.dataset.selected = node === target ? "true" : "false";
      });
      if (target.children.length === 0 && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        target.contentEditable = "true";
        target.dataset.cmsEditableText = "true";
      }
      paintSelectionOverlay(target);
      sendTarget("cms-builder", target);
    };

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("application/x-uvs-component")) event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      const componentId = event.dataTransfer?.getData("application/x-uvs-component");
      const target = getCmsTarget(event.target);
      if (!componentId || !target) return;
      event.preventDefault();
      const slot = target.closest<HTMLElement>("[data-cms-slot]")?.dataset.cmsSlot;
      window.parent.postMessage({
        source: "cms-builder-dom-drop",
        parentId: slot ? `slot:${slot}` : target.dataset.cmsId,
        index: target.parentElement ? Array.prototype.indexOf.call(target.parentElement.children, target) : 0,
        componentId,
      }, parentOrigin);
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    window.addEventListener("message", onMutation);
    window.addEventListener("message", onBuilderSelect);
    const refreshSelected = () => {
      if (selectionRefreshFrameRef.current !== null) return;
      selectionRefreshFrameRef.current = window.requestAnimationFrame(() => {
        selectionRefreshFrameRef.current = null;
        const target = selectedTargetRef.current;
        if (target) {
          paintSelectionOverlay(target);
          sendTarget("cms-builder", target);
        }
      });
    };
    window.addEventListener("scroll", refreshSelected, true);
    window.addEventListener("resize", refreshSelected);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drop", onDrop, true);
      window.removeEventListener("message", onMutation);
      window.removeEventListener("message", onBuilderSelect);
      window.removeEventListener("scroll", refreshSelected, true);
      window.removeEventListener("resize", refreshSelected);
      if (selectionRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionRefreshFrameRef.current);
        selectionRefreshFrameRef.current = null;
      }
      observer.disconnect();
      selectionOverlay?.remove();
      document.querySelectorAll<HTMLElement>("[data-cms-editable-text]").forEach((node) => {
        node.contentEditable = "false";
        delete node.dataset.cmsEditableText;
      });
      delete document.body.dataset.uvsEditor;
      selectedTargetRef.current = null;
    };
  }, [selectionMode]);

  useEffect(() => {
    if (!home.domOverrides) return;
    const applyOverride = (node: HTMLElement, overrides: Record<string, unknown>) => {
      for (const [prop, value] of Object.entries(overrides)) {
        if (typeof value !== "string") continue;
        if (prop === "textContent" && node.children.length === 0) node.textContent = value;
        else if (prop === "href" && node instanceof HTMLAnchorElement) node.href = value;
        else if (prop === "src" && node instanceof HTMLImageElement) node.src = value;
        else if (prop.startsWith("style.")) {
          const styleProperty = normalizeCmsDomStyle(prop, value);
          if (styleProperty) node.style.setProperty(styleProperty.slice(6), value);
        }
      }
    };
    for (const [id, overrides] of Object.entries(home.domOverrides)) {
      const node = Array.from(
        document.querySelectorAll<HTMLElement>("[data-cms-id]"),
      ).find((candidate) => candidate.dataset.cmsId === id);
      if (node) applyOverride(node, overrides);
    }
    for (const owner of Array.from(document.querySelectorAll<HTMLElement>('[data-cms-block-type="visual_primitive"]'))) {
      for (const node of Array.from(owner.querySelectorAll<HTMLElement>("*:not(script):not(style)"))) {
        const path: number[] = [];
        let current: Element | null = node;
        while (current && current !== owner) {
          path.unshift(Array.prototype.indexOf.call(current.parentElement?.children ?? [], current));
          current = current.parentElement;
        }
        const overrides = home.domOverrides[`__visual_path:${path.join("-")}`];
        if (overrides) applyOverride(node, overrides);
      }
    }
  }, [home.domOverrides]);

  const heroStyle = home.hero.style;
  const heroLeadTone = heroLeadToneClass(heroStyle.textTone);
  const heroLeadWidth = heroLeadWidthClass(heroStyle.contentWidth);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ease = "power3.out";
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({ defaults: { duration: 0.8, ease } });
      if (leadRef.current) {
        heroTl.from(
          leadRef.current,
          { y: 30, duration: 0.8, ease },
          "-=0.55",
        );
      }
      if (ctaRef.current) {
        heroTl.from(
          ctaRef.current,
          { y: 30, duration: 0.8, ease },
          "-=0.55",
        );
      }
      if (partnersRef.current) {
        heroTl.from(
          partnersRef.current,
          { y: 24, duration: 0.75, ease },
          "-=0.48",
        );
      }

      if (latestHeaderRef.current) {
        gsap.from(latestHeaderRef.current.children, {
          scrollTrigger: {
            trigger: latestHeaderRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          y: 36,
          opacity: 0,
          duration: 0.75,
          stagger: 0.12,
          ease,
        });
      }

      batchScrollRevealChildren(
        gsap,
        ScrollTrigger,
        productsGridRef.current,
        "[data-home-product]",
        {
          ease,
          y: 50,
          duration: 0.72,
          stagger: 0.12,
          start: "top 82%",
        },
      );

    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, [products.length, home.hero.line1]);

  return (
    <div
      ref={rootRef}
      data-cms-visual-block-count={visualBlocks.length}
    >
      <section
        data-cms-id="home-hero"
        data-uvs-id="home-hero"
        data-cms-label="Hero"
        style={sectionStyle(home.hero.layout)}
        className="relative flex min-h-[clamp(22rem,72svh,40rem)] w-full items-center overflow-hidden bg-surface-container-low storefront-section-x py-10 sm:py-14 md:py-16 lg:py-20"
      >
        <div className="relative z-10 mx-auto w-full max-w-[1600px]">
          <p
            ref={leadRef}
            data-cms-id="home-hero-lead"
            data-uvs-id="home-hero-lead"
            data-cms-label="Supporting text"
            className={`mb-8 ${heroLeadWidth} font-body text-base leading-relaxed ${heroLeadTone} sm:mb-10 sm:text-lg`}
          >
            {home.hero.lead}{" "}
            {home.hero.showPrivacyLink ? (
              <Link
                href="/privacy"
                className="font-medium text-primary underline underline-offset-4 hover:no-underline"
              >
                Privacy policy
              </Link>
            ) : null}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:mt-0 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              className="bg-gradient-to-br from-primary to-primary-container px-8 py-3.5 font-medium sm:px-10 sm:py-4"
            >
              <Link ref={ctaRef} data-cms-id="home-hero-cta" data-uvs-id="home-hero-cta" data-cms-label="Primary action" href={home.hero.ctaHref || "/shop"}>
                {home.hero.ctaLabel}
              </Link>
            </Button>
            <RatingBadge
              rating={socialProof.reviewSummary.average}
              title={`${socialProof.customerCount.toLocaleString("en-PH")} customers`}
              subtitle={`${socialProof.reviewSummary.count.toLocaleString("en-PH")} reviews`}
              className="shrink-0 sm:ml-2"
            />
          </div>
          <div
            ref={partnersRef}
            className="mt-8 w-full max-w-[min(100%,38rem)]"
          >
            <div className="mb-3 flex flex-col gap-1">
              <span data-cms-id="home-hero-eyebrow" data-uvs-id="home-hero-eyebrow" data-cms-label="Eyebrow" className="font-headline text-[0.7rem] font-bold uppercase tracking-[0.3em] text-on-surface-variant">
                Partners with
              </span>
              <span className="text-[0.7rem] font-medium text-on-surface-variant">
                Official brands & logistics partners
              </span>
            </div>
            <div
            data-cms-id="home-hero-partners"
            data-uvs-id="home-hero-partners"
              data-cms-label="Partner marquee"
              className="group relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
              aria-label="Partners logo marquee"
            >
              <div
                className="flex min-w-max items-center gap-6 motion-safe:animate-[partner-marquee_24s_linear_infinite] motion-reduce:animate-none group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
                role="list"
                aria-label="Official brand and logistics partners"
              >
                {marqueePartners.map((partner, index) => {
                  const isDecorativeClone = index >= PARTNERS.length;
                  return (
                    <li
                      key={`${partner.name}-${partner.href}-${index}`}
                      role="listitem"
                      aria-hidden={isDecorativeClone || undefined}
                      className="flex h-14 w-[clamp(7.25rem,14vw,9rem)] shrink-0 items-center justify-center"
                    >
                    <a
                      href={partner.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group/logo flex h-14 w-[clamp(7.25rem,14vw,9rem)] shrink-0 items-center justify-center rounded-lg bg-transparent px-3 opacity-80 transition-[transform,opacity,filter] duration-300 hover:-translate-y-0.5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      aria-label={`Visit ${partner.name} official site`}
                      tabIndex={isDecorativeClone ? -1 : undefined}
                    >
                      <span className="sr-only">{partner.name}</span>
                      <div className="relative h-full w-full">
                        <Image
                          src={encodeURI(partner.logo)}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 42vw, 180px"
                          className={`object-contain object-center transition-transform duration-300 group-hover/logo:scale-[1.03] ${
                            partner.imageClassName ?? ""
                          }`}
                        />
                      </div>
                    </a>
                    </li>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-full md:w-1/2">
          <FeaturedProductsCarousel products={products} />
        </div>
      </section>

      <section
        data-cms-id="home-latest"
        data-uvs-id="home-latest"
        data-cms-label="Latest products"
        style={sectionStyle(home.sectionLayout?.latest)}
        className="scroll-mt-[5.5rem] bg-surface-container-low py-14 sm:py-16 md:py-24 storefront-section-x"
      >
        <div className="mx-auto max-w-[1600px]">
          <div
            ref={latestHeaderRef}
          data-cms-id="home-latest-header"
          data-uvs-id="home-latest-header"
            data-cms-label="Section heading"
            className="mb-10 flex flex-col items-baseline justify-between gap-4 sm:mb-12 md:mb-16 md:flex-row"
          >
            <h2 className="font-headline text-3xl font-extrabold tracking-tighter sm:text-4xl">
              {home.latestSection.title}
            </h2>
            <div className="mx-8 hidden h-0.5 flex-grow bg-outline-variant opacity-20 md:block" />
            <Link
              href={home.latestSection.viewAllHref || "/shop"}
              className="font-medium text-primary transition-[text-decoration-color] hover:underline"
            >
              {home.latestSection.viewAllLabel}
            </Link>
          </div>
          {products.length === 0 ? (
            <div className="mx-auto max-w-2xl space-y-4 py-12 text-center sm:py-16">
              <p className="font-medium text-on-surface">No products on the home grid yet.</p>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                Products will show here when they are live in the{" "}
                <Link href="/shop" className="font-medium text-primary underline-offset-4 hover:underline">
                  shop catalog
                </Link>
                . If you are the shop team and expect products here, check that items are
                published and available for your storefront region in admin.
              </p>
            </div>
          ) : (
            <div
              ref={productsGridRef}
            data-cms-id="home-latest-products"
            data-uvs-id="home-latest-products"
              data-cms-label="Product grid"
              className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-16 lg:grid-cols-4"
            >
              {products.map((product) => (
                <div key={product.id} data-home-product>
                  <CatalogProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {visualBlocks.map((block) => {
        const markup = sanitizeCmsHtml(String(block.props.markup ?? ""));
        if (!markup.trim()) return null;
        const overrides = block.props.domOverrides && typeof block.props.domOverrides === "object"
          ? block.props.domOverrides as Record<string, Record<string, unknown>>
          : {};
        const content = typeof overrides[block.id]?.innerHTML === "string"
          ? sanitizeCmsHtml(String(overrides[block.id].innerHTML))
          : sanitizeCmsHtml(markup);
        return (
          <section
            key={block.id}
            data-cms-id={block.id}
            data-uvs-id={block.id}
            data-cms-label={String(block.props.sourceName ?? block.props.sourceType ?? "Vvveb component")}
            data-cms-block-id={block.id}
            data-cms-block-type="visual_primitive"
            data-cms-source-type={String(block.props.sourceType ?? "")}
            className="storefront-section-x"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      })}

    </div>
  );
}
