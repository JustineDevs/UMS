# agent-hub: end-to-end commands guide (paste into chat)

Use this file as **one attachment** (or paste its full text) when you want the AI to **wire agent-hub workflows into your editor** without you hand-creating files.

---

## What you get

- **Canonical workflows** always live in **`commands/*.md`** inside the agent-hub package (same folder as **`SKILL.md`**).
- **Optional launchers** are **short** Markdown files under **`.cursor/commands/`** at your **workspace (repository) root**. They do not replace the specs; they only point the model at the right **`commands/*.md`** file.
- Other hosts (Claude Code, Windsurf, and so on) may use different folders; the **AI instructions** below still apply: create **thin pointers**, keep **one source of truth** in **`commands/`**.

---

## Copy-paste prompt for the user (optional)

After attaching **`COMMANDS.md`** (or this whole **`agent-hub/`** tree), send:

```text
I attached agent-hub/COMMANDS.md. Follow the section "Instructions for the AI" exactly: resolve the agent-hub package root, create or update .cursor/commands/ launchers at my workspace root using the wrapper template, use the preferred filenames table, and confirm the list of files you wrote. If my layout is ambiguous, state your assumption and proceed.
```

---

## Instructions for the AI

Run these steps **in order** when the user pastes this guide or attaches **`COMMANDS.md`**.

### 1. Resolve the agent-hub package root

The **package root** is the directory that contains **`SKILL.md`** and a **`commands/`** subfolder with **`commands/agent-hub.md`**.

- If **`COMMANDS.md`** is on disk at **`…/agent-hub/COMMANDS.md`**, the package root is the parent of **`COMMANDS.md`** (the **`agent-hub`** folder).
- If the user only pasted text, infer the root from their workspace: search for **`SKILL.md`** plus **`commands/agent-hub.md`** and use that directory.
- Let **`PACKAGE_REL`** be the path from the **workspace root** to that directory, using forward slashes (examples: **`agent-hub`**, **`skills/agent-hub`**, **`packages/agent-hub`**). If the workspace root **is** the package root, set **`PACKAGE_REL`** to **`.`** (and reference **`commands/...`** without a prefix).

### 2. Choose the launcher directory (Cursor)

- **Default:** **`<workspace_root>/.cursor/commands/`** (create **`commands`** if missing).
- If the user names another host or path, adapt: still write **thin** files that only **delegate** to the canonical **`commands/*.md`** paths; do not copy full workflow bodies into launchers.

### 3. Wrapper template (mandatory shape)

For each launcher file, use **only** delegation text. **Do not** paste the full content of **`commands/*.md`** into the launcher.

When **`PACKAGE_REL`** is **`.`**:

```markdown
# Title shown in the command picker

You are running an agent-hub workflow. Open and follow every section of **`commands/TARGET.md`** (relative to this repository root). Paths inside that spec are relative to the agent-hub package root (this repo). Execute Purpose, Read first, Expected output, Guardrails, and Stop conditions. Do not replace that file with a summary; work from the file.
```

When **`PACKAGE_REL`** is not **`.`**, replace the bold path with **`PACKAGE_REL/commands/TARGET.md`** (example: **`agent-hub/commands/agent-hub.md`**).

Use a clear **H1** (`# …`) so the picker label is obvious.

### 4. Files to create (preferred names)

Create one launcher per row (all under **`.cursor/commands/`**):

| Launcher filename | Open and follow (canonical spec) |
|-------------------|-----------------------------------|
| `agent-hub.md` | `PACKAGE_REL/commands/agent-hub.md` |
| `agent-hub-map.md` | `PACKAGE_REL/commands/map.md` |
| `agent-hub-architect.md` | `PACKAGE_REL/commands/architect.md` |
| `agent-hub-memory.md` | `PACKAGE_REL/commands/memory.md` |
| `agent-hub-recovery.md` | `PACKAGE_REL/commands/recovery.md` |
| `agent-hub-verify.md` | `PACKAGE_REL/commands/verify.md` |
| `agent-hub-next-pass.md` | `PACKAGE_REL/commands/next-pass.md` |

**Collision rule:** If **`agent-hub.md`** or another name already exists and is **not** an agent-hub delegation, **do not overwrite**. Use the **`agent-hub-*`** names above, or ask the user once. Prefer **`agent-hub-*`** prefixes for new files in busy repos.

**Legacy aliases (optional):** If the user wants short names, you may add **`repo-map.md`**, **`architect.md`**, **`memory.md`**, **`recovery.md`**, **`verify.md`**, **`next-pass.md`** only when they do not clash; each must use the same wrapper template pointing at the matching **`commands/*.md`**.

### 5. After writing files

Reply with:

1. **Workspace root** path you used.
2. **`PACKAGE_REL`** you used.
3. **List of launcher paths** created or updated.
4. **One-line reminder:** normative text remains in **`commands/*.md`**; launchers are disposable shortcuts.

### 6. If you cannot write files

Tell the user to copy the **wrapper template** manually, substitute **`PACKAGE_REL`** and **`TARGET.md`**, and save under **`.cursor/commands/`**. Point them to **`indexes/command-index.md`** for the full command table and naming notes.

---

## Quick reference: canonical command specs

| Spec | Role |
|------|------|
| `commands/agent-hub.md` | Dispatcher: classify intent, minimal route |
| `commands/map.md` | Orchestration layer table for this workspace |
| `commands/architect.md` | Architecture pass and phased plan |
| `commands/memory.md` | Memory pipelines |
| `commands/recovery.md` | Resume, rewind, reconnect |
| `commands/verify.md` | Verification and quality gates |
| `commands/next-pass.md` | Next inspection targets |

Specialist profiles live under **`subagents/`**; the dispatcher explains when to use them.

---

## Related docs (for humans)

- **`README.md`** — what agent-hub is, plug-and-play prompts
- **`SKILL.md`** — machine-readable entry for skill-capable hosts
- **`indexes/command-index.md`** — full index, legacy launcher names, how to add a command
- **`commands/README.md`** — short note on canonical vs launcher files

---

## Maintenance

When maintainers add **`commands/<new>.md`**, update this file’s **Files to create** table and **`indexes/command-index.md`** so paste-into-chat setup stays accurate.
