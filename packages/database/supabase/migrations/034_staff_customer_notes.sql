-- PH-14: Staff customer notes with audit trail.
-- Staff can attach notes to a customer (by email) for CRM context.
-- Each note records the author email and is append-only (no deletes; soft-delete via is_deleted).

CREATE TABLE IF NOT EXISTS public.staff_customer_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email  text NOT NULL,
  note_body       text NOT NULL CHECK (char_length(note_body) BETWEEN 1 AND 4000),
  author_email    text NOT NULL,
  is_deleted      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_customer_notes_customer_email_idx
  ON public.staff_customer_notes (customer_email);

CREATE INDEX IF NOT EXISTS staff_customer_notes_author_email_idx
  ON public.staff_customer_notes (author_email);

ALTER TABLE public.staff_customer_notes ENABLE ROW LEVEL SECURITY;

-- Service role has full access; anon/authenticated roles are denied by default via RLS.
CREATE POLICY staff_customer_notes_service_all ON public.staff_customer_notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
