-- Payment evidence is private object storage. The signed URL is generated per
-- authorized request and must never be persisted as a public URL.
alter table if exists public.payment_receipts
  drop column if exists public_url;
