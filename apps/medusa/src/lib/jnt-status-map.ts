/**
 * Map J&T Express PH VIP API status codes to the internal tracking status strings
 * used throughout the codebase.
 */
export function mapJntStatus(status: string | undefined): string {
  const s = (status ?? "").toUpperCase().replace(/[\s_-]/g, "");

  if (s === "SIGNED" || s === "DELIVERED") return "delivered";
  if (s === "DELIVERING" || s === "OUTFORDELIVERY") return "out_for_delivery";
  if (s === "TRANSIT" || s === "INTRANSIT" || s === "ARRIVED") return "in_transit";
  if (s === "PENDING" || s === "CREATED" || s === "PICKEDUP") return "pending";
  if (s === "PROBLEM" || s === "EXCEPTION" || s === "RETURN") return "exception";

  return "in_transit";
}
