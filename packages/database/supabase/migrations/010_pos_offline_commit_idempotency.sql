-- Idempotent POS offline sync: one Medusa order per client sale id (IndexedDB key).

CREATE TABLE IF NOT EXISTS pos_offline_commit_idempotency (
  client_sale_id text PRIMARY KEY,
  medusa_order_id text NOT NULL,
  display_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pos_offline_commit_idempotency IS
  'Stores successful commit-sale results so offline queue retries cannot double-create orders.';

ALTER TABLE pos_offline_commit_idempotency ENABLE ROW LEVEL SECURITY;
