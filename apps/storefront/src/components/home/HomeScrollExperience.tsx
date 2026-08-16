"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@universal-music-store/ui";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { RatingBadge } from "@/components/foundations/rating-badge";
import type { Product } from "@universal-music-store/types";
import type { StorefrontHomePayload, StorefrontHomeSectionLayout } from "@universal-music-store/platform-data";
import type { HomepageSocialProof } from "@/lib/homepage-social-proof";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef, useState, useCallback, useEffect, type CSSProperties } from "react";
import { batchScrollRevealChildren } from "@/lib/gsap-scroll-system";
import { getRecaptchaToken } from "@/components/RecaptchaScript";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  products: Product[];
  home: StorefrontHomePayload;
  socialProof: {
    customerCount: number;
    reviewSummary: HomepageSocialProof;
  };
  selectionMode?: boolean;
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

function heroFontClass(style: HeroStyle["headlineFont"]): string {
  if (style === "body") return "font-body";
  if (style === "mono") return "font-mono";
  return "font-headline";
}

function heroToneClass(style: HeroStyle["textTone"]): string {
  if (style === "neutral") return "text-on-surface";
  if (style === "muted") return "text-on-surface-variant";
  return "text-primary";
}

function heroLeadToneClass(style: HeroStyle["textTone"]): string {
  if (style === "neutral") return "text-on-surface-variant";
  if (style === "muted") return "text-on-surface-variant/90";
  return "text-primary/80";
}

function heroTitleSizeClass(style: HeroStyle["headlineSize"]): string {
  if (style === "compact") {
    return "text-[clamp(1.9rem,6.2vw,3.6rem)] md:text-[clamp(2.1rem,5.6vw,4rem)]";
  }
  if (style === "hero") {
    return "text-[clamp(2.3rem,8vw,5.25rem)] md:text-[clamp(2.7rem,7vw,5.6rem)]";
  }
  return "text-[clamp(2rem,7.5vw,4.75rem)] md:text-[clamp(2.25rem,6.5vw,4.5rem)]";
}

function heroWidthClass(style: HeroStyle["contentWidth"]): string {
  if (style === "extra") return "max-w-[min(100%,52rem)] lg:max-w-[60rem]";
  if (style === "wide") return "max-w-[min(100%,48rem)] lg:max-w-[54rem]";
  return "max-w-[min(100%,42rem)] lg:max-w-[48rem]";
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
    imageClassName: "scale-[1.8]",
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
    imageClassName: "scale-[1.45]",
  },
  {
    name: "Squier by Fender",
    href: "https://www.fender.com/collections/squier",
    logo: "/UVS/partners/Squeir by Fender/squier-by-fender-logo.png",
    imageClassName: "scale-[1.5]",
  },
  {
    name: "Thomson",
    href: "https://www.thomson.ph/",
    logo: "/UVS/partners/Thomson/thomson-logo(0).png",
    imageClassName: "scale-[1.6]",
  },
  {
    name: "Yamaha",
    href: "https://www.yamaha.com/",
    logo: "/UVS/partners/Yamaha/yamaha-logo.png",
    imageClassName: "scale-[1.45]",
  },
];

const marqueePartners = [...PARTNERS, ...PARTNERS, ...PARTNERS];

function TileMedia({
  imageUrl,
  fallbackClass,
}: {
  imageUrl: string;
  fallbackClass: string;
}) {
  const trimmed = imageUrl?.trim();
  if (trimmed) {
    if (isKnownUnavailableExternalImage(trimmed)) {
      return (
        <div
          className={`flex h-full min-h-[inherit] w-full items-end justify-start bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high p-5 transition-transform duration-700 group-hover:scale-105 ${fallbackClass}`}
        >
          <div className="max-w-[16rem] rounded-lg bg-white/85 px-4 py-3 text-sm font-medium text-on-surface shadow-sm">
            Featured image unavailable
          </div>
        </div>
      );
    }
    return (
      <div className="relative h-full min-h-[inherit] w-full">
        <Image
          src={trimmed}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 66vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          unoptimized={shouldUnoptimizeImage(trimmed)}
        />
      </div>
    );
  }
  return (
    <div
      className={`h-full min-h-[inherit] w-full transition-transform duration-700 group-hover:scale-105 ${fallbackClass}`}
    />
  );
}

/**
 * Home layout with hero stagger and scroll reveals (GSAP ScrollTrigger).
 * Copy and images come from admin CMS (Supabase).
 */
export function HomeScrollExperience({
  products,
  home,
  socialProof,
  selectionMode = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const leadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const partnersRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const collectionsRef = useRef<HTMLElement>(null);
  const latestHeaderRef = useRef<HTMLDivElement>(null);
  const productsGridRef = useRef<HTMLDivElement>(null);
  const clubRef = useRef<HTMLElement>(null);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
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
        "home-tiles",
        "home-latest",
        "home-newsletter",
        "storefront-footer",
        "home-footer",
      ]);
      document.querySelectorAll<HTMLElement>("[data-cms-id]").forEach((node) => {
        if (rootIds.has(node.dataset.cmsId ?? "")) {
          node.dataset.cmsBlockId = node.dataset.cmsId;
        }
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
        const owner = node.closest<HTMLElement>("[data-cms-block-id]");
        if (owner?.dataset.cmsBlockId) node.dataset.cmsBlockId = owner.dataset.cmsBlockId;
      });
    };
    decorateEditorNodes();
    const observer = new MutationObserver(decorateEditorNodes);
    observer.observe(document.body, { childList: true, subtree: true });

    const sendTarget = (source: "cms-builder-hover" | "cms-builder", target: HTMLElement | null) => {
      if (source === "cms-builder") selectedTargetRef.current = target;
      if (!target) {
        window.parent.postMessage({ source, id: null }, parentOrigin);
        return;
      }
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
      const prop = event.data?.prop;
      const value = typeof event.data?.value === "string" ? event.data.value : "";
      if (!prop || value.length > 100_000) return;
      if (prop === "textContent" && target.children.length === 0) target.textContent = value;
      else if (prop === "href" && target instanceof HTMLAnchorElement) target.href = value;
      else if (prop === "src" && target instanceof HTMLImageElement) target.src = value;
      else if (prop.startsWith("style.")) {
        const css = prop.slice(6);
        if (["display", "position", "width", "height", "margin", "padding", "color", "background-color", "font-size", "font-weight", "border-radius", "gap", "align-items", "justify-content", "grid-template-columns", "min-width", "max-width", "min-height", "max-height", "line-height", "letter-spacing", "border", "box-shadow", "object-fit", "object-position", "background-size", "background-position"].includes(css) && !/[{};]/.test(value) && !/url\s*\(/i.test(value)) {
          target.style.setProperty(css, value);
        }
      } else return;
      const block = target.closest<HTMLElement>("[data-cms-block-id]");
      window.parent.postMessage({ source: "cms-builder-dom-mutation", id: target.dataset.cmsId, blockId: block?.dataset.cmsBlockId ?? null, prop, value }, parentOrigin);
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

    const onClick = (event: MouseEvent) => {
      const target = getCmsTarget(event.target);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll<HTMLElement>("[data-cms-id]").forEach((node) => {
        node.dataset.selected = node === target ? "true" : "false";
      });
      sendTarget("cms-builder", target);
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMutation);
    const refreshSelected = () => {
      if (selectionRefreshFrameRef.current !== null) return;
      selectionRefreshFrameRef.current = window.requestAnimationFrame(() => {
        selectionRefreshFrameRef.current = null;
        const target = selectedTargetRef.current;
        if (target) sendTarget("cms-builder", target);
      });
    };
    window.addEventListener("scroll", refreshSelected, true);
    window.addEventListener("resize", refreshSelected);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMutation);
      window.removeEventListener("scroll", refreshSelected, true);
      window.removeEventListener("resize", refreshSelected);
      if (selectionRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionRefreshFrameRef.current);
        selectionRefreshFrameRef.current = null;
      }
      observer.disconnect();
      selectedTargetRef.current = null;
    };
  }, [selectionMode]);

  useEffect(() => {
    if (!home.domOverrides) return;
    for (const [id, overrides] of Object.entries(home.domOverrides)) {
      const node = Array.from(
        document.querySelectorAll<HTMLElement>("[data-cms-id]"),
      ).find((candidate) => candidate.dataset.cmsId === id);
      if (!node) continue;
      for (const [prop, value] of Object.entries(overrides)) {
        if (prop === "textContent" && node.children.length === 0) node.textContent = value;
        else if (prop === "href" && node instanceof HTMLAnchorElement) node.href = value;
        else if (prop === "src" && node instanceof HTMLImageElement) node.src = value;
        else if (prop.startsWith("style.")) node.style.setProperty(prop.slice(6), value);
      }
    }
  }, [home.domOverrides]);

  const handleNewsletterSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = newsletterEmail.trim();
      if (!trimmed || !trimmed.includes("@")) {
        setNewsletterError("Please enter a valid email address.");
        return;
      }
      setNewsletterStatus("sending");
      setNewsletterError(null);
      try {
        const recaptchaToken = await getRecaptchaToken("signup");
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, source: "homepage", recaptchaToken }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        setNewsletterStatus("sent");
        setNewsletterEmail("");
      } catch (err) {
        setNewsletterStatus("error");
        setNewsletterError(err instanceof Error ? err.message : "Subscription failed. Try again.");
      }
    },
    [newsletterEmail],
  );

  const heroStyle = home.hero.style;
  const heroTone = heroToneClass(heroStyle.textTone);
  const heroLeadTone = heroLeadToneClass(heroStyle.textTone);
  const heroFont = heroFontClass(heroStyle.headlineFont);
  const heroTitleSize = heroTitleSizeClass(heroStyle.headlineSize);
  const heroWidth = heroWidthClass(heroStyle.contentWidth);
  const heroLeadWidth = heroLeadWidthClass(heroStyle.contentWidth);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ease = "power3.out";
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({ defaults: { duration: 0.8, ease } });
      if (line1Ref.current) {
        heroTl.from(line1Ref.current, {
          x: 100,
          opacity: 0,
          duration: 0.8,
          ease,
        });
      }
      if (line2Ref.current) {
        heroTl.from(
          line2Ref.current,
          { y: 30, opacity: 0, duration: 0.8, ease },
          "-=0.5",
        );
      }
      if (leadRef.current) {
        heroTl.from(
          leadRef.current,
          { y: 30, opacity: 0, duration: 0.8, ease },
          "-=0.55",
        );
      }
      if (ctaRef.current) {
        heroTl.from(
          ctaRef.current,
          { y: 30, opacity: 0, duration: 0.8, ease },
          "-=0.55",
        );
      }
      if (partnersRef.current) {
        heroTl.from(
          partnersRef.current,
          { y: 24, opacity: 0, duration: 0.75, ease },
          "-=0.48",
        );
      }
      if (asideRef.current) {
        heroTl.from(
          asideRef.current,
          { opacity: 0, scale: 1.04, duration: 1, ease: "power2.out" },
          "-=0.9",
        );
      }

      const panels = collectionsRef.current?.querySelectorAll<HTMLElement>(
        "[data-home-collection-panel]",
      );
      if (panels?.length) {
        panels.forEach((panel, index) => {
          const fromX = index % 2 === 0 ? -70 : 70;
          gsap.from(panel, {
            scrollTrigger: {
              trigger: panel,
              start: "top 88%",
              toggleActions: "play none none none",
            },
            x: fromX,
            opacity: 0,
            duration: 0.85,
            ease,
          });
        });
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

      if (clubRef.current) {
        gsap.from(clubRef.current.children, {
          scrollTrigger: {
            trigger: clubRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          y: 32,
          opacity: 0,
          duration: 0.75,
          stagger: 0.15,
          ease,
        });
      }
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, [products.length, home.hero.line1]);

  const heroImage = home.hero.imageUrl?.trim();
  const heroVideo = home.hero.mediaType === "video" ? home.hero.videoUrl?.trim() : "";

  return (
    <div
      ref={rootRef}
    >
      <section
        data-cms-id="home-hero"
        data-cms-label="Hero"
        style={sectionStyle(home.hero.layout)}
        className="relative flex min-h-[clamp(22rem,72svh,40rem)] w-full items-center overflow-hidden bg-surface-container-low storefront-section-x py-10 sm:py-14 md:py-16 lg:py-20"
      >
        <div className="relative z-10 mx-auto w-full max-w-[1600px]">
          <h1
            className={`mb-6 ${heroWidth} ${heroFont} ${heroTitleSize} font-extrabold leading-[1.02] tracking-tighter ${heroTone} sm:mb-8`}
          >
              <span ref={line1Ref} data-cms-id="home-hero-title" data-cms-label="Headline" className="block">
              {home.hero.line1}
            </span>
            <span
              ref={line2Ref}
              className={`block text-[clamp(1.2rem,4.2vw,2.75rem)] font-bold tracking-tight ${heroTone}`}
            >
              {home.hero.line2}
            </span>
          </h1>
          <p
            ref={leadRef}
            data-cms-id="home-hero-lead"
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
              <Link ref={ctaRef} data-cms-id="home-hero-cta" data-cms-label="Primary action" href={home.hero.ctaHref || "/shop"}>
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
              <span data-cms-id="home-hero-eyebrow" data-cms-label="Eyebrow" className="font-headline text-[0.7rem] font-bold uppercase tracking-[0.3em] text-on-surface-variant">
                Partners with
              </span>
              <span className="text-[0.7rem] font-medium text-on-surface-variant">
                Official brands & logistics partners
              </span>
            </div>
            <div
              data-cms-id="home-hero-partners"
              data-cms-label="Partner marquee"
              className="group relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
              aria-label="Partners logo marquee"
            >
              <div
                className="flex min-w-max items-center gap-6 will-change-transform motion-safe:animate-[partner-marquee_24s_linear_infinite] motion-reduce:animate-none group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
              >
                {marqueePartners.map((partner, index) => (
                  <a
                    key={`${partner.name}-${index}`}
                    href={partner.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group/logo flex h-14 w-[clamp(7.25rem,14vw,9rem)] shrink-0 items-center justify-center rounded-lg bg-transparent px-3 opacity-80 transition-[transform,opacity,filter] duration-300 hover:-translate-y-0.5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={`Visit ${partner.name} official site`}
                  >
                    <span className="sr-only">{partner.name}</span>
                    <div className="relative h-full w-full">
                      <Image
                        src={encodeURI(partner.logo)}
                        alt={partner.name}
                        fill
                        sizes="(max-width: 768px) 42vw, 180px"
                        className={`object-contain object-center transition-transform duration-300 group-hover/logo:scale-[1.03] ${
                          partner.imageClassName ?? ""
                        }`}
                      />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          ref={asideRef}
          className="pointer-events-none absolute right-0 top-0 h-full w-full opacity-35 md:w-1/2 md:opacity-100"
        >
          {heroVideo ? (
            <video src={heroVideo} className="h-full w-full object-cover" autoPlay muted loop playsInline aria-label="Hero background video" />
          ) : heroImage ? (
            isKnownUnavailableExternalImage(heroImage) ? (
              <div className="flex h-full w-full items-end justify-start bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high p-6 md:p-10">
                <div className="max-w-sm rounded-xl bg-white/85 px-4 py-3 text-sm font-medium text-on-surface shadow-sm">
                  Featured image unavailable
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  unoptimized={shouldUnoptimizeImage(heroImage)}
                />
              </div>
            )
          ) : (
            <div className="h-full w-full bg-surface-container-high" aria-hidden />
          )}
        </div>
      </section>

      <section
        ref={collectionsRef}
        data-cms-id="home-tiles"
        data-cms-label="Homepage category tiles"
        style={sectionStyle(home.sectionLayout?.tiles)}
        className="bg-surface py-14 sm:py-16 md:py-24 storefront-section-x"
      >
        <div
          data-cms-id="home-tiles-grid"
          data-cms-label="Tile grid"
          className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 md:grid-cols-12"
        >
          {home.tiles.map((tile, index) => {
            const wide = tile.variant === "wide" || index >= 2;
            const dark = tile.variant !== "small";
            return (
              <Link
                key={`${tile.href}-${index}`}
                data-home-collection-panel
                data-cms-id={`home-tile-${index}`}
                data-cms-label={`Category tile ${index + 1}`}
                href={tile.href}
                className={`group relative min-h-[14rem] overflow-hidden rounded-lg bg-surface-container-high ${wide ? "md:col-span-12" : index === 0 ? "md:col-span-8" : "md:col-span-4"}`}
              >
                <TileMedia
                  imageUrl={tile.imageUrl}
                  fallbackClass="bg-surface-container-low"
                />
                <div className={`absolute ${wide ? "inset-0 flex flex-col items-center justify-center text-center" : "bottom-6 left-6 sm:bottom-8 sm:left-8 md:bottom-10 md:left-10"}`}>
                  <h3 className={dark ? "font-headline text-3xl font-extrabold text-white mix-blend-difference sm:text-4xl" : "font-headline text-2xl font-extrabold text-primary sm:text-3xl"}>
                    {tile.title}
                  </h3>
                  {tile.subtitle ? (
                    <p className={`mt-3 text-sm font-medium uppercase tracking-widest ${dark ? "text-white/80" : "text-on-surface-variant"}`}>
                      {tile.subtitle}
                    </p>
                  ) : null}
                  {tile.linkLabel ? (
                    <span className={`mt-2 inline-block font-medium ${dark ? "text-white underline underline-offset-8" : "text-primary transition-all hover:underline hover:underline-offset-8"}`}>
                      {tile.linkLabel}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        data-cms-id="home-latest"
        data-cms-label="Latest products"
        style={sectionStyle(home.sectionLayout?.latest)}
        className="bg-surface-container-low py-14 sm:py-16 md:py-24 storefront-section-x"
      >
        <div className="mx-auto max-w-[1600px]">
          <div
            ref={latestHeaderRef}
            data-cms-id="home-latest-header"
            data-cms-label="Section heading"
            className="mb-10 flex flex-col items-baseline justify-between gap-4 sm:mb-12 md:mb-16 md:flex-row"
          >
            <h2 className="font-headline text-3xl font-extrabold tracking-tighter sm:text-4xl">
              {home.latestSection.title}
            </h2>
            <div className="mx-8 hidden h-0.5 flex-grow bg-outline-variant opacity-20 md:block" />
            <Link
              href={home.latestSection.viewAllHref || "/shop"}
              className="font-medium text-primary transition-all hover:underline"
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

      <section
        ref={clubRef}
        data-cms-id="home-newsletter"
        data-cms-label="Newsletter"
        style={sectionStyle(home.sectionLayout?.newsletter)}
        id="join-club"
        className="flex justify-center bg-surface px-[clamp(0.75rem,4vw,2rem)] py-16 text-center sm:py-24 scroll-mt-[5.5rem]"
      >
        <div className="max-w-xl">
          <h2 data-cms-id="home-newsletter-heading" data-cms-label="Signup heading" className="mb-4 font-headline text-2xl font-extrabold sm:mb-6 sm:text-3xl">
            {home.newsletter.title}
          </h2>
          <p className="mb-8 text-base leading-relaxed text-on-surface-variant sm:mb-10 sm:text-lg">
            {home.newsletter.body}
          </p>
          {newsletterStatus === "sent" ? (
            <p className="rounded bg-surface-container-highest px-6 py-4 text-sm font-medium text-primary">
              You are subscribed. Thank you!
            </p>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              data-cms-id="home-newsletter-form"
              data-cms-label="Signup form"
              className="flex flex-col gap-3 sm:flex-row sm:gap-4"
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder={home.newsletter.placeholder}
                className="min-h-[3rem] flex-grow rounded bg-surface-container-highest px-5 py-3 font-body outline-none focus:ring-1 focus:ring-secondary/40 sm:min-h-0 sm:px-6 sm:py-4"
              />
              <button
                type="submit"
                disabled={newsletterStatus === "sending"}
                className="rounded bg-primary px-6 py-3 font-medium text-on-primary transition-all hover:opacity-90 disabled:opacity-60 sm:px-8 sm:py-4"
              >
                {newsletterStatus === "sending" ? "..." : home.newsletter.buttonLabel}
              </button>
            </form>
          )}
          {newsletterError ? (
            <p className="mt-2 text-xs text-error" role="alert">{newsletterError}</p>
          ) : null}
        </div>
      </section>

    </div>
  );
}
