-- 004: Retail Operations Stack
-- Employee management, POS operations, loyalty, segments, campaigns, receipts, offline queue.

-- Employee role enum
DO $$ BEGIN
  CREATE TYPE employee_role AS ENUM ('admin','manager','cashier','staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  role employee_role NOT NULL DEFAULT 'staff',
  is_active boolean NOT NULL DEFAULT true,
  pin_hash text,
  hired_at date,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(is_active);

-- POS Shifts
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  device_name text NOT NULL DEFAULT 'Terminal 01',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric(12,2) NOT NULL DEFAULT 0,
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  notes text,
  status text NOT NULL DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_employee ON public.pos_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_status ON public.pos_shifts(status);

-- POS Voids / Refunds / Discount overrides audit log
CREATE TABLE IF NOT EXISTS public.pos_voids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES public.pos_shifts(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  approved_by uuid REFERENCES public.employees(id),
  order_id text,
  line_item_id text,
  action text NOT NULL,
  amount numeric(12,2),
  reason text,
  pin_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_voids_shift ON public.pos_voids(shift_id);

-- POS Devices (terminals, printers, KDS)
CREATE TABLE IF NOT EXISTS public.pos_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'terminal',
  ip_address text,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Loyalty Accounts
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL UNIQUE,
  medusa_customer_id text,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'standard',
  birthday date,
  phone text,
  qr_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_email ON public.loyalty_accounts(customer_email);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_qr ON public.loyalty_accounts(qr_token);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tier ON public.loyalty_accounts(tier);

-- Loyalty Transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id),
  order_id text,
  points_delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account ON public.loyalty_transactions(loyalty_account_id);

-- Loyalty Rewards catalog
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  points_cost integer NOT NULL,
  reward_type text NOT NULL DEFAULT 'discount',
  reward_value jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer Segments
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  rule_type text NOT NULL,
  rule_config jsonb NOT NULL DEFAULT '{}',
  auto_refresh boolean NOT NULL DEFAULT true,
  member_count integer NOT NULL DEFAULT 0,
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_segment_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES public.customer_segments(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  medusa_customer_id text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(segment_id, customer_email)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON public.customer_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_email ON public.customer_segment_members(customer_email);

-- Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  segment_id uuid REFERENCES public.customer_segments(id),
  subject text,
  body_template text,
  channel text NOT NULL DEFAULT 'email',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  schedule_cron text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.campaigns(type);

CREATE TABLE IF NOT EXISTS public.campaign_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id),
  recipient_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON public.campaign_messages(campaign_id);

-- Digital Receipts
CREATE TABLE IF NOT EXISTS public.digital_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  customer_email text,
  receipt_html text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_receipts_order ON public.digital_receipts(order_id);

-- Offline POS Queue
CREATE TABLE IF NOT EXISTS public.offline_pos_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON public.offline_pos_queue(status);

-- RLS on all new tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_pos_queue ENABLE ROW LEVEL SECURITY;
