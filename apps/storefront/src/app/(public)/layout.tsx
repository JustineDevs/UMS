import { StorefrontPublicChrome } from "../../components/StorefrontPublicChrome";
import { CmsPagePreviewBridge } from "../../components/CmsPagePreviewBridge";
import { StorefrontRuntimeProviders } from "../../components/StorefrontRuntimeProviders";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StorefrontRuntimeProviders>
      <StorefrontPublicChrome>
        <CmsPagePreviewBridge />
        {children}
      </StorefrontPublicChrome>
    </StorefrontRuntimeProviders>
  );
}
