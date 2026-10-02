-- 128: Remove retired platform setup objects and redundant indexes.
--
-- Historical migration ordering remains intact. This forward-only cleanup
-- keeps new databases from recreating legacy_import_runs and converges
-- existing databases that may still contain it or duplicate index structures.

DROP TABLE IF EXISTS public.legacy_import_runs CASCADE;

-- Each replacement index has the same key definition and is the canonical
-- name used by the later tenant/uniqueness migration.
DROP INDEX IF EXISTS public.idx_digital_receipts_medusa_order;
DROP INDEX IF EXISTS public.idx_payment_attempts_organization_updated;
DROP INDEX IF EXISTS public.idx_cms_ab_experiments_org_key;
DROP INDEX IF EXISTS public.cms_payment_links_org_id;
DROP INDEX IF EXISTS public.idx_cms_category_content_canonical;
