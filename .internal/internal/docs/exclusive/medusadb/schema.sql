create table public.account_holder (
  id text not null,
  provider_id text not null,
  external_id text not null,
  email text null,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint account_holder_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_account_holder_deleted_at" on public.account_holder using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_account_holder_provider_id_external_id_unique" on public.account_holder using btree (provider_id, external_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.api_key (
  id text not null,
  token text not null,
  salt text not null,
  redacted text not null,
  title text not null,
  type text not null,
  last_used_at timestamp with time zone null,
  created_by text not null,
  created_at timestamp with time zone not null default now(),
  revoked_by text null,
  revoked_at timestamp with time zone null,
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint api_key_pkey primary key (id),
  constraint api_key_type_check check (
    (
      type = any (array['publishable'::text, 'secret'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_api_key_revoked_at" on public.api_key using btree (revoked_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_api_key_token_unique" on public.api_key using btree (token) TABLESPACE pg_default;

create index IF not exists "IDX_api_key_type" on public.api_key using btree (type) TABLESPACE pg_default;

create index IF not exists "IDX_api_key_deleted_at" on public.api_key using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_api_key_redacted" on public.api_key using btree (redacted) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.application_method_buy_rules (
  application_method_id text not null,
  promotion_rule_id text not null,
  constraint application_method_buy_rules_pkey primary key (application_method_id, promotion_rule_id),
  constraint application_method_buy_rules_application_method_id_foreign foreign KEY (application_method_id) references promotion_application_method (id) on update CASCADE on delete CASCADE,
  constraint application_method_buy_rules_promotion_rule_id_foreign foreign KEY (promotion_rule_id) references promotion_rule (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.application_method_target_rules (
  application_method_id text not null,
  promotion_rule_id text not null,
  constraint application_method_target_rules_pkey primary key (application_method_id, promotion_rule_id),
  constraint application_method_target_rules_application_method_id_foreign foreign KEY (application_method_id) references promotion_application_method (id) on update CASCADE on delete CASCADE,
  constraint application_method_target_rules_promotion_rule_id_foreign foreign KEY (promotion_rule_id) references promotion_rule (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.auth_identity (
  id text not null,
  app_metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint auth_identity_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_auth_identity_deleted_at" on public.auth_identity using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.capture (
  id text not null,
  amount numeric not null,
  raw_amount jsonb not null,
  payment_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  created_by text null,
  metadata jsonb null,
  constraint capture_pkey primary key (id),
  constraint capture_payment_id_foreign foreign KEY (payment_id) references payment (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_capture_payment_id" on public.capture using btree (payment_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_capture_deleted_at" on public.capture using btree (deleted_at) TABLESPACE pg_default;

create table public.cart (
  id text not null,
  region_id text null,
  customer_id text null,
  sales_channel_id text null,
  email text null,
  currency_code text not null,
  shipping_address_id text null,
  billing_address_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  locale text null,
  constraint cart_pkey primary key (id),
  constraint cart_billing_address_id_foreign foreign KEY (billing_address_id) references cart_address (id) on update CASCADE on delete set null,
  constraint cart_shipping_address_id_foreign foreign KEY (shipping_address_id) references cart_address (id) on update CASCADE on delete set null
) TABLESPACE pg_default;

create index IF not exists "IDX_cart_customer_id" on public.cart using btree (customer_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (customer_id is not null)
  );

create index IF not exists "IDX_cart_shipping_address_id" on public.cart using btree (shipping_address_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (shipping_address_id is not null)
  );

create index IF not exists "IDX_cart_billing_address_id" on public.cart using btree (billing_address_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (billing_address_id is not null)
  );

create index IF not exists "IDX_cart_region_id" on public.cart using btree (region_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (region_id is not null)
  );

create index IF not exists "IDX_cart_sales_channel_id" on public.cart using btree (sales_channel_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (sales_channel_id is not null)
  );

create index IF not exists "IDX_cart_currency_code" on public.cart using btree (currency_code) TABLESPACE pg_default;

create index IF not exists "IDX_cart_deleted_at" on public.cart using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.cart_address (
  id text not null,
  customer_id text null,
  company text null,
  first_name text null,
  last_name text null,
  address_1 text null,
  address_2 text null,
  city text null,
  country_code text null,
  province text null,
  postal_code text null,
  phone text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint cart_address_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_cart_address_deleted_at" on public.cart_address using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.cart_line_item (
  id text not null,
  cart_id text not null,
  title text not null,
  subtitle text null,
  thumbnail text null,
  quantity integer not null,
  variant_id text null,
  product_id text null,
  product_title text null,
  product_description text null,
  product_subtitle text null,
  product_type text null,
  product_collection text null,
  product_handle text null,
  variant_sku text null,
  variant_barcode text null,
  variant_title text null,
  variant_option_values jsonb null,
  requires_shipping boolean not null default true,
  is_discountable boolean not null default true,
  is_tax_inclusive boolean not null default false,
  compare_at_unit_price numeric null,
  raw_compare_at_unit_price jsonb null,
  unit_price numeric not null,
  raw_unit_price jsonb not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  product_type_id text null,
  is_custom_price boolean not null default false,
  is_giftcard boolean not null default false,
  constraint cart_line_item_pkey primary key (id),
  constraint cart_line_item_cart_id_foreign foreign KEY (cart_id) references cart (id) on update CASCADE on delete CASCADE,
  constraint cart_line_item_unit_price_check check ((unit_price >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists "IDX_line_item_product_id" on public.cart_line_item using btree (product_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (product_id is not null)
  );

create index IF not exists "IDX_line_item_variant_id" on public.cart_line_item using btree (variant_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (variant_id is not null)
  );

create index IF not exists "IDX_cart_line_item_deleted_at" on public.cart_line_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_cart_line_item_cart_id" on public.cart_line_item using btree (cart_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.cart_line_item_adjustment (
  id text not null,
  description text null,
  promotion_id text null,
  code text null,
  amount numeric not null,
  raw_amount jsonb not null,
  provider_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  item_id text null,
  is_tax_inclusive boolean not null default false,
  constraint cart_line_item_adjustment_pkey primary key (id),
  constraint cart_line_item_adjustment_item_id_foreign foreign KEY (item_id) references cart_line_item (id) on update CASCADE on delete CASCADE,
  constraint cart_line_item_adjustment_check check ((amount >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists "IDX_line_item_adjustment_promotion_id" on public.cart_line_item_adjustment using btree (promotion_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (promotion_id is not null)
  );

create index IF not exists "IDX_cart_line_item_adjustment_deleted_at" on public.cart_line_item_adjustment using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_cart_line_item_adjustment_item_id" on public.cart_line_item_adjustment using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.cart_line_item_tax_line (
  id text not null,
  description text null,
  tax_rate_id text null,
  code text not null,
  rate real not null,
  provider_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  item_id text null,
  constraint cart_line_item_tax_line_pkey primary key (id),
  constraint cart_line_item_tax_line_item_id_foreign foreign KEY (item_id) references cart_line_item (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_line_item_tax_line_tax_rate_id" on public.cart_line_item_tax_line using btree (tax_rate_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (tax_rate_id is not null)
  );

create index IF not exists "IDX_cart_line_item_tax_line_deleted_at" on public.cart_line_item_tax_line using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_cart_line_item_tax_line_item_id" on public.cart_line_item_tax_line using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.cart_payment_collection (
  cart_id character varying(255) not null,
  payment_collection_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint cart_payment_collection_pkey primary key (cart_id, payment_collection_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-4a39f6c9" on public.cart_payment_collection using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_cart_id_-4a39f6c9" on public.cart_payment_collection using btree (cart_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_payment_collection_id_-4a39f6c9" on public.cart_payment_collection using btree (payment_collection_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-4a39f6c9" on public.cart_payment_collection using btree (deleted_at) TABLESPACE pg_default;

create table public.cart_promotion (
  cart_id character varying(255) not null,
  promotion_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint cart_promotion_pkey primary key (cart_id, promotion_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-a9d4a70b" on public.cart_promotion using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_cart_id_-a9d4a70b" on public.cart_promotion using btree (cart_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_id_-a9d4a70b" on public.cart_promotion using btree (promotion_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-a9d4a70b" on public.cart_promotion using btree (deleted_at) TABLESPACE pg_default;

create table public.cart_shipping_method (
  id text not null,
  cart_id text not null,
  name text not null,
  description jsonb null,
  amount numeric not null,
  raw_amount jsonb not null,
  is_tax_inclusive boolean not null default false,
  shipping_option_id text null,
  data jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint cart_shipping_method_pkey primary key (id),
  constraint cart_shipping_method_cart_id_foreign foreign KEY (cart_id) references cart (id) on update CASCADE on delete CASCADE,
  constraint cart_shipping_method_check check ((amount >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_method_option_id" on public.cart_shipping_method using btree (shipping_option_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (shipping_option_id is not null)
  );

create index IF not exists "IDX_cart_shipping_method_deleted_at" on public.cart_shipping_method using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_cart_shipping_method_cart_id" on public.cart_shipping_method using btree (cart_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.cart_shipping_method_adjustment (
  id text not null,
  description text null,
  promotion_id text null,
  code text null,
  amount numeric not null,
  raw_amount jsonb not null,
  provider_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  shipping_method_id text null,
  constraint cart_shipping_method_adjustment_pkey primary key (id),
  constraint cart_shipping_method_adjustment_shipping_method_id_foreign foreign KEY (shipping_method_id) references cart_shipping_method (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_method_adjustment_promotion_id" on public.cart_shipping_method_adjustment using btree (promotion_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (promotion_id is not null)
  );

create index IF not exists "IDX_cart_shipping_method_adjustment_deleted_at" on public.cart_shipping_method_adjustment using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_cart_shipping_method_adjustment_shipping_method_id" on public.cart_shipping_method_adjustment using btree (shipping_method_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.cart_shipping_method_tax_line (
  id text not null,
  description text null,
  tax_rate_id text null,
  code text not null,
  rate real not null,
  provider_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  shipping_method_id text null,
  constraint cart_shipping_method_tax_line_pkey primary key (id),
  constraint cart_shipping_method_tax_line_shipping_method_id_foreign foreign KEY (shipping_method_id) references cart_shipping_method (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_method_tax_line_tax_rate_id" on public.cart_shipping_method_tax_line using btree (tax_rate_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (tax_rate_id is not null)
  );

create index IF not exists "IDX_cart_shipping_method_tax_line_deleted_at" on public.cart_shipping_method_tax_line using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_cart_shipping_method_tax_line_shipping_method_id" on public.cart_shipping_method_tax_line using btree (shipping_method_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.credit_line (
  id text not null,
  cart_id text not null,
  reference text null,
  reference_id text null,
  amount numeric not null,
  raw_amount jsonb not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint credit_line_pkey primary key (id),
  constraint credit_line_cart_id_foreign foreign KEY (cart_id) references cart (id) on update CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_credit_line_cart_id" on public.credit_line using btree (cart_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_credit_line_deleted_at" on public.credit_line using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_cart_credit_line_reference_reference_id" on public.credit_line using btree (reference, reference_id) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.currency (
  code text not null,
  symbol text not null,
  symbol_native text not null,
  decimal_digits integer not null default 0,
  rounding numeric not null default 0,
  raw_rounding jsonb not null,
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint currency_pkey primary key (code)
) TABLESPACE pg_default;

create table public.customer (
  id text not null,
  company_name text null,
  first_name text null,
  last_name text null,
  email text null,
  phone text null,
  has_account boolean not null default false,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  created_by text null,
  constraint customer_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_customer_email_has_account_unique" on public.customer using btree (email, has_account) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_customer_deleted_at" on public.customer using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.customer_account_holder (
  customer_id character varying(255) not null,
  account_holder_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint customer_account_holder_pkey primary key (customer_id, account_holder_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_5cb3a0c0" on public.customer_account_holder using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_customer_id_5cb3a0c0" on public.customer_account_holder using btree (customer_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_account_holder_id_5cb3a0c0" on public.customer_account_holder using btree (account_holder_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_5cb3a0c0" on public.customer_account_holder using btree (deleted_at) TABLESPACE pg_default;

create table public.customer_address (
  id text not null,
  customer_id text not null,
  address_name text null,
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  company text null,
  first_name text null,
  last_name text null,
  address_1 text null,
  address_2 text null,
  city text null,
  country_code text null,
  province text null,
  postal_code text null,
  phone text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint customer_address_pkey primary key (id),
  constraint customer_address_customer_id_foreign foreign KEY (customer_id) references customer (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_customer_address_customer_id" on public.customer_address using btree (customer_id) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_customer_address_unique_customer_billing" on public.customer_address using btree (customer_id) TABLESPACE pg_default
where
  (is_default_billing = true);

create unique INDEX IF not exists "IDX_customer_address_unique_customer_shipping" on public.customer_address using btree (customer_id) TABLESPACE pg_default
where
  (is_default_shipping = true);

create index IF not exists "IDX_customer_address_deleted_at" on public.customer_address using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.customer_group (
  id text not null,
  name text not null,
  metadata jsonb null,
  created_by text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint customer_group_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_customer_group_name_unique" on public.customer_group using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_customer_group_deleted_at" on public.customer_group using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.customer_group_customer (
  id text not null,
  customer_id text not null,
  customer_group_id text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by text null,
  deleted_at timestamp with time zone null,
  constraint customer_group_customer_pkey primary key (id),
  constraint customer_group_customer_customer_group_id_foreign foreign KEY (customer_group_id) references customer_group (id) on update CASCADE on delete CASCADE,
  constraint customer_group_customer_customer_id_foreign foreign KEY (customer_id) references customer (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_customer_group_customer_customer_id" on public.customer_group_customer using btree (customer_id) TABLESPACE pg_default;

create index IF not exists "IDX_customer_group_customer_customer_group_id" on public.customer_group_customer using btree (customer_group_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_customer_group_customer_deleted_at" on public.customer_group_customer using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.fulfillment (
  id text not null,
  location_id text not null,
  packed_at timestamp with time zone null,
  shipped_at timestamp with time zone null,
  delivered_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  data jsonb null,
  provider_id text null,
  shipping_option_id text null,
  metadata jsonb null,
  delivery_address_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  marked_shipped_by text null,
  created_by text null,
  requires_shipping boolean not null default true,
  constraint fulfillment_pkey primary key (id),
  constraint fulfillment_delivery_address_id_foreign foreign KEY (delivery_address_id) references fulfillment_address (id) on update CASCADE on delete set null,
  constraint fulfillment_provider_id_foreign foreign KEY (provider_id) references fulfillment_provider (id) on update CASCADE on delete set null,
  constraint fulfillment_shipping_option_id_foreign foreign KEY (shipping_option_id) references shipping_option (id) on update CASCADE on delete set null
) TABLESPACE pg_default;

create index IF not exists "IDX_fulfillment_location_id" on public.fulfillment using btree (location_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_shipping_option_id" on public.fulfillment using btree (shipping_option_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_deleted_at" on public.fulfillment using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.fulfillment_address (
  id text not null,
  company text null,
  first_name text null,
  last_name text null,
  address_1 text null,
  address_2 text null,
  city text null,
  country_code text null,
  province text null,
  postal_code text null,
  phone text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint fulfillment_address_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_fulfillment_address_deleted_at" on public.fulfillment_address using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.fulfillment_item (
  id text not null,
  title text not null,
  sku text not null,
  barcode text not null,
  quantity numeric not null,
  raw_quantity jsonb not null,
  line_item_id text null,
  inventory_item_id text null,
  fulfillment_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint fulfillment_item_pkey primary key (id),
  constraint fulfillment_item_fulfillment_id_foreign foreign KEY (fulfillment_id) references fulfillment (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_fulfillment_item_line_item_id" on public.fulfillment_item using btree (line_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_item_inventory_item_id" on public.fulfillment_item using btree (inventory_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_item_fulfillment_id" on public.fulfillment_item using btree (fulfillment_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_item_deleted_at" on public.fulfillment_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.fulfillment_label (
  id text not null,
  tracking_number text not null,
  tracking_url text not null,
  label_url text not null,
  fulfillment_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint fulfillment_label_pkey primary key (id),
  constraint fulfillment_label_fulfillment_id_foreign foreign KEY (fulfillment_id) references fulfillment (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_fulfillment_label_fulfillment_id" on public.fulfillment_label using btree (fulfillment_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_label_deleted_at" on public.fulfillment_label using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.fulfillment_provider (
  id text not null,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint fulfillment_provider_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_fulfillment_provider_deleted_at" on public.fulfillment_provider using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.fulfillment_set (
  id text not null,
  name text not null,
  type text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint fulfillment_set_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_fulfillment_set_name_unique" on public.fulfillment_set using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_set_deleted_at" on public.fulfillment_set using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.geo_zone (
  id text not null,
  type text not null default 'country'::text,
  country_code text not null,
  province_code text null,
  city text null,
  service_zone_id text not null,
  postal_expression jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint geo_zone_pkey primary key (id),
  constraint geo_zone_service_zone_id_foreign foreign KEY (service_zone_id) references service_zone (id) on update CASCADE on delete CASCADE,
  constraint geo_zone_type_check check (
    (
      type = any (
        array[
          'country'::text,
          'province'::text,
          'city'::text,
          'zip'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_geo_zone_country_code" on public.geo_zone using btree (country_code) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_geo_zone_province_code" on public.geo_zone using btree (province_code) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (province_code is not null)
  );

create index IF not exists "IDX_geo_zone_city" on public.geo_zone using btree (city) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (city is not null)
  );

create index IF not exists "IDX_geo_zone_service_zone_id" on public.geo_zone using btree (service_zone_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_geo_zone_deleted_at" on public.geo_zone using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.image (
  id text not null,
  url text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  rank integer not null default 0,
  product_id text not null,
  constraint image_pkey primary key (id),
  constraint image_product_id_foreign foreign KEY (product_id) references product (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_product_image_url" on public.image using btree (url) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_image_deleted_at" on public.image using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_image_product_id" on public.image using btree (product_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_image_rank" on public.image using btree (rank) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_image_url_rank_product_id" on public.image using btree (url, rank, product_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_image_rank_product_id" on public.image using btree (rank, product_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.inventory_item (
  id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  sku text null,
  origin_country text null,
  hs_code text null,
  mid_code text null,
  material text null,
  weight integer null,
  length integer null,
  height integer null,
  width integer null,
  requires_shipping boolean not null default true,
  description text null,
  title text null,
  thumbnail text null,
  metadata jsonb null,
  constraint inventory_item_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_inventory_item_deleted_at" on public.inventory_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_inventory_item_sku" on public.inventory_item using btree (sku) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.inventory_level (
  id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  inventory_item_id text not null,
  location_id text not null,
  stocked_quantity numeric not null default 0,
  reserved_quantity numeric not null default 0,
  incoming_quantity numeric not null default 0,
  metadata jsonb null,
  raw_stocked_quantity jsonb null,
  raw_reserved_quantity jsonb null,
  raw_incoming_quantity jsonb null,
  constraint inventory_level_pkey primary key (id),
  constraint inventory_level_inventory_item_id_foreign foreign KEY (inventory_item_id) references inventory_item (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_inventory_level_deleted_at" on public.inventory_level using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_inventory_level_inventory_item_id" on public.inventory_level using btree (inventory_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_inventory_level_location_id" on public.inventory_level using btree (location_id) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_inventory_level_location_id_inventory_item_id" on public.inventory_level using btree (inventory_item_id, location_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.invite (
  id text not null,
  email text not null,
  accepted boolean not null default false,
  token text not null,
  expires_at timestamp with time zone not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint invite_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_invite_token" on public.invite using btree (token) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_invite_deleted_at" on public.invite using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_invite_email_unique" on public.invite using btree (email) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.link_module_migrations (
  id serial not null,
  table_name character varying(255) not null,
  link_descriptor jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint link_module_migrations_pkey primary key (id),
  constraint link_module_migrations_table_name_key unique (table_name)
) TABLESPACE pg_default;

create table public.location_fulfillment_provider (
  stock_location_id character varying(255) not null,
  fulfillment_provider_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint location_fulfillment_provider_pkey primary key (stock_location_id, fulfillment_provider_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-1e5992737" on public.location_fulfillment_provider using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_stock_location_id_-1e5992737" on public.location_fulfillment_provider using btree (stock_location_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_provider_id_-1e5992737" on public.location_fulfillment_provider using btree (fulfillment_provider_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-1e5992737" on public.location_fulfillment_provider using btree (deleted_at) TABLESPACE pg_default;

create table public.location_fulfillment_set (
  stock_location_id character varying(255) not null,
  fulfillment_set_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint location_fulfillment_set_pkey primary key (stock_location_id, fulfillment_set_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-e88adb96" on public.location_fulfillment_set using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_stock_location_id_-e88adb96" on public.location_fulfillment_set using btree (stock_location_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_set_id_-e88adb96" on public.location_fulfillment_set using btree (fulfillment_set_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-e88adb96" on public.location_fulfillment_set using btree (deleted_at) TABLESPACE pg_default;

create table public.mikro_orm_migrations (
  id serial not null,
  name character varying(255) null,
  executed_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint mikro_orm_migrations_pkey primary key (id)
) TABLESPACE pg_default;

create table public.notification (
  id text not null,
  "to" text not null,
  channel text not null,
  template text null,
  data jsonb null,
  trigger_type text null,
  resource_id text null,
  resource_type text null,
  receiver_id text null,
  original_notification_id text null,
  idempotency_key text null,
  external_id text null,
  provider_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  status text not null default 'pending'::text,
  "from" text null,
  provider_data jsonb null,
  constraint notification_pkey primary key (id),
  constraint notification_provider_id_foreign foreign KEY (provider_id) references notification_provider (id) on update CASCADE on delete set null,
  constraint notification_status_check check (
    (
      status = any (
        array['pending'::text, 'success'::text, 'failure'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_notification_provider_id" on public.notification using btree (provider_id) TABLESPACE pg_default;

create index IF not exists "IDX_notification_receiver_id" on public.notification using btree (receiver_id) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_notification_idempotency_key_unique" on public.notification using btree (idempotency_key) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_notification_deleted_at" on public.notification using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.notification_provider (
  id text not null,
  handle text not null,
  name text not null,
  is_enabled boolean not null default true,
  channels text[] not null default '{}'::text[],
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint notification_provider_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_notification_provider_deleted_at" on public.notification_provider using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order (
  id text not null,
  region_id text null,
  display_id serial not null,
  customer_id text null,
  version integer not null default 1,
  sales_channel_id text null,
  status public.order_status_enum not null default 'pending'::order_status_enum,
  is_draft_order boolean not null default false,
  email text null,
  currency_code text not null,
  shipping_address_id text null,
  billing_address_id text null,
  no_notification boolean null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  custom_display_id text null,
  locale text null,
  constraint order_pkey primary key (id),
  constraint order_billing_address_id_foreign foreign KEY (billing_address_id) references order_address (id) on update CASCADE on delete set null,
  constraint order_shipping_address_id_foreign foreign KEY (shipping_address_id) references order_address (id) on update CASCADE on delete set null
) TABLESPACE pg_default;

create index IF not exists "IDX_order_deleted_at" on public."order" using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_order_display_id" on public."order" using btree (display_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_region_id" on public."order" using btree (region_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_customer_id" on public."order" using btree (customer_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_sales_channel_id" on public."order" using btree (sales_channel_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_currency_code" on public."order" using btree (currency_code) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_shipping_address_id" on public."order" using btree (shipping_address_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_billing_address_id" on public."order" using btree (billing_address_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_is_draft_order" on public."order" using btree (is_draft_order) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_order_custom_display_id" on public."order" using btree (custom_display_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_address (
  id text not null,
  customer_id text null,
  company text null,
  first_name text null,
  last_name text null,
  address_1 text null,
  address_2 text null,
  city text null,
  country_code text null,
  province text null,
  postal_code text null,
  phone text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint order_address_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_address_customer_id" on public.order_address using btree (customer_id) TABLESPACE pg_default;

create index IF not exists "IDX_order_address_deleted_at" on public.order_address using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_cart (
  order_id character varying(255) not null,
  cart_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint order_cart_pkey primary key (order_id, cart_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-71069c16" on public.order_cart using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_order_id_-71069c16" on public.order_cart using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_cart_id_-71069c16" on public.order_cart using btree (cart_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-71069c16" on public.order_cart using btree (deleted_at) TABLESPACE pg_default;

create table public.order_change (
  id text not null,
  order_id text not null,
  version integer not null,
  description text null,
  status text not null default 'pending'::text,
  internal_note text null,
  created_by text null,
  requested_by text null,
  requested_at timestamp with time zone null,
  confirmed_by text null,
  confirmed_at timestamp with time zone null,
  declined_by text null,
  declined_reason text null,
  metadata jsonb null,
  declined_at timestamp with time zone null,
  canceled_by text null,
  canceled_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  change_type text null,
  deleted_at timestamp with time zone null,
  return_id text null,
  claim_id text null,
  exchange_id text null,
  carry_over_promotions boolean null,
  constraint order_change_pkey primary key (id),
  constraint order_change_order_id_foreign foreign KEY (order_id) references "order" (id) on update CASCADE on delete CASCADE,
  constraint order_change_status_check check (
    (
      status = any (
        array[
          'confirmed'::text,
          'declined'::text,
          'requested'::text,
          'pending'::text,
          'canceled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_order_change_order_id_version" on public.order_change using btree (order_id, version) TABLESPACE pg_default;

create index IF not exists "IDX_order_change_change_type" on public.order_change using btree (change_type) TABLESPACE pg_default;

create index IF not exists "IDX_order_change_deleted_at" on public.order_change using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_order_change_order_id" on public.order_change using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_change_return_id" on public.order_change using btree (return_id) TABLESPACE pg_default
where
  (
    (return_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_change_claim_id" on public.order_change using btree (claim_id) TABLESPACE pg_default
where
  (
    (claim_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_change_exchange_id" on public.order_change using btree (exchange_id) TABLESPACE pg_default
where
  (
    (exchange_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_change_status" on public.order_change using btree (status) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_change_version" on public.order_change using btree (order_id, version) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_change_action (
  id text not null,
  order_id text null,
  version integer null,
  ordering bigserial not null,
  order_change_id text null,
  reference text null,
  reference_id text null,
  action text not null,
  details jsonb null,
  amount numeric null,
  raw_amount jsonb null,
  internal_note text null,
  applied boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  return_id text null,
  claim_id text null,
  exchange_id text null,
  constraint order_change_action_pkey primary key (id),
  constraint order_change_action_order_change_id_foreign foreign KEY (order_change_id) references order_change (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_change_action_deleted_at" on public.order_change_action using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_order_change_action_order_change_id" on public.order_change_action using btree (order_change_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_change_action_order_id" on public.order_change_action using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_change_action_return_id" on public.order_change_action using btree (return_id) TABLESPACE pg_default
where
  (
    (return_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_change_action_claim_id" on public.order_change_action using btree (claim_id) TABLESPACE pg_default
where
  (
    (claim_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_change_action_exchange_id" on public.order_change_action using btree (exchange_id) TABLESPACE pg_default
where
  (
    (exchange_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_change_action_ordering" on public.order_change_action using btree (ordering) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_claim (
  id text not null,
  order_id text not null,
  return_id text null,
  order_version integer not null,
  display_id serial not null,
  type public.order_claim_type_enum not null,
  no_notification boolean null,
  refund_amount numeric null,
  raw_refund_amount jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  created_by text null,
  constraint order_claim_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_claim_deleted_at" on public.order_claim using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_claim_display_id" on public.order_claim using btree (display_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_claim_order_id" on public.order_claim using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_claim_return_id" on public.order_claim using btree (return_id) TABLESPACE pg_default
where
  (
    (return_id is not null)
    and (deleted_at is null)
  );

  create table public.order_claim_item (
  id text not null,
  claim_id text not null,
  item_id text not null,
  is_additional_item boolean not null default false,
  reason public.claim_reason_enum null,
  quantity numeric not null,
  raw_quantity jsonb not null,
  note text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint order_claim_item_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_claim_item_deleted_at" on public.order_claim_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_claim_item_claim_id" on public.order_claim_item using btree (claim_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_claim_item_item_id" on public.order_claim_item using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_claim_item_image (
  id text not null,
  claim_item_id text not null,
  url text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint order_claim_item_image_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_claim_item_image_deleted_at" on public.order_claim_item_image using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_order_claim_item_image_claim_item_id" on public.order_claim_item_image using btree (claim_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_credit_line (
  id text not null,
  order_id text not null,
  reference text null,
  reference_id text null,
  amount numeric not null,
  raw_amount jsonb not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  version integer not null default 1,
  constraint order_credit_line_pkey primary key (id),
  constraint order_credit_line_order_id_foreign foreign KEY (order_id) references "order" (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_credit_line_deleted_at" on public.order_credit_line using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_order_credit_line_order_id" on public.order_credit_line using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_credit_line_order_id_version" on public.order_credit_line using btree (order_id, version) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_exchange (
  id text not null,
  order_id text not null,
  return_id text null,
  order_version integer not null,
  display_id serial not null,
  no_notification boolean null,
  allow_backorder boolean not null default false,
  difference_due numeric null,
  raw_difference_due jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  created_by text null,
  constraint order_exchange_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_exchange_deleted_at" on public.order_exchange using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_exchange_display_id" on public.order_exchange using btree (display_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_exchange_order_id" on public.order_exchange using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_exchange_return_id" on public.order_exchange using btree (return_id) TABLESPACE pg_default
where
  (
    (return_id is not null)
    and (deleted_at is null)
  );

  create table public.order_exchange_item (
  id text not null,
  exchange_id text not null,
  item_id text not null,
  quantity numeric not null,
  raw_quantity jsonb not null,
  note text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint order_exchange_item_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_exchange_item_deleted_at" on public.order_exchange_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_exchange_item_exchange_id" on public.order_exchange_item using btree (exchange_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_exchange_item_item_id" on public.order_exchange_item using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_fulfillment (
  order_id character varying(255) not null,
  fulfillment_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint order_fulfillment_pkey primary key (order_id, fulfillment_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-e8d2543e" on public.order_fulfillment using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_order_id_-e8d2543e" on public.order_fulfillment using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_id_-e8d2543e" on public.order_fulfillment using btree (fulfillment_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-e8d2543e" on public.order_fulfillment using btree (deleted_at) TABLESPACE pg_default;

create table public.order_item (
  id text not null,
  order_id text not null,
  version integer not null,
  item_id text not null,
  quantity numeric not null,
  raw_quantity jsonb not null,
  fulfilled_quantity numeric not null,
  raw_fulfilled_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  shipped_quantity numeric not null,
  raw_shipped_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  return_requested_quantity numeric not null,
  raw_return_requested_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  return_received_quantity numeric not null,
  raw_return_received_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  return_dismissed_quantity numeric not null,
  raw_return_dismissed_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  written_off_quantity numeric not null,
  raw_written_off_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  delivered_quantity numeric not null default 0,
  raw_delivered_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  unit_price numeric null,
  raw_unit_price jsonb null,
  compare_at_unit_price numeric null,
  raw_compare_at_unit_price jsonb null,
  constraint order_item_pkey primary key (id),
  constraint order_item_item_id_foreign foreign KEY (item_id) references order_line_item (id) on update CASCADE on delete CASCADE,
  constraint order_item_order_id_foreign foreign KEY (order_id) references "order" (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_item_order_id_version" on public.order_item using btree (order_id, version) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_item_deleted_at" on public.order_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_order_item_order_id" on public.order_item using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_item_item_id" on public.order_item using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_line_item (
  id text not null,
  totals_id text null,
  title text not null,
  subtitle text null,
  thumbnail text null,
  variant_id text null,
  product_id text null,
  product_title text null,
  product_description text null,
  product_subtitle text null,
  product_type text null,
  product_collection text null,
  product_handle text null,
  variant_sku text null,
  variant_barcode text null,
  variant_title text null,
  variant_option_values jsonb null,
  requires_shipping boolean not null default true,
  is_discountable boolean not null default true,
  is_tax_inclusive boolean not null default false,
  compare_at_unit_price numeric null,
  raw_compare_at_unit_price jsonb null,
  unit_price numeric not null,
  raw_unit_price jsonb not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  is_custom_price boolean not null default false,
  product_type_id text null,
  is_giftcard boolean not null default false,
  constraint order_line_item_pkey primary key (id),
  constraint order_line_item_totals_id_foreign foreign KEY (totals_id) references order_item (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_line_item_product_id" on public.order_line_item using btree (product_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_line_item_product_type_id" on public.order_line_item using btree (product_type_id) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (product_type_id is not null)
  );

create index IF not exists "IDX_order_line_item_variant_id" on public.order_line_item using btree (variant_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_line_item_adjustment (
  id text not null,
  description text null,
  promotion_id text null,
  code text null,
  amount numeric not null,
  raw_amount jsonb not null,
  provider_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  item_id text not null,
  deleted_at timestamp with time zone null,
  is_tax_inclusive boolean not null default false,
  version integer not null default 1,
  constraint order_line_item_adjustment_pkey primary key (id),
  constraint order_line_item_adjustment_item_id_foreign foreign KEY (item_id) references order_line_item (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_line_item_adjustment_item_id" on public.order_line_item_adjustment using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_line_item_tax_line (
  id text not null,
  description text null,
  tax_rate_id text null,
  code text not null,
  rate numeric not null,
  raw_rate jsonb not null,
  provider_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  item_id text not null,
  deleted_at timestamp with time zone null,
  constraint order_line_item_tax_line_pkey primary key (id),
  constraint order_line_item_tax_line_item_id_foreign foreign KEY (item_id) references order_line_item (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_line_item_tax_line_item_id" on public.order_line_item_tax_line using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_payment_collection (
  order_id character varying(255) not null,
  payment_collection_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint order_payment_collection_pkey primary key (order_id, payment_collection_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_f42b9949" on public.order_payment_collection using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_order_id_f42b9949" on public.order_payment_collection using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_payment_collection_id_f42b9949" on public.order_payment_collection using btree (payment_collection_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_f42b9949" on public.order_payment_collection using btree (deleted_at) TABLESPACE pg_default;

create table public.order_promotion (
  order_id character varying(255) not null,
  promotion_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint order_promotion_pkey primary key (order_id, promotion_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-71518339" on public.order_promotion using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_order_id_-71518339" on public.order_promotion using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_id_-71518339" on public.order_promotion using btree (promotion_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-71518339" on public.order_promotion using btree (deleted_at) TABLESPACE pg_default;

create table public.order_shipping (
  id text not null,
  order_id text not null,
  version integer not null,
  shipping_method_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  return_id text null,
  claim_id text null,
  exchange_id text null,
  constraint order_shipping_pkey primary key (id),
  constraint order_shipping_order_id_foreign foreign KEY (order_id) references "order" (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_shipping_order_id_version" on public.order_shipping using btree (order_id, version) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_shipping_item_id" on public.order_shipping using btree (shipping_method_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_shipping_deleted_at" on public.order_shipping using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_order_shipping_order_id" on public.order_shipping using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_shipping_return_id" on public.order_shipping using btree (return_id) TABLESPACE pg_default
where
  (
    (return_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_shipping_claim_id" on public.order_shipping using btree (claim_id) TABLESPACE pg_default
where
  (
    (claim_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_shipping_exchange_id" on public.order_shipping using btree (exchange_id) TABLESPACE pg_default
where
  (
    (exchange_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_shipping_shipping_method_id" on public.order_shipping using btree (shipping_method_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_shipping_method (
  id text not null,
  name text not null,
  description jsonb null,
  amount numeric not null,
  raw_amount jsonb not null,
  is_tax_inclusive boolean not null default false,
  shipping_option_id text null,
  data jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  is_custom_amount boolean not null default false,
  constraint order_shipping_method_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_order_shipping_method_shipping_option_id" on public.order_shipping_method using btree (shipping_option_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_shipping_method_adjustment (
  id text not null,
  description text null,
  promotion_id text null,
  code text null,
  amount numeric not null,
  raw_amount jsonb not null,
  provider_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  shipping_method_id text not null,
  deleted_at timestamp with time zone null,
  constraint order_shipping_method_adjustment_pkey primary key (id),
  constraint order_shipping_method_adjustment_shipping_method_id_foreign foreign KEY (shipping_method_id) references order_shipping_method (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_shipping_method_adjustment_shipping_method_id" on public.order_shipping_method_adjustment using btree (shipping_method_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_shipping_method_tax_line (
  id text not null,
  description text null,
  tax_rate_id text null,
  code text not null,
  rate numeric not null,
  raw_rate jsonb not null,
  provider_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  shipping_method_id text not null,
  deleted_at timestamp with time zone null,
  constraint order_shipping_method_tax_line_pkey primary key (id),
  constraint order_shipping_method_tax_line_shipping_method_id_foreign foreign KEY (shipping_method_id) references order_shipping_method (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_shipping_method_tax_line_shipping_method_id" on public.order_shipping_method_tax_line using btree (shipping_method_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_summary (
  id text not null,
  order_id text not null,
  version integer not null default 1,
  totals jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint order_summary_pkey primary key (id),
  constraint order_summary_order_id_foreign foreign KEY (order_id) references "order" (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_summary_deleted_at" on public.order_summary using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_order_summary_order_id_version" on public.order_summary using btree (order_id, version) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.order_transaction (
  id text not null,
  order_id text not null,
  version integer not null default 1,
  amount numeric not null,
  raw_amount jsonb not null,
  currency_code text not null,
  reference text null,
  reference_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  return_id text null,
  claim_id text null,
  exchange_id text null,
  constraint order_transaction_pkey primary key (id),
  constraint order_transaction_order_id_foreign foreign KEY (order_id) references "order" (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_order_transaction_order_id" on public.order_transaction using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_transaction_order_id_version" on public.order_transaction using btree (order_id, version) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_transaction_return_id" on public.order_transaction using btree (return_id) TABLESPACE pg_default
where
  (
    (return_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_transaction_claim_id" on public.order_transaction using btree (claim_id) TABLESPACE pg_default
where
  (
    (claim_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_transaction_exchange_id" on public.order_transaction using btree (exchange_id) TABLESPACE pg_default
where
  (
    (exchange_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_order_transaction_reference_id" on public.order_transaction using btree (reference_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_order_transaction_currency_code" on public.order_transaction using btree (currency_code) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.payment (
  id text not null,
  amount numeric not null,
  raw_amount jsonb not null,
  currency_code text not null,
  provider_id text not null,
  data jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  captured_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  payment_collection_id text not null,
  payment_session_id text not null,
  metadata jsonb null,
  constraint payment_pkey primary key (id),
  constraint payment_payment_collection_id_foreign foreign KEY (payment_collection_id) references payment_collection (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_payment_deleted_at" on public.payment using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_payment_payment_collection_id" on public.payment using btree (payment_collection_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_payment_provider_id" on public.payment using btree (provider_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_payment_payment_session_id" on public.payment using btree (payment_session_id) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_payment_payment_session_id_unique" on public.payment using btree (payment_session_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.payment_collection (
  id text not null,
  currency_code text not null,
  amount numeric not null,
  raw_amount jsonb not null,
  authorized_amount numeric null,
  raw_authorized_amount jsonb null,
  captured_amount numeric null,
  raw_captured_amount jsonb null,
  refunded_amount numeric null,
  raw_refunded_amount jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  status text not null default 'not_paid'::text,
  metadata jsonb null,
  constraint payment_collection_pkey primary key (id),
  constraint payment_collection_status_check check (
    (
      status = any (
        array[
          'not_paid'::text,
          'awaiting'::text,
          'authorized'::text,
          'partially_authorized'::text,
          'canceled'::text,
          'failed'::text,
          'partially_captured'::text,
          'completed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_payment_collection_deleted_at" on public.payment_collection using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.payment_collection_payment_providers (
  payment_collection_id text not null,
  payment_provider_id text not null,
  constraint payment_collection_payment_providers_pkey primary key (payment_collection_id, payment_provider_id),
  constraint payment_collection_payment_providers_payment_col_aa276_foreign foreign KEY (payment_collection_id) references payment_collection (id) on update CASCADE on delete CASCADE,
  constraint payment_collection_payment_providers_payment_pro_2d555_foreign foreign KEY (payment_provider_id) references payment_provider (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.payment_provider (
  id text not null,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint payment_provider_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_payment_provider_deleted_at" on public.payment_provider using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.payment_session (
  id text not null,
  currency_code text not null,
  amount numeric not null,
  raw_amount jsonb not null,
  provider_id text not null,
  data jsonb not null default '{}'::jsonb,
  context jsonb null,
  status text not null default 'pending'::text,
  authorized_at timestamp with time zone null,
  payment_collection_id text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint payment_session_pkey primary key (id),
  constraint payment_session_payment_collection_id_foreign foreign KEY (payment_collection_id) references payment_collection (id) on update CASCADE on delete CASCADE,
  constraint payment_session_status_check check (
    (
      status = any (
        array[
          'authorized'::text,
          'captured'::text,
          'pending'::text,
          'requires_more'::text,
          'error'::text,
          'canceled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_payment_session_payment_collection_id" on public.payment_session using btree (payment_collection_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_payment_session_deleted_at" on public.payment_session using btree (deleted_at) TABLESPACE pg_default;

create table public.price (
  id text not null,
  title text null,
  price_set_id text not null,
  currency_code text not null,
  raw_amount jsonb not null,
  rules_count integer null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  price_list_id text null,
  amount numeric not null,
  min_quantity numeric null,
  max_quantity numeric null,
  raw_min_quantity jsonb null,
  raw_max_quantity jsonb null,
  constraint price_pkey primary key (id),
  constraint price_price_list_id_foreign foreign KEY (price_list_id) references price_list (id) on update CASCADE on delete CASCADE,
  constraint price_price_set_id_foreign foreign KEY (price_set_id) references price_set (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_price_price_set_id" on public.price using btree (price_set_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_price_list_id" on public.price using btree (price_list_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_deleted_at" on public.price using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_price_currency_code" on public.price using btree (currency_code) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.price_list (
  id text not null,
  status text not null default 'draft'::text,
  starts_at timestamp with time zone null,
  ends_at timestamp with time zone null,
  rules_count integer null default 0,
  title text not null,
  description text not null,
  type text not null default 'sale'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint price_list_pkey primary key (id),
  constraint price_list_status_check check (
    (
      status = any (array['active'::text, 'draft'::text])
    )
  ),
  constraint price_list_type_check check (
    (
      type = any (array['sale'::text, 'override'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_price_list_deleted_at" on public.price_list using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_price_list_id_status_starts_at_ends_at" on public.price_list using btree (id, status, starts_at, ends_at) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (status = 'active'::text)
  );

  create table public.price_list_rule (
  id text not null,
  price_list_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  value jsonb null,
  attribute text not null default ''::text,
  constraint price_list_rule_pkey primary key (id),
  constraint price_list_rule_price_list_id_foreign foreign KEY (price_list_id) references price_list (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_price_list_rule_price_list_id" on public.price_list_rule using btree (price_list_id) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_price_list_rule_deleted_at" on public.price_list_rule using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_price_list_rule_attribute" on public.price_list_rule using btree (attribute) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_list_rule_value" on public.price_list_rule using gin (value) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.price_preference (
  id text not null,
  attribute text not null,
  value text null,
  is_tax_inclusive boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint price_preference_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_price_preference_deleted_at" on public.price_preference using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_price_preference_attribute_value" on public.price_preference using btree (attribute, value) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.price_rule (
  id text not null,
  value text not null,
  priority integer not null default 0,
  price_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  attribute text not null default ''::text,
  operator text not null default 'eq'::text,
  constraint price_rule_pkey primary key (id),
  constraint price_rule_price_id_foreign foreign KEY (price_id) references price (id) on update CASCADE on delete CASCADE,
  constraint price_rule_operator_check check (
    (
      operator = any (
        array[
          'gte'::text,
          'lte'::text,
          'gt'::text,
          'lt'::text,
          'eq'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_price_rule_deleted_at" on public.price_rule using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_price_rule_operator" on public.price_rule using btree (operator) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_price_rule_price_id_attribute_operator_unique" on public.price_rule using btree (price_id, attribute, operator) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_rule_price_id" on public.price_rule using btree (price_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_rule_attribute_value" on public.price_rule using btree (attribute, value) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_rule_operator_value" on public.price_rule using btree (operator, value) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_rule_attribute" on public.price_rule using btree (attribute) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_rule_attribute_value_price_id" on public.price_rule using btree (attribute, value, price_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.price_set (
  id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint price_set_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_price_set_deleted_at" on public.price_set using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.product (
  id text not null,
  title text not null,
  handle text not null,
  subtitle text null,
  description text null,
  is_giftcard boolean not null default false,
  status text not null default 'draft'::text,
  thumbnail text null,
  weight text null,
  length text null,
  height text null,
  width text null,
  origin_country text null,
  hs_code text null,
  mid_code text null,
  material text null,
  collection_id text null,
  type_id text null,
  discountable boolean not null default true,
  external_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  metadata jsonb null,
  constraint product_pkey primary key (id),
  constraint product_collection_id_foreign foreign KEY (collection_id) references product_collection (id) on update CASCADE on delete set null,
  constraint product_type_id_foreign foreign KEY (type_id) references product_type (id) on update CASCADE on delete set null,
  constraint product_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'proposed'::text,
          'published'::text,
          'rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_product_handle_unique" on public.product using btree (handle) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_type_id" on public.product using btree (type_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_collection_id" on public.product using btree (collection_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_deleted_at" on public.product using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_product_status" on public.product using btree (status) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.product_category (
  id text not null,
  name text not null,
  description text not null default ''::text,
  handle text not null,
  mpath text not null,
  is_active boolean not null default false,
  is_internal boolean not null default false,
  rank integer not null default 0,
  parent_category_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  metadata jsonb null,
  constraint product_category_pkey primary key (id),
  constraint product_category_parent_category_id_foreign foreign KEY (parent_category_id) references product_category (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_category_handle_unique" on public.product_category using btree (handle) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_category_path" on public.product_category using btree (mpath) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_category_parent_category_id" on public.product_category using btree (parent_category_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.product_category_product (
  product_id text not null,
  product_category_id text not null,
  constraint product_category_product_pkey primary key (product_id, product_category_id),
  constraint product_category_product_product_category_id_foreign foreign KEY (product_category_id) references product_category (id) on update CASCADE on delete CASCADE,
  constraint product_category_product_product_id_foreign foreign KEY (product_id) references product (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.product_collection (
  id text not null,
  title text not null,
  handle text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint product_collection_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_collection_handle_unique" on public.product_collection using btree (handle) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_collection_deleted_at" on public.product_collection using btree (deleted_at) TABLESPACE pg_default;

create table public.product_option (
  id text not null,
  title text not null,
  product_id text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint product_option_pkey primary key (id),
  constraint product_option_product_id_foreign foreign KEY (product_id) references product (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_product_option_deleted_at" on public.product_option using btree (deleted_at) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_option_product_id_title_unique" on public.product_option using btree (product_id, title) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_option_product_id" on public.product_option using btree (product_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.product_option_value (
  id text not null,
  value text not null,
  option_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint product_option_value_pkey primary key (id),
  constraint product_option_value_option_id_foreign foreign KEY (option_id) references product_option (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_option_value_option_id_unique" on public.product_option_value using btree (option_id, value) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_option_value_deleted_at" on public.product_option_value using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_product_option_value_option_id" on public.product_option_value using btree (option_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.product_sales_channel (
  product_id character varying(255) not null,
  sales_channel_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint product_sales_channel_pkey primary key (product_id, sales_channel_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_20b454295" on public.product_sales_channel using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_product_id_20b454295" on public.product_sales_channel using btree (product_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_sales_channel_id_20b454295" on public.product_sales_channel using btree (sales_channel_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_20b454295" on public.product_sales_channel using btree (deleted_at) TABLESPACE pg_default;

create table public.product_shipping_profile (
  product_id character varying(255) not null,
  shipping_profile_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint product_shipping_profile_pkey primary key (product_id, shipping_profile_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_17a262437" on public.product_shipping_profile using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_product_id_17a262437" on public.product_shipping_profile using btree (product_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_shipping_profile_id_17a262437" on public.product_shipping_profile using btree (shipping_profile_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_17a262437" on public.product_shipping_profile using btree (deleted_at) TABLESPACE pg_default;

create table public.product_tag (
  id text not null,
  value text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint product_tag_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_product_tag_deleted_at" on public.product_tag using btree (deleted_at) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_tag_value_unique" on public.product_tag using btree (value) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.product_tags (
  product_id text not null,
  product_tag_id text not null,
  constraint product_tags_pkey primary key (product_id, product_tag_id),
  constraint product_tags_product_id_foreign foreign KEY (product_id) references product (id) on update CASCADE on delete CASCADE,
  constraint product_tags_product_tag_id_foreign foreign KEY (product_tag_id) references product_tag (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.product_type (
  id text not null,
  value text not null,
  metadata json null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint product_type_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_type_value_unique" on public.product_type using btree (value) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_type_deleted_at" on public.product_type using btree (deleted_at) TABLESPACE pg_default;

create table public.product_variant (
  id text not null,
  title text not null,
  sku text null,
  barcode text null,
  ean text null,
  upc text null,
  allow_backorder boolean not null default false,
  manage_inventory boolean not null default true,
  hs_code text null,
  origin_country text null,
  mid_code text null,
  material text null,
  weight integer null,
  length integer null,
  height integer null,
  width integer null,
  metadata jsonb null,
  variant_rank integer null default 0,
  product_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  thumbnail text null,
  constraint product_variant_pkey primary key (id),
  constraint product_variant_product_id_foreign foreign KEY (product_id) references product (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_product_variant_ean_unique" on public.product_variant using btree (ean) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_product_variant_upc_unique" on public.product_variant using btree (upc) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_product_variant_sku_unique" on public.product_variant using btree (sku) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_product_variant_barcode_unique" on public.product_variant using btree (barcode) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_variant_product_id" on public.product_variant using btree (product_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_variant_deleted_at" on public.product_variant using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_product_variant_id_product_id" on public.product_variant using btree (id, product_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.product_variant_inventory_item (
  variant_id character varying(255) not null,
  inventory_item_id character varying(255) not null,
  id character varying(255) not null,
  required_quantity integer not null default 1,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint product_variant_inventory_item_pkey primary key (variant_id, inventory_item_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_17b4c4e35" on public.product_variant_inventory_item using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_variant_id_17b4c4e35" on public.product_variant_inventory_item using btree (variant_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_inventory_item_id_17b4c4e35" on public.product_variant_inventory_item using btree (inventory_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_17b4c4e35" on public.product_variant_inventory_item using btree (deleted_at) TABLESPACE pg_default;

create table public.product_variant_option (
  variant_id text not null,
  option_value_id text not null,
  constraint product_variant_option_pkey primary key (variant_id, option_value_id),
  constraint product_variant_option_option_value_id_foreign foreign KEY (option_value_id) references product_option_value (id) on update CASCADE on delete CASCADE,
  constraint product_variant_option_variant_id_foreign foreign KEY (variant_id) references product_variant (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.product_variant_price_set (
  variant_id character varying(255) not null,
  price_set_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint product_variant_price_set_pkey primary key (variant_id, price_set_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_52b23597" on public.product_variant_price_set using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_variant_id_52b23597" on public.product_variant_price_set using btree (variant_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_set_id_52b23597" on public.product_variant_price_set using btree (price_set_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_52b23597" on public.product_variant_price_set using btree (deleted_at) TABLESPACE pg_default;

create table public.product_variant_product_image (
  id text not null,
  variant_id text not null,
  image_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint product_variant_product_image_pkey primary key (id),
  constraint product_variant_product_image_image_id_foreign foreign KEY (image_id) references image (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_product_variant_product_image_variant_id" on public.product_variant_product_image using btree (variant_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_variant_product_image_image_id" on public.product_variant_product_image using btree (image_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_product_variant_product_image_deleted_at" on public.product_variant_product_image using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion (
  id text not null,
  code text not null,
  campaign_id text null,
  is_automatic boolean not null default false,
  type text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  status text not null default 'draft'::text,
  is_tax_inclusive boolean not null default false,
  "limit" integer null,
  used integer not null default 0,
  metadata jsonb null,
  constraint promotion_pkey primary key (id),
  constraint promotion_campaign_id_foreign foreign KEY (campaign_id) references promotion_campaign (id) on update CASCADE on delete set null,
  constraint promotion_status_check check (
    (
      status = any (
        array['draft'::text, 'active'::text, 'inactive'::text]
      )
    )
  ),
  constraint promotion_type_check check (
    (
      type = any (array['standard'::text, 'buyget'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_type" on public.promotion using btree (type) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_campaign_id" on public.promotion using btree (campaign_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_deleted_at" on public.promotion using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_status" on public.promotion using btree (status) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_unique_promotion_code" on public.promotion using btree (code) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_is_automatic" on public.promotion using btree (is_automatic) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion_application_method (
  id text not null,
  value numeric null,
  raw_value jsonb null,
  max_quantity integer null,
  apply_to_quantity integer null,
  buy_rules_min_quantity integer null,
  type text not null,
  target_type text not null,
  allocation text null,
  promotion_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  currency_code text null,
  constraint promotion_application_method_pkey primary key (id),
  constraint promotion_application_method_promotion_id_foreign foreign KEY (promotion_id) references promotion (id) on update CASCADE on delete CASCADE,
  constraint promotion_application_method_allocation_check check (
    (
      allocation = any (array['each'::text, 'across'::text, 'once'::text])
    )
  ),
  constraint promotion_application_method_target_type_check check (
    (
      target_type = any (
        array[
          'order'::text,
          'shipping_methods'::text,
          'items'::text
        ]
      )
    )
  ),
  constraint promotion_application_method_type_check check (
    (
      type = any (array['fixed'::text, 'percentage'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_application_method_currency_code" on public.promotion_application_method using btree (currency_code) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_application_method_type" on public.promotion_application_method using btree (type) TABLESPACE pg_default;

create index IF not exists "IDX_application_method_target_type" on public.promotion_application_method using btree (target_type) TABLESPACE pg_default;

create index IF not exists "IDX_application_method_allocation" on public.promotion_application_method using btree (allocation) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_application_method_deleted_at" on public.promotion_application_method using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_promotion_application_method_promotion_id_unique" on public.promotion_application_method using btree (promotion_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion_campaign (
  id text not null,
  name text not null,
  description text null,
  campaign_identifier text not null,
  starts_at timestamp with time zone null,
  ends_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint promotion_campaign_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_promotion_campaign_campaign_identifier_unique" on public.promotion_campaign using btree (campaign_identifier) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_campaign_deleted_at" on public.promotion_campaign using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion_campaign_budget (
  id text not null,
  type text not null,
  campaign_id text not null,
  "limit" numeric null,
  raw_limit jsonb null,
  used numeric not null default 0,
  raw_used jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  currency_code text null,
  attribute text null,
  constraint promotion_campaign_budget_pkey primary key (id),
  constraint promotion_campaign_budget_campaign_id_foreign foreign KEY (campaign_id) references promotion_campaign (id) on update CASCADE on delete CASCADE,
  constraint promotion_campaign_budget_type_check check (
    (
      type = any (
        array[
          'spend'::text,
          'usage'::text,
          'use_by_attribute'::text,
          'spend_by_attribute'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_campaign_budget_type" on public.promotion_campaign_budget using btree (type) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_campaign_budget_deleted_at" on public.promotion_campaign_budget using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_promotion_campaign_budget_campaign_id_unique" on public.promotion_campaign_budget using btree (campaign_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion_campaign_budget_usage (
  id text not null,
  attribute_value text not null,
  used numeric not null default 0,
  budget_id text not null,
  raw_used jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint promotion_campaign_budget_usage_pkey primary key (id),
  constraint promotion_campaign_budget_usage_budget_id_foreign foreign KEY (budget_id) references promotion_campaign_budget (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_campaign_budget_usage_budget_id" on public.promotion_campaign_budget_usage using btree (budget_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_campaign_budget_usage_deleted_at" on public.promotion_campaign_budget_usage using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_promotion_campaign_budget_usage_attribute_value_budget_id_u" on public.promotion_campaign_budget_usage using btree (attribute_value, budget_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion_promotion_rule (
  promotion_id text not null,
  promotion_rule_id text not null,
  constraint promotion_promotion_rule_pkey primary key (promotion_id, promotion_rule_id),
  constraint promotion_promotion_rule_promotion_id_foreign foreign KEY (promotion_id) references promotion (id) on update CASCADE on delete CASCADE,
  constraint promotion_promotion_rule_promotion_rule_id_foreign foreign KEY (promotion_rule_id) references promotion_rule (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.promotion_rule (
  id text not null,
  description text null,
  attribute text not null,
  operator text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint promotion_rule_pkey primary key (id),
  constraint promotion_rule_operator_check check (
    (
      operator = any (
        array[
          'gte'::text,
          'lte'::text,
          'gt'::text,
          'lt'::text,
          'eq'::text,
          'ne'::text,
          'in'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_rule_attribute" on public.promotion_rule using btree (attribute) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_rule_operator" on public.promotion_rule using btree (operator) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_rule_deleted_at" on public.promotion_rule using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_rule_attribute_operator" on public.promotion_rule using btree (attribute, operator) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_rule_attribute_operator_id" on public.promotion_rule using btree (operator, attribute, id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.promotion_rule_value (
  id text not null,
  promotion_rule_id text not null,
  value text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint promotion_rule_value_pkey primary key (id),
  constraint promotion_rule_value_promotion_rule_id_foreign foreign KEY (promotion_rule_id) references promotion_rule (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_promotion_rule_value_promotion_rule_id" on public.promotion_rule_value using btree (promotion_rule_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_rule_value_deleted_at" on public.promotion_rule_value using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_rule_value_rule_id_value" on public.promotion_rule_value using btree (promotion_rule_id, value) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_promotion_rule_value_value" on public.promotion_rule_value using btree (value) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.provider_identity (
  id text not null,
  entity_id text not null,
  provider text not null,
  auth_identity_id text not null,
  user_metadata jsonb null,
  provider_metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint provider_identity_pkey primary key (id),
  constraint provider_identity_auth_identity_id_foreign foreign KEY (auth_identity_id) references auth_identity (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_provider_identity_auth_identity_id" on public.provider_identity using btree (auth_identity_id) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_provider_identity_provider_entity_id" on public.provider_identity using btree (entity_id, provider) TABLESPACE pg_default;

create index IF not exists "IDX_provider_identity_deleted_at" on public.provider_identity using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.publishable_api_key_sales_channel (
  publishable_key_id character varying(255) not null,
  sales_channel_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint publishable_api_key_sales_channel_pkey primary key (publishable_key_id, sales_channel_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-1d67bae40" on public.publishable_api_key_sales_channel using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_publishable_key_id_-1d67bae40" on public.publishable_api_key_sales_channel using btree (publishable_key_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_sales_channel_id_-1d67bae40" on public.publishable_api_key_sales_channel using btree (sales_channel_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-1d67bae40" on public.publishable_api_key_sales_channel using btree (deleted_at) TABLESPACE pg_default;

create table public.refund (
  id text not null,
  amount numeric not null,
  raw_amount jsonb not null,
  payment_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  created_by text null,
  metadata jsonb null,
  refund_reason_id text null,
  note text null,
  constraint refund_pkey primary key (id),
  constraint refund_payment_id_foreign foreign KEY (payment_id) references payment (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_refund_payment_id" on public.refund using btree (payment_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_refund_deleted_at" on public.refund using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists "IDX_refund_refund_reason_id" on public.refund using btree (refund_reason_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.refund_reason (
  id text not null,
  label text not null,
  description text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  code text not null,
  constraint refund_reason_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_refund_reason_deleted_at" on public.refund_reason using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.region (
  id text not null,
  name text not null,
  currency_code text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  automatic_taxes boolean not null default true,
  constraint region_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_region_deleted_at" on public.region using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.region_country (
  iso_2 text not null,
  iso_3 text not null,
  num_code text not null,
  name text not null,
  display_name text not null,
  region_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint region_country_pkey primary key (iso_2),
  constraint region_country_region_id_foreign foreign KEY (region_id) references region (id) on update CASCADE on delete set null
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_region_country_region_id_iso_2_unique" on public.region_country using btree (region_id, iso_2) TABLESPACE pg_default;

create index IF not exists "IDX_region_country_region_id" on public.region_country using btree (region_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_region_country_deleted_at" on public.region_country using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.region_payment_provider (
  region_id character varying(255) not null,
  payment_provider_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint region_payment_provider_pkey primary key (region_id, payment_provider_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_1c934dab0" on public.region_payment_provider using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_region_id_1c934dab0" on public.region_payment_provider using btree (region_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_payment_provider_id_1c934dab0" on public.region_payment_provider using btree (payment_provider_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_1c934dab0" on public.region_payment_provider using btree (deleted_at) TABLESPACE pg_default;

create table public.reservation_item (
  id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  line_item_id text null,
  location_id text not null,
  quantity numeric not null,
  external_id text null,
  description text null,
  created_by text null,
  metadata jsonb null,
  inventory_item_id text not null,
  allow_backorder boolean null default false,
  raw_quantity jsonb null,
  constraint reservation_item_pkey primary key (id),
  constraint reservation_item_inventory_item_id_foreign foreign KEY (inventory_item_id) references inventory_item (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_reservation_item_deleted_at" on public.reservation_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_reservation_item_line_item_id" on public.reservation_item using btree (line_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_reservation_item_location_id" on public.reservation_item using btree (location_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_reservation_item_inventory_item_id" on public.reservation_item using btree (inventory_item_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.return (
  id text not null,
  order_id text not null,
  claim_id text null,
  exchange_id text null,
  order_version integer not null,
  display_id serial not null,
  status public.return_status_enum not null default 'open'::return_status_enum,
  no_notification boolean null,
  refund_amount numeric null,
  raw_refund_amount jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  received_at timestamp with time zone null,
  canceled_at timestamp with time zone null,
  location_id text null,
  requested_at timestamp with time zone null,
  created_by text null,
  constraint return_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_return_display_id" on public.return using btree (display_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_return_order_id" on public.return using btree (order_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_return_exchange_id" on public.return using btree (exchange_id) TABLESPACE pg_default
where
  (
    (exchange_id is not null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_return_claim_id" on public.return using btree (claim_id) TABLESPACE pg_default
where
  (
    (claim_id is not null)
    and (deleted_at is null)
  );

  create table public.return_fulfillment (
  return_id character varying(255) not null,
  fulfillment_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint return_fulfillment_pkey primary key (return_id, fulfillment_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_-31ea43a" on public.return_fulfillment using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_return_id_-31ea43a" on public.return_fulfillment using btree (return_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_fulfillment_id_-31ea43a" on public.return_fulfillment using btree (fulfillment_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_-31ea43a" on public.return_fulfillment using btree (deleted_at) TABLESPACE pg_default;

create table public.return_item (
  id text not null,
  return_id text not null,
  reason_id text null,
  item_id text not null,
  quantity numeric not null,
  raw_quantity jsonb not null,
  received_quantity numeric not null default 0,
  raw_received_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  note text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  damaged_quantity numeric not null default 0,
  raw_damaged_quantity jsonb not null default '{"value": "0", "precision": 20}'::jsonb,
  constraint return_item_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_return_item_deleted_at" on public.return_item using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_return_item_return_id" on public.return_item using btree (return_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_return_item_item_id" on public.return_item using btree (item_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_return_item_reason_id" on public.return_item using btree (reason_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.return_reason (
  id character varying not null,
  value character varying not null,
  label character varying not null,
  description character varying null,
  metadata jsonb null,
  parent_return_reason_id character varying null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint return_reason_pkey primary key (id),
  constraint return_reason_parent_return_reason_id_foreign foreign KEY (parent_return_reason_id) references return_reason (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_return_reason_value" on public.return_reason using btree (value) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_return_reason_parent_return_reason_id" on public.return_reason using btree (parent_return_reason_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.sales_channel (
  id text not null,
  name text not null,
  description text null,
  is_disabled boolean not null default false,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint sales_channel_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_sales_channel_deleted_at" on public.sales_channel using btree (deleted_at) TABLESPACE pg_default;

create table public.sales_channel_stock_location (
  sales_channel_id character varying(255) not null,
  stock_location_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint sales_channel_stock_location_pkey primary key (sales_channel_id, stock_location_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_26d06f470" on public.sales_channel_stock_location using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_sales_channel_id_26d06f470" on public.sales_channel_stock_location using btree (sales_channel_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_stock_location_id_26d06f470" on public.sales_channel_stock_location using btree (stock_location_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_26d06f470" on public.sales_channel_stock_location using btree (deleted_at) TABLESPACE pg_default;

create table public.script_migrations (
  id serial not null,
  script_name character varying(255) not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  finished_at timestamp with time zone null,
  constraint script_migrations_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists idx_script_name_unique on public.script_migrations using btree (script_name) TABLESPACE pg_default;

create table public.service_zone (
  id text not null,
  name text not null,
  metadata jsonb null,
  fulfillment_set_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint service_zone_pkey primary key (id),
  constraint service_zone_fulfillment_set_id_foreign foreign KEY (fulfillment_set_id) references fulfillment_set (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_service_zone_name_unique" on public.service_zone using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_service_zone_fulfillment_set_id" on public.service_zone using btree (fulfillment_set_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_service_zone_deleted_at" on public.service_zone using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.shipping_option (
  id text not null,
  name text not null,
  price_type text not null default 'flat'::text,
  service_zone_id text not null,
  shipping_profile_id text null,
  provider_id text null,
  data jsonb null,
  metadata jsonb null,
  shipping_option_type_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint shipping_option_pkey primary key (id),
  constraint shipping_option_provider_id_foreign foreign KEY (provider_id) references fulfillment_provider (id) on update CASCADE on delete set null,
  constraint shipping_option_service_zone_id_foreign foreign KEY (service_zone_id) references service_zone (id) on update CASCADE on delete CASCADE,
  constraint shipping_option_shipping_option_type_id_foreign foreign KEY (shipping_option_type_id) references shipping_option_type (id) on update CASCADE,
  constraint shipping_option_shipping_profile_id_foreign foreign KEY (shipping_profile_id) references shipping_profile (id) on update CASCADE on delete set null,
  constraint shipping_option_price_type_check check (
    (
      price_type = any (array['calculated'::text, 'flat'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_option_service_zone_id" on public.shipping_option using btree (service_zone_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_shipping_option_shipping_profile_id" on public.shipping_option using btree (shipping_profile_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_shipping_option_deleted_at" on public.shipping_option using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_shipping_option_provider_id" on public.shipping_option using btree (provider_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_shipping_option_shipping_option_type_id" on public.shipping_option using btree (shipping_option_type_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.shipping_option_price_set (
  shipping_option_id character varying(255) not null,
  price_set_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint shipping_option_price_set_pkey primary key (shipping_option_id, price_set_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_ba32fa9c" on public.shipping_option_price_set using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_option_id_ba32fa9c" on public.shipping_option_price_set using btree (shipping_option_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_price_set_id_ba32fa9c" on public.shipping_option_price_set using btree (price_set_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_ba32fa9c" on public.shipping_option_price_set using btree (deleted_at) TABLESPACE pg_default;

create table public.shipping_option_rule (
  id text not null,
  attribute text not null,
  operator text not null,
  value jsonb null,
  shipping_option_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint shipping_option_rule_pkey primary key (id),
  constraint shipping_option_rule_shipping_option_id_foreign foreign KEY (shipping_option_id) references shipping_option (id) on update CASCADE on delete CASCADE,
  constraint shipping_option_rule_operator_check check (
    (
      operator = any (
        array[
          'in'::text,
          'eq'::text,
          'ne'::text,
          'gt'::text,
          'gte'::text,
          'lt'::text,
          'lte'::text,
          'nin'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_option_rule_shipping_option_id" on public.shipping_option_rule using btree (shipping_option_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_shipping_option_rule_deleted_at" on public.shipping_option_rule using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.shipping_option_type (
  id text not null,
  label text not null,
  description text null,
  code text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint shipping_option_type_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_shipping_option_type_deleted_at" on public.shipping_option_type using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.shipping_profile (
  id text not null,
  name text not null,
  type text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint shipping_profile_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists "IDX_shipping_profile_name_unique" on public.shipping_profile using btree (name) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_shipping_profile_deleted_at" on public.shipping_profile using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.stock_location (
  id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  name text not null,
  address_id text null,
  metadata jsonb null,
  constraint stock_location_pkey primary key (id),
  constraint stock_location_address_id_foreign foreign KEY (address_id) references stock_location_address (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_stock_location_deleted_at" on public.stock_location using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_stock_location_address_id_unique" on public.stock_location using btree (address_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.stock_location_address (
  id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  address_1 text not null,
  address_2 text null,
  company text null,
  city text null,
  country_code text not null,
  phone text null,
  province text null,
  postal_code text null,
  metadata jsonb null,
  constraint stock_location_address_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_stock_location_address_deleted_at" on public.stock_location_address using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.store (
  id text not null,
  name text not null default 'Medusa Store'::text,
  default_sales_channel_id text null,
  default_region_id text null,
  default_location_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint store_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_store_deleted_at" on public.store using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

  create table public.store_currency (
  id text not null,
  currency_code text not null,
  is_default boolean not null default false,
  store_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint store_currency_pkey primary key (id),
  constraint store_currency_store_id_foreign foreign KEY (store_id) references store (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_store_currency_deleted_at" on public.store_currency using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create index IF not exists "IDX_store_currency_store_id" on public.store_currency using btree (store_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.store_locale (
  id text not null,
  locale_code text not null,
  store_id text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint store_locale_pkey primary key (id),
  constraint store_locale_store_id_foreign foreign KEY (store_id) references store (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_store_locale_store_id" on public.store_locale using btree (store_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_store_locale_deleted_at" on public.store_locale using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.tax_provider (
  id text not null,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint tax_provider_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_tax_provider_deleted_at" on public.tax_provider using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.tax_rate (
  id text not null,
  rate real null,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  is_combinable boolean not null default false,
  tax_region_id text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by text null,
  deleted_at timestamp with time zone null,
  constraint tax_rate_pkey primary key (id),
  constraint FK_tax_rate_tax_region_id foreign KEY (tax_region_id) references tax_region (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_tax_rate_tax_region_id" on public.tax_rate using btree (tax_region_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_tax_rate_deleted_at" on public.tax_rate using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_single_default_region" on public.tax_rate using btree (tax_region_id) TABLESPACE pg_default
where
  (
    (is_default = true)
    and (deleted_at is null)
  );

  create table public.tax_rate_rule (
  id text not null,
  tax_rate_id text not null,
  reference_id text not null,
  reference text not null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by text null,
  deleted_at timestamp with time zone null,
  constraint tax_rate_rule_pkey primary key (id),
  constraint FK_tax_rate_rule_tax_rate_id foreign KEY (tax_rate_id) references tax_rate (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "IDX_tax_rate_rule_tax_rate_id" on public.tax_rate_rule using btree (tax_rate_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_tax_rate_rule_reference_id" on public.tax_rate_rule using btree (reference_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_tax_rate_rule_deleted_at" on public.tax_rate_rule using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_tax_rate_rule_unique_rate_reference" on public.tax_rate_rule using btree (tax_rate_id, reference_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.tax_region (
  id text not null,
  provider_id text null,
  country_code text not null,
  province_code text null,
  parent_id text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by text null,
  deleted_at timestamp with time zone null,
  constraint tax_region_pkey primary key (id),
  constraint FK_tax_region_parent_id foreign KEY (parent_id) references tax_region (id) on delete CASCADE,
  constraint FK_tax_region_provider_id foreign KEY (provider_id) references tax_provider (id) on delete set null,
  constraint CK_tax_region_country_top_level check (
    (
      (parent_id is null)
      or (province_code is not null)
    )
  ),
  constraint CK_tax_region_provider_top_level check (
    (
      (parent_id is null)
      or (provider_id is null)
    )
  )
) TABLESPACE pg_default;

create index IF not exists "IDX_tax_region_parent_id" on public.tax_region using btree (parent_id) TABLESPACE pg_default;

create index IF not exists "IDX_tax_region_deleted_at" on public.tax_region using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_tax_region_unique_country_province" on public.tax_region using btree (country_code, province_code) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_tax_region_unique_country_nullable_province" on public.tax_region using btree (country_code) TABLESPACE pg_default
where
  (
    (province_code is null)
    and (deleted_at is null)
  );

create index IF not exists "IDX_tax_region_provider_id" on public.tax_region using btree (provider_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.user (
  id text not null,
  first_name text null,
  last_name text null,
  email text not null,
  avatar_url text null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint user_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_user_deleted_at" on public."user" using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is not null);

create unique INDEX IF not exists "IDX_user_email_unique" on public."user" using btree (email) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.user_preference (
  id text not null,
  user_id text not null,
  key text not null,
  value jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint user_preference_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_user_preference_deleted_at" on public.user_preference using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_user_preference_user_id_key_unique" on public.user_preference using btree (user_id, key) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_user_preference_user_id" on public.user_preference using btree (user_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.user_rbac_role (
  user_id character varying(255) not null,
  rbac_role_id character varying(255) not null,
  id character varying(255) not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint user_rbac_role_pkey primary key (user_id, rbac_role_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_id_64ff0c4c" on public.user_rbac_role using btree (id) TABLESPACE pg_default;

create index IF not exists "IDX_user_id_64ff0c4c" on public.user_rbac_role using btree (user_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_rbac_role_id_64ff0c4c" on public.user_rbac_role using btree (rbac_role_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_deleted_at_64ff0c4c" on public.user_rbac_role using btree (deleted_at) TABLESPACE pg_default;

create table public.view_configuration (
  id text not null,
  entity text not null,
  name text null,
  user_id text null,
  is_system_default boolean not null default false,
  configuration jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint view_configuration_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists "IDX_view_configuration_deleted_at" on public.view_configuration using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_view_configuration_entity_user_id" on public.view_configuration using btree (entity, user_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_view_configuration_entity_is_system_default" on public.view_configuration using btree (entity, is_system_default) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_view_configuration_user_id" on public.view_configuration using btree (user_id) TABLESPACE pg_default
where
  (deleted_at is null);

  create table public.workflow_execution (
  id character varying not null,
  workflow_id character varying not null,
  transaction_id character varying not null,
  execution jsonb null,
  context jsonb null,
  state character varying not null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  deleted_at timestamp without time zone null,
  retention_time integer null,
  run_id text not null default '01KMA5Z43AFWWACD2HXBPD58YA'::text,
  constraint workflow_execution_pkey primary key (workflow_id, transaction_id, run_id)
) TABLESPACE pg_default;

create index IF not exists "IDX_workflow_execution_deleted_at" on public.workflow_execution using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_id" on public.workflow_execution using btree (id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_workflow_id" on public.workflow_execution using btree (workflow_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_transaction_id" on public.workflow_execution using btree (transaction_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_state" on public.workflow_execution using btree (state) TABLESPACE pg_default
where
  (deleted_at is null);

create unique INDEX IF not exists "IDX_workflow_execution_workflow_id_transaction_id_run_id_unique" on public.workflow_execution using btree (workflow_id, transaction_id, run_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_run_id" on public.workflow_execution using btree (run_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_workflow_id_transaction_id" on public.workflow_execution using btree (workflow_id, transaction_id) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_state_updated_at" on public.workflow_execution using btree (state, updated_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists "IDX_workflow_execution_retention_time_updated_at_state" on public.workflow_execution using btree (retention_time, updated_at, state) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (retention_time is not null)
  );

create index IF not exists "IDX_workflow_execution_updated_at_retention_time" on public.workflow_execution using btree (updated_at, retention_time) TABLESPACE pg_default
where
  (
    (deleted_at is null)
    and (retention_time is not null)
    and (
      (state)::text = any (
        (
          array[
            'done'::character varying,
            'failed'::character varying,
            'reverted'::character varying
          ]
        )::text[]
      )
    )
  );