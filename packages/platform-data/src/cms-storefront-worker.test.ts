import assert from "node:assert/strict";
import test from "node:test";

import {
  loadCmsAnnouncementsPublic,
  loadCmsBlogListPublic,
  loadCmsBlogPostPublic,
  loadCmsCategoryContentPublic,
  loadCmsCategoryContentListPublic,
  loadCmsNavigationPublic,
  loadCmsPagePublic,
  loadCmsSitemapEntries,
} from "./cms-storefront.js";

test("public CMS reads use the Worker response contracts when API_URL is configured", async () => {
  const previousApiUrl = process.env.API_URL;
  const previousFetch = globalThis.fetch;
  process.env.API_URL = "https://api.example.test";
  globalThis.fetch = async (input) => {
    const url = String(input);
    const body = url.includes("/store/navigation")
      ? { navigation: { headerLinks: [{ href: "/shop", label: "Shop" }], headerLinksMobile: [], footerColumns: [], footerBottomLinks: [], socialLinks: [] } }
      : url.includes("/store/announcements")
        ? { announcements: [{ id: "a1", body: "Sale", body_format: "plain", locale: "en", priority: 1, dismissible: true }] }
        : url.includes("/store/pages/about")
          ? { page: { id: "p1", slug: "about", locale: "en", page_type: "static", title: "About", status: "published", blocks: [], tree: [], version: 2 } }
          : url.includes("/store/categories/guitars")
            ? { content: { id: "c1", collection_handle: "guitars", locale: "en", blocks: [{ type: "hero", props: { title: "Guitars" } }] } }
            : url.includes("/store/categories?")
              ? { contents: [{ id: "c1", collection_handle: "guitars", locale: "en", blocks: [{ type: "hero", props: { title: "Guitars" } }] }] }
            : url.includes("/store/blog/hello")
              ? { post: { id: "b1", slug: "hello", locale: "en", title: "Hello", status: "published", tags: [] } }
              : url.includes("/store/blog?")
                ? { posts: [{ id: "b1", slug: "hello", locale: "en", title: "Hello", status: "published", tags: [] }] }
                : { entries: [{ slug: "about", locale: "en", updated_at: "2026-01-01", kind: "page" }, { slug: "hello", locale: "en", updated_at: "2026-01-02", kind: "post" }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    assert.equal((await loadCmsNavigationPublic()).headerLinks[0]?.label, "Shop");
    assert.equal((await loadCmsAnnouncementsPublic())[0]?.body, "Sale");
    assert.equal((await loadCmsPagePublic("about"))?.version, 2);
    assert.equal((await loadCmsCategoryContentPublic("guitars"))?.blocks[0]?.type, "hero");
    assert.equal((await loadCmsCategoryContentListPublic())[0]?.collection_handle, "guitars");
    assert.equal((await loadCmsBlogListPublic())[0]?.slug, "hello");
    assert.equal((await loadCmsBlogPostPublic("hello"))?.title, "Hello");
    assert.deepEqual(await loadCmsSitemapEntries(), {
      pages: [{ slug: "about", locale: "en", updated_at: "2026-01-01" }],
      posts: [{ slug: "hello", locale: "en", updated_at: "2026-01-02" }],
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
  }
});
