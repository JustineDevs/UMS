-- Customer notification settings: preserve the existing newsletter channel and
-- add operational preferences without storing provider credentials or content.
ALTER TABLE public.marketing_preferences
  DROP CONSTRAINT IF EXISTS marketing_preferences_channel_check;

ALTER TABLE public.marketing_preferences
  ADD CONSTRAINT marketing_preferences_channel_check
  CHECK (channel IN ('email', 'order_updates', 'back_in_stock', 'promotions', 'wallet', 'platform_updates'));

CREATE INDEX IF NOT EXISTS marketing_preferences_customer_channels_idx
  ON public.marketing_preferences (organization_id, email, channel);
