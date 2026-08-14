# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the current major version. Check the repository for the latest supported version.

## Reporting a Vulnerability

If you discover a security vulnerability in the Universal Music Store Platform, please report it responsibly.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Contact the maintainers directly via the contact method listed in the repository or project documentation.
3. Include a clear description of the vulnerability, steps to reproduce, and potential impact.
4. Allow a reasonable time for a fix before any public disclosure.

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
- **Assessment**: We will assess the vulnerability and determine severity and impact.
- **Fix**: We will work on a fix and keep you informed of progress.
- **Disclosure**: We will coordinate with you on disclosure timing after a fix is available.

### Scope

In-scope for security reporting:

- Authentication and authorization bypass or privilege escalation
- Payment flow vulnerabilities (e.g., webhook forgery, order state manipulation)
- Data exposure (customer data, order data, API keys, secrets)
- Injection (SQL, XSS, command injection)
- Insecure configuration or misconfiguration

Out-of-scope:

- Issues in third-party services (payment processors, shipping providers, Supabase, NextAuth) – report to those providers
- Social engineering or physical access
- Denial of service that requires significant resources

## Security Practices

The Universal Music Store Platform follows these security practices:

### Payment and Webhooks

- **Payment webhooks** are verified using provider signature validation before any order or payment state change.
- Orders are never marked as paid solely from client-side redirect state.
- Webhook events are logged for idempotency and replay safety.

### Authentication and Authorization

- NextAuth/Auth.js with Google OAuth for staff and customers.
- Role-based access control (admin, staff, customer) enforced on admin and POS routes.
- Sensitive credentials stored in environment variables, never in client bundles.

### Data and Compliance

- GDPR and Philippines Data Privacy Act (PDPA) compliance considerations as described in `internal/docs/privacy-terms.md`.
- Inventory movements are immutable and attributable for audit trails.
- Database access uses Supabase with Row Level Security (RLS) where applicable.

### Infrastructure

- HTTPS everywhere.
- Secrets and API keys in environment variables.
- OWASP Top 10 awareness in development and hardening.

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities. Contributors will be acknowledged (with permission) in release notes or a dedicated acknowledgments section.
