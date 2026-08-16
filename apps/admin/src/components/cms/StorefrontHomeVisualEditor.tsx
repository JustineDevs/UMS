"use client";

import {
  staffHasPermission,
  cmsBlocksToTree,
  cmsTreeToBlocks,
  type CmsBlock,
  type CmsComponentInstance,
  type CmsNode,
  type CmsMutationRecord,
  type StorefrontHomePayload,
} from "@universal-music-store/platform-data";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { StorefrontPublicMetadataEditor } from "@/components/StorefrontPublicMetadataEditor";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { cmsMutationHeaders } from "@/lib/cms-mutation-headers";
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
  const headerNavigation: CmsComponentInstance = {
    id: IDS.headerNavigation,
    componentId: "header-navigation",
    props: {},
    slots: {},
  };
  const headerActions: CmsComponentInstance = {
    id: IDS.headerActions,
    componentId: "header-actions",
    props: {},
    slots: {},
  };
  const footerColumns: CmsComponentInstance = {
    id: IDS.footerColumns,
    componentId: "footer-columns",
    props: {},
    slots: {},
  };
  return [
    {
      id: IDS.header,
      type: "storefront_header",
      componentId: "storefront-header",
      props: {},
      slots: { navigation: [headerNavigation], actions: [headerActions] },
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
      componentId: "storefront-footer",
      props: {},
      slots: { columns: [footerColumns] },
    },
  ];
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
  const [tree, setTree] = useState<CmsNode[]>([]);
  const [mutations, setMutations] = useState<CmsMutationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/admin/storefront-home"),
      fetch("/api/admin/cms/pages?locale=en&slug=home"),
    ])
      .then(async ([legacyResponse, canonicalResponse]) => {
        const legacyJson = (await legacyResponse.json()) as {
          data?: StorefrontHomePayload;
          error?: string;
          devMode?: boolean;
        };
        if (!legacyResponse.ok) throw new Error(legacyJson.error ?? legacyResponse.statusText);
        const canonicalJson = canonicalResponse.ok
          ? ((await canonicalResponse.json()) as { data?: Array<{ tree?: CmsNode[] }> })
          : { data: [] };
        if (!cancelled && legacyJson.data) {
          setDevMode(Boolean(legacyJson.devMode));
          setPayload(legacyJson.data);
          const canonicalTree = canonicalJson.data?.[0]?.tree;
          if (canonicalTree?.length) {
            setTree(canonicalTree);
            setBlocks(cmsTreeToBlocks(canonicalTree));
          } else {
            // Legacy content is read only for first-run migration.
            const legacyBlocks = toBlocks(legacyJson.data);
            setBlocks(legacyBlocks);
            setTree(cmsBlocksToTree(legacyBlocks));
          }
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
      const canonical = await fetch("/api/admin/cms/pages", {
        method: "POST",
        headers: { ...cmsMutationHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "home",
          locale: "en",
          page_type: "landing",
          title: "Homepage",
          status: "published",
          tree,
          blocks: cmsTreeToBlocks(tree),
          mutations,
        }),
      });
      if (!canonical.ok) {
        const canonicalJson = (await canonical.json().catch(() => ({}))) as { error?: string };
        throw new Error(canonicalJson.error ?? "Unable to persist the canonical homepage tree");
      }
      setBlocks(cmsTreeToBlocks(tree));
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
      onChange={(next) => {
        setBlocks(next);
        setTree(cmsBlocksToTree(next));
      }}
      onMutation={(mutation) => setMutations((current) => [...current, mutation])}
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
