"use client";

import { Announcement4 } from "@universal-music-store/ui";
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
    <div className="pointer-events-none flex w-full flex-col [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
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

  const plainMessage = bodyFormat === "html" ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : body;

  return (
    <Announcement4
      message={plainMessage}
      actionLabel={linkUrl ? linkLabel ?? "Details" : ""}
      onAction={
        linkUrl
          ? () => {
              track("click", announcementId, locale);
              window.location.href = linkUrl;
            }
          : undefined
      }
      dismissible={dismissible}
      onDismiss={() => {
        track("dismiss", announcementId, locale);
        window.sessionStorage.setItem(storageKey, "1");
        setHidden(true);
      }}
    />
  );
}
