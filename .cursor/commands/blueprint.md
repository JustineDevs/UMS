# /blueprint
# Purpose: Execute Full Production Hardening with Zero-Slop Enforcement.

- PRE-ACTION: Load .cursor/rules/AGENTS.mdc and .cursor/rules/sprint-commitments.mdc.
- EXECUTE: Run the 8-step Hardening Procedure (Review, QA, Audit, Maturity, OWASP, UX, Design, Onboarding).
- ZERO-SLOP ENFORCEMENT:
    1. NO PLACEHOLDERS: If a "High" severity weakness is found, write the FULL fix immediately. Do not use "// implementation here".
    2. NO DUPLICATION: Before fixing, check if a utility already exists. Refactor, don't duplicate.
    3. NO APOLOGIES: If the audit finds a bug I previously missed, do not apologize. Just list the fix in the "Hardening Findings Log".
    4. CONTEXT RETENTION: Stay focused on the and Spec Lock architecture. Do not suggest generic solutions that bypass these security gates.
- OUTPUT: 
    1. The "Hardening Findings Log" (Table: Component | Severity | Finding | Fix Status).
    2. Immediate code blocks for all "Critical" and "High" findings.
