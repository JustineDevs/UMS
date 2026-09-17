export type ReceiptLookupState = "empty" | "found" | "not_found" | "unavailable";

export function classifyReceiptLookup(
  responseStatus: number,
  hasData: boolean,
  hasInput = true,
): ReceiptLookupState {
  if (!hasInput) return "empty";
  if (hasData && responseStatus >= 200 && responseStatus < 300) return "found";
  if (responseStatus === 404) return "not_found";
  return "unavailable";
}

export function catalogMediaEmptyState(
  rowCount: number,
  hasFilters: boolean,
  upstreamUnavailable = false,
): "none" | "filtered" | "unavailable" {
  if (rowCount === 0 && upstreamUnavailable) return "unavailable";
  return rowCount === 0 && hasFilters ? "filtered" : "none";
}
