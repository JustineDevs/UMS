import type { CmsNavigationPayload } from "@universal-music-store/platform-data";
import { StorefrontNav } from "./StorefrontNav";
import { StorefrontUtilityBar } from "./StorefrontUtilityBar";

export type StorefrontHeaderSections = {
  announcement?: boolean;
  utilityBar?: boolean;
  primaryNav?: boolean;
};

export function StorefrontHeader({
  announcement,
  navigation,
  sections,
}: {
  announcement?: React.ReactNode;
  /** Full CMS navigation (mega menu, mobile links, footer bar). */
  navigation?: CmsNavigationPayload;
  /** Independently compose the utility and primary navigation sections. */
  sections?: StorefrontHeaderSections;
}) {
  const showUtilityBar = sections?.utilityBar !== false;
  const showPrimaryNav = sections?.primaryNav !== false;
  const showAnnouncement = sections?.announcement !== false;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex w-full min-w-0 flex-col bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75"
      data-cms-id="storefront-header"
      data-cms-label="Storefront navbar"
    >
      {showAnnouncement ? announcement : null}
      {showUtilityBar ? <StorefrontUtilityBar /> : null}
      {showPrimaryNav ? <StorefrontNav navigation={navigation} /> : null}
    </header>
  );
}
