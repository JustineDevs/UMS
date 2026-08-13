/**
 * HMAC-based tracking token for /track/[orderId] and /track?orderId=&t=
 * Spec: "Anonymous tracking SHALL use a scoped secret (e.g. HMAC of order id)
 * conveyed in the URL query string so that knowledge of the order UUID alone
 * is insufficient to read order or shipment data."
 *
 * Server-only: reads TRACKING_HMAC_SECRET from env.
 */
import { createHmac, timingSafeEqual } from "crypto";
const ALG = "sha256";
function getSecret() {
    return process.env.TRACKING_HMAC_SECRET?.trim() || undefined;
}
export function generateTrackingToken(id) {
    const secret = getSecret();
    if (!secret)
        return null;
    const hmac = createHmac(ALG, secret);
    hmac.update(id);
    return hmac.digest("base64url");
}
export function verifyTrackingToken(id, token) {
    const secret = getSecret();
    if (!secret)
        return false;
    const expected = generateTrackingToken(id);
    if (!expected)
        return false;
    if (token.length !== expected.length)
        return false;
    try {
        return timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(expected, "utf8"));
    }
    catch {
        return false;
    }
}
/**
 * Build tracking URL with signed token. Returns null if secret not configured
 * (caller should fall back to token-less for dev, or block in production).
 */
export function buildTrackingUrl(baseUrl, id) {
    const token = generateTrackingToken(id);
    if (!token)
        return null;
    const cleanBase = baseUrl.replace(/\/$/, "");
    return `${cleanBase}/track/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tpbmctdG9rZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0cmFja2luZy10b2tlbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7OztHQU9HO0FBQ0gsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFckQsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDO0FBRXJCLFNBQVMsU0FBUztJQUNoQixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLElBQUksU0FBUyxDQUFDO0FBQy9ELENBQUM7QUFFRCxNQUFNLFVBQVUscUJBQXFCLENBQUMsRUFBVTtJQUM5QyxNQUFNLE1BQU0sR0FBRyxTQUFTLEVBQUUsQ0FBQztJQUMzQixJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQ3pCLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNoQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxFQUFVLEVBQUUsS0FBYTtJQUMzRCxNQUFNLE1BQU0sR0FBRyxTQUFTLEVBQUUsQ0FBQztJQUMzQixJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzFCLE1BQU0sUUFBUSxHQUFHLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLElBQUksQ0FBQyxRQUFRO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDNUIsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxNQUFNO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDbkQsSUFBSSxDQUFDO1FBQ0gsT0FBTyxlQUFlLENBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FDOUIsQ0FBQztJQUNKLENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE9BQWUsRUFBRSxFQUFVO0lBQzFELE1BQU0sS0FBSyxHQUFHLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3hDLElBQUksQ0FBQyxLQUFLO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDeEIsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDN0MsT0FBTyxHQUFHLFNBQVMsVUFBVSxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsTUFBTSxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBQ3ZGLENBQUMifQ==