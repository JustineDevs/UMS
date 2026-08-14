# PRODUCT REQUIREMENT DOCUMENT (PRD)

**Universal Music Store Platform – Composable POS + Storefront + Fulfillment**

***

## Executive Summary

This document specifies product requirements for a music commerce stack for a retail business in the Philippines. The implementation is **Medusa-first** for commerce (catalog, cart, orders, payments, inventory records) with a Next.js storefront and admin, Supabase for staff and operational data, and a carrier tracking provider for shipment updates. **Inventory and reservations** follow Medusa and configured modules. **POS** features are workflow scaffolding unless you deploy a full register process. Marketing language should not claim a fully unified omnichannel engine unless those behaviors are deployed and tested end to end.

***

## Project Overview

| Field | Details |
|---|---|
| **Project Name** | Universal Music Store Platform |
| **Client** | [Client Name] |
| **Business Focus** | Music retail (instruments, accessories, gear) |
| **Primary Markets** | Philippines and regional markets |
| **Target Launch** | Q2 2026 |
| **Status** | In Planning |
| **Version** | 1.0 |

***

## Business Objectives

1. **Align sales channels** – Online and retail flows on a Medusa-centered catalog and orders
2. **Reduce inventory drift** – Medusa inventory records as commerce truth; visibility depends on configuration
3. **Enable global tax compliance** – Hosted payments handle VAT and sales tax
4. **Reduce fulfillment friction** – Integrated tracking and label generation for J&T Express
5. **Support high-volume catalog SKUs** – Handle variant combinations efficiently
6. **Build scalable infrastructure** – Architect for multi-location retail growth

***

## Target Audience / User Personas

### Persona 1: Online Customer
- **Goal**: Browse, purchase, and track orders online
- **Pain Point**: Need fast checkout, real-time tracking, easy returns
- **Frequency**: Occasional, varies seasonally

### Persona 2: Retail Staff (Cashier/POS Operator)
- **Goal**: Ring up in-store sales quickly via barcode scanning
- **Pain Point**: Manual inventory tracking, payment delays, label printing friction
- **Frequency**: Daily, high-volume

### Persona 3: Inventory Manager
- **Goal**: Monitor stock levels, receive shipments, adjust inventory
- **Pain Point**: Visibility across warehouse and retail locations, variants unclear
- **Frequency**: Daily

### Persona 4: Fulfillment Specialist
- **Goal**: Pick, pack, and ship orders with tracking
- **Pain Point**: Manual tracking lookup, integration gaps with carriers
- **Frequency**: Daily

### Persona 5: Admin / Business Owner
- **Goal**: Oversee sales analytics, profitability, and operational metrics
- **Pain Point**: Scattered data, no unified view of revenue by channel
- **Frequency**: Weekly or on-demand

***

## Core Features

### A. Storefront (Customer-Facing)

#### A1. Home Page
- Hero banner with seasonal promotions
- Featured product collections
- Category links (Guitars, amps, pedals, etc.)
- Search and basic filtering

**Why**: Drives discoverability and first impression

#### A2. Shop / Product Listing
- Grid view of all active products
- Filters: Size, Color, Price range
- Sorting: New, Popular, Price (low-to-high/high-to-low)
- Pagination or infinite scroll

**Why**: Helps customers find relevant products quickly

#### A3. Product Detail Page
- High-resolution product gallery
- Size picker (S, M, L, XL, 2XL)
- Color swatches
- Price and "Compare at" price display
- "Add to Cart" button
- Product description and specs

**Why**: Enables informed purchase decisions

#### A4. Shopping Cart & Drawer
- Real-time cart summary
- Adjust quantity or remove items
- Estimated shipping and tax preview
- "Proceed to Checkout" call-to-action

**Why**: Low-friction pre-checkout review

#### A5. Checkout Page
- Billing and shipping address capture
- Hosted payment flow via configured Medusa payment providers (e.g. Stripe, PayPal, Xendit)
- Order review before payment
- Payment success confirmation

**Why**: PCI-compliant, reduces cart abandonment

#### A6. Order Tracking Page
- Order status display (Pending Payment → Paid → Ready to Ship → Shipped → Delivered)
- Real-time J&T Express tracking from the shipment tracking provider
- Estimated delivery date
- Carrier contact info and support

**Why**: Reduces post-purchase support inquiries

#### A7. Customer Account
- Google OAuth login
- Order history
- Saved shipping addresses
- Account profile and email preferences

**Why**: Builds loyalty and repeat purchase potential

***

### B. Admin Dashboard (Internal-Facing)

#### B1. Dashboard / Analytics
- Total revenue and recent sales
- Best-selling products by variant
- Low-stock alerts and out-of-stock items
- Orders pending fulfillment
- Recent payments received

**Why**: Executive visibility into business health

#### B2. Inventory Management
- Master table of all product variants
- Stock quantities per location (warehouse, retail store, returns, damaged)
- Add / remove stock by movement reason
- Barcode printable
- SKU and variant search

**Why**: Staff control over stock levels without double-entry

#### B3. POS Terminal
- Barcode scanner input (or manual SKU/product search)
- Quick-add buttons for variants
- Cart-like order entry
- Payment link generation (for walk-in customers)
- Receipt printing or email

**Why**: Enables in-store sales without separate checkout

#### B4. Orders Fulfillment Hub
- Paid orders awaiting fulfillment
- Print J&T Express label from the shipment tracking provider
- Mark order as "Ready to Ship"
- Mark order as "Shipped" with tracking number
- Exception handling (failed labels, returns, cancellations)
- Bulk operations (mass print labels, bulk mark shipped)

**Why**: Streamlines warehouse and shipping operations

#### B5. Role-Based Access Control
- Admin: Full platform access
- Staff: POS, inventory read, order fulfillment
- Customer: Storefront + account only

**Why**: Security and operational clarity

***

### C. Inventory Model (Core)

#### C1. Product Variants
- Parent product: Guitars, amplifiers, pedals, etc.
- Variants: Each type-finish combination is a unique SKU
- Example: GTR-ELC-BLK, GTR-ACO-WHT, AMP-COMBO
- Barcode per variant
- Price and cost per variant
- Status (active/inactive)

**Why**: Inventory lives at variant level, not parent level

#### C2. Inventory Locations
- Warehouse (primary stock)
- Retail store
- Returns (received returns awaiting inspection)
- Damaged (discarded stock)

**Why**: Multi-location visibility and movement tracking

#### C3. Stock Movements (Immutable Log)
- Opening stock received
- Purchased stock received
- Sale (order fulfilled)
- Return (customer return)
- Adjustment (inventory reconciliation)
- Transfer in/out (between locations)

**Why**: Audit trail prevents inventory drift

#### C4. Stock Reservation
- Holds qty during cart and checkout
- Expires if payment fails or timeout reached
- Converts to committed sale on payment confirmation

**Why**: Prevents overselling in high-volume scenarios

***

### D. Order Management System (Core)

#### D1. Order Header
- Order number
- Customer name and contact
- Billing and shipping address
- Web or POS channel
- Order status (draft, pending payment, paid, ready to ship, shipped, delivered, cancelled, refunded)
- Order total (subtotal, shipping, tax, grand total)
- Notes field

**Why**: Complete order context for fulfillment

#### D2. Order Line Items
- Product name snapshot
- Variant (size, color) snapshot
- Unit price snapshot (price at purchase time)
- Quantity
- Line total

**Why**: Historical accuracy; catalog changes don't mutate order history

#### D3. Payment Records
- Payment provider: per enabled Medusa integration (e.g. Stripe, PayPal, Xendit)
- Payment status: Pending, Paid, Failed, Refunded
- External payment ID
- Payment timestamp
- Webhook verification log

**Why**: Payment truth from external provider, auditability

#### D4. Shipment Records
- Order reference
- Carrier: J&T Express Philippines
- Tracking number
- Tracking ID
- Label URL
- Shipment status (pending, label created, in transit, out for delivery, delivered, failed, returned)
- Last checkpoint from carrier

**Why**: Real-time tracking for customer and staff

***

### E. Payments (Medusa payment providers)

#### E1. Hosted Checkout
- Payment link generated per order
- Card, Apple Pay, Google Pay support
- Global VAT/tax handling
- Secure webhook verification

**Why**: Reduces PCI scope; handles tax complexity

#### E2. POS Payment Links
- Generate payment link for walk-in customers
- QR code for mobile payment
- Fallback manual payment entry

**Why**: Offline capability for retail

#### E3. Payment Webhooks
- Idempotent webhook processing
- Verify webhook signature before state change
- Automatic order status update on payment confirmation
- Inventory movement on payment success

**Why**: Reliable payment truth source

***

### F. Shipping & Logistics

#### F1. Shipment Creation
- Create J&T Express label from admin interface
- Auto-populate recipient address from order
- Weight and dimensions optional (depends on carrier rate card)
- Label URL and tracking number stored

**Why**: Integrated workflow; no external tab switching

#### F2. Tracking Sync
- Real-time or polling-based sync with the shipment tracking provider
- Shipment status updates customer tracking page
- Exception handling (failed delivery, returned to sender)
- Notification webhooks for status changes

**Why**: Customer visibility; reduces support burden

#### F3. Multi-Carrier Ready
- The tracking architecture supports future carrier additions
- J&T Express Philippines initially; GCash/Lalamove optional later

**Why**: Future scalability without re-architecture

***

### G. Authentication & Authorization

#### G1. Google OAuth for Staff
- Staff login via Google Workspace or Gmail
- Email-based access grant
- Role assignment (admin, staff, customer)

**Why**: Reduced password management; faster onboarding

#### G2. Google OAuth for Customers
- Optional customer login via Google
- Fallback email/password if preferred
- Account linking to order history

**Why**: Frictionless customer experience

#### G3. Role-Based Access Control
- Admin: All features
- Staff: POS, inventory, orders (no financial reports)
- Customer: Storefront, tracking, account

**Why**: Security and operational separation

***

## Non-Functional Requirements

### Performance
- Storefront homepage load in < 2 seconds (first visit)
- POS barcode lookup in < 500ms
- Payment webhook processing in < 5 seconds
- Tracking page updates within 1 minute of carrier webhook

### Scalability
- Support 10,000+ product variants
- Handle 1,000+ concurrent storefront users
- Support 100+ POS terminals (future expansion)
- 50,000+ orders per month capacity

### Reliability
- 99.5% uptime SLA for storefront
- Automatic webhook retry on failure
- Inventory movements auditable and reversible (within limits)
- Database backups daily

### Security
- HTTPS everywhere
- Payment data handled by configured PSPs and hosted checkouts (PCI scope reduced)
- OAuth for authentication (no password storage)
- Environment variables for secrets
- SQL injection / XSS prevention

### Compliance
- GDPR-ready (customer data retention policies)
- Philippines Data Privacy Act (PDPA) compliance
- Tax invoice generation (PH VAT if applicable)
- Audit logs for financial transactions

***

## Technical Specifications

### Architecture
- **Frontend**: Next.js App Router (Storefront + Admin)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL via Supabase
- **Monorepo**: Turborepo + pnpm
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth**: NextAuth/Auth.js with Google provider
- **Payments**: Medusa payment modules and official PSP SDKs or typed clients where applicable
- **Shipping**: shipment tracking provider + J&T Express Philippines

### Deployment
- **Storefront**: Vercel or similar (auto-deploy from `main` branch)
- **Admin**: Same Vercel app or separate instance
- **API**: Node.js service on Fly.io or similar
- **Database**: Supabase managed Postgres
- **CI/CD**: GitHub Actions for lint, build, test; branch-based auto-deploy

***

## Success Metrics

| Metric | Target | Why |
|---|---|---|
| Storefront conversion rate | > 2% | Baseline e-commerce benchmark |
| POS transaction time | < 2 minutes | Staff efficiency |
| Inventory accuracy | 98%+ | Prevents overselling |
| Order-to-ship time | < 24 hours | Competitive advantage |
| Customer support tickets (shipping) | < 5% of orders | Tracking reduces inquiries |
| Payment success rate | > 98% | PSP uptime and checkout quality |
| Uptime | 99.5% | SLA commitment |

***

## Out of Scope (Phase 2+)

- Multi-currency support (USD, EUR)
- Custom product recommendations / ML
- Advanced analytics (cohort analysis, RFM segmentation)
- Mobile app (iOS/Android native)
- Marketplace model (vendor onboarding)
- Subscription/recurring orders
- Gift cards or store credit
- Email marketing automation
- Advanced warehouse management (pick lists, cycle counting)
- Custom shipping integrations beyond J&T

***

## Assumptions & Constraints

### Assumptions
- Business has active J&T Express account and tracking integration available
- Customers and staff have email access for authentication
- Product catalog will not exceed 500 parent products initially (10,000+ variants)
- Single warehouse / up to 2 retail locations initially

### Constraints
- Philippines-first focus (localised for PH tax, carriers, currency)
- No legacy system data migration in scope
- Phase 1 uses a defined set of Medusa-configured payment providers (see technical docs)
- Shipping limited to J&T Express initially

***

## Project Timeline & Milestones

| Phase | Duration | Key Deliverables |
|---|---|---|
| **Phase 1: Foundation** | Weeks 1–2 | Monorepo setup, database schema, auth scaffold, API skeleton |
| **Phase 2: Catalog** | Weeks 2–3 | Product catalog, variant management, inventory APIs, admin UI |
| **Phase 3: Checkout** | Weeks 3–4 | Storefront, cart, payment provider integration, payment webhooks |
| **Phase 4: Fulfillment** | Weeks 4–5 | POS, orders hub, tracking integration, tracking page |
| **Phase 5: QA & Launch** | Weeks 5–6 | Testing, staging deploy, production launch, SOP handoff |

***

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep | Medium | High | Strict sprint gate; no mid-phase feature adds |
| Payment provider downtime | Low | High | Implement offline POS fallback; manual webhook replay |
| Inventory sync issues | Medium | High | Immutable movement log; daily reconciliation jobs |
| Shipping carrier delays | Low | Medium | Transparency via tracking page; communication templates |
| Data loss | Low | Critical | Daily backups; point-in-time recovery tested quarterly |

***

## Glossary

- **SKU**: Stock-Keeping Unit – unique identifier for a variant (e.g., GTR-ELC-BLK)
- **Variant**: A type-finish combination of a product (e.g., Black electric guitar variant)
- **POS**: Point-of-Sale terminal for in-store transactions
- **OMS**: Order Management System
- **Tracking provider**: Third-party shipping tracking and label provider
- **Payment processor**: Third-party PSP (e.g. Stripe, PayPal) as configured per deployment
- **Webhook**: HTTP callback from external service (payment confirmed, shipment updated)

***

## Approval & Sign-Off

| Role | Name | Signature | Date |
|---|---|---|---|
| Product Owner | [Name] | ________________ | __________ |
| Project Lead | [Name] | ________________ | __________ |
| Business Sponsor | [Name] | ________________ | __________ |
| Tech Lead | [Name] | ________________ | __________ |

***

***

# PROGRAMMING SERVICE AGREEMENT

**Universal Music Store Platform Development**

***

## 1. PARTIES

**SERVICE PROVIDER** ("Provider"): [Developer Name/Company], registered at [Address]

**CLIENT** ("Client"): [Client Name], registered at [Address]

**Effective Date**: [Date]

***

## 2. SERVICES OVERVIEW

Provider agrees to design, develop, and deliver a music commerce platform (the "Project") as defined in this Agreement and the attached Product Requirement Document ("PRD").

The Project includes:
- Customer storefront (web)
- Admin dashboard and POS terminal
- Order management system
- Inventory management system
- Integration with configured payment providers for checkout and webhooks
- Integration with the tracking provider and J&T Express for shipping

***

## 3. SCOPE OF WORK

### 3.1 Deliverables

Provider will deliver the following components:

1. **Monorepo codebase** with Next.js storefront, admin, and Node.js API
2. **PostgreSQL database** schema and migrations
3. **Fully functional storefront** with product browsing, cart, and checkout
4. **Admin dashboard** with inventory, orders, and analytics
5. **POS terminal** for in-store sales
6. **Payment provider integration** with webhook processing
7. **Shipment tracking and J&T Express integration** for shipment tracking
8. **Deployment configuration** for production environments (CI/CD, Docker if applicable)
9. **Documentation** including setup guides, API docs, and operational SOPs

### 3.2 Tech Stack

Provider will use the following technology stack:

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Node.js with Express, TypeScript
- Database: PostgreSQL via Supabase
- Monorepo: Turborepo + pnpm
- Auth: NextAuth/Auth.js with Google OAuth
- Deployment: Vercel (storefront/admin), Fly.io or similar (API)
- CI/CD: GitHub Actions

Any deviation from this stack requires written approval from Client.

### 3.3 What Is NOT Included

The following are explicitly excluded and may be added as separate change orders:

- Multi-currency support (USD, EUR, etc.)
- Mobile app development (iOS/Android)
- Advanced analytics (ML-based recommendations, cohort analysis)
- Email marketing automation
- Custom shipping carrier integrations beyond J&T Express
- Legacy system data migration

***

## 4. PROJECT TIMELINE

| Phase | Duration | Completion Date |
|---|---|---|
| Phase 1: Foundation | 2 weeks | [Date] |
| Phase 2: Catalog | 1 week | [Date] |
| Phase 3: Checkout | 1 week | [Date] |
| Phase 4: Fulfillment | 1 week | [Date] |
| Phase 5: QA & Launch | 1 week | [Date] |
| **Total** | **6 weeks** | **[Final Date]** |

Completion dates are estimates. Provider will notify Client immediately of any foreseeable delays. Changes to scope may extend timelines; additional time will be billed separately.

***

## 5. PAYMENT TERMS

### 5.1 Total Project Fee

Total project cost: **[Amount] PHP** (or equivalent in agreed currency)

### 5.2 Payment Schedule

| Milestone | Percentage | Amount | Due Date |
|---|---|---|---|
| Upon signature | 30% | [Amount] | [Date] |
| Phase 2 completion | 20% | [Amount] | [Date] |
| Phase 4 completion | 20% | [Amount] | [Date] |
| Final delivery & launch | 30% | [Amount] | [Date] |

### 5.3 Payment Method

Invoices will be submitted via email. Client agrees to pay within 15 days of invoice date via:
- Bank transfer
- PayPal
- Other method agreed in writing

### 5.4 Late Payment

If payment is more than 15 days overdue, Provider may:
- Pause work on the Project
- Charge 1.5% monthly interest on outstanding balance
- Recover collection costs

### 5.5 Expenses

Out-of-pocket expenses (if any) for hosting, third-party API keys, or tools will be reimbursed at cost plus 10% administrative fee. Provider will request approval before incurring expenses over [Amount].

***

## 6. INTELLECTUAL PROPERTY (IP) RIGHTS

### 6.1 Ownership

Upon full payment, all custom code, designs, documentation, and deliverables created specifically for Client under this Agreement are owned by Client. This includes:

- Codebase
- Database schema
- API design
- UI/UX designs
- Deployment configurations

### 6.2 Third-Party Libraries

Client acknowledges that the Project includes open-source libraries and third-party services (Next.js, Tailwind CSS, Supabase, etc.). These remain owned by their respective creators and are governed by their original licenses.

### 6.3 Provider Tools & Methods

Provider retains ownership of any tools, methodologies, templates, or processes developed during the Project that are not specific to the deliverables (e.g., build scripts, testing frameworks if generic).

### 6.4 Licensing

Client receives a perpetual, non-exclusive license to use the delivered code and documentation for the Project purpose. Client may modify and distribute the code as needed for the Project.

***

## 7. CONFIDENTIALITY

### 7.1 Confidential Information

Both parties agree to keep confidential any proprietary business information, source code, data, or strategies shared during the Project. This applies to both parties for a period of 2 years after the Project ends.

### 7.2 Exceptions

Confidentiality does not apply to information that:
- Is publicly available
- Was known prior to this Agreement
- Is independently developed
- Is required to be disclosed by law

### 7.3 Public Use

Provider may use the Project as a portfolio example (with Client permission) or for case studies after launch.

***

## 8. WARRANTIES & LIABILITIES

### 8.1 Provider Warranties

Provider warrants that:

- Deliverables will be developed in a professional and workmanlike manner
- Code will follow industry best practices
- Deliverables will be free of viruses or intentional malware
- Code will not violate third-party IP rights (as far as Provider knows)
- Security practices will follow OWASP Top 10 guidelines

### 8.2 Disclaimer

Provider does NOT warrant:

- Uninterrupted uptime or zero defects
- Specific performance benchmarks beyond those in the PRD
- Third-party services (payment processors, shipping provider, Supabase) availability
- Fitness for purposes not described in this Agreement

### 8.3 Limitation of Liability

In no event shall Provider be liable for:

- Loss of revenue or profit
- Loss of data (unless caused by Provider's gross negligence)
- Indirect, incidental, or consequential damages

**Maximum liability** is capped at the total amount paid by Client under this Agreement.

### 8.4 Client Responsibilities

Client agrees to:

- Provide timely feedback and approval on deliverables
- Provide third-party API keys (payment processors, shipping provider, Google OAuth)
- Arrange and pay for hosting services (Vercel, Supabase, Fly.io, etc.)
- Test the application thoroughly before production launch
- Maintain regular backups

***

## 9. CHANGE REQUESTS & SCOPE MANAGEMENT

### 9.1 Scope Lock

The scope of work is fixed as defined in this Agreement and the attached PRD. No additional features or scope changes will be made without a written change order.

### 9.2 Change Order Process

If Client requests new features or modifications:

1. Client submits a written change request
2. Provider estimates time and cost impact
3. Client approves the change order in writing
4. Additional fees and timeline adjustments are agreed
5. Work begins only after approval and payment (if applicable)

### 9.3 Emergency Changes

Urgent production fixes (critical bugs) will be addressed at no additional cost. Non-critical bugs found after launch will be handled under the Maintenance section (Section 11).

***

## 10. TESTING & ACCEPTANCE

### 10.1 Testing Responsibility

Provider will:

- Perform unit and integration testing during development
- Conduct a staging environment QA phase
- Provide a testing checklist to Client

Client will:

- Perform user acceptance testing (UAT)
- Test all core features in staging before production
- Approve or reject deliverables within 5 business days

### 10.2 Acceptance Criteria

Deliverables are considered accepted when:

- All features in the PRD are functional
- Security and performance meet requirements
- Client signs a delivery acceptance form

### 10.3 Minor Issues

Small bugs or formatting issues discovered post-acceptance will be fixed within 5 business days at no additional charge (up to 10 hours).

***

## 11. SUPPORT & MAINTENANCE (Post-Launch)

### 11.1 Included Support (30 days post-launch)

For 30 days after production launch, Provider will:

- Fix critical production bugs (defined as: system downtime, data loss, payment failures)
- Respond to urgent issues within 24 hours
- Provide minor improvements or tweaks (up to 5 hours/week)

### 11.2 Post-Warranty Support

After 30 days, support is available as a separate service agreement at [Amount] per month, including:

- Bug fixes and patches
- Performance optimization
- Security updates
- Minor feature additions (up to 10 hours/month)

***

## 12. HOSTING & INFRASTRUCTURE

### 12.1 Provider Responsibility

Provider will:

- Set up development, staging, and production environments
- Configure CI/CD pipelines
- Provide deployment documentation
- Transfer credentials and admin access to Client

### 12.2 Client Responsibility

Client will pay for and maintain:

- Vercel hosting (storefront/admin)
- Supabase Postgres database
- Fly.io or similar (API server)
- Third-party API services (payment processors, shipping provider, Google Cloud)
- Email/domain services

Estimated monthly infrastructure cost: **[Amount] PHP**, variable based on usage.

***

## 13. DATA & PRIVACY

### 13.1 Data Ownership

All customer data, product information, and order data belongs to Client. Provider will not use this data for any purpose other than development and support.

### 13.2 GDPR & PDPA Compliance

Provider will design the system to support:

- GDPR compliance (EU customers)
- Philippines Data Privacy Act (PDPA) compliance (local customers)

Client is responsible for:

- Data retention policies
- Customer consent management
- Privacy policy (Provider can provide a template)

### 13.3 Data Backup & Recovery

Provider will configure:

- Daily automated Supabase backups
- Point-in-time recovery capability
- Disaster recovery procedures

Client is responsible for testing backup recovery procedures quarterly.

***

## 14. TERMINATION

### 14.1 Termination by Agreement

Either party may terminate this Agreement with 2 weeks' written notice if:

- The other party materially breaches and does not cure within 10 business days
- Circumstances prevent completion (force majeure)

### 14.2 Termination by Client

If Client terminates without cause:

- Provider will invoice for all completed work to date plus 50% of remaining milestone value
- Client receives delivery of all work completed to date
- All credentials and documentation are transferred to Client

### 14.3 Surviving Obligations

Sections that survive termination include:

- Intellectual Property (Section 6)
- Confidentiality (Section 7)
- Liability Limitations (Section 8)

***

## 15. DISPUTE RESOLUTION

### 15.1 Good Faith Negotiation

Before litigation or arbitration, the parties agree to attempt good-faith resolution between senior representatives.

### 15.2 Mediation

If negotiation fails, the parties agree to submit to mediation under the rules of [Philippine Mediation/Arbitration Board or similar].

### 15.3 Governing Law

This Agreement is governed by the laws of the Philippines (or [Jurisdiction] if international).

***

## 16. GENERAL TERMS

### 16.1 Entire Agreement

This Agreement (including the attached PRD and any accepted change orders) constitutes the entire understanding between the parties. Any prior agreements or conversations are superseded.

### 16.2 Amendments

Amendments must be in writing and signed by both parties.

### 16.3 Force Majeure

Neither party is liable for delays caused by acts of God, natural disasters, pandemics, or similar events beyond reasonable control. Provider will resume work as soon as practicable.

### 16.4 Relationship

This is a contract for services, not an employment relationship. Provider is an independent contractor.

### 16.5 Waiver

Failure to enforce any provision does not constitute a waiver of that provision.

***

## 17. SIGNATURES

**SERVICE PROVIDER:**

Signature: ________________________

Name (print): ________________________

Title: ________________________

Date: ________________________

Company (if applicable): ________________________

***

**CLIENT:**

Signature: ________________________

Name (print): ________________________

Title: ________________________

Date: ________________________

Company (if applicable): ________________________

***

***

## APPENDIX A: STATEMENT OF WORK (SOW)

*(See attached PRD as definitive feature specification)*

***

## APPENDIX B: PAYMENT SCHEDULE

*(Insert specific dates and amounts as negotiated)*

***

## APPENDIX C: THIRD-PARTY API CREDENTIALS REQUIREMENT

**Client will provide by [Date]:**

- Payment provider API keys and webhook secrets as required for enabled integrations (live and test)
- Tracking provider API Key
- Google Cloud OAuth Client ID and Secret
- Supabase project URL and API key (if Client creates account)

***

**End of Agreement**

***

## How to Use These Documents

1. **PRD**: Share with stakeholders, technical team, and Client to ensure alignment on features, timeline, and success metrics. Update the approval table with actual names and signatures.

2. **Service Agreement**: Have both parties review with legal counsel if needed. Customize:
   - Payment amounts and schedule
   - Dates and timelines
   - Liability caps
   - Dispute resolution jurisdiction
   - Support pricing and terms
   - Hosting and infrastructure costs

3. **Before Signing**: Ensure both parties have:
   - Reviewed all deliverables and acceptance criteria
   - Understood what is in-scope vs. out-of-scope
   - Agreed on payment terms and schedule
   - Confirmed third-party API requirements
