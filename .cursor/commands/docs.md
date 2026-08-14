# /docs

**Strict scope:** When answering documentation questions or loading doc context, read **only** from these roots. All files and directories under them are the canonical doc set.

---

## 1. `.cursor/llm` (all files and directories)

LLM context and indexed project/docs. Read everything under `.cursor/llm/`.

### Root
- `llm.txt` – Project/LLM context index
- `README.md` – LLM context overview (if present)

### `.cursor/llm/*` (all files)
- Any `.txt` files in this directory

---

## 2. `docs/` (all files and directories)

Canonical spec, blueprint, and runbook docs. Read everything under `docs/`.

### `docs/`
- `spec.md` – Universal Music Store Platform specification
- `privacy-terms.md` – PRD, service agreement, GDPR/PDPA compliance
- `validation-truth-matrix.md` – Verification commands and audit surface

### `docs/runbooks/`
- `GUIDE.md` – Deployment and operational runbook
- `VERCEL.md` – Vercel-specific deployment notes
- `PAYMENT-INTEGRATION.md` – Payment provider setup

---

## Rule

For any request that needs documentation or context: **strictly read from `.cursor/llm` and `docs/`** (all files and directories listed above). When in doubt, prefer `docs/spec.md` as the primary entry point.
