"use client";

import { sanitizeCmsHtml } from "@universal-music-store/validation";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_PREFIX = "cms_announcement_dismissed_";

function track(metric: "impression" | "click" | "dismiss", id: string, locale: string) {
  void fetch("/api/cms/announcement/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, locale, metric }),
  }).catch(() => {});
}

export function CmsAnnouncementStack({
  bars,
}: {
  bars: {
    id: string;
    locale: string;
    body: string;
    bodyFormat: "plain" | "html";
    linkUrl: string | null;
    linkLabel: string | null;
    dismissible: boolean;
  }[];
}) {
  useEffect(() => {
    for (const b of bars) {
      if (!b.body.trim()) continue;
      track("impression", b.id, b.locale);
    }
  }, [bars]);

  if (!bars.length) return null;

  return (
    <div className="flex w-full flex-col">
      {bars.map((b) => (
        <CmsAnnouncementBar
          key={`${b.id}:${b.locale}`}
          announcementId={b.id}
          locale={b.locale}
          body={b.body}
          bodyFormat={b.bodyFormat}
          linkUrl={b.linkUrl}
          linkLabel={b.linkLabel}
          dismissible={b.dismissible}
        />
      ))}
    </div>
  );
}

function CmsAnnouncementBar({
  announcementId,
  locale,
  body,
  bodyFormat,
  linkUrl,
  linkLabel,
  dismissible,
}: {
  announcementId: string;
  locale: string;
  body: string;
  bodyFormat: "plain" | "html";
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!body.trim()) return;
    const storageKey = STORAGE_PREFIX + announcementId + "_" + locale;
    if (dismissible && typeof window !== "undefined") {
      if (window.sessionStorage.getItem(storageKey)) {
        setHidden(true);
        return;
      }
    }
    setHidden(false);
  }, [body, dismissible, announcementId, locale]);

  if (!body.trim() || hidden) return null;

  const storageKey = STORAGE_PREFIX + announcementId + "_" + locale;

  return (
    <div className="w-full border-b border-primary/15 bg-primary/5 px-4 py-2 text-center text-xs text-primary sm:text-sm">
      {bodyFormat === "html" ? (
        <span
          className="font-body inline-block max-w-full [&_a]:underline [&_a]:underline-offset-2"
          dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(body) }}
        />
      ) : (
        <span className="font-body">{body}</span>
      )}
      {linkUrl ? (
        <Link
          href={linkUrl}
          className="ml-2 font-semibold underline underline-offset-2"
          onClick={() => track("click", announcementId, locale)}
        >
          {linkLabel ?? "Details"}
        </Link>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          className="ml-3 text-on-surface-variant hover:text-primary"
          aria-label="Dismiss announcement"
          onClick={() => {
            track("dismiss", announcementId, locale);
            window.sessionStorage.setItem(storageKey, "1");
            setHidden(true);
          }}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
