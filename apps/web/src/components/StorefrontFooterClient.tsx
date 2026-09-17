"use client";

import { useState } from "react";
import { Footer12 } from "@universal-music-store/ui";

type FooterColumn = { title: string; links: { label: string; href: string }[] };
type FooterLink = { label: string; href: string };

export function StorefrontFooterClient({
  columns,
  bottomLinks,
  socialLinks,
}: {
  columns: FooterColumn[];
  bottomLinks: FooterLink[];
  socialLinks: FooterLink[];
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function subscribe(email: string) {
    setStatus("sending");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      if (!response.ok) throw new Error("Newsletter request failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <Footer12
        brandName="Universal Music Store"
        brandImageSrc="/brand/universal-music-store-logo-landscape.png"
        copyright={`© ${new Date().getFullYear()} Universal Music Store. All rights reserved.`}
        columns={columns}
        socialLinks={socialLinks.map((link) => ({
          ...link,
          icon: <span className="text-[10px] font-semibold uppercase tracking-wide">{link.label}</span>,
        }))}
        onSubscribe={subscribe}
      />
      {status !== "idle" ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className="bg-white px-6 pb-4 text-center text-sm text-neutral-700"
        >
          {status === "sending"
            ? "Subscribing…"
            : status === "sent"
              ? "You are subscribed. Thank you!"
              : "Subscription failed. Please try again."}
        </p>
      ) : null}
      {bottomLinks.length > 0 ? (
        <nav aria-label="Footer secondary" className="bg-white px-6 pb-6 text-center text-xs text-neutral-600">
          {bottomLinks.map((link) => (
            <a key={`${link.href}-${link.label}`} href={link.href} className="mx-2 underline-offset-2 hover:underline">
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}
    </>
  );
}
