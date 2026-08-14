import { StorefrontPublicChrome } from "../../components/StorefrontPublicChrome";
import { CmsPagePreviewBridge } from "../../components/CmsPagePreviewBridge";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StorefrontPublicChrome>
      <CmsPagePreviewBridge />
      {children}
    </StorefrontPublicChrome>
  );
}
