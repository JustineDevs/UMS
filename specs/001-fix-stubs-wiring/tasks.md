# Tasks: Stabilize Unfinished Commerce Flows

**Input**: Design documents from `/specs/001-fix-stubs-wiring/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/stabilization-contract.md

**Tests**: Targeted tests are required for each repaired route, validation boundary, or workflow path touched in this feature.

**Organization**: Tasks are grouped by user story so each repaired slice can be validated independently.

## Phase 1: Setup (Shared Context)

**Purpose**: Establish the feature lane and ground the stabilization pass in real repo evidence.

- [x] T001 Create Spec Kit feature artifacts in `specs/001-fix-stubs-wiring/`
- [x] T002 Update `AGENTS.md` to point Spec Kit context at `specs/001-fix-stubs-wiring/plan.md`
- [x] T003 Audit likely incomplete hotspots across `apps/storefront/src`, `apps/admin/src`, `apps/medusa/src`, and shared packages

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capture the highest-risk mismatches and add coverage before broader repairs.

- [x] T004 Add targeted regression coverage for admin commerce lookup route behavior in `apps/admin/src/lib/` or `apps/admin/src/app/api/admin/commerce/products/lookup/`
- [x] T005 [P] Add targeted regression coverage for checkout finalization and COD handler edge cases in `apps/storefront/src/lib/`
- [x] T006 [P] Add targeted regression coverage for J&T webhook route logic in `apps/medusa/src/api/hooks/jnt/`

**Checkpoint**: The highest-risk route and workflow boundaries have executable safety rails.

---

## Phase 3: User Story 1 - Complete Primary Commerce Flows (Priority: P1) 🎯 MVP

**Goal**: Remove broken route resolution and incomplete primary flow behavior from the most visible commerce paths.

**Independent Test**: Admin catalog lookup returns the expected filtered products, storefront checkout completion paths return explicit outcomes, and no primary route terminates in a dead or ambiguous state.

- [x] T007 [US1] Repair admin commerce product lookup query semantics in `apps/admin/src/app/api/admin/commerce/products/lookup/route.ts`
- [x] T008 [US1] Align the admin commerce search UI with the route contract in `apps/admin/src/components/cms/CmsCommerceSearch.tsx`
- [x] T009 [US1] Verify and harden storefront checkout finalization route wiring in `apps/storefront/src/app/api/payments/checkout-intents/[correlationId]/finalize/route.ts`
- [x] T010 [US1] Verify and harden COD place-order route wiring in `apps/storefront/src/app/api/checkout/cod-place-order/route.ts`

**Checkpoint**: Primary route-driven commerce paths have explicit and testable behavior.

---

## Phase 4: User Story 2 - Align Validation and Business Rules (Priority: P2)

**Goal**: Make equivalent business rules and workflow transitions behave consistently across the affected entry points.

**Independent Test**: Invalid transitions are rejected before mutation, equivalent validation rules yield the same results across touched surfaces, and route handlers no longer rely on ambiguous fallbacks.

- [x] T011 [US2] Audit and repair POS commit-sale transition and fallback behavior in `apps/admin/src/app/api/pos/medusa/commit-sale/route.ts` and `apps/admin/src/lib/pos-commit-sale-route-logic.ts`
- [x] T012 [US2] Reconcile shared checkout/payment-attempt error handling in `apps/storefront/src/lib/payment-attempt-route-logic.ts`
- [x] T013 [P] [US2] Reconcile shared validation usage in `packages/validation/src` and any touched admin/storefront callers

**Checkpoint**: Repaired logic boundaries reject invalid inputs consistently and preserve recoverable state.

---

## Phase 5: User Story 3 - Remove Hidden Incomplete Areas (Priority: P3)

**Goal**: Replace hidden incomplete behavior with explicit, traceable implementation or intentional failure modes.

**Independent Test**: Previously ambiguous backend/webhook paths either complete correctly or fail explicitly with a clear signal.

- [x] T014 [US3] Audit and repair J&T webhook processing fallbacks in `apps/medusa/src/api/hooks/jnt/route.ts` and `apps/medusa/src/api/hooks/jnt/route-logic.ts`
- [x] T015 [US3] Make any remaining touched unsupported paths explicit and traceable in the owning route or logic files

**Checkpoint**: Hidden incomplete behavior is no longer silently exposed in touched surfaces.

---

## Phase 6: Polish & Verification

**Purpose**: Prove the repaired slices and close the feature lane with evidence.

- [x] T016 [P] Run targeted tests for touched admin, storefront, and Medusa files
- [x] T017 Run repo-level verification that is practical for the touched scope (`lint`, targeted build/typecheck, targeted test commands)
- [x] T018 Document remaining intentionally deferred unsupported paths in `specs/001-fix-stubs-wiring/quickstart.md` or feature notes if any remain

## Dependencies & Execution Order

- Phase 1 is complete.
- Phase 2 should start before broad code edits so repairs are covered.
- User Story 1 is the MVP and should be completed before deeper validation and webhook cleanup.
- User Story 2 and User Story 3 may proceed in parallel once the highest-risk regression coverage exists.
- Polish starts after the intended repair slices are complete.

## Implementation Strategy

1. Lock the first confirmed mismatch with a targeted test.
2. Repair the owning route and UI contract together.
3. Move outward to shared logic and backend/webhook boundaries only after the primary route path is stable.
4. End with verification and explicit documentation for any intentionally unsupported leftovers.
