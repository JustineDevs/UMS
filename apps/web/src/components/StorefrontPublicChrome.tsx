import {
  loadCmsAbExperimentsActivePublic,
  loadCmsAnnouncementsPublic,
  loadCmsNavigationPublic,
  storefrontSocialLinks,
} from "@universal-music-store/platform-data";
import { CmsAnnouncementStack } from "./CmsAnnouncementBar";
import { CmsExperimentAssigner } from "./CmsExperimentAssigner";
import { GlobalRouteMotion } from "./GlobalRouteMotion";
import { StorefrontFooter } from "./StorefrontFooter";
import { StorefrontHeader } from "./StorefrontHeader";
import { getCachedPublicSiteMetadata } from "@/lib/public-site-metadata";

/**
 * Shared storefront chrome (header, footer, motion, CMS experiments) for public routes
 * and root not-found so global 404s still match the main layout.
 */
export async function StorefrontPublicChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const [nav, announcements, experiments, publicSite] = await Promise.all([
    loadCmsNavigationPublic(),
    loadCmsAnnouncementsPublic(),
    loadCmsAbExperimentsActivePublic(),
    getCachedPublicSiteMetadata(),
  ]);

  const announcementBars = announcements.map((ann) => ({
    id: ann.id,
    locale: ann.locale,
    body: ann.body,
    bodyFormat: ann.bodyFormat,
    linkUrl: ann.linkUrl,
    linkLabel: ann.linkLabel,
    dismissible: ann.dismissible,
  }));

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[500] focus:block focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-on-primary focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        Skip to main content
      </a>
      <StorefrontHeader
        announcement={
          announcementBars.length > 0 ? <CmsAnnouncementStack bars={announcementBars} /> : undefined
        }
        navigation={nav}
      />
      <CmsExperimentAssigner experiments={experiments} />
      <div
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-[100vw] pt-[5.875rem] outline-none xs:pt-24 sm:pt-[6.125rem] md:pt-[6.25rem]"
      >
        <GlobalRouteMotion>{children}</GlobalRouteMotion>
      </div>
      <StorefrontFooter
        cmsFooterColumns={nav.footerColumns.length > 0 ? nav.footerColumns : undefined}
        cmsFooterBottomLinks={
          nav.footerBottomLinks.length > 0 ? nav.footerBottomLinks : undefined
        }
        cmsSocialLinks={nav.socialLinks.length > 0 ? nav.socialLinks : undefined}
        publicSocialLinks={storefrontSocialLinks(publicSite)}
      />
    </>
  );
}
