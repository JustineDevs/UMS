-- Retired legacy table: payment provider secrets live on the Medusa process only (env / medusa-config).
-- Safe on fresh DBs (no-op) and on upgrades (drops table, policies, and indexes).

DROP TABLE IF EXISTS public.payment_connections CASCADE;
