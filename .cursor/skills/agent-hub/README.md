# agent-hub

**agent-hub** is a **documentation skill** for anyone who uses AI assistants (or teams of agents) on real software projects. It gives you a **shared map** of how work should flow: intent, policy, context, planning, routing, execution, tools, verification, memory, recovery, and release awareness, without tying you to one vendor or framework.

Use it when you want agents to **stop guessing** where orchestration lives in your repo and to **follow the same guardrails** you care about.

---

## Plug-and-play (single entry, AI decides the route)

You do **not** need to open architecture files in order before every task.

1. **Install** the skill (see **Install** below).
2. Give the AI **one instruction** (see **Copy-paste prompts** and **Use cases**).
3. The AI follows **`commands/agent-hub.md`**: it reads **`agent/operating-model.md`**, matches your goal to a **task class (A–J)** and a **routing table**, then opens **only** the right follow-up doc or command (for example **`commands/map.md`** or **`architecture/08-memory-pipelines.md`**).

That is the **plug-and-play** model: **one dispatcher**, **user states desire**, **model picks** the smallest safe path. Optional **Cursor** (or other) slash commands are thin shortcuts to the same specs; see **`commands/README.md`**.

---

## Use cases (what you want → what the AI should run)

| What you want (examples) | AI should start from | Typical follow-on |
|---------------------------|----------------------|-------------------|
| “Figure out orchestration in this repo” / “Where does X live?” | **`commands/agent-hub.md`** | **`commands/map.md`**, then one **`architecture/NN-*.md`** |
| “Big picture / refactor plan / audit” | **`commands/agent-hub.md`** | **`commands/architect.md`** |
| “How does memory work here?” / “Session vs extracted memory” | **`commands/agent-hub.md`** | **`commands/memory.md`** |
| “Resume vs rewind” / “Reconnect behavior” | **`commands/agent-hub.md`** | **`commands/recovery.md`** |
| “What proves quality?” / “CI gates” | **`commands/agent-hub.md`** | **`commands/verify.md`** |
| “We only had time for part of the review” | **`commands/agent-hub.md`** | **`commands/next-pass.md`** |
| “I already know I need the memory layer only” | (optional) skip dispatcher | **`architecture/08-memory-pipelines.md`** + **`commands/memory.md`** if you want the full workflow |
| “Multi-step architecture work, specialist help” | **`commands/agent-hub.md`** | **`subagents/README.md`** and a matching **`subagents/*.md`** when the dispatcher says so |

If the user names a **specific** command, the AI can open **`commands/<name>.md`** directly; the dispatcher is for **unclear** or **broad** intent.

---

## Copy-paste prompts

Use these after the skill is available in context (or after you `@`-reference **`agent-hub/`** in your IDE).

**Default (let the AI route):**

```text
Use the agent-hub package. Run the workflow in commands/agent-hub.md: infer my goal from what I say next, state your route (task class + files you will read), then execute the smallest path. My goal: <describe in your own words>.
```

**Hands-off (“you choose everything”):**

```text
agent-hub: read commands/agent-hub.md and agent/operating-model.md, pick the right command and architecture docs for this repository, and produce the next artifact (map, plan, or analysis) without loading every architecture file.
```

**Targeted (you name the outcome):**

```text
agent-hub: follow commands/map.md and produce the orchestration layer table for this workspace with evidence paths from the actual tree.
```

Replace the last line with **`commands/architect.md`**, **`commands/memory.md`**, **`commands/recovery.md`**, **`commands/verify.md`**, or **`commands/next-pass.md`** when you already know the workflow.

---

## What this is for

| Situation | How agent-hub helps |
|-----------|---------------------|
| You paste long prompts and hope the model picks the right concern | You route through **layers** and **commands** so one layer is loaded at a time. |
| “Memory”, “resume”, and “tools” get mixed up | **Architecture** docs split responsibilities; **memory** and **recovery** have their own chapters and command specs. |
| Refactors touch permission or session boundaries | **`agent/editing-rules.md`** and policy layers call out high-risk areas before edits. |
| You use Cursor, Claude Code, or another host | **Normative text** lives in Markdown here; optional **`.cursor/commands/`** (or similar) can be thin wrappers. See **`commands/README.md`**. |

agent-hub does **not** run your app, replace tests, or ship application code. It is **navigation and rules for humans and LLMs** working on code that may live **outside** this folder.

---

## Who should read this

- **You** driving an AI from the IDE: skim this file, then **`architecture/00-scope-and-rules.md`** and **`indexes/orchestration-map.md`**.
- **You** configuring agents: start from **`SKILL.md`**, then **`agent/README.md`** and **`agent/operating-model.md`**.
- **Maintainers** evolving the repo: follow **Documentation maintenance** below and the collection **[CONTRIBUTING.md](../CONTRIBUTING.md)**.

---

## Quick start

**Fastest (plug-and-play):** Use a **Copy-paste prompt** above so the AI runs **`commands/agent-hub.md`** first.

**Manual (you want the map in hand):**

1. **`architecture/00-scope-and-rules.md`**
2. **`indexes/orchestration-map.md`**
3. Then either **`commands/agent-hub.md`** or the specific **`commands/*.md`** from **`indexes/command-index.md`**, or **`subagents/README.md`** for a specialist.

**Cursor-style slash commands:** Attach **`COMMANDS.md`** and use its copy-paste prompt so the AI creates **`.cursor/commands/`** launchers for you, or add thin files manually; see **`commands/README.md`** and **`indexes/command-index.md`**.

---

## What is inside this folder

- **`architecture/`** — One doc per orchestration layer (intent through observability and human gates).
- **`indexes/`** — Command index, orchestration map, glossary, decisions, sibling-skill routing.
- **`diagrams/`** — Flow and sequence views (including Mermaid where useful).
- **`templates/`** — Inspection passes, architecture notes, sequences.
- **`agent/`** — Operating model, task routing, editing rules for agents.
- **`subagents/`** — Specialist profiles that link into canon instead of duplicating every layer.
- **`commands/`** — Canonical workflow specs (purpose, read-first, output, guardrails). **`commands/README.md`** explains IDE integration.
- **`COMMANDS.md`** — End-to-end guide to paste into chat: AI resolves package root, writes **`.cursor/commands/`** wrappers, lists what it created.
- **`SKILL.md`** — Machine-readable entry for skill-capable hosts.
- **`.claude-plugin/`** — **`marketplace.json`** (same pattern as other collection skills), plus **`capabilities.md`** and **`routing-rules.md`**.

Docs here are **authoritative for navigation and boundaries** when work is guided by agent-hub. If **application source** disagrees, the code wins for **runtime**; **update these docs** after you verify behavior.

---

## This package versus optional host files

Everything **shipped as this skill** lives under **`agent-hub/`**. Normative workflows are **`commands/*.md`** and **`SKILL.md`**.

**Editor launchers** (for example `.cursor/commands/` at repo root) are **optional**. They are not required. If a launcher disagrees with **`commands/*.md`**, fix the launcher. Details: **`indexes/command-index.md`**.

---

## Optional subtrees

An **`external/`** directory under **`agent-hub/`**, if present, is **not** part of the orchestration canon unless maintainers document that bridge. Prefer **`indexes/orchestration-map.md`** and **`architecture/*.md`**. Record coupling in **`indexes/decisions-index.md`** and **`docs/decisions/`** when needed.

---

## What agent-hub is not

- Not a substitute for **tests** or **CI**.
- Not one README that replaces the **layered** architecture set.
- Not approval to add **global mutable state** without design review (see **`architecture/03-context-and-state.md`**).
- Not a promise that every layer exists in every workspace; you still fill the map for **your** repo.

---

## Reading order

| Audience | Order |
|----------|--------|
| **New to this package** | This **`README.md`** → **`architecture/00-scope-and-rules.md`** → **`indexes/orchestration-map.md`** → **`indexes/glossary.md`** |
| **LLM agent** | **`SKILL.md`** → **`agent/README.md`** → **`agent/operating-model.md`** → **`subagents/README.md`** if delegating → relevant **`architecture/*.md`** per task |
| **Architect / review** | **`commands/architect.md`** → **`architecture/04-planning-and-routing.md`** → **`diagrams/delegation-flow.md`** |
| **Memory / recovery** | **`commands/memory.md`** or **`commands/recovery.md`** → **`architecture/08-memory-pipelines.md`** / **`09-recovery-and-resume.md`** |

---

## How agents should use this package

1. Classify the task (intent, policy, execution, verification, memory, recovery, release).
2. Open **one** architecture doc for the matching layer; avoid loading the full tree unless you are doing a full audit.
3. Follow **`agent/editing-rules.md`** before editing application source outside this folder.
4. Prefer the **smallest route**: **`commands/agent-hub.md`** → command spec and/or **`subagents/*.md`** → one architecture doc → action.

---

## Documentation maintenance

- Update **`architecture/*.md`** when cross-cutting behavior or boundaries change.
- Add command specs under **`commands/`** and a row in **`indexes/command-index.md`**.
- Add **`subagents/*.md`** profiles, update **`subagents/README.md`**, and extend the subagent table in **`indexes/command-index.md`**.
- Use **`templates/`** for inspections; record major decisions in **`docs/decisions/`** and **`indexes/decisions-index.md`**.
- Do not add shared bootstrap or session fields without documenting impact in **`architecture/03-context-and-state.md`** and maintainer agreement.

---

## Indexes and editor integration

- **`indexes/README.md`** — Map of indexes.
- **`indexes/command-index.md`** — Command list and launcher naming (**`agent-hub-*`**).
- **`indexes/decisions-index.md`** — Architecture decision log pointers.

Optional **`.cursor/commands/`** launchers should point at the same workflows as **`commands/*.md`**. See **`commands/README.md`**.

---

## Install

From the JustineDevs collection (example):

```bash
npx skills add https://github.com/justinedevs/collection --skill agent-hub
```

Adjust the URL or flags if your publisher documents a different flow.

---

## License

License terms come with the distribution that contains this package (for example **`LICENSE`** at the collection root). Follow that file when contributing.
