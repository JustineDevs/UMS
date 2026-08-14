import sanitizeHtml from "sanitize-html";

/**
 * Options aligned with typical rich-text CMS: safe tags, no script/on* handlers.
 * Uses `sanitize-html` (pure Node) instead of JSDOM-based DOMPurify so Next.js RSC/API
 * bundles do not trigger ENOENT on `.next/browser/default-stylesheet.css`.
 */
const CMS_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags,
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
};

/**
 * Sanitize CMS or rich-text HTML before `dangerouslySetInnerHTML`.
 * Strips script, event handlers, and other XSS vectors while keeping common formatting.
 */
export function sanitizeCmsHtml(dirty: string): string {
  if (typeof dirty !== "string" || !dirty.trim()) {
    return "";
  }
  return sanitizeHtml(dirty.trim(), CMS_SANITIZE_OPTIONS);
}
