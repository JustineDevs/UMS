import { HttpErrorPage } from "@/components/HttpErrorPage";

/**
 * `notFound()` from routes under `(public)` uses this file (nearest not-found).
 * Header and footer come from `(public)/layout` via `StorefrontPublicChrome`.
 */
export default function PublicNotFound() {
  return <HttpErrorPage code={404} />;
}
