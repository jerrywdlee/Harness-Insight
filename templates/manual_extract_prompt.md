# Manual Extraction Prompt (for environments without Node or Python)

Node.js and Python are not available in the analysis environment.
You (the running AI agent) must directly collect logs and normalize them to the common schema.

## Language Policy
- If you need to ask follow-up questions, respond in the same language as the user's latest question unless the user explicitly requests another language.
- Do not translate machine-readable identifiers, paths, or schema keys.

## Procedure
1. Using the detection priority below, fetch session logs from host capabilities (VS Code API, OS filesystem, user attachments, etc.).
2. Normalize output as one event per line according to [`templates/normalized.schema.json`](../templates/normalized.schema.json).
3. Write to `.harness_insights/normalized.jsonl` under the target project (create if missing).
4. Append `/.harness_insights/` to `.gitignore` (skip if already present).
5. After extraction, read [`templates/fallback_prompt.md`](fallback_prompt.md) and estimate quantitative metrics.

## Detection Priority

| Priority | Harness | Example Path |
|---|---|---|
| 1 | GitHub Copilot Chat | `%APPDATA%/Code/User/workspaceStorage/*/GitHub.copilot-chat/debug-logs/*` |
| 2 | Cursor | `%APPDATA%/Cursor/logs/**/*`, `~/.cursor/sessions/*.jsonl` |
| 3 | Claude Code | `~/.claude/projects/<encoded-cwd>/*.jsonl` |
| 4 | OpenAI Codex CLI | `~/.codex/sessions/*.jsonl`, `~/.codex/history/*.jsonl` |
| 5 | OpenClaw | `./.openclaw/sessions/*.jsonl` |
| 6 | HermesAgent | `./.hermes/runs/*/overview.txt` |
| 7 | Antigravity | `./.antigravity/transcripts/*.jsonl` |
| 99 | Unknown | Ask the user to attach the log or provide a path |

## Constraints
- Never modify raw logs (read-only only).
- Mask API tokens, personal data, and username segments in file paths as `***`.
- If logs cannot be retrieved, send one clear request to the user to attach the relevant log file (do not fabricate data).
