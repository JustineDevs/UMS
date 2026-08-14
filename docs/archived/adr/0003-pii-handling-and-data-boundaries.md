# ADR-0003: PII Handling and Data Boundaries

## Status
Accepted

## Date
2026-03-31

## Context
The application stores customer PII across two systems: Medusa (commerce database) and Supabase (platform database). Clear rules are needed for where PII lives, how it flows, and how it gets erased.

## Decision

### Data Ownership
- **Medusa**: owns customer email, name, shipping addresses, order history, payment session references
- **Supabase**: owns reviews (linked by customer_id), Q&A entries, cart abandonment records, customer profiles (extended data), staff identity/RBAC

### PII Flow Rules
1. Storefront collects PII only for Medusa operations (checkout, account)
2. Supabase stores PII references (customer_id) but not raw financial data
3. Admin accesses PII through Medusa API with staff session checks
4. Logs MUST NOT contain raw PII (email, phone, card data)
5. Analytics events with PII fields get redacted before export

### Data Erasure
- Customer erasure request triggers:
  1. Medusa customer anonymization (name, email, phone replaced)
  2. Supabase table deletion (reviews, qa_entries, cart_abandonment, customer_profiles)
  3. Audit log entry (non-PII: customer_id + action + timestamp)
- Order records retained with anonymized customer data for accounting
- Route: `POST /compliance/data-erasure` in `apps/api`

### Log Redaction
- Analytics contract defines `pii: true` fields per event type
- Export pipeline applies `redactPiiFields` before writing to warehouse
- Privacy tiers: public, internal, pii, financial

## Consequences
- Two-system erasure requires coordination (API route handles both)
- Staff audit logs reference customer_id, not email
- Warehouse exports use redacted copies of PII events
- Quarterly reviews verify no PII leakage to logs or analytics
