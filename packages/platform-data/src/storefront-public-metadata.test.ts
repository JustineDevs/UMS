import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  EMPTY_STOREFRONT_PUBLIC_METADATA,
  mergeStorefrontPublicMetadataPayload,
  resolveStorefrontPublicMetadataWithEnv,
  storefrontSocialLinks,
} from "./storefront-public-metadata.js";

describe("mergeStorefrontPublicMetadataPayload", () => {
  it("returns empty strings for null input", () => {
    const m = mergeStorefrontPublicMetadataPayload(null);
    assert.deepEqual(m, EMPTY_STOREFRONT_PUBLIC_METADATA);
  });

  it("merges partial payload", () => {
    const m = mergeStorefrontPublicMetadataPayload({
      supportEmail: "a@b.co",
    });
    assert.equal(m.supportEmail, "a@b.co");
    assert.equal(m.instagramUrl, "");
  });

  it("normalizes configured social handles and omits empty links", () => {
    const links = storefrontSocialLinks({
      ...EMPTY_STOREFRONT_PUBLIC_METADATA,
      instagramUrl: "@universal.music.store",
      facebookUrl: "https://facebook.com/universal-music-store",
      tiktokUrl: "umsph",
      whatsappUrl: "https://wa.me/639171234567",
    });

    assert.deepEqual(links, [
      { label: "Instagram", href: "https://instagram.com/universal.music.store" },
      { label: "Facebook", href: "https://facebook.com/universal-music-store" },
      { label: "TikTok", href: "https://tiktok.com/@umsph" },
      { label: "WhatsApp", href: "https://wa.me/639171234567" },
    ]);
  });
});

const ENV_KEYS = [
  "NEXT_PUBLIC_INSTAGRAM_URL",
  "NEXT_PUBLIC_FACEBOOK_URL",
  "NEXT_PUBLIC_TIKTOK_URL",
  "NEXT_PUBLIC_YOUTUBE_URL",
  "NEXT_PUBLIC_X_URL",
  "NEXT_PUBLIC_LINKEDIN_URL",
  "NEXT_PUBLIC_WHATSAPP_URL",
  "NEXT_PUBLIC_MESSENGER_URL",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_SUPPORT_PHONE",
] as const;

describe("resolveStorefrontPublicMetadataWithEnv", () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {};
    for (const k of ENV_KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  it("prefers non-empty CMS over env", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "env@x.com";
    const r = resolveStorefrontPublicMetadataWithEnv({
      ...EMPTY_STOREFRONT_PUBLIC_METADATA,
      supportEmail: "cms@x.com",
    });
    assert.equal(r.supportEmail, "cms@x.com");
  });

  it("falls back to env when CMS empty", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "env@x.com";
    const r = resolveStorefrontPublicMetadataWithEnv(EMPTY_STOREFRONT_PUBLIC_METADATA);
    assert.equal(r.supportEmail, "env@x.com");
  });
});
