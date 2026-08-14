import type { Metadata } from "next";
import { HttpErrorPage } from "@/components/HttpErrorPage";
import { StorefrontPublicChrome } from "@/components/StorefrontPublicChrome";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * Global 404 for unmatched URLs and `notFound()` from nested routes.
 * Uses the same chrome as `(public)` so header and footer stay aligned.
 */
export default function NotFound() {
  return (
    <StorefrontPublicChrome>
      <HttpErrorPage code={404} />
    </StorefrontPublicChrome>
  );
}
