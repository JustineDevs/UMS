#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://universalmusic.vercel.app';

export const PRIVATE_PAGE_CONTRACT = [
  { path: '/account/profile', requiresNoIndex: false },
  { path: '/account/addresses', requiresNoIndex: false },
  { path: '/account/banks-cards', requiresNoIndex: false },
  { path: '/account/notifications', requiresNoIndex: false },
  { path: '/account/notifications/order', requiresNoIndex: false },
  { path: '/account/notifications/promotions', requiresNoIndex: false },
  { path: '/account/orders', requiresNoIndex: false },
  { path: '/account/orders/order_c3210b94a7c747c6956a96fba19848cf', requiresNoIndex: false },
  { path: '/account/orders/order_c3210b94a7c747c6956a96fba19848cf/return', requiresNoIndex: false },
  { path: '/account/password', requiresNoIndex: false },
  { path: '/account/preferences', requiresNoIndex: false },
  { path: '/account/privacy', requiresNoIndex: false },
  { path: '/account/vouchers', requiresNoIndex: false },
  { path: '/order-confirmation/test', requiresNoIndex: true },
  { path: '/track', requiresNoIndex: true },
  { path: '/track/test', requiresNoIndex: true },
];

function normalizeBaseUrl(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function header(response, name) {
  return response.headers?.get?.(name) ?? response.headers?.[name] ?? '';
}

export function validatePrivatePageResponse({ status, headers, body }, contract, url) {
  const failures = [];
  if (status < 200 || status >= 400) failures.push(`${url} returned HTTP ${status}`);
  const cacheControl = header({ headers }, 'cache-control').toLowerCase();
  if (!cacheControl.includes('no-store')) failures.push(`${url} is missing cache-control: no-store`);
  if (header({ headers }, 'referrer-policy').toLowerCase() !== 'no-referrer') {
    failures.push(`${url} is missing referrer-policy: no-referrer`);
  }
  if (header({ headers }, 'x-content-type-options').toLowerCase() !== 'nosniff') {
    failures.push(`${url} is missing x-content-type-options: nosniff`);
  }
  if (!/^max-age=\d+/.test(header({ headers }, 'strict-transport-security').toLowerCase())) {
    failures.push(`${url} is missing strict-transport-security`);
  }
  const contentSecurityPolicy = header({ headers }, 'content-security-policy').toLowerCase();
  if (!contentSecurityPolicy.includes("frame-ancestors 'self'")) {
    failures.push(`${url} is missing a self-only content-security-policy frame-ancestors directive`);
  }
  if (!header({ headers }, 'permissions-policy').trim()) {
    failures.push(`${url} is missing permissions-policy`);
  }
  if (contract.requiresNoIndex && !/noindex/i.test(body)) {
    failures.push(`${url} is missing noindex metadata`);
  }
  return failures;
}

export async function runChecks({
  baseUrl = process.env.STOREFRONT_URL_PRODUCTION ?? DEFAULT_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  const failures = [];
  const base = normalizeBaseUrl(baseUrl);
  for (const contract of PRIVATE_PAGE_CONTRACT) {
    const url = `${base}${contract.path}`;
    try {
      const response = await fetchImpl(url, { redirect: 'manual' });
      const body = await response.text();
      failures.push(...validatePrivatePageResponse({
        status: response.status,
        headers: response.headers,
        body,
      }, contract, url));
    } catch (error) {
      failures.push(`${url} request failed: ${error.message}`);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = await runChecks();
  if (failures.length > 0) {
    console.error('Deployed private-page contract check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Deployed private-page contract check passed for ${PRIVATE_PAGE_CONTRACT.length} routes.`);
  }
}
