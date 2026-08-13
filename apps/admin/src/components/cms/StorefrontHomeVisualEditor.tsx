"use client";

import {
  staffHasPermission,
  type CmsBlock,
  type StorefrontHomeSectionLayout,
  type StorefrontHomePayload,
} from "@universal-music-store/platform-data";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { StorefrontPublicMetadataEditor } from "@/components/StorefrontPublicMetadataEditor";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { CmsPageBuilder } from "./CmsPageBuilder";

const IDS = {
  header: "storefront-header",
  headerNavigation: "header-navigation",
  headerActions: "header-actions",
  hero: "home-hero",
  tiles: "home-tiles",
  latest: "home-latest",
  newsletter: "home-newsletter",
  footer: "storefront-footer",
  footerColumns: "footer-columns",
} as const;

function toBlocks(payload: StorefrontHomePayload): CmsBlock[] {
  return [
    {
      id: IDS.header,
      type: "storefront_header",
      props: { editorHref: "/admin/cms/navigation" },
    },
    {
      id: IDS.headerNavigation,
      type: "header_navigation",
      props: { editorHref: "/admin/cms/navigation" },
    },
    {
      id: IDS.headerActions,
      type: "header_actions",
      props: { editorHref: "/admin/cms/navigation" },
    },
    {
      id: IDS.hero,
      type: "hero",
      props: {
        title: `${payload.hero.line1}\n${payload.hero.line2}`,
        subtitle: payload.hero.lead,
        imageUrl: payload.hero.imageUrl,
        mediaType: payload.hero.mediaType,
        videoUrl: payload.hero.videoUrl,
        href: payload.hero.ctaHref,
        ctaLabel: payload.hero.ctaLabel,
        showPrivacyLink: payload.hero.showPrivacyLink,
        layout: payload.hero.layout,
        style: payload.hero.style,
        domOverrides: payload.domOverrides,
      },
    },
    { id: IDS.tiles, type: "home_tiles", props: { tiles: payload.tiles, layout: payload.sectionLayout?.tiles } },
    {
      id: IDS.latest,
      type: "latest_section",
      props: { ...payload.latestSection, layout: payload.sectionLayout?.latest },
    },
    {
      id: IDS.newsletter,
      type: "newsletter",
      props: {
        heading: payload.newsletter.title,
        subtitle: payload.newsletter.body,
        placeholder: payload.newsletter.placeholder,
        buttonLabel: payload.newsletter.buttonLabel,
        layout: payload.sectionLayout?.newsletter,
      },
    },
    {
      id: IDS.footer,
      type: "storefront_footer",
      props: { editorHref: "/admin/cms/navigation" },
    },
    {
      id: IDS.footerColumns,
      type: "footer_columns",
      props: { editorHref: "/admin/cms/navigation" },
    },
  ];
}

function fromBlocks(
  blocks: CmsBlock[],
  previous: StorefrontHomePayload,
): StorefrontHomePayload {
  const next = JSON.parse(JSON.stringify(previous)) as StorefrontHomePayload;
  next.domOverrides = Object.assign(
    {},
    ...blocks.map((block) =>
      block.props.domOverrides && typeof block.props.domOverrides === "object"
        ? block.props.domOverrides
        : {},
    ),
  ) as StorefrontHomePayload["domOverrides"];
  const heroBlock = blocks.find((block) => block.id === IDS.hero);
  const hero = heroBlock?.props;
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
  const tilesBlock = blocks.find((block) => block.id === IDS.tiles)?.props;
  const tiles = tilesBlock?.tiles;
  if (Array.isArray(tiles) && tiles.length >= 3)
    next.tiles = tiles.slice(0, 3) as StorefrontHomePayload["tiles"];
  if (tilesBlock?.layout) next.sectionLayout = { ...next.sectionLayout, tiles: tilesBlock.layout as StorefrontHomeSectionLayout };
  const latest = blocks.find((block) => block.id === IDS.latest)?.props;
  if (latest)
    next.latestSection = {
      title: String(latest.title ?? ""),
      viewAllLabel: String(latest.viewAllLabel ?? ""),
      viewAllHref: String(latest.viewAllHref ?? "/shop"),
    };
  if (latest?.layout) next.sectionLayout = { ...next.sectionLayout, latest: latest.layout as StorefrontHomeSectionLayout };
  const newsletter = blocks.find((block) => block.id === IDS.newsletter)?.props;
  if (newsletter)
    next.newsletter = {
      title: String(newsletter.heading ?? ""),
      body: String(newsletter.subtitle ?? ""),
      placeholder: String(newsletter.placeholder ?? "email@address.com"),
      buttonLabel: String(newsletter.buttonLabel ?? "Subscribe"),
    };
  if (newsletter?.layout) next.sectionLayout = { ...next.sectionLayout, newsletter: newsletter.layout as StorefrontHomeSectionLayout };
  return next;
}

export function StorefrontHomeVisualEditor({
  onClose,
}: {
  onClose: () => void;
}) {
  const { data: session, status } = useSession();
  const [devMode, setDevMode] = useState(false);
  const canWrite = devMode || staffHasPermission(
    session?.user?.permissions ?? [],
    "settings:write",
  );
  const [payload, setPayload] = useState<StorefrontHomePayload | null>(null);
  const [blocks, setBlocks] = useState<CmsBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/storefront-home")
      .then(async (response) => {
        const json = (await response.json()) as {
          data?: StorefrontHomePayload;
          error?: string;
          devMode?: boolean;
        };
        if (!response.ok) throw new Error(json.error ?? response.statusText);
        if (!cancelled && json.data) {
          setDevMode(Boolean(json.devMode));
          setPayload(json.data);
          setBlocks(toBlocks(json.data));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load homepage",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewUrl = useMemo(
    () => `${getStorefrontPublicOrigin()}/?adminPreview=1`,
    [],
  );
  const save = async () => {
    if (!payload || !canWrite) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/storefront-home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromBlocks(blocks, payload)),
      });
      const json = (await response.json()) as {
        data?: StorefrontHomePayload;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      if (json.data) {
        setPayload(json.data);
        setBlocks(toBlocks(json.data));
      }
      setSaved(true);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save homepage",
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !payload)
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-100 text-sm text-slate-600">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
          {error ?? "Loading homepage editor..."}
        </div>
      </div>
    );
  return (
    <CmsPageBuilder
      value={blocks}
      onChange={setBlocks}
      disabled={!canWrite}
      immersive
      pageTitle="Homepage"
      pageBody=""
      pages={[
        { id: "home", title: "Home page", slug: "/", status: "published" },
      ]}
      currentPageId="home"
      previewUrl={previewUrl}
      previewMode="home"
      settings={
        <div className="space-y-4 text-xs text-slate-500">
          <div className="space-y-3">
            <p>
              This visual surface edits the public homepage configuration and
              saves through the homepage API.
            </p>
            <p>
              Use the Components panel to add reusable content sections. Homepage
              sections are kept in the same CMS canvas as ordinary pages.
            </p>
            {saved ? (
              <p className="rounded bg-emerald-50 px-2.5 py-2 text-emerald-700">
                Homepage saved.
              </p>
            ) : null}
            {error ? (
              <p className="rounded bg-red-50 px-2.5 py-2 text-red-700">
                {error}
              </p>
            ) : null}
          </div>
          <StorefrontPublicMetadataEditor />
        </div>
      }
      toolbarActions={
        <button
          type="button"
          className="h-8 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={!canWrite || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      }
      onClose={onClose}
    />
  );
}
