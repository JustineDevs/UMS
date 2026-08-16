# Full-task hardening matrix

Date: 2026-08-15

Source of requested findings: `.omx/context/Full-Task-fix.md`.

This is a verification record, not an implementation claim. `PASS` means the
acceptance target has fresh executable proof. `PARTIAL` means only part of the
target is evidenced. `FAIL` means the requested hardening is absent in the
observed source. `UNPROVEN` means source evidence exists but the required
behavioral proof was not run. `BLOCKED` means the proof source is unavailable.

No application, provider, or CMS implementation file was changed in this
lane. The only test changes are assertions in existing test-only files.

## Evidence baseline

| Proof command | Result | What it proves |
|---|---:|---|
| `pnpm --filter @universal-music-store/admin test` | PASS, 86/86 | Configured admin unit/contract suite, including `cms-route-contracts.test.ts` |
| `pnpm --filter @universal-music-store/storefront test` | PASS, 127/127 | Configured storefront logic suite |
| `node --require ./scripts/load-platform-data-test-env.cjs --import tsx/esm --test packages/platform-data/src/cms-pages.test.ts packages/platform-data/src/cms-component-registry.test.ts packages/platform-data/src/storefront-home-cms.test.ts` | PASS, 12/12 | CMS tree, component registry, and homepage model assertions; this is a direct command because the package script does not list these CMS tests |
| `pnpm --filter @universal-music-store/admin exec node --import tsx/esm --test src/lib/cms-route-contracts.test.ts` | PASS, 3/3 | CMS page schema assertions, including canonical tree input |
| `git diff --check` | PASS | No whitespace errors in the current diff |
| `pnpm --filter @universal-music-store/admin exec tsc --noEmit -p tsconfig.json` | FAIL | Existing modified application error: `src/lib/cms-tree-commands.ts:62`, `definition` possibly undefined |
| `pnpm --filter @universal-music-store/storefront exec tsc --noEmit -p tsconfig.json` | BLOCKED | `.next/types/cache-life.d.ts` and `.next/types/validator.ts` are missing from the configured include path |

The passing unit suites do not prove browser geometry, route-level tenant
isolation, database concurrency, storage bucket privacy, or live provider
sandbox behavior.

## CMS findings

| ID | Requested finding / acceptance target | Status | Current evidence and exact proof command |
|---|---|---|---|
| F1 | One canonical builder workspace; tools are in-builder panels | FAIL | `rg -n 'CmsToolSurface|CmsNavigationEditor|CmsFormsTable|CmsRedirectsManager' apps/admin/src/components/cms/CmsPageBuilder.tsx` still shows independent tool surfaces. Browser route/workspace proof is not present. |
| F2 | Homepage uses a complete canonical component tree | PARTIAL | Canonical tree schema/conversion is covered by the direct platform command above and `cms-route-contracts.test.ts`; `StorefrontHomeVisualEditor.tsx` still defines the fixed header/hero/footer adapter. |
| F3 | Preview is the actual storefront renderer, without synthetic product/content markup | FAIL | `rg -n 'Product [0-9]|Latest product|_canvasDocument|Synthetic' apps/admin/src/components/cms/CmsPageBuilder.tsx` finds synthetic canvas markup. |
| F4 | Component Canvas is real visual DOM authoring | PARTIAL | `rg -n 'cms-component-canvas|contentEditable|Visual component canvas' apps/admin/src/components/cms/CmsPageBuilder.tsx` finds an isolated iframe and inline editing, but no browser save/reload proof or full visual definition lifecycle. |
| F5 | Inspector is registry-driven and covers responsive/content/layout/style/advanced controls | PARTIAL | `rg -n 'PROPERTY_KEYS|LayoutFields|backgroundImage|gridTemplateColumns|boxShadow' apps/admin/src/components/cms/CmsPageBuilder.tsx` proves several expanded fields; it does not prove the requested complete registry or responsive state model. |
| F6 | Slots/variants support validated insertion, nesting, reordering, and definition behavior | PARTIAL | Nested slot schema and round-trip assertions pass; `rg -n 'onDropSlot|onDropBlock|allowedSlot|allowedChildren|lockedStructure' apps/admin/src/components/cms/CmsPageBuilder.tsx packages/platform-data/src` shows insertion paths but no complete validation contract or browser proof. |
| F7 | Selection/geometry remains stable across iframe, scroll, resize, and zoom | PARTIAL | Bridge message schema/origin checks and resize handling are present: `rg -n 'builderMessageSchema|ResizeObserver|toCanvasRect|zoomRef' apps/admin/src/components/cms/CmsPageBuilder.tsx apps/storefront/src/components/CmsPagePreviewBridge.tsx`; no Playwright geometry assertion exists. |
| F8 | Undo/redo is command/mutation history, including nested DOM mutations | PARTIAL | `rg -n 'CmsMutation|replayCmsMutation|setHistory|setFuture' apps/admin/src/components/cms/CmsPageBuilder.tsx` proves command-shaped block history; no browser or persistence replay proof establishes DOM mutation parity. |
| F9 | Code editor supports permitted component/page code with sanitization and permissions | PARTIAL | `rg -n '<textarea|sanitizeCmsHtml|Code' apps/admin/src/components/cms/CmsPageBuilder.tsx` proves text/JSON/page-body editors; homepage/component HTML/CSS policy and permissioned publish proof are absent. |
| F10 | Header/footer are in-context editable global components | FAIL | `rg -n 'editorHref|/admin/cms/navigation|storefront_header|storefront_footer' apps/admin/src/components/cms/StorefrontHomeVisualEditor.tsx apps/admin/src/components/cms/CmsPageBuilder.tsx` shows fixed synthetic global blocks and navigation surface separation. |

### CMS real-value and risk findings

| ID | Requested finding / acceptance target | Status | Current evidence and exact proof command |
|---|---|---|---|
| R1 | Component persistence is a durable tenant/version foundation | PASS for foundation; not for full editor | `rg -n 'organization_id|version|published|archived|expectedVersion|advisory' packages/platform-data/src/cms-component-registry.ts packages/database/supabase/migrations/075_cms_component_lifecycle.sql packages/database/supabase/migrations/081_cms_component_definition_transaction.sql` plus the platform CMS command proves the local foundation only. |
| R2 | Storefront preview bridge selects, reports, edits, and decorates real DOM | PARTIAL | `rg -n 'MutationObserver|postMessage|event.source|event.origin|builderMessageSchema' apps/storefront/src/components/CmsPagePreviewBridge.tsx` proves source behavior; no browser interaction proves the end-to-end bridge. |
| R3 | CMS mutations have auth, validation, tenant, idempotency, and audit controls | PARTIAL | Admin suite includes negative security/idempotency assertions (86/86); route-by-route audit and replay proof for every CMS mutation are absent. |
| Risk 1 | Form export cannot select another tenant's submissions | IMPLEMENTED/UNPROVEN | `rg -n 'organization_id|from\("form_submissions"\)' apps/admin/src/app/api/admin/cms/forms/submissions/export/route.ts` shows the tenant filter in source; no route integration/IDOR test executes two organizations. |
| Risk 2 | Redirect import collision checks are tenant-scoped | IMPLEMENTED/UNPROVEN | `rg -n 'organization_id|from_path' apps/admin/src/app/api/admin/cms/redirects/import/route.ts` shows tenant-aware lookup; no two-tenant import test proves collision isolation. |
| Risk 3 | All CMS routes use one literal shared route guard | FAIL | `rg -n 'requireStaffApiSession|getStaffSession|staffSessionAllows|Response\(.*Unauthorized' apps/admin/src/app/api/admin/cms` shows mixed boundaries. |
| Risk 4 | CMS ownership columns are non-null, FK-backed, and tenant-unique | UNPROVEN | `rg -n 'organization_id|SET NOT NULL|REFERENCES organizations|UNIQUE' packages/database/supabase/migrations/066_cms_pages_tenant_scope.sql packages/database/supabase/migrations/076_cms_experiment_media_tenant_scope.sql packages/database/supabase/migrations/078_cms_core_tenant_scope.sql packages/database/supabase/migrations/079_cms_legacy_composite_tenant_keys.sql packages/database/supabase/migrations/082_cms_block_presets_tenant_scope.sql packages/database/supabase/migrations/087_cms_pages_canonical_tree.sql` is source-only; migration application/status proof was not run. |
| Risk 5 | Unknown blocks preserve structure and original data | PARTIAL | The added platform assertion proves an unsupported node stays `future_block` rather than `rich_text`; raw unknown JSON preservation and destructive-edit blocking are not proven. |
| Risk 6 | Preview product data comes from the storefront catalog | FAIL | `rg -n 'Product [0-9]|Latest product [0-9]|product-grid' apps/admin/src/components/cms/CmsPageBuilder.tsx` still finds synthetic product markup. |
| Risk 7 | Builder media uses asset IDs, server URL resolution, and reference protection | PARTIAL | `rg -n 'CatalogMediaPickerDialog|mediaId|public_url|softDelete|reference' apps/admin/src/components/cms packages/platform-data/src/cms-media.ts` proves picker/media plumbing, not asset-ID-only props or deletion reference enforcement. |
| Risk 8 | Browser-level CMS parity is verified | UNPROVEN | `pnpm test:e2e:admin` is the available admin browser command, but no CMS parity spec/selector assertions were run; unit suites cannot close this item. |

## Checkout and payment findings

| ID | Requested claim/finding | Status | Current evidence and exact proof command |
|---|---|---|---|
| C1 | Bag always shows current prices | FAIL | `rg -n 'localStorage|price|confirmed|reconcile' 'apps/storefront/src/app/(public)/cart/cart-client.tsx'` shows local bag display state; no authoritative snapshot/browser stale-price proof exists. |
| C2 | Checkout recalculates totals server-side | PASS for unit contract | Storefront suite 127/127 includes totals preview and quote tests; focused proof: `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='MedusaTotalsPreview|quote|total'`. |
| C3 | Stock is checked before payment | PASS for unit contract | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='stock|checkout'` passes the configured logic assertions; live Medusa/cart integration is not included. |
| C4 | Provider availability is tenant/store bound | PARTIAL | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='payment availability|wallets|Xendit'` passes provider filtering assertions; active organization/store routing is not integration-proven. |
| C5 | COD is server-controlled | PARTIAL | Storefront suite covers COD handler/replay paths; `rg -n 'cod|profile|address|finalize' apps/storefront/src/lib/cod-place-order-route-handler.ts apps/storefront/src/app/api/checkout/cod-place-order/route.ts` shows server gates, but database transaction/fulfillment proof is absent. |
| C6 | Client cannot change the payment amount | PARTIAL | Quote fingerprint and Medusa totals tests pass; provider webhook amount/currency/order matching is not proven end-to-end. |
| C7 | Hosted redirect proves payment | PASS as a negative claim | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='hosted return|finalize'` proves redirect/finalization handling; it does not treat redirect as payment authority. |
| C8 | Payment attempts are durable | PASS for helper/route contract | Storefront suite includes registration, recovery, and finalization logic tests; live persistence/migration proof is not included. |
| C9 | Payment finalization is duplicate-safe | PARTIAL/UNPROVEN | Migration `086_payment_attempt_finalize_claim.sql` and 127 passing logic tests exist; no concurrent database test proves the atomic claim and unique completion constraints. |
| C10 | Payment receipts are secure | PARTIAL/UNPROVEN | Source now requires a session, verifies the customer order, rolls back storage on DB failure, and returns a signed URL: `rg -n 'getServerSession|fetchCustomerOrders|createSignedUrl|remove\(' apps/storefront/src/app/api/checkout/upload-payment-receipt/route.ts`. Storage bucket privacy and route behavior lack an integration/IDOR test. |
| C11 | PayPal retries are idempotent | UNPROVEN | `rg -n 'PayPal-Request-Id|request.?id|capture' apps/medusa apps/storefront stress-test` is the source check; no provider retry test proves one stable action key. |
| C12 | Multi-merchant payment routing is safe | UNPROVEN | `rg -n 'organization|store|Nango|connection|payment' apps/storefront apps/medusa packages/platform-data | rg 'payment|checkout|Nango|organization'` is source-only; no two-store integration proof exists. |
| C13 | Stripe/PayPal/Xendit sandbox checkout is verified | UNPROVEN/BLOCKED | `pnpm test:e2e:psp-full` is the available command, but live provider credentials and sandbox execution were not available in this verification. |
| C14 | Focused tests have no path-alias failure | PASS for current configured suites | Admin and storefront suites completed without alias failures; typecheck remains separately blocked/failed as recorded above. |

Additional checkout risk rows from the task are mapped below rather than marked
complete by the existence of a route:

| Risk | Status | Proof command / gap |
|---|---|---|
| Analytics uses confirmed server total | UNPROVEN | `rg -n 'analytics|cart total|confirmedTotal|purchase' apps/storefront/src apps/storefront/src/lib` plus a browser checkout analytics assertion is required. |
| Cart resume/bind proves ownership, not only ID existence | PARTIAL | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='cart|resume'`; the resume route now requires the query ID to match the cookie, but no cross-user HTTP test exists. |
| Availability operational failures are non-200 | PARTIAL | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='availability|error'`; service-config integration proof is absent. |
| Loyalty failure is explicit, not zero balance | PARTIAL | `rg -n 'loyalty|zero|unavailable|error' apps/storefront/src/app/api/checkout/loyalty-balance/route.ts`; no failure-path route test is recorded. |
| Abandonment data is not authoritative commerce data | FAIL | `rg -n 'abandonment|price|quantity|total|email' apps/storefront/src/app/api/cart`; no server snapshot proof closes the finding. |
| Provider webhooks match amount, currency, order, tenant, and idempotency | UNPROVEN | `rg -n 'amount|currency|organization|event|idempot' apps/medusa/src/modules apps/medusa/src/api`; provider webhook integration tests are required. |

## Storefront findings

| ID | Requested surface/risk | Status | Current evidence and exact proof command |
|---|---|---|---|
| S1 | Product catalog and product detail are real Medusa-backed surfaces | PASS for logic | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='catalog|product'`; browser rendering is not covered. |
| S2 | Collections have native detail pages | PARTIAL | `rg -n 'redirect|/shop\?category|collection' 'apps/storefront/src/app/(public)/collections'`; route behavior needs browser/HTTP assertion. |
| S3 | Search is a complete accessible combobox | PARTIAL | `rg -n 'role="combobox"|aria-activedescendant|Arrow|Escape|Enter' apps/storefront/src/components/CatalogSearchTypeahead.tsx`; keyboard and axe proof was not run. |
| S4 | Saved items are authoritative and synchronized | PARTIAL | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='wishlist|saved'`; server re-resolution exists, but cross-account API proof is absent. |
| S5 | Public tracking cannot use raw order IDs as authorization | FAIL/PARTIAL | `rg -n 'fetchMedusaTrackByOrderId|verifyTrackingToken|rawOrderId|orderId' 'apps/storefront/src/app/(public)/track/[orderId]/page.tsx'`; signed-link helper tests pass, but raw-ID rejection is not proven. |
| S6 | Account/order cancellation/returns enforce ownership | PARTIAL | `rg -n 'session|customer|ownership|order' apps/storefront/src/app/'(public)'/account apps/storefront/src/app/api`; cross-account negative browser/API tests are missing. |
| S7 | Legal/policy content is current and versioned | FAIL | `rg -n 'shipping|returns|privacy|terms|cookies|Static|CMS' apps/storefront/src/app/'(public)'`; no policy/version audit artifact exists. |
| S8 | Accessibility claim has tested conformance scope | FAIL | `rg -n 'WCAG|accessibility' apps/storefront/src/app/'(public)'/accessibility`; no axe/Lighthouse/browser run was performed. |
| S9 | Sitemap is complete from route/catalog/CMS sources | PARTIAL | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='sitemap|shop'` is not a configured sitemap test; source is manually inspected with `rg -n 'sitemap|listCmsPages|products|collections' apps/storefront/src/app/sitemap.ts 'apps/storefront/src/app/(public)/sitemap/page.tsx'`. |
| S10 | Newsletter has transactional consent, double opt-in, and unsubscribe lifecycle | PARTIAL | `pnpm --filter @universal-music-store/storefront test -- --test-name-pattern='newsletter'` has no dedicated configured assertion; source/migration inspection finds confirmation flow, but email/provider E2E is absent. |
| S11 | Helpful votes are unique and atomic | PARTIAL | `rg -n 'review_helpful_votes|rpc\(|ALREADY_VOTED' apps/storefront/src/app/api/reviews/helpful/'[id]'/route.ts packages/database/supabase/migrations/085_review_helpful_atomic_increment.sql`; no concurrent vote test ran. |
| S12 | Public mutations have consistent bot protection and rate limits | PARTIAL | Storefront suite and `rg -n 'withBotIdProtection|rateLimit' apps/storefront/src/app/api`; no abuse/oversized-payload matrix across all public forms ran. |
| S13 | Wishlist delete reports failures | IMPLEMENTED/UNPROVEN | `rg -n 'delete\(|Unable to update|status: 503' apps/storefront/src/app/api/wishlist/route.ts`; no route integration test exercises the failure response. |
| S14 | Image zoom has focus trap and restoration | PARTIAL | `rg -n 'role="dialog"|aria-modal|focus\(|Tab|Escape' apps/storefront/src/components/ProductImageZoom.tsx`; keyboard browser proof was not run. |
| S15 | Mobile navigation is a semantic menu/dialog with focus management | PARTIAL | `rg -n 'menu|dialog|aria-expanded|focus|StorefrontMainNav|StorefrontNav' apps/storefront/src/components`; no mobile Playwright/axe proof exists. |

## Stop condition and remaining blockers

The verification stop condition is reached for this lane: the matrix is
grounded by fresh local test output, and remaining gaps require proof sources
that were not available or would expand scope into application changes.

Remaining blockers are precise:

- Admin typecheck fails at `apps/admin/src/lib/cms-tree-commands.ts:62`; fixing it would modify application implementation and is out of scope.
- Storefront typecheck cannot run until the configured `.next/types` declarations exist; generating/building them is outside this documentation/test-only lane.
- No CMS browser parity spec proves selection, geometry, nested editing, save/reload, publish, responsive preview, or component-canvas behavior.
- No two-tenant route integration test proves form-export or redirect-import isolation, despite source-level tenant filters.
- No applied-database concurrency test proves payment finalization claims, unique completion, helpful-vote atomicity, or migration constraints.
- No live Stripe, PayPal, or Xendit sandbox credentials/run prove provider behavior.
- No axe/Lighthouse/mobile browser run proves accessibility or responsive claims.

Overall verdict: **PARTIAL**. The local logic and contract suites pass, but the
task's production-hardening claims cannot be marked complete without the
browser, database, tenant, and provider proof listed above.
