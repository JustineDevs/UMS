/**
 * Scenario registry: human-readable ids, tags for `pnpm exec playwright test --grep @tag`,
 * and links to manifests under stress-test/e2e/manifests/.
 */

export const TAG = {
  smoke: "@smoke",
  workflow: "@workflow",
  checkout: "@checkout",
  admin: "@admin",
  crossApp: "@cross-app",
  layout: "@layout",
  matrix: "@matrix",
  chaos: "@chaos",
  architecture: "@architecture",
  resilience: "@resilience",
} as const;

export type ScenarioEntry = {
  id: string;
  tags: string[];
  description: string;
  manifestRef?: string;
};

export const scenarios: ScenarioEntry[] = [
  {
    id: "storefront-health-pdp",
    tags: [TAG.smoke, TAG.architecture],
    description: "API health and optional first PDP from catalog",
    manifestRef: "workflow-coverage.json#storefront-health-pdp",
  },
  {
    id: "checkout-shell-guest",
    tags: [TAG.smoke, TAG.workflow, TAG.checkout],
    description: "Checkout page shell (guest or pay path affordances)",
    manifestRef: "workflow-coverage.json#checkout-shell",
  },
  {
    id: "stripe-return",
    tags: [TAG.smoke, TAG.checkout],
    description: "Stripe return route responds without 5xx",
    manifestRef: "route-coverage.json#/checkout/stripe-return",
  },
  {
    id: "admin-route-stress",
    tags: [TAG.workflow, TAG.admin],
    description: "Authenticated pass over core admin routes",
    manifestRef: "route-coverage.json#admin-core",
  },
  {
    id: "cross-app-health",
    tags: [TAG.crossApp, TAG.smoke],
    description: "Storefront and admin health reachable in same run",
    manifestRef: "workflow-coverage.json#cross-app-health",
  },
  {
    id: "layout-viewport-stress",
    tags: [TAG.layout, TAG.matrix],
    description: "Shell stability across viewports and back navigation",
    manifestRef: "layout-coverage.json#storefront-chrome",
  },
  {
    id: "network-chaos-storefront",
    tags: [TAG.chaos, TAG.resilience],
    description: "Injected API failures and slow network; UI must not hard-crash",
    manifestRef: "workflow-coverage.json#chaos-storefront",
  },
];
