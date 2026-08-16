"use client";

import {
  cmsTreeToBlocks,
} from "@universal-music-store/platform-data";
import type {
  CmsBlock,
  StorefrontHomeSectionLayout,
  StorefrontHomePayload,
} from "@universal-music-store/platform-data";
import { useEffect, useState } from "react";
import { HomeScrollExperience } from "@/components/home/HomeScrollExperience";
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

  useEffect(() => {
    const parentOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : window.location.origin;
      } catch {
        return window.location.origin;
      }
    })();
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (event.origin !== parentOrigin) return;
      if (event.data?.source === "cms-builder-select") {
        const id = typeof event.data.id === "string" ? event.data.id : "";
        document.querySelectorAll<HTMLElement>("[data-cms-id]").forEach((node) => {
          const selected = node.dataset.cmsId === id ? "true" : "false";
          if (node.dataset.selected !== selected) node.dataset.selected = selected;
        });
        const node = id
          ? document.querySelector<HTMLElement>(`[data-cms-id="${CSS.escape(id)}"]`)
          : null;
        if (node) {
          node.scrollIntoView({ block: "nearest" });
          const rect = node.getBoundingClientRect();
          window.parent.postMessage(
            {
              source: "cms-builder",
              id,
              label: node.dataset.cmsLabel ?? id,
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            },
            parentOrigin,
          );
        }
        return;
      }
      if (event.data?.source !== "cms-builder-draft" || event.data.mode !== "home") {
        return;
      }
      const blocks = Array.isArray(event.data.tree)
        ? cmsTreeToBlocks(event.data.tree as Parameters<typeof cmsTreeToBlocks>[0])
        : Array.isArray(event.data.blocks)
          ? event.data.blocks
          : [];
      setHome((current) => draftHome(blocks as CmsBlock[], current));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ source: "cms-preview-ready" }, parentOrigin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <HomeScrollExperience
      products={products}
      home={home}
      socialProof={socialProof}
      selectionMode
    />
  );
}
