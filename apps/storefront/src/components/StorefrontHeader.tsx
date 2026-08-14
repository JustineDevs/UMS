import type { CmsNavigationPayload } from "@universal-music-store/platform-data";
import { StorefrontNav } from "./StorefrontNav";
import { StorefrontUtilityBar } from "./StorefrontUtilityBar";

export function StorefrontHeader({
  announcement,
  navigation,
}: {
  announcement?: React.ReactNode;
  /** Full CMS navigation (mega menu, mobile links, footer bar). */
  navigation?: CmsNavigationPayload;
}) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex w-full min-w-0 flex-col bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75"
      data-cms-id="storefront-header"
      data-cms-label="Storefront navbar"
    >
      {announcement}
      <StorefrontUtilityBar />
      <StorefrontNav navigation={navigation} />
    </header>
  );
}
