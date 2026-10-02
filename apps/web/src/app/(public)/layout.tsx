import {
  StorefrontPublicChrome,
  type StorefrontChromeSections,
} from "../../components/StorefrontPublicChrome";
import { CmsPagePreviewBridge } from "../../components/CmsPagePreviewBridge";
import { StorefrontRuntimeProviders } from "../../components/StorefrontRuntimeProviders";

const STOREFRONT_SECTIONS: StorefrontChromeSections = {
  header: {
    announcement: true,
    primaryNav: true,
  },
  footer: true,
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StorefrontRuntimeProviders>
      <StorefrontPublicChrome sections={STOREFRONT_SECTIONS}>
        <CmsPagePreviewBridge />
        {children}
      </StorefrontPublicChrome>
    </StorefrontRuntimeProviders>
  );
}
