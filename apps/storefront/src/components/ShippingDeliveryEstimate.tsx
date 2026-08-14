import Link from "next/link";
import { headers } from "next/headers";

function metroManilaHint(country: string | null): string {
  const c = (country ?? "").trim().toUpperCase();
  if (c === "PH" || c === "") {
    return "Metro Manila and nearby provinces often see roughly 2–5 business days after dispatch. Remote areas may take longer.";
  }
  if (c === "US" || c === "CA" || c === "AU" || c === "GB") {
    return "International delivery times depend on customs and the carrier. We quote a firmer range at checkout once your address is known.";
  }
  return "Delivery estimates depend on your address and courier. You will see shipping options and timing as you complete checkout.";
}

/**
 * Best-effort region hint from edge headers (Vercel / common proxies). Not a guaranteed delivery date.
 */
export async function ShippingDeliveryEstimate() {
  const h = await headers();
  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code") ??
    null;

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low/30 px-4 py-3 text-sm text-on-surface-variant">
      <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
        Estimated delivery (guide only)
      </p>
      <p className="mt-2 leading-relaxed">{metroManilaHint(country)}</p>
      <p className="mt-2">
        <Link href="/shipping" className="text-primary underline">
          Full shipping policy
        </Link>
      </p>
    </div>
  );
}
