/**
 * Compatibility tombstone for the former Medusa-only checkout completion API.
 * Keep the old path explicitly retired so stale clients receive the same
 * fail-closed contract as the canonical completion path instead of a generic
 * framework 404.
 */
export { POST, dynamic } from "../complete/route";
