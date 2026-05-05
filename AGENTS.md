# AGENTS.md - Harness-Insight Repository

This repository is both:
- the source repository of the Harness-Insight SKILL, and
- a dogfooding environment where this SKILL is used to improve itself.

## Project Identity
- Type: Universal AI Self-Reflection and Improvement SKILL source repository
- Distribution: `npx skills add jerrywdlee/Harness-Insight` / `npx harness-insight`
- Specification: [SKILL.md](SKILL.md)

## Instructions for AI Agents Working in This Repository

### 0. Global Language Policy (Outer Prompt Contract)
- Respond in the same language as the user's latest question unless the user explicitly requests another language.
- Never translate machine-readable identifiers:
  - JSON keys
  - schema field names
  - tool argument names
  - CLI flags
  - path literals
  - metric names and formulas
- Keep code blocks and raw logs in original language unless the user explicitly asks to translate them.

### 1. Role
- You are a developer of this SKILL.
- If the user requests a feature addition or fix, directly edit the relevant files:
  - [scripts/](scripts/)
  - [templates/](templates/)
  - [bin/install.js](bin/install.js)

### 2. Structure Rules
- Adapters must always be implemented in both JS and Python as a pair:
  - naming: `scripts/adapters/<harness>.{js,py}`
- When adding a new harness, update all 4 areas together:
  1. Add `scripts/adapters/<harness>.{js,py}`
  2. Register in [scripts/extract.js](scripts/extract.js) and [scripts/extract.py](scripts/extract.py) (`detectHarness()` / `detect_harness()`)
  3. Update DETECT table and file layout in [SKILL.md](SKILL.md)
  4. Update harness-related entries in [skill.json](skill.json) `files[]` and [README.md](README.md)
- Raw logs are read-only.
- Output directory must be `.harness_insights/`, and auto-append behavior for `.gitignore` must be preserved.

### 3. Step 5 (APPLY) Scope
- Default scope is `project`. Do not change default to `global`.
- Wrapped apply marker must be used:
  - `<!-- harness-insight: <date> scope=<...> -->`

### 4. When Running `/harness-insight` (`/reflect`) in This Repository
- Execute full Step 1 to Step 5 flow in [SKILL.md](SKILL.md).
- For extraction-only use cases, use `/harness-insight extract` (do not add a standalone trigger).
1. Run all 5 steps against this repository's own session logs.
2. Use local extractors from this repository:
   - [scripts/extract.js](scripts/extract.js)
   - [scripts/extract.py](scripts/extract.py)
   Do not use `.agents/skills/harness-insight/...` for this repository's self-run.
3. For `project` scope, target order is:
   - `./AGENTS.md`
   - `./.github/copilot-instructions.md`
   - `./.cursor/rules/harness-insight.md`
4. Because this repository is the SKILL source, include at least one SKILL improvement hint in Section A.

### 5. Editing Policy
- Do not change documents unless requested by the user.
- [docs/detailed-design.md](docs/detailed-design.md) is the implementation-based source of truth for detailed design.
- Use Conventional Commits where possible:
  - `feat:`
  - `fix:`
  - `docs:`
  - `chore:`

### 6. Test and Run Commands
```bash
# Self-reflect (analyze this repository session)
npm run reflect

# Individual steps
npm run extract
npm run analyze
npm run apply -- --scope project
```

---

<!-- harness-insight: 2026-04-29 scope=project -->
# Harness-Insight Proposed Rules
generated_at: 2026-04-29
session: copilot/728d494b-dd8d-4d3c-ad38-5bd73d2235d5
mode: llm-fallback (copilot adapter was telemetry-heavy, so AI estimated directly from conversation history)

---

## Proposed Rule 1
- **Trigger**: User reported that score details were missing. Implementation did not emit `breakdown` and output spec was not fixed in both SKILL.md and templates.
- **Rule**: For report-related features, lock output samples first (human-readable and JSON structure) in both SKILL.md and templates before implementation.
- **Apply to**: AGENTS.md
- **Evidence**: On a separate PC with Antigravity, scoring table was emitted without detailed breakdown.

## Proposed Rule 2
- **Trigger**: After adding standalone `/extract-logs`, user said subcommand support was sufficient and asked to undo.
- **Rule**: Before introducing a new trigger or subcommand, explicitly confirm in one turn whether existing `/<trigger> <sub>` can satisfy the request.
- **Apply to**: AGENTS.md
- **Evidence**: A 5-file cross-cutting change was fully reverted a few turns later.

## Proposed Rule 3 (Required SKILL Improvement Hint)
- **Trigger**: Copilot adapter consumed 1824 telemetry events from `debug-logs/*/main.jsonl`, but `prompts/edits/interrupts` remained all zero. Same issue was seen in prior `/reflect` runs.
- **Rule (SKILL code action)**: Update `scripts/adapters/copilot.{js,py}` to support chat transcripts paths as first-class sources:
  - `%APPDATA%/Code/User/workspaceStorage/<ws>/GitHub.copilot-chat/transcripts/*.jsonl`
  - `chatSessions/*.json`
  Prefer files containing request or response style conversation events and ignore telemetry-only files.
- **Apply to**: SKILL code issue / `scripts/adapters/copilot.{js,py}`
- **Evidence**: Quantitative parser picked zero prompts/edits in two consecutive sessions.
<!-- /harness-insight -->
