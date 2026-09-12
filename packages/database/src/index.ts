/**
 * @universal-music-store/database
 *
 * Re-exports platform data from @universal-music-store/platform-data.
 * Supabase = identity, RBAC, compliance, audit only. Medusa owns commerce.
 * See `data-boundaries.ts`, ADR-0002, and docs/data-ownership.md.
 *
 * Runtime enforcement is in app code and CI (e.g. migration-boundary checks), not in this package alone.
 */
export {
  assertMedusaOrderRef,
  MissingMedusaOrderRefError,
} from "./medusa-order-ref";
export {
  LEGACY_TABLE_BINDINGS,
  MEDUSA_COMMERCE_DOMAINS,
  MEDUSA_EXCLUSIVE_TABLE_NAMES,
  isMedusaExclusiveTableName,
  type AppSurface,
  type LegacyTableBinding,
  type LegacyTableKind,
} from "./data-boundaries";
export {
  createSupabaseClient,
  tryCreateSupabaseClient,
  upsertOAuthUser,
  isStaffRole,
  checkStaffRole,
  type StaffCheckSession,
  exportDataSubjectByEmail,
  deleteDataSubjectByEmail,
  purgeExpiredPrivacyData,
  anonymizeStaleOrderAddresses,
  type DataSubjectExport,
  STAFF_PERMISSION_KEYS,
  isStaffRbacStrictEnv,
  staffHasPermission,
  staffPermissionListForSession,
  staffSessionAllows,
  resolveStaffPermissionsForUserId,
  type StaffPermissionKey,
  type StaffSessionLike,
  authorizeResourceContext,
  normalizeResourceContext,
  resourceContextAllows,
  type ResourceContext,
  type ResourceContextGrant,
  reportDateKey,
  toUtcStorageTimestamp,
  utcDateRange,
  listReasonRegistry,
  upsertReasonRegistry,
  deleteReasonRegistry,
  type ReasonRegistryRow,
  type ReasonRegistryKind,
} from "@universal-music-store/platform-data";
