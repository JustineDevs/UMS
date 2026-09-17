import { getMedusaStoreBaseUrl } from "@universal-music-store/sdk";
import { getMedusaSecretKey } from "@/lib/medusa-pos";

/**
 * Same encoding as @medusajs/js-sdk Client: Basic base64(`${apiKey}:`).
 * Medusa's admin authenticate middleware only accepts secret keys via Basic, not Bearer
 * (Bearer is for JWT user sessions).
 */
function secretApiKeyBasicAuthorization(secret: string): string {
  const payload = `${secret}:`;
  const b64 = Buffer.from(payload, "utf8").toString("base64");
  return `Basic ${b64}`;
}

const MEDUSA_FETCH_ATTEMPTS = 5;
const MEDUSA_FETCH_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient failures while `medusa develop` is still binding the port. */
function shouldRetryMedusaHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

async function medusaAdminFetchOnce(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getMedusaStoreBaseUrl().replace(/\/$/, "");
  const secret = getMedusaSecretKey();
  if (!secret) {
    throw new Error("MEDUSA_SECRET_API_KEY (or MEDUSA_ADMIN_API_SECRET) is not set");
  }
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init?.headers);
  headers.set("Authorization", secretApiKeyBasicAuthorization(secret));
  if (
    init?.body &&
    init.method !== "GET" &&
    init.method !== "HEAD" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

/**
 * Authenticated Admin API call to the Medusa backend (server-side only).
 * Retries a few times on connection errors or gateway responses while the commerce server starts.
 */
export async function medusaAdminFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MEDUSA_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await medusaAdminFetchOnce(path, init);
      if (
        shouldRetryMedusaHttpStatus(res.status) &&
        attempt < MEDUSA_FETCH_ATTEMPTS - 1
      ) {
        await sleep(MEDUSA_FETCH_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < MEDUSA_FETCH_ATTEMPTS - 1) {
        await sleep(MEDUSA_FETCH_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error("medusaAdminFetch failed");
}
