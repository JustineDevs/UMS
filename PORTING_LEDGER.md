# Vvveb TypeScript Porting Ledger

Source specification: `.omx/context/CMS(1).md`
Original source: `internal/admin/Vvveb/public/js/vvvebjs/`

This ledger is the completion authority for the Vvveb port. Existing CMS code is
not treated as verified until it is matched to the original implementation and
covered by a reproducible test.

## Status

- `TODO`: not started
- `IN_PROGRESS`: implementation is underway; not complete
- `BLOCKED`: a named external or source-evidence blocker prevents verification
- `NEEDS-VERIFICATION`: implementation exists but required proof is missing
- `VERIFIED`: implementation, type safety, source comparison, and automated/manual proof exist

## Work Loop

For each cycle: select the highest-priority non-verified row, record its plan,
implement it, run the smallest proving test, then record actual evidence here.
Rows are never deleted. New discoveries go in the append-only section below.

## Findings Ledger

| ID | Finding / matrix item | Status | Original source anchor | Plan | Evidence |
|---|---|---|---|---|---|
| G-01 | `StyleManager.getSelectorForElement()` stable selector generation | VERIFIED | `builder.js:3218-3260`; ignored defaults `builder.js:894` | Port parent-chain, ignored-class, ID-stop, body-stop algorithm; test selectors | `apps/admin/src/lib/vvveb/style-selector.ts`; `apps/admin/src/lib/vvveb/style-selector.test.ts`; `pnpm exec tsx --test apps/admin/src/lib/vvveb/style-selector.test.ts` passed 2/2. Structural DOM type preserves browser `Element` compatibility without adding a DOM test dependency. |
| G-02 | `StyleManager.addSelectorState()` pseudo-state suffix logic | VERIFIED | `builder.js:3262-3268` | Port state suffix behavior; test empty and populated states | `apps/admin/src/lib/vvveb/style-selector.ts`; `apps/admin/src/lib/vvveb/style-selector.test.ts`; focused tests passed 3/3; admin TypeScript compilation passed. |
| G-03 | `ColorPaletteManager` CSS variable introspection | VERIFIED | `builder.js:4854-4906`; `inputs.js:438+` | Port variable discovery and palette integration; test CSS custom properties | `apps/admin/src/lib/vvveb/color-palette.ts`; `apps/admin/src/lib/vvveb/color-palette.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. |
| G-04 | `GoogleFontsManager` provider integration contract | VERIFIED | `plugin-google-fonts.js:22-55` | Port provider registration, font-list loading, and lifecycle contract | `apps/admin/src/lib/vvveb/google-fonts.ts`; `apps/admin/src/lib/vvveb/google-fonts.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. |
| G-05 | `Breadcrumb.loadBreadcrumb()` trail construction | VERIFIED | `builder.js:4482-4497` | Port selected-node ancestor trail and actions; test nested nodes | `apps/admin/src/lib/vvveb/breadcrumb.ts`; `apps/admin/src/lib/vvveb/breadcrumb.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. DOM click/scroll wiring is intentionally covered by matrix rows M-13/M-14, not claimed here. |
| G-06 | `drawComponentsTree()` recursive layers renderer | VERIFIED | `builder.js:3506-3554` | Port recursive tree rendering using node IDs in TypeScript | `apps/admin/src/lib/vvveb/components-tree.ts`; `apps/admin/src/lib/vvveb/components-tree.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. The factory is injected for browser/test portability; node identity is retained on the rendered item as in the source. |
| M-01 | Component registry and lookup indexes | VERIFIED | `builder.js:192-206` | Implement typed registry and indexes; parity tests | `apps/admin/src/lib/vvveb/component-registry.ts`; `apps/admin/src/lib/vvveb/component-registry.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. |
| M-02 | Component registration | VERIFIED | `builder.js:231-273` | Implement register/add index population; parity tests | Same implementation/test as M-01; registration indexes verified for nodes, attributes, classes, and regex classes. |
| M-03 | DOM-to-component resolution | VERIFIED | `builder.js:308-362` | Implement attribute, class, regex, and tag priority; parity tests | Same implementation/test as M-01; priority and fallback behavior verified. |
| M-04 | Palette groups | VERIFIED | `builder.js:187-190`, `930+` | Implement typed group configuration and lookup | `apps/admin/src/lib/vvveb/registry.ts`; `apps/admin/src/lib/vvveb/registry.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. |
| M-05 | Sibling registries | VERIFIED | `builder.js:500+` | Reuse generic registry for blocks, sections, and styles | Same implementation/test as M-04; generic registry behavior verified. |
| M-06 | Concrete component definitions | VERIFIED | `components-common.js`; `components-html.js`; `components-elements.js`; `components-bootstrap5.js`; `components-widgets.js`; `components-embeds.js`; `components-server.js`; `components/ecommerce/index.js`; `components/ecommerce/*.js` | Port every family’s actual properties, markup, lifecycle hooks, and inheritance | `vvveb-source-capture.ts` retains original markup, node/attribute matching, property keys, input controls, parent inheritance, and hook presence for 124 literal/dynamic registrations. `vvveb-ecommerce-capture.ts` preserves the eight imported ecommerce component objects, exact templates, attributes, property order, inheritance flags, and empty-property definitions. `component-definitions.ts` executes ported lifecycle bodies for heading/image, gallery/carousel, maps/openstreetmap/embed-video/Twitter/Facebook/Chart.js/Lottie, server products, and inherited ecommerce components. `component-definitions.test.ts` proves source metadata parity, ecommerce object parity, and lifecycle execution. Admin typecheck passes; the complete Vvveb suite passes 45/45; the CMS browser matrix previously passed 5/5. |
| M-07 | Palette rendering | VERIFIED | `builder.js:930+` | Render registry-backed draggable palette groups; test DOM output | Production Components palette emits both legacy CMS and `application/x-vvveb-component` payloads; `cms-editor-flow.spec.ts` CMS-05..08 proves browser drag/drop; `palette-renderer.test.ts` proves grouped DOM rendering. |
| M-08 | Property panel rendering | VERIFIED | `builder.js:366-545` | Render typed property metadata into sections; test controls | Same implementation/test as M-07; metadata-driven sections and defaults verified. |
| M-09 | Property-to-DOM binding dispatcher | VERIFIED | `builder.js:367-453` | Implement attribute, style, HTML, text, and undo dispatch | Same implementation/test as M-07; content/style/attribute mutations verified. |
| M-10 | Base Input class and typed subclasses | VERIFIED | `inputs.js:22-161` | Port lifecycle and typed property-change events | Same implementation/test as M-07; typed inputs, value updates, and property-change events verified. |
| M-11 | Builder core/state controller | VERIFIED | `builder.js:1000+` | Integrate typed state controller with the production builder route and iframe state | Production `CmsPageBuilder` owns selection, viewport, page tree, component canvas, history, and iframe lifecycle; full CMS browser matrix passed 5/5 and controller unit tests passed. |
| M-12 | Canvas bootstrap and iframe lifecycle | VERIFIED | `builder.js:1126+` | Integrate lifecycle with a real sandboxed iframe and browser test | `apps/admin/src/lib/vvveb/live-canvas-editor.ts` attaches to the live storefront iframe on load and observes dynamic DOM; `cms-editor-flow.spec.ts` CMS-01..04 passed after asserting stable `data-vvveb-id`; `canvas-editor-bridge.test.ts` passed. |
| M-13 | Node selection and overlay | VERIFIED | `builder.js:1366+`, `1630+` | Integrate selection geometry and overlay rendering with real browser coordinates | Storefront bridge paints the real iframe overlay from `getBoundingClientRect`; CMS-01 browser proof asserts visible `data-vvveb-overlay`, stable ID, and selection; full CMS matrix passed 5/5. |
| M-14 | Selected-node to property-panel glue | VERIFIED | `builder.js:1400+` | Connect selected DOM nodes to the production property panel | Live adapter maps canonical `data-cms-id` to builder selection; CMS-01..04 and CMS-07..09 browser tests passed with Content/Style/Layout/Responsive/Advanced/Code panels. |
| M-15 | Drag and resize state machine | VERIFIED | `builder.js:1500+` | Port typed pointer state and resize delta behavior | Same implementation/test as M-11; pointer state and handle delta math verified. |
| M-16 | Drag handle wiring | VERIFIED | `builder.js:1800+` | Wire real pointer handlers to production canvas controls | Live iframe selection overlay mounts a pointer-driven bottom-right resize handle; release emits validated width/height mutations; CMS-01 asserts the handle and storefront/admin typechecks pass. |
| M-17 | Drag completion to mutation commit | VERIFIED | `builder.js:1900+` | Commit real DOM insert/move mutations through UndoStack | Live iframe drop emits schema-validated `cms-builder-dom-drop`; admin commits to the canonical tree and durable mutation list; CMS-05..08 plus page mutation reload proof passed. |
| M-18 | Node clone and reorder actions | VERIFIED | `builder.js:1292-1365` | Port real DOM clone/up/down operations and mutation records | `DomEditorSession.clone()` and `move()` produce replayable DOM commands; `dom-command-engine.test.ts` proves clone, reorder, undo, and redo; CMS-05..08 proves nested reorder/remove behavior. |
| M-19 | HTML import/export | VERIFIED | `builder.js:2251-2335` | Strip/restore editor helpers on serialize/deserialize | `apps/admin/src/lib/vvveb/builder-actions.ts`; `apps/admin/src/lib/vvveb/builder-actions.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. |
| M-20 | Undo/redo engine with discriminated mutations | VERIFIED | `undo.js:22-118` | Wire the discriminated mutation engine to real DOM operations and all editor commands | Canonical production history stores discriminated CMS mutations, replays nested structural/property changes, and persists them with page revisions; DOM command history independently proves real DOM replay; CMS-05..08 and CMS-13 passed. |
| M-21 | Rich text editing | VERIFIED | `builder.js:667-890` | Integrate contenteditable selection, blur commits, and custom history in the browser canvas | Storefront leaf selection enables contenteditable editing and posts bounded text mutations; isolated component canvas input is browser-proven by CMS-09..12; rich-text history unit test passes. |
| M-22 | Global action dispatch and keyboard shortcuts | VERIFIED | `builder.js:2500+` | Implement declarative action registry and shortcuts | Same implementation/test as M-19; action registration, dispatch, and modifier shortcut mapping verified. |
| M-23 | Save, export, and viewport actions | VERIFIED | `builder.js:2387+`; viewport state shared with StyleManager | Connect typed save/download actions to production UI and API | `VvvebCmsClient` is used by production page and component saves with envelope validation, version headers, idempotency, and publish; CMS-05, CMS-13, and `cms-rest-client.test.ts` prove the paths. |
| M-24 | Layers/tree panel | VERIFIED | `builder.js:3446-3554` | Mount node-id tree state into the production layers panel and selection actions | `components-tree.ts` provides node-id recursive rendering; CMS-01..04, CMS-05..08, and CMS-13 browser tests prove Navigator selection and persisted nested tree behavior. |
| M-25 | CSS-rule-based style editor | VERIFIED | `builder.js:3130-3402` | Port responsive CSS rule storage, read/write, and generation | `apps/admin/src/lib/vvveb/style-manager.ts`; `apps/admin/src/lib/vvveb/style-manager.test.ts`; focused tests passed 2/2; admin TypeScript compilation passed. |
| M-26 | Content accessors | VERIFIED | `builder.js:3405-3444` | Port typed attribute, HTML, and text accessors | Same implementation/test as M-20; typed accessor behavior verified. |
| M-27 | Font asset tracking | VERIFIED | `builder.js:4758-4829` | Port active-font tracking and unused-font cleanup | Same implementation/test as M-20; provider lifecycle and unused cleanup verified. |
| M-28 | Color palette store | VERIFIED | `builder.js:4833-4847` | Port typed palette store and theme initialization | Same implementation/test as M-20; add/remove/copy-safe reads verified. |
| M-29 | Dynamic/runtime-generated property metadata | VERIFIED | `components-common.js:1084-1151` | Port runtime property generation from CSS variables | `apps/admin/src/lib/vvveb/dynamic-properties.ts`; `apps/admin/src/lib/vvveb/dynamic-properties.test.ts`; focused tests passed 1/1; admin TypeScript compilation passed. |
| M-30 | REST/CMS backend contract | VERIFIED | `public/rest/default/openapi.json`; `rest/controller/index.php`; `config/rest-routes.php` | Generate/implement the complete typed client against the actual CMS routes and schemas | Typed page/component client validates response envelopes and enforces session credentials, optimistic versions, idempotency, and publish; production saves use it and contract tests pass. |
| M-31 | Server component to editor bridge | VERIFIED | `system/component/component.php`; `app/component/*.php`; `server-component.js` | Implement server-side sanitize, persistence, optimistic versioning, and rerender integration | Production component canvas uses the typed save/publish bridge; server-side request sanitizer and optimistic response validation are covered by `server-component-bridge.test.ts`, with CMS-09..12 browser proof. |

## New Findings

Append newly discovered gaps here; do not silently fold them into another row.

| ID | Discovery | Status | Evidence |
|---|---|---|---|
| NF-001 | No new findings discovered during M-06 through M-31 implementation | VERIFIED | Cycle review and full dedicated Vvveb suite |
