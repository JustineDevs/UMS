/**
 * @universal-music-store/platform-data
 *
 * Supabase-backed platform data: identity, RBAC, compliance.
 * Per ADR-0002: Medusa owns commerce; Supabase owns identity, compliance, archive.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");

  if (process.env.NODE_ENV === "production") {
    if (!serviceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required in production (anon key bypass is disabled)",
      );
    }
    return createClient(url, serviceKey);
  }

  if (!serviceKey && !anonKey) {
    throw new Error("Missing Supabase credentials (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)");
  }
  if (!serviceKey) {
    console.warn("[platform-data] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key (dev only)");
  }
  return createClient(url, serviceKey ?? anonKey!);
}

/**
 * Returns null when Supabase env is missing or invalid (instead of throwing).
 * Use in API routes to return 503 instead of 500.
 */
export function tryCreateSupabaseClient(): SupabaseClient | null {
  try {
    return createSupabaseClient();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[platform-data] tryCreateSupabaseClient:", e);
    }
    return null;
  }
}

export { isMissingTableOrSchemaError } from "./supabase-errors.js";
export {
  archiveCmsComponentDefinition,
  getCmsComponentDefinitionForOrganization,
  listCmsComponentDefinitionsForOrganization,
  mergeCmsComponentDefinitions,
  publishCmsComponentDefinition,
  saveCmsComponentDefinition,
  type CmsComponentDefinitionRow,
} from "./cms-components.js";
export {
  buildPaymentTerminalArtifactBindingRows,
  listPaymentProviderArtifacts,
  upsertPaymentProviderArtifact,
  upsertPaymentTerminalArtifactBinding,
  type PaymentProviderArtifactRow,
  type PaymentProviderArtifactType,
  type PaymentTerminalArtifactBindingInput,
} from "./payment-provider-artifacts.js";
export {
  attachMedusaInventoryReservation,
  closeMedusaInventoryReservation,
  commitInventoryReservation,
  releaseInventoryReservation,
  reserveInventory,
  type FinalizeInventoryReservationInput,
  type InventoryReservationRow,
  type InventoryReservationStatus,
  type ReserveInventoryInput,
} from "./inventory-reservations.js";

/** Anon client for public reads (e.g. storefront home CMS). Requires SUPABASE_ANON_KEY. */
export function createSupabaseAnonClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url.trim(), anonKey.trim());
}

export {
  upsertOAuthUser,
  isStaffRole,
  checkStaffRole,
  type StaffCheckSession,
} from "./admin-users.js";
export {
  STAFF_PERMISSION_KEYS,
  isStaffRbacStrictEnv,
  staffHasPermission,
  staffPermissionListForSession,
  staffSessionAllows,
  resolveStaffPermissionsForUserId,
  type StaffPermissionKey,
  type StaffSessionLike,
} from "./permissions.js";
export {
  exportDataSubjectByEmail,
  anonymizeStaleOrderAddresses,
  type DataSubjectExport,
} from "./compliance.js";

export {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type Employee,
  type EmployeeRole,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "./employees.js";

export {
  hashPin,
  verifyPinHash,
  setEmployeePin,
  verifyEmployeePin,
  requirePinApproval,
} from "./employee-pins.js";

export {
  openShift,
  closeShift,
  getActiveShift,
  getShiftById,
  listShifts,
  type PosShift,
} from "./pos-shifts.js";

export {
  recordVoid,
  listVoids,
  type PosVoid,
  type VoidAction,
  type RecordVoidInput,
} from "./pos-voids.js";

export {
  listDevices,
  getDeviceByName,
  updateDevice,
  upsertDevice,
  deactivateDevice,
  heartbeatDevice,
  type PosDevice,
  type DeviceType,
} from "./pos-devices.js";

export {
  getOrCreateLoyaltyAccount,
  lookupByQr,
  lookupByPhone,
  addPoints,
  redeemPoints,
  listLoyaltyAccounts,
  type LoyaltyAccount,
  type LoyaltyTier,
} from "./loyalty.js";

export {
  listRewards,
  createReward,
  updateReward,
  type LoyaltyReward,
  type RewardType,
} from "./loyalty-rewards.js";

export {
  listReasonRegistry,
  upsertReasonRegistry,
  deleteReasonRegistry,
  type ReasonRegistryRow,
  type ReasonRegistryKind,
} from "./reason-registry.js";

export {
  CRM_SYSTEM_CHECKLIST,
  buildCrmFeatureCoverageMetadata,
  buildNangoCustomerFeatureMappingMetadata,
  buildNangoCrmConnectionMetadata,
  buildNangoCrmConnectionTags,
  buildNangoCrmRecordMetadata,
  deleteCrmIntegrationMapping,
  deleteCrmIntegrationConnection,
  deleteCrmIntegrationRecord,
  listCrmIntegrationConnections,
  listCrmIntegrationMappings,
  listCrmIntegrationRecords,
  NANGO_CRM_SUPPORTED_APPS,
  upsertCrmIntegrationConnection,
  upsertCrmIntegrationMapping,
  upsertCrmIntegrationRecord,
  type CrmIntegrationConnectionRow,
  type CrmIntegrationEntityType,
  type CrmIntegrationMappingRow,
  type CrmIntegrationRecordKind,
  type CrmIntegrationRecordRow,
  type CrmIntegrationProvider,
  type CrmIntegrationSyncMode,
  type CrmIntegrationSyncState,
  type CrmIntegrationSyncScope,
  type CrmChecklistGroup,
  type CrmChecklistItem,
  type CrmCapabilityStatus,
  type CrmIntegrationSupportedApp,
  type CrmIntegrationSupportedAppCategory,
} from "./crm-integration-mappings.js";

export {
  POS_FEATURE_MAPPINGS,
  buildPosSaleFeatureMetadata,
  type PosFeatureMapping,
  type PosSaleFeatureMetadata,
} from "./pos-feature-mappings.js";

export {
  PLATFORM_FEATURE_MAPPINGS,
  buildPlatformFeatureMappingMetadata,
  buildPublicPlatformFeatureMappingMetadata,
  type PlatformFeatureDomain,
  type PlatformFeatureMapping,
  type PlatformFeatureStatus,
} from "./platform-feature-mappings.js";

export {
  DELIVERY_LOGISTICS_CHECKLIST,
  DELIVERY_LOGISTICS_SUPPORTED_APPS,
  buildDeliveryLogisticsCoverageMetadata,
  type DeliveryLogisticsChecklistGroup,
  type DeliveryLogisticsChecklistItem,
  type DeliveryLogisticsCapabilityStatus,
  type DeliveryLogisticsSupportedApp,
  type DeliveryLogisticsSupportedAppCategory,
} from "./delivery-logistics-checklist.js";

export {
  appendDeliveryLogisticsEvent,
  listDeliveryLogisticsEvents,
  listDeliveryLogisticsShipments,
  upsertDeliveryLogisticsShipment,
  type DeliveryLogisticsEventRow,
  type DeliveryLogisticsSettlementStatus,
  type DeliveryLogisticsShipmentRow,
  type DeliveryLogisticsShipmentStatus,
} from "./delivery-logistics-ledger.js";

export {
  calculatePosReconciliation,
  countCash,
  validateFiscalProfile,
  validateTerminalCertification,
  type PosCashCount,
  type PosReconciliation,
  type PosFiscalProfile,
  type PosTerminalCertification,
} from "./pos-enterprise.js";

export {
  assertDeliveryGeofence,
  validateCourierCashEntry,
  calculateDriverEarnings,
  buildRoutingRequest,
  type CourierCashLedgerEntry,
} from "./delivery-enterprise.js";


export {
  assignDeliverySla,
  buildBatches,
  calculateDeliveryPrice,
  calculatePackageMetrics,
  distanceKm,
  estimateEtaMinutes,
  normalizeAddress,
  optimizeRoute,
  selectCourier,
  validateGeoPoint,
  verifyDeliveryProof,
  type CourierCapacity,
  type DeliveryProofInput,
  type DeliverySla,
  type DeliveryStop,
  type GeoPoint,
  type PackageSpec,
} from "./delivery-logistics-operations.js";

export {
  activityMetrics,
  crmDeduplicationKey,
  forecastPipeline,
  normalizeCrmEmail,
  routeLead,
  scoreLead,
  type CrmActivity,
  type LeadProfile,
} from "./crm-operations.js";

export {
  listSegments,
  createSegment,
  addSegmentMembers,
  getSegmentMembers,
  deleteSegment,
  type Segment,
  type SegmentRuleType,
} from "./customer-segments.js";

export {
  listCampaigns,
  createCampaign,
  updateCampaign,
  executeCampaign,
  recordCampaignMessage,
  type Campaign,
  type CampaignType,
} from "./campaigns.js";

export {
  buildReceiptHtml,
  saveReceipt,
  markReceiptSent,
  getReceiptByOrder,
  type DigitalReceipt,
} from "./digital-receipts.js";

export {
  CATALOG_PROVIDER_DEFINITIONS,
  buildCatalogProviderCapabilityMap,
  clearCatalogProviderProjections,
  defaultCatalogProviderDrafts,
  expandProviderDraftToArtifactRows,
  getCatalogProviderDefinition,
  listCatalogProviderProjections,
  upsertCatalogProviderProjection,
  upsertCatalogProviderProjections,
  type CatalogProviderArtifactType,
  type CatalogProviderCapability,
  type CatalogProviderDefinition,
  type CatalogProviderPublishingDraft,
  type CatalogProviderKey,
  type CatalogProviderProjectionRow,
  type CatalogProviderSyncMode,
  type CatalogProviderSyncState,
} from "./catalog-provider-projections.js";

export {
  PAYMENT_PROVIDER_CAPABILITIES,
  getPaymentProviderCapabilities,
  paymentProviderSupports,
  type PaymentCapability,
  type PaymentProvider,
  type PaymentProviderCapabilities,
} from "./payment-provider-capabilities.js";

export {
  enqueueOfflineSale,
  listPendingQueue,
  markSynced,
  markFailed,
  retryFailed,
  type OfflineQueueItem,
} from "./offline-queue.js";

export {
  getPosOfflineCommit,
  insertPosOfflineCommit,
  insertPosOfflineCommitOrRecover,
  type PosOfflineCommitRow,
} from "./pos-offline-idempotency.js";

export {
  computeClv,
  computeRetention,
  computeSalesTrends,
  type ClvResult,
  type RetentionMetric,
  type SalesTrend,
} from "./analytics.js";

export {
  mergeStorefrontHomePayload,
  getStorefrontHomeContent,
  upsertStorefrontHomeContent,
  loadStorefrontHomeContentForPublic,
  DEFAULT_STOREFRONT_HOME_PAYLOAD,
  type StorefrontHomeSectionLayout,
  type StorefrontHomePayload,
  type StorefrontHomeTile,
} from "./storefront-home-cms.js";

export {
  createProductReview,
  deleteProductReview,
  getProductReviewById,
  listProductReviews,
  updateProductReview,
  type CreateProductReviewInput,
  type ListProductReviewsOptions,
  type ProductReviewRow,
  type ProductReviewStatus,
  type UpdateProductReviewInput,
} from "./product-reviews.js";

export {
  inferReviewProofMedia,
  type ReviewProofMedia,
  type ReviewProofMediaKind,
} from "./review-proof-media.js";

export {
  EMPTY_STOREFRONT_PUBLIC_METADATA,
  mergeStorefrontPublicMetadataPayload,
  getStorefrontPublicMetadata,
  upsertStorefrontPublicMetadata,
  resolveStorefrontPublicMetadataWithEnv,
  storefrontSocialLinks,
  loadStorefrontPublicMetadataForPublic,
  loadStorefrontPublicMetadataResolvedForPublic,
  type StorefrontPublicMetadataPayload,
  type StorefrontSocialLink,
} from "./storefront-public-metadata.js";

export { isCmsPubliclyVisible } from "./cms-public-visibility.js";

export type {
  CmsPageType,
  CmsPublishStatus,
  CmsNavLink,
  CmsNavFeatured,
  CmsFooterColumn,
  CmsSocialLink,
  CmsNavigationPayload,
  CmsComponentPropType,
  CmsComponentPropOption,
  CmsComponentPropDefinition,
  CmsComponentMatch,
  CmsComponentSlotDefinition,
  CmsComponentVariant,
  CmsComponentDefinition,
  CmsComponentInstance,
  CmsBlock,
  CmsNode,
  CmsMutationRecord,
  CmsPageRow,
  CmsPageBlockPresetRow,
  CmsBlogPostRow,
} from "./cms-types.js";

export {
  CMS_COMPONENT_DEFINITIONS,
  listCmsComponentDefinitions,
  getCmsComponentDefinition,
  getCmsVariant,
  resolveCmsComponentDefinition,
  resolveCmsInstanceProps,
  componentInstanceFromBlock,
  blockFromComponentInstance,
} from "./cms-component-registry.js";

export {
  cmsBlocksToTree,
  cmsTreeToBlocks,
  normalizeCmsTree,
  listCmsPages,
  getCmsPageById,
  getCmsPageBySlugLocalePublic,
  listCmsPagesForSitemapPublic,
  getCmsPageBySlugAdmin,
  upsertCmsPage,
  appendCmsPageMutations,
  listCmsPageMutations,
  deleteCmsPage,
  listCmsPageVersions,
  getCmsPageBySlugPreview,
  getCmsPageAncestorTrail,
  getCmsPageBreadcrumbTrail,
  type UpsertCmsPageInput,
} from "./cms-pages.js";

export {
  getCmsNavigationPayload,
  getCmsNavigationPayloadAdmin,
  upsertCmsNavigationPayload,
  normalizeNavigationPayloadInput,
  getCmsNavigationDraftPayload,
  mergeNavigationDraftOverLive,
  upsertCmsNavigationDraftPayload,
  publishCmsNavigationDraft,
  parseNavLink,
  type CmsNavigationDraftPayload,
} from "./cms-navigation.js";

export {
  listCmsPageBlockPresets,
  insertCmsPageBlockPreset,
  deleteCmsPageBlockPreset,
} from "./cms-page-block-presets.js";

export {
  CMS_ANNOUNCEMENT_DEFAULT_ID,
  getCmsAnnouncement,
  listCmsAnnouncementsAdmin,
  listCmsAnnouncementsForLocalePublic,
  resolveAnnouncementStack,
  upsertCmsAnnouncement,
  deleteCmsAnnouncement,
  getCmsAnnouncementAnalyticsMap,
  incrementCmsAnnouncementMetric,
  type CmsAnnouncementRow,
  type CmsAnnouncementAnalyticsRow,
  type UpsertCmsAnnouncementInput,
} from "./cms-announcement.js";

export {
  listCmsCategoryContent,
  upsertCmsCategoryContent,
  getCmsCategoryContentPublic,
  type CmsCategoryContentRow,
} from "./cms-category.js";

export {
  CMS_MEDIA_TAG_CATALOG_PRODUCT,
  cmsMediaRowIsCatalogProduct,
  ensureExternalCatalogProductMediaRows,
  findCmsMediaCatalogProductByPublicUrl,
  findCmsMediaReferences,
  getCmsMediaById,
  insertCmsMedia,
  listCmsMedia,
  normalizeCatalogMediaUrlForDb,
  softDeleteCmsMedia,
  updateCmsMedia,
  type CmsMediaRow,
  type ListCmsMediaOptions,
  type CmsMediaReferenceHit,
} from "./cms-media.js";

export {
  listCmsBlogPosts,
  getCmsBlogPostById,
  getCmsBlogPostBySlugAdmin,
  upsertCmsBlogPost,
  deleteCmsBlogPost,
  getCmsBlogPostBySlugPublic,
  listCmsBlogPostsPublic,
  listCmsBlogPostsForSitemapPublic,
  getCmsBlogPostBySlugPreview,
  type UpsertCmsBlogInput,
} from "./cms-blog.js";

export {
  listCmsPaymentLinks,
  getCmsPaymentLinkById,
  upsertCmsPaymentLink,
  deleteCmsPaymentLink,
  type CmsPaymentLinkRow,
  type UpsertCmsPaymentLinkInput,
} from "./cms-payment-links.js";

export {
  listCmsFormSubmissions,
  insertCmsFormSubmission,
  updateCmsFormSubmission,
  getCmsFormSettings,
  upsertCmsFormSettings,
  CMS_FORM_KEYS,
  type CmsFormKey,
  type CmsFormSubmissionRow,
  type CmsFormSettingsRow,
  type ListCmsFormSubmissionsOptions,
} from "./cms-forms.js";

export {
  listCmsRedirects,
  upsertCmsRedirect,
  deleteCmsRedirect,
  getCmsRedirectForPath,
  type CmsRedirectRow,
} from "./cms-redirects.js";

export {
  listCmsAbExperiments,
  upsertCmsAbExperiment,
  incrementCmsAbExperimentImpressions,
  type CmsAbExperimentRow,
} from "./cms-experiments.js";

export {
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
} from "./cms-storefront.js";

export {
  findOpenPaymentAttemptForCart,
  registerPaymentAttempt,
  getPaymentAttemptByCorrelationId,
  findPaymentAttemptByMedusaOrderId,
  updatePaymentAttemptByCorrelationId,
  mergePaymentAttemptProviderPayload,
  mergePaymentAttemptPayloadByMedusaOrderId,
  incrementFinalizeAttempts,
  claimPaymentAttemptForFinalization,
  listOpenPaymentAttempts,
  listStuckPaymentAttempts,
  listStalePaymentAttempts,
  listRecentPaymentAttempts,
  countPaymentAttemptsByStatuses,
  computeNextQuoteVersionForFingerprintPatch,
  fetchPaymentAttemptInvalidationDayBuckets,
  paymentAttemptMatchesCatalogMutation,
  shouldReusePaymentAttempt,
  type PaymentAttemptRow,
  type RegisterPaymentAttemptInput,
} from "./payment-ledger.js";

export {
  insertPaymentRefundAudit,
  completePaymentRefundAudit,
  insertCustomerReturnRequestAudit,
  type PaymentRefundAuditRow,
} from "./payment-ops-audit.js";

export { getPaymentPlatformMetrics, type PaymentPlatformMetrics } from "./payment-platform-metrics.js";

export { PAYMENT_OUTBOX_EVENT_TYPES } from "./payment-outbox-events.js";

export {
  enqueueJob,
  completeJob,
  failJob,
  claimNextRunnableJob,
  releaseJobFailure,
  type BackgroundJob,
  type JobStatus,
} from "./background-jobs.js";

export {
  campaignScheduleMatches,
  enqueueDueCampaignJobs,
} from "./campaign-schedule.js";

export {
  PAYMENT_RECONCILIATION_JOB_TYPES,
  enqueueReconciliationJob,
  requestProviderReconciliationJob,
  type ProviderReconciliationJobRequest,
  type ProviderReconciliationRequest,
} from "./payment-reconciliation-jobs.js";

export {
  recordWebhookEvent,
  markWebhookProcessed,
  type PaymentWebhookEventRow,
} from "./payment-webhook-inbox.js";

export {
  enqueueOutboxEvent,
  listPendingOutboxEvents,
  processOutboxBatch,
  failOutboxEventWithBackoff,
  type OutboxEvent,
} from "./outbox.js";
