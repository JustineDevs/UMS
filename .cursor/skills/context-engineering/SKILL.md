---
name: context-engineering
description: Context Engineering patterns for AI development and prompting. Use when the user wants to reduce tokens, avoid lost-in-the-middle, and structure prompts using Skeleton-of-Thought, token-efficient diff updates, XML tagging, symbolic variables, negative constraints, or LLMBundle-style context packaging.
license: See repository LICENSE
---

# Context Engineering Skill

Modern LLMs bill you for every token you send. Large, unstructured prompts lead to higher cost and worse reasoning (lost-in-the-middle). This skill defines practical Context Engineering techniques and shows how to apply them in your current setup, regardless of which editor or AI product a user has.

---

## 0. Non‑Negotiable Pre‑Actions

Before any user applies these techniques, always do the following:

1. **Define the objective in one sentence.**  
   Example: “Add input validation to app.py and factor shared logic into utils/transform.py.”
2. **Limit the scope.**  
   Only include the files that matter for the current change, not the whole repo.
3. **Wrap context with hard boundaries.**  
   Use the XML tags in this skill (`<global_rules>`, `<file>`, `<task>`) so any LLM knows what is rules, what is code, and what is the task.
4. **State negative constraints.**  
   Always end prompts with instructions like “No preamble. No explanations. Output code or SEARCH/REPLACE blocks only.”
5. **Test on a small example first.**  
   Try the pattern on one small function or file before applying it to a large refactor. If the model output is noisy, tighten constraints and retry.

These pre‑actions are model‑ and tool‑agnostic and should be followed by every user to make the skill reliable.

---

## 1. Skeleton-of-Thought (SoT) Prompting

**Goal:** Give the model the *shape* of your code instead of full implementations.

**How it looks (blueprint instead of full file):**

```python
def process_data(input_str: str) -> dict:
    """Parses raw string into a structured dict."""
    ...

class ReportBuilder:
    """Builds JSON reports from normalized data."""

    def build(self, data: dict) -> str:
        """Return JSON summary."""
        ...
```

**Prompt pattern:**

```text
I am working on this project. Here is the skeleton:
<file name="pipeline.py">
def process_data(input_str: str) -> dict:
    """Parses raw string into a structured dict."""
    ...
</file>

Please implement process_data to parse JSON, handle errors, and return a dict.
```

**Execution steps:**
- Strip function bodies (keep signatures, docstrings, and class layout).
- Send only the skeleton when you want new logic or refactors.

---

## 2. Token-Efficient Diff Updates

**Goal:** Stop paying for full-file rewrites; request focused changes.

**Search/replace format:**

```text
Do not rewrite the whole file.
Respond only with SEARCH/REPLACE blocks in this format:

SEARCH:
old_code_block
REPLACE:
new_code_block
```

**Example usage:**

```text
Here is the current code in handler.py:
<file name="handler.py">
def handle(event):
    user = get_user(event["id"])
    # TODO: add logging and error handling
    return user
</file>

Update it to add logging and catch KeyError. Use SEARCH/REPLACE blocks only.
```

LLMs then return minimal patches instead of re-typing the file.

---

## 3. XML Tagging for Modular Context

**Goal:** Create hard boundaries between rules, files, and tasks so the model does not mix contexts.

**Pattern:**

```xml
<global_rules>
  - Follow PEP8.
  - Use snake_case for functions.
</global_rules>

<file name="utils.py">
def slugify(name: str) -> str:
    ...
</file>

<task>
Add a logging decorator to functions in utils.py and apply it to slugify.
</task>
```

**Why this works:** LLMs are trained to respect XML-like tags as structure. Wrapping each file or rule block in tags keeps the model from blending unrelated parts.

---

## 4. Symbolic Variables (Reusable Rules)

**Goal:** Define long rule sets once, then reference them by handle.

**Header section:**

```text
[RULE_STRICT_TYPES]:
  - Always use Python type hints.
  - Use Pydantic models for external I/O.

[RULE_STYLE]:
  - Use snake_case for functions and variables.
  - Add a one-line docstring to public functions.
```

**Later in the prompt:**

```text
Implement a user login function. Apply [RULE_STRICT_TYPES] and [RULE_STYLE].
```

This keeps the task-specific part short and readable while still enforcing strong constraints.

---

## 5. Negative Constraints (Token Filter)

**Goal:** Remove unneeded prose; pay only for code or the minimal output you want.

**Common constraints:**

```text
Constraints:
- No preamble.
- Do not explain the code.
- Output code only.
```

**Prompt example:**

```text
Refactor the following function to use early returns and clearer naming.
Constraints:
- No preamble.
- No explanation.
- Output code only.
```

---

## 6. LLMBundle and Context Packages

LLMBundle (e.g. Context-Engineering/llmbundle) acts as a context manager for multi-file projects.

**Desired behavior:**
- Wrap each file in `<file name="...">...</file>` tags.
- Include a header with `<global_rules>` and symbolic rule blocks.
- Omit noise files like `node_modules/`, build artifacts, and lockfiles.
- Optionally add a table of contents at the top:

```xml
<bundle_index>
  - app.py
  - utils/transform.py
  - tests/test_transform.py
</bundle_index>
```

With LLMBundle, your prompt to an AI agent becomes:

```xml
<global_rules>
  - Follow PEP8.
  - Prefer pure functions when possible.
</global_rules>

<bundle_index>
  - app.py
  - utils/transform.py
</bundle_index>

<file name="app.py">
  ...code...
</file>

<file name="utils/transform.py">
  ...code...
</file>

<task>
Add input validation to app.py and factor shared logic into utils/transform.py.
</task>
```

### Using llmbundle (optional helper)

If you have the external tool [`llmbundle`](https://github.com/vlasky/llmbundle) installed:

- Run `llmbundle` on the files or directories you want to share (see its README for exact commands and security guidance).
- Open the generated script (for example `project.sh`) and paste its contents into your LLM conversation.
- Treat the outer bash structure as a container and only modify file contents between the heredoc EOF markers, as described in the `llmbundle` header comments.

This skill does not require `llmbundle` and never executes it. It only describes how to use the tool if the user has chosen to install and verify it independently.

---

## 7. How To Apply This In Your Setup

1. **For new features:** Send a SoT skeleton of relevant files instead of full bodies.
2. **For edits:** Ask for SEARCH/REPLACE style diffs, not entire files.
3. **For multi-file work:** Wrap rules, files, and tasks in XML tags.
4. **For repeated rules:** Define symbolic variables like [RULE_*] once at the top and reference them later.
5. **For cost control:** Always end prompts with negative constraints (no preamble, no explanations) when you only need code or diffs.
6. **With LLMBundle:** Use it to automatically package your repo into XML-tagged, token-efficient context before sending it to an AI agent.

### Project-specific assets (Universal Music Store Platform)

This monorepo ships curated bundles, `[RULE_*]` blocks, and copy-paste templates under **`.cursor/context/`** (index: `.cursor/context/README.md`). Use them when scoping work across `apps/*`, `packages/*`, and Medusa or Supabase boundaries.

