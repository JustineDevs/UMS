# Design System: Universal Music Store

**Project ID:** UVS repository synthesis (no Stitch project was available in this session)

## 1. Visual Theme & Atmosphere

UVS is a monochrome commerce interface with an instrument-focused editorial tone. The storefront is high-contrast and search-led: a black primary header anchors the shopping journey, while white surfaces and restrained borders keep catalog and checkout content calm. The admin console is denser and more utilitarian, using compact controls, uppercase utility labels, and shallow card elevation.

The system should feel confident, practical, and tactile rather than decorative. Motion is short and interruptible: interaction feedback should use color, opacity, border, and a restrained press scale, while page entrance motion yields to reduced-motion preferences.

## 2. Color Palette & Roles

- **Ink Primary (#000000 / RGB 0 0 0):** storefront and admin primary actions, header surfaces, strong headings, and active navigation.
- **Primary Text (#FFFFFF / RGB 255 255 255):** text and icons placed on black primary surfaces.
- **Cool Canvas (#F7F9FB / RGB 247 249 251):** admin page background and low-emphasis application canvas.
- **White Surface (#FFFFFF / RGB 255 255 255):** cards, forms, storefront navigation, and elevated content.
- **Cool Surface Layers (#F2F4F6, #ECEEF0, #E6E8EA):** grouped controls, selected surfaces, table headers, and quiet section separation.
- **White Secondary (#FFFFFF / RGB 255 255 255):** secondary actions and light surfaces, always paired with black text and a visible border where needed.
- **Secondary Container (#F2F2F2 / RGB 242 242 242):** quiet secondary status and contextual emphasis.
- **Charcoal Text (#191C1E / RGB 25 28 30):** primary body and heading text on light surfaces.
- **Neutral Variant (#474747 / RGB 71 71 71):** supporting text, descriptions, and secondary navigation.
- **Outline Gray (#777777 / RGB 119 119 119):** focus ring and important structure.
- **Soft Outline (#C6C6C6 / RGB 198 198 198):** dividers and low-contrast control boundaries.
- **Error Red (#BA1A1A / RGB 186 26 26):** destructive actions and validation errors.

## 3. Typography Rules

Use Inter for operational body copy and compact data surfaces. Use Plus Jakarta Sans for storefront and admin headlines, page titles, and high-level navigation. Headings are bold and tightly tracked; utility labels use uppercase lettering with generous tracking. Numeric columns and money values use tabular numerals.

Headings should use balanced wrapping where supported. Loading and asynchronous status copy ends with an ellipsis character (…), and action labels should describe the result, such as “Download OpenAPI YAML” or “Save API Key”.

## 4. Component Stylings

* **Buttons:** Subtly rounded corners with semantic primary, outline, secondary, ghost, link, and destructive variants. Controls use visible focus-visible rings, explicit transitions rather than broad transitions, and a restrained scale(0.96) press response. Icon-only buttons must have an accessible label and at least a comfortable touch target.
* **Cards/Containers:** White or lowest-surface cards sit on the cool canvas with a 12px default admin card radius and whisper-soft elevation (0 1px 2px rgb(0 0 0 / 0.04)). Nested surfaces should follow concentric radii: the inner control radius is smaller than its containing card.
* **Inputs/Forms:** Inputs are 40px-class controls with semantic borders, quiet light surfaces, explicit labels, meaningful names, and visible focus rings. Form groups use consistent vertical gaps rather than ad hoc spacing. Admin native inputs, selects, and textareas inherit a shared 36px field height and 8px radius.
* **Navigation:** The storefront header is dark and search-first with a white secondary navigation band. CMS navigation is the source of truth for desktop, mobile, featured links, and badges. Admin navigation is permission-aware and grouped by business intent.
* **Feedback:** Use alert, badge, skeleton, and empty-state components rather than one-off styled blocks. Async errors explain what happened and what the user can do next.

## 5. Layout Principles

Storefront pages use a full-width shell with a max-width of approximately 1600px and fluid gutters based on viewport width. The header remains fixed, so main content reserves explicit top space. Catalog and checkout layouts prioritize a single clear reading path, while admin pages use a consistent shell with breadcrumbs, title, command actions, workspace content, and optional inspector context.

Responsive behavior must preserve discovery, not merely hide content. Primary categories remain reachable on small screens through a keyboard-accessible menu with focus containment and restoration. Tables and endpoint directories may scroll inside bounded regions; long labels and generated routes must wrap or truncate without pushing the page horizontally.

## 6. Verification Notes

This document was synthesized from apps/web/src/admin-globals.css, the active storefront/admin components, and the OpenAPI generator. A Stitch project, screen metadata, and screenshot were not available, so visual claims are repository-grounded rather than screenshot-verified.
