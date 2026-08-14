-- 015: Remove public tables that duplicate Medusa v2 commerce schema names.
--
-- APPLY ONLY via LEGACY_DATABASE_URL (Supabase platform DB from packages/database migrations).
-- NEVER run against Medusa DATABASE_URL — that would destroy the commerce database.
--
-- Name list derived from: internal/docs/exclusive/medusadb/schema.sql (Medusa public tables).
-- Intentional legacy tables use different names (e.g. public.users staff, product_reviews bridge).
-- This migration is idempotent: drops only tables that exist.

DO $drop_medusa_name_collisions$
DECLARE
  t text;
  medusa_public_tables text[] := ARRAY[
    'account_holder',
    'api_key',
    'application_method_buy_rules',
    'application_method_target_rules',
    'auth_identity',
    'capture',
    'cart',
    'cart_address',
    'cart_line_item',
    'cart_line_item_adjustment',
    'cart_line_item_tax_line',
    'cart_payment_collection',
    'cart_promotion',
    'cart_shipping_method',
    'cart_shipping_method_adjustment',
    'cart_shipping_method_tax_line',
    'credit_line',
    'currency',
    'customer',
    'customer_account_holder',
    'customer_address',
    'customer_group',
    'customer_group_customer',
    'fulfillment',
    'fulfillment_address',
    'fulfillment_item',
    'fulfillment_label',
    'fulfillment_provider',
    'fulfillment_set',
    'geo_zone',
    'image',
    'inventory_item',
    'inventory_level',
    'invite',
    'link_module_migrations',
    'location_fulfillment_provider',
    'location_fulfillment_set',
    'mikro_orm_migrations',
    'notification',
    'notification_provider',
    'order',
    'order_address',
    'order_cart',
    'order_change',
    'order_change_action',
    'order_claim',
    'order_claim_item',
    'order_claim_item_image',
    'order_credit_line',
    'order_exchange',
    'order_exchange_item',
    'order_fulfillment',
    'order_item',
    'order_line_item',
    'order_line_item_adjustment',
    'order_line_item_tax_line',
    'order_payment_collection',
    'order_promotion',
    'order_shipping',
    'order_shipping_method',
    'order_shipping_method_adjustment',
    'order_shipping_method_tax_line',
    'order_summary',
    'order_transaction',
    'payment',
    'payment_collection',
    'payment_collection_payment_providers',
    'payment_provider',
    'payment_session',
    'price',
    'price_list',
    'price_list_rule',
    'price_preference',
    'price_rule',
    'price_set',
    'product',
    'product_category',
    'product_category_product',
    'product_collection',
    'product_option',
    'product_option_value',
    'product_sales_channel',
    'product_shipping_profile',
    'product_tag',
    'product_tags',
    'product_type',
    'product_variant',
    'product_variant_inventory_item',
    'product_variant_option',
    'product_variant_price_set',
    'product_variant_product_image',
    'promotion',
    'promotion_application_method',
    'promotion_campaign',
    'promotion_campaign_budget',
    'promotion_campaign_budget_usage',
    'promotion_promotion_rule',
    'promotion_rule',
    'promotion_rule_value',
    'provider_identity',
    'publishable_api_key_sales_channel',
    'refund',
    'refund_reason',
    'region',
    'region_country',
    'region_payment_provider',
    'reservation_item',
    'return',
    'return_fulfillment',
    'return_item',
    'return_reason',
    'sales_channel',
    'sales_channel_stock_location',
    'script_migrations',
    'service_zone',
    'shipping_option',
    'shipping_option_price_set',
    'shipping_option_rule',
    'shipping_option_type',
    'shipping_profile',
    'stock_location',
    'stock_location_address',
    'store',
    'store_currency',
    'store_locale',
    'tax_provider',
    'tax_rate',
    'tax_rate_rule',
    'tax_region',
    'user',
    'user_preference',
    'user_rbac_role',
    'view_configuration',
    'workflow_execution'
  ];
  common_monolith_typos text[] := ARRAY[
    'addresses',
    'orders',
    'carts',
    'products',
    'variants',
    'line_items',
    'inventory',
    'shipments',
    'payments'
  ];
  all_names text[];
BEGIN
  all_names := medusa_public_tables || common_monolith_typos;
  FOREACH t IN ARRAY all_names
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
      RAISE NOTICE '015: dropped accidental commerce-named table public.%', t;
    END IF;
  END LOOP;
END;
$drop_medusa_name_collisions$;
