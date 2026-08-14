/**
 * CMS facade: helpers in this package; data loaders live in @universal-music-store/platform-data.
 */

export {
  isCmsPubliclyVisible,
  isMissingTableOrSchemaError,
  loadCmsPagePublic,
  loadCmsPagePreviewPublic,
  loadCmsNavigationPublic,
  loadCmsAnnouncementsPublic,
  loadCmsAnnouncementPublic,
  loadCmsCategoryContentPublic,
  loadCmsBlogListPublic,
  loadCmsBlogPostPublic,
  loadCmsAbExperimentsActivePublic,
  loadCmsSitemapEntries,
  getCmsRedirectForPath,
  CMS_FORM_KEYS,
} from "@universal-music-store/platform-data";

export type {
  CmsPageType,
  CmsPublishStatus,
  CmsNavLink,
  CmsNavFeatured,
  CmsFooterColumn,
  CmsSocialLink,
  CmsNavigationPayload,
  CmsBlock,
  CmsPageRow,
  CmsPageBlockPresetRow,
  CmsBlogPostRow,
  CmsRedirectRow,
  CmsAbExperimentRow,
  CmsAnnouncementRow,
  CmsCategoryContentRow,
  CmsMediaRow,
  CmsFormSettingsRow,
  CmsFormKey,
} from "@universal-music-store/platform-data";

export {
  buildCmsPreviewUrl,
  buildCmsStoragePublicUrl,
  normalizeCmsLocale,
  type BuildCmsPreviewUrlInput,
  type CmsPreviewUrlKind,
} from "./cms-helpers.js";

export { pickCmsAbVariantId } from "./cms-experiment-pick.js";
