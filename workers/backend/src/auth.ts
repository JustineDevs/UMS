const encoder = new TextEncoder();

export type WorkerAuthClaims = {
  sub: string;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
};

export type WorkerAuthConfig = {
  secret?: string;
  supabaseUrl?: string;
  audience?: string;
  fetch?: typeof fetch;
};

type WorkerJsonWebKey = JsonWebKey & { kid?: string };
type JsonWebKeySet = { keys?: WorkerJsonWebKey[] };
const jwksCache = new Map<string, Promise<WorkerJsonWebKey[]>>();

function base64UrlBytes(value: string): Uint8Array | null {
  try {
    const padded =
      value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1)
    result |= left[index] ^ right[index];
  return result === 0;
}

export async function verifyWorkerBearerToken(
  authorization: string | null,
  secretOrConfig: string | WorkerAuthConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<WorkerAuthClaims | null> {
  const config: WorkerAuthConfig =
    typeof secretOrConfig === "string"
      ? { secret: secretOrConfig }
      : secretOrConfig;
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = base64UrlBytes(parts[0]);
  const payload = base64UrlBytes(parts[1]);
  const signature = base64UrlBytes(parts[2]);
  if (!header || !payload || !signature) return null;
  try {
    const parsedHeader = JSON.parse(new TextDecoder().decode(header)) as {
      alg?: string;
      typ?: string;
      kid?: string;
    };
    const claims = JSON.parse(
      new TextDecoder().decode(payload),
    ) as Partial<WorkerAuthClaims>;
    if (parsedHeader.typ !== "JWT" || typeof claims.sub !== "string" || !claims.sub.trim())
      return null;
    if (
      claims.exp !== undefined &&
      (!Number.isSafeInteger(claims.exp) || claims.exp <= nowSeconds)
    )
      return null;
    // Server-to-Worker calls use a short-lived internal token carrying the
    // already-authorized staff scope. It is deliberately distinct from a
    // Supabase user token and is accepted only with the explicit issuer/aud.
    if (
      parsedHeader.alg === "HS256" &&
      config.secret &&
      claims.iss === "uvs.internal" &&
      claims.aud === "uvs-worker"
    ) {
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(config.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        signature as unknown as BufferSource,
        encoder.encode(`${parts[0]}.${parts[1]}`),
      );
      return valid ? (claims as WorkerAuthClaims) : null;
    }
    if (config.supabaseUrl) {
      if (
        (parsedHeader.alg !== "RS256" && parsedHeader.alg !== "ES256") ||
        typeof parsedHeader.kid !== "string"
      )
        return null;
      const issuer = `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1`;
      if (claims.iss !== issuer) return null;
      const audience = claims.aud;
      const expectedAudience = config.audience ?? "authenticated";
      if (!(audience === expectedAudience || (Array.isArray(audience) && audience.includes(expectedAudience)))) return null;
      const expiry = claims.exp;
      if (!Number.isSafeInteger(expiry) || (expiry as number) <= nowSeconds) return null;
      if (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > nowSeconds)) return null;
      const fetcher = config.fetch ?? fetch;
      let keysPromise = jwksCache.get(issuer);
      if (!keysPromise) {
        const pending = fetcher(`${issuer}/.well-known/jwks.json`, { headers: { Accept: "application/json" } })
          .then(async (response) => {
            if (!response.ok) throw new Error("jwks_unavailable");
            const body = (await response.json()) as JsonWebKeySet;
            if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error("jwks_empty");
            return body.keys;
          });
        keysPromise = pending.catch((error) => {
          jwksCache.delete(issuer);
          throw error;
        });
        jwksCache.set(issuer, keysPromise);
      }
      const jwk = (await keysPromise).find((candidate) => candidate.kid === parsedHeader.kid);
      if (!jwk) return null;
      const algorithm =
        parsedHeader.alg === "ES256"
          ? { name: "ECDSA", namedCurve: "P-256" as const }
          : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" as const };
      if (
        (parsedHeader.alg === "ES256" && (jwk.kty !== "EC" || jwk.crv !== "P-256")) ||
        (parsedHeader.alg === "RS256" && jwk.kty !== "RSA") ||
        (jwk.alg !== undefined && jwk.alg !== parsedHeader.alg)
      )
        return null;
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        algorithm,
        false,
        ["verify"],
      );
      const valid = await crypto.subtle.verify(
        parsedHeader.alg === "ES256"
          ? { name: "ECDSA", hash: "SHA-256" }
          : { name: "RSASSA-PKCS1-v1_5" },
        key,
        signature as unknown as BufferSource,
        encoder.encode(`${parts[0]}.${parts[1]}`),
      );
      return valid ? (claims as WorkerAuthClaims) : null;
    }
    if (parsedHeader.alg !== "HS256" || !config.secret) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(config.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as unknown as BufferSource,
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? (claims as WorkerAuthClaims) : null;
  } catch {
    return null;
  }
}
