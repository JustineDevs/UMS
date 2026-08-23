/**
 * HMAC-based tracking token for /track/[orderId] and /track?orderId=&t=
 * Spec: "Anonymous tracking SHALL use a scoped secret (e.g. HMAC of order id)
 * conveyed in the URL query string so that knowledge of the order UUID alone
 * is insufficient to read order or shipment data."
 *
 * Server-only: reads TRACKING_HMAC_SECRET from env.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const ALG = "sha256";
const CAPABILITY_VERSION = "v2";
const LEGACY_CAPABILITY_VERSION = "v1";
const CAPABILITY_PURPOSE = "track";
const CAPABILITY_AUDIENCE = "public-tracking";
const DEFAULT_KEY_VERSION = "v1";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const OPAQUE_CAPABILITY_VERSION = "v3";
const OPAQUE_PURPOSE = CAPABILITY_PURPOSE;
const OPAQUE_AUDIENCE = CAPABILITY_AUDIENCE;
const CONFIRMATION_PURPOSE = "confirmation";
type OpaqueCapabilityPurpose = typeof OPAQUE_PURPOSE | typeof CONFIRMATION_PURPOSE;

export type TrackingCapabilityScope = {
  customerEmail?: string;
  storeId?: string;
};

export type ResolvedTrackingCapability = {
  id: string;
  scope?: {
    customerEmailHash?: string;
    storeId?: string;
  };
};

function normalizeCapabilityScope(scope?: TrackingCapabilityScope): ResolvedTrackingCapability["scope"] {
  if (!scope) return undefined;
  const customerEmail = scope.customerEmail?.trim().toLowerCase();
  const storeId = scope.storeId?.trim();
  const customerEmailHash = customerEmail
    ? createHash("sha256").update(customerEmail).digest("hex")
    : undefined;
  return customerEmailHash || storeId ? { customerEmailHash, storeId } : undefined;
}

function getSecret(): string | undefined {
  return process.env.TRACKING_HMAC_SECRET?.trim() || undefined;
}

export function generateTrackingToken(id: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const hmac = createHmac(ALG, secret);
  hmac.update(id);
  return hmac.digest("base64url");
}

export function verifyTrackingToken(id: string, token: string): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const expected = generateTrackingToken(id);
  if (!expected) return false;
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(token, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

function opaqueKey(version: string): Buffer | null {
  const secret = getCapabilityKey(version);
  return secret ? createHash("sha256").update(secret).digest() : null;
}

export function generateOpaqueTrackingCapability(
  id: string,
  nowMs = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
  purpose: OpaqueCapabilityPurpose = OPAQUE_PURPOSE,
  scope?: TrackingCapabilityScope,
): string | null {
  const normalizedId = id.trim();
  if (!normalizedId || !Number.isFinite(nowMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return null;
  }
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = Math.floor((nowMs + ttlMs) / 1000);
  const keyVersion = process.env.TRACKING_HMAC_KEY_VERSION?.trim() || DEFAULT_KEY_VERSION;
  const key = opaqueKey(keyVersion);
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = JSON.stringify({
    version: OPAQUE_CAPABILITY_VERSION,
    purpose,
    audience: OPAQUE_AUDIENCE,
    keyVersion,
    id: normalizedId,
    issuedAt,
    expiresAt,
    scope: normalizeCapabilityScope(scope),
  });
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return [
    OPAQUE_CAPABILITY_VERSION,
    keyVersion,
    String(issuedAt),
    String(expiresAt),
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function resolveOpaqueTrackingCapability(
  token: string,
  nowMs = Date.now(),
  expectedPurpose: OpaqueCapabilityPurpose = OPAQUE_PURPOSE,
): string | null {
  return resolveOpaqueTrackingCapabilityDetails(token, nowMs, expectedPurpose)?.id ?? null;
}

export function resolveOpaqueTrackingCapabilityDetails(
  token: string,
  nowMs = Date.now(),
  expectedPurpose: OpaqueCapabilityPurpose = OPAQUE_PURPOSE,
): ResolvedTrackingCapability | null {
  const [version, keyVersion, issuedAtRaw, expiresAtRaw, ivRaw, tagRaw, ciphertextRaw] = token.split(".");
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    version !== OPAQUE_CAPABILITY_VERSION ||
    !keyVersion ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    issuedAt > nowSeconds ||
    expiresAt <= nowSeconds ||
    expiresAt <= issuedAt ||
    !ivRaw ||
    !tagRaw ||
    !ciphertextRaw
  ) return null;
  const key = opaqueKey(keyVersion);
  if (!key) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as {
      version?: string;
      purpose?: string;
      audience?: string;
      keyVersion?: string;
      id?: string;
      issuedAt?: number;
      expiresAt?: number;
      scope?: ResolvedTrackingCapability["scope"];
    };
    if (
      payload.version !== version ||
      payload.purpose !== expectedPurpose ||
      payload.audience !== OPAQUE_AUDIENCE ||
      payload.keyVersion !== keyVersion ||
      payload.issuedAt !== issuedAt ||
      payload.expiresAt !== expiresAt ||
      typeof payload.id !== "string" ||
      !/^(order|cart)_[A-Za-z0-9_-]+$/.test(payload.id)
    ) return null;
    const scope = payload.scope && typeof payload.scope === "object"
      ? {
          ...(typeof payload.scope.customerEmailHash === "string" && /^[a-f0-9]{64}$/.test(payload.scope.customerEmailHash)
            ? { customerEmailHash: payload.scope.customerEmailHash }
            : {}),
          ...(typeof payload.scope.storeId === "string" && payload.scope.storeId.trim()
            ? { storeId: payload.scope.storeId.trim().slice(0, 128) }
            : {}),
        }
      : undefined;
    return { id: payload.id, ...(scope && Object.keys(scope).length > 0 ? { scope } : {}) };
  } catch {
    return null;
  }
}

function getCapabilityKey(version: string): string | undefined {
  const currentVersion = process.env.TRACKING_HMAC_KEY_VERSION?.trim() || DEFAULT_KEY_VERSION;
  if (version === currentVersion) return getSecret();
  const previousVersion = process.env.TRACKING_HMAC_PREVIOUS_KEY_VERSION?.trim();
  const previousSecret = process.env.TRACKING_HMAC_SECRET_PREVIOUS?.trim();
  return version === previousVersion ? previousSecret || undefined : undefined;
}

function capabilitySignature(
  id: string,
  issuedAt: number,
  expiresAt: number,
  keyVersion: string,
): string | null {
  const secret = getCapabilityKey(keyVersion);
  if (!secret) return null;
  return createHmac(ALG, secret)
    .update(`${CAPABILITY_VERSION}:${CAPABILITY_PURPOSE}:${CAPABILITY_AUDIENCE}:${keyVersion}:${id}:${issuedAt}:${expiresAt}`)
    .digest("base64url");
}

function legacyCapabilitySignatures(id: string, expiresAt: number): string[] {
  const secrets = [
    getSecret(),
    process.env.TRACKING_HMAC_SECRET_PREVIOUS?.trim() || undefined,
  ].filter((secret): secret is string => Boolean(secret));
  return secrets.map((secret) =>
    createHmac(ALG, secret)
      .update(`${LEGACY_CAPABILITY_VERSION}:${CAPABILITY_PURPOSE}:${id}:${expiresAt}`)
      .digest("base64url"),
  );
}

/** Create a short-lived tracking capability. The legacy token API remains exported for compatibility. */
export function generateTrackingCapability(
  id: string,
  nowMs = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
): string | null {
  if (!id.trim() || !Number.isFinite(nowMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return null;
  }
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = Math.floor((nowMs + ttlMs) / 1000);
  const keyVersion = process.env.TRACKING_HMAC_KEY_VERSION?.trim() || DEFAULT_KEY_VERSION;
  const signature = capabilitySignature(id, issuedAt, expiresAt, keyVersion);
  return signature
    ? `${CAPABILITY_VERSION}.${issuedAt}.${expiresAt}.${CAPABILITY_PURPOSE}.${CAPABILITY_AUDIENCE}.${keyVersion}.${signature}`
    : null;
}

export function verifyTrackingCapability(
  id: string,
  token: string,
  nowMs = Date.now(),
): boolean {
  const parts = token.split(".");
  if (parts[0] === LEGACY_CAPABILITY_VERSION && parts.length === 3) {
    const expiresAt = Number(parts[1]);
    const signature = parts[2];
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(nowMs / 1000) || !signature) return false;
    return legacyCapabilitySignatures(id, expiresAt).some((expected) =>
      expected.length === signature.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
    );
  }
  const [version, issuedAtRaw, expiresAtRaw, purpose, audience, keyVersion, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    version !== CAPABILITY_VERSION ||
    purpose !== CAPABILITY_PURPOSE ||
    audience !== CAPABILITY_AUDIENCE ||
    !keyVersion ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    issuedAt > nowSeconds ||
    expiresAt <= nowSeconds ||
    expiresAt <= issuedAt ||
    !signature
  ) {
    return false;
  }
  const expected = capabilitySignature(id, issuedAt, expiresAt, keyVersion);
  if (!expected || expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Build tracking URL with signed token. Returns null if secret not configured
 * (callers must block rather than expose an unsigned order identifier).
 */
export function buildTrackingUrl(
  baseUrl: string,
  id: string,
  scope?: TrackingCapabilityScope,
): string | null {
  const token = generateOpaqueTrackingCapability(id, Date.now(), DEFAULT_TTL_MS, OPAQUE_PURPOSE, scope);
  if (!token) return null;
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/track/cap_${encodeURIComponent(token)}`;
}

/** Build a separate capability for private order-confirmation data. */
export function buildOrderConfirmationUrl(baseUrl: string, id: string): string | null {
  const token = generateOpaqueTrackingCapability(id, Date.now(), DEFAULT_TTL_MS, CONFIRMATION_PURPOSE);
  if (!token) return null;
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/order-confirmation/cap_${encodeURIComponent(token)}`;
}
