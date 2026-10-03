import type { CmsNavigationPayload } from "@universal-music-store/platform-data";
import { StorefrontNav } from "./StorefrontNav";

export type StorefrontHeaderSections = {
  announcement?: boolean;
  primaryNav?: boolean;
};

export type StorefrontNavigationSource = "cms" | "empty";

export function StorefrontHeader({
  announcement,
  navigation,
  navigationSource = "empty",
  sections,
}: {
  announcement?: React.ReactNode;
  /** Full CMS navigation (mega menu, mobile links, footer bar). */
  navigation?: CmsNavigationPayload;
  /** Identifies whether visible navigation comes from CMS or safe defaults. */
  navigationSource?: StorefrontNavigationSource;
  /** Independently compose the announcement and primary navigation sections. */
  sections?: StorefrontHeaderSections;
}) {
  const showPrimaryNav = sections?.primaryNav !== false;
  const showAnnouncement = sections?.announcement !== false;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex w-full min-w-0 flex-col bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75"
      data-cms-id="storefront-header"
      data-cms-label="Storefront navbar"
    >
      {showAnnouncement ? announcement : null}
      {showPrimaryNav ? (
        <StorefrontNav navigation={navigation} navigationSource={navigationSource} />
      ) : null}
    </header>
  );
}
