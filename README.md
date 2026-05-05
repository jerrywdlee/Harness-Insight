Languages: English | [日本語](./docs/i18n/README.ja.md)

# Harness-Insight

> A universal SKILL that retrofits a **Self-Reflection ⇒ Self-Improvement** loop onto any vibe-coding session.
> This repository itself **is** the SKILL package.

Supported harnesses: GitHub Copilot Chat / Cursor / **Claude Code** / **OpenAI Codex CLI** / OpenClaw / HermesAgent / Antigravity

## Install

### Recommended: via the skills CLI
```bash
npx skills add jerrywdlee/Harness-Insight
```

### Or run the installer directly
```bash
# install into the current project
npx harness-insight

# install into a specific directory
npx harness-insight --dest skills/harness-insight
```

The installer will:
1. Copy the SKILL files into `<project>/.agents/skills/harness-insight/`
2. Append `/.harness_insights/` to `.gitignore` automatically
3. Insert a marker block into `AGENTS.md` (skipped if already present)

## Usage

After installation, type **`/harness-insight`** (preferred) or `/reflect` to your AI agent inside the target project.

### Subcommands

| Trigger | What it does |
|---|---|
| `/harness-insight` (preferred) / `/reflect` | Run the full Step 1–5 loop |
| `/harness-insight extract` | **Extract only** (Step 1+2). Useful for projects with multiple sessions |
| `/harness-insight list` | List detected sessions only (no extraction) |

### Manual commands

```bash
# Step 2: extract logs (auto-falls back to Python if Node is missing)
node .agents/skills/harness-insight/scripts/extract.js
# or
python .agents/skills/harness-insight/scripts/extract.py

# Multi-session helpers
node .agents/skills/harness-insight/scripts/extract.js --list
node .agents/skills/harness-insight/scripts/extract.js --session <substring> --out .harness_insights/<name>.jsonl
node .agents/skills/harness-insight/scripts/extract.js --session <substring> --out .harness_insights/all.jsonl --append

# Step 3: analyze
node .agents/skills/harness-insight/scripts/analyze.js
# or
python .agents/skills/harness-insight/scripts/analyze.py
# or
pwsh .agents/skills/harness-insight/scripts/analyze.ps1

# Step 5: pick an apply scope (none / project / global, default = project)
node .agents/skills/harness-insight/scripts/apply.js
```

When **neither Node nor Python** is available, the AI agent itself follows
[`templates/manual_extract_prompt.md`](templates/manual_extract_prompt.md) to fetch the session log
and normalize it into the common schema.

## Apply scopes (Step 5)

| Value | Scope | Target file (priority) |
|---|---|---|
| `1` / `none` | Do not apply | (only keeps `proposed_rules.md`) |
| `2` / `project` ★default | Per-project | `./AGENTS.md` → `./.github/copilot-instructions.md` → `./.cursor/rules/harness-insight.md` |
| `3` / `global` | Per-user (global) | `~/.agents/AGENTS.md` → `%APPDATA%/Code/User/prompts/harness-insight.instructions.md` → `~/.cursor/rules/harness-insight.md` |

## Repository layout

| Path | Role |
|---|---|
| [SKILL.md](SKILL.md) | SKILL specification (read by the AI) |
| [skill.json](skill.json) | Manifest for the skills CLI |
| [package.json](package.json) | npm package definition (`bin: harness-insight`) |
| [bin/install.js](bin/install.js) | Installer |
| [scripts/extract.js](scripts/extract.js) / [extract.py](scripts/extract.py) | Log extraction (multi-language) |
| [scripts/adapters/](scripts/adapters/) | Per-harness adapters (JS / PY) |
| [scripts/analyze.js](scripts/analyze.js) / [analyze.py](scripts/analyze.py) / [analyze.ps1](scripts/analyze.ps1) | Quantitative analysis (multi-language) |
| [scripts/apply.js](scripts/apply.js) | Step 5 apply (none/project/global) |
| [templates/](templates/) | LLM prompts, schemas, rule templates |
| [docs/detailed-design.md](docs/detailed-design.md) | Detailed design document |

## Outputs (under `.harness_insights/`)

- `meta.json` — detected harness info
- `normalized.jsonl` — session log normalized to the common schema
- `metrics.json` — quantitative scores
- `history.jsonl` — history (used for trend reporting)
- `proposed_rules.md` — candidate rules for AGENTS.md

## Safety
- Analysis runs in a **forked context (`context: fork`)** so it never pollutes the main session's tokens.
- Raw logs are **read-only**.
- Step 5 (apply) **always requires explicit user approval** (empty input = `project`).

## License
MIT
