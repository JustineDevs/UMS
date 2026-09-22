"use client";

import {
  cmsTreeToBlocks,
} from "@universal-music-store/platform-data";
import type {
  CmsBlock,
  StorefrontHomeSectionLayout,
  StorefrontHomePayload,
} from "@universal-music-store/platform-data";
import { useEffect, useRef, useState } from "react";
import { HomeScrollExperience } from "@/components/home/HomeScrollExperience";
import { parseHomePreviewMessage } from "@/components/home-preview-message";
import type { HomepageSocialProof } from "@/lib/homepage-social-proof";
import type { Product } from "@universal-music-store/types";

type Props = {
  products: Product[];
  home: StorefrontHomePayload;
  socialProof: {
    customerCount: number;
    reviewSummary: HomepageSocialProof;
  };
};

function draftHome(blocks: CmsBlock[], previous: StorefrontHomePayload) {
  const next = structuredClone(previous);
  next.domOverrides = Object.assign(
    {},
    ...blocks.map((block) =>
      block.props?.domOverrides && typeof block.props.domOverrides === "object"
        ? block.props.domOverrides
        : {},
    ),
  ) as StorefrontHomePayload["domOverrides"];
  const hero = blocks.find((block) => block.id === "home-hero")?.props;
  if (hero) {
    const lines = String(hero.title ?? "").split(/\r?\n/);
    next.hero = {
      ...next.hero,
      line1: lines[0] ?? "",
      line2: lines.slice(1).join(" "),
      lead: String(hero.subtitle ?? ""),
      imageUrl: String(hero.imageUrl ?? ""),
      mediaType: hero.mediaType === "video" ? "video" : "image",
      videoUrl: String(hero.videoUrl ?? ""),
      ctaHref: String(hero.href ?? "/shop"),
      ctaLabel: String(hero.ctaLabel ?? "Shop Now"),
      showPrivacyLink: Boolean(hero.showPrivacyLink),
      layout: hero.layout as StorefrontHomePayload["hero"]["layout"],
      style: (hero.style ?? next.hero.style) as StorefrontHomePayload["hero"]["style"],
    };
  }
  const tilesBlock = blocks.find((block) => block.id === "home-tiles")?.props;
  const tiles = tilesBlock?.tiles;
  if (Array.isArray(tiles)) {
    next.tiles = tiles as StorefrontHomePayload["tiles"];
  }
  if (tilesBlock?.layout) next.sectionLayout = { ...next.sectionLayout, tiles: tilesBlock.layout as StorefrontHomeSectionLayout };
  const latest = blocks.find((block) => block.id === "home-latest")?.props;
  if (latest) {
    next.latestSection = {
      title: String(latest.title ?? ""),
      viewAllLabel: String(latest.viewAllLabel ?? ""),
      viewAllHref: String(latest.viewAllHref ?? "/shop"),
    };
    if (latest.layout) next.sectionLayout = { ...next.sectionLayout, latest: latest.layout as StorefrontHomeSectionLayout };
  }
  const newsletter = blocks.find((block) => block.id === "home-newsletter")?.props;
  if (newsletter) {
    next.newsletter = {
      title: String(newsletter.heading ?? ""),
      body: String(newsletter.subtitle ?? ""),
      placeholder: String(newsletter.placeholder ?? "email@address.com"),
      buttonLabel: String(newsletter.buttonLabel ?? "Subscribe"),
    };
    if (newsletter.layout) next.sectionLayout = { ...next.sectionLayout, newsletter: newsletter.layout as StorefrontHomeSectionLayout };
  }
  return next;
}

export function StorefrontHomePreviewBridge({
  products,
  home: initialHome,
  socialProof,
}: Props) {
  const [home, setHome] = useState(initialHome);
  const [visualBlocks, setVisualBlocks] = useState<CmsBlock[]>([]);
  const homeRef = useRef(initialHome);
  useEffect(() => {
    homeRef.current = home;
  }, [home]);

  useEffect(() => {
    const parentOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : "";
      } catch {
        return "";
      }
    })();
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      // The admin preview can be served from a different local port and may
      // omit the referrer. The parent-window identity is the trust boundary;
      // only enforce an origin when the embedded document can determine it.
      if (parentOrigin && event.origin !== parentOrigin) return;
      const message = parseHomePreviewMessage(event.data);
      const raw = event.data && typeof event.data === "object"
        ? event.data as Record<string, unknown>
        : null;
      if ((!message && raw?.source !== "cms-builder-draft") || raw?.mode !== "home") return;
      // The block payload is the editor's authoritative draft. Prefer it when
      // both representations are present so newly registered primitive blocks
      // are not lost during a tree round-trip.
      const rawBlocks = Array.isArray(raw?.blocks)
        ? raw.blocks.filter((item): item is CmsBlock => Boolean(
          item && typeof item === "object" &&
          typeof (item as Record<string, unknown>).id === "string" &&
          typeof (item as Record<string, unknown>).type === "string" &&
          (item as Record<string, unknown>).props &&
          typeof (item as Record<string, unknown>).props === "object",
        ))
        : [];
      const blocks = message?.blocks ?? rawBlocks;
      const draftBlocks = blocks.length ? blocks : message?.tree ? cmsTreeToBlocks(message.tree) : [];
      const nextHome = draftHome(draftBlocks, homeRef.current);
      homeRef.current = nextHome;
      setHome(nextHome);
      setVisualBlocks(
        draftBlocks.filter(
          (block) =>
            block.type === "visual_primitive" ||
            block.componentId?.startsWith("visual:") === true,
        ),
      );
    };
    window.addEventListener("message", onMessage);
    // The iframe may be served without a referrer, so its parent origin cannot
    // be derived reliably. The admin receiver validates the iframe origin and
    // the message source before accepting this handshake.
    window.parent.postMessage({ source: "cms-preview-ready" }, "*");
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <HomeScrollExperience
      products={products}
      home={home}
      socialProof={socialProof}
      selectionMode
      visualBlocks={visualBlocks}
    />
  );
}
