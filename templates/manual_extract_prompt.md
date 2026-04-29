# Manual Extraction Prompt（Node も Python も使えない環境向け）

> 解析環境に Node.js も Python もインストールされていません。
> あなた（実行中の AI Agent）が **自力で** 直接ログを取得し、共通スキーマに正規化してください。

## 手順
1. 下記の検知優先順序で、**実行ホスト OS の標準 API（VS Code API / OS ファイルシステム / ユーザー添付ファイル等）** からセッションログを取得する。
2. 共通スキーマ（[`templates/normalized.schema.json`](../templates/normalized.schema.json)）に従って 1 イベント = 1 行で出力する。
3. 出力先は対象プロジェクトの `.harness_insights/normalized.jsonl`（無ければ作成）。
4. 同時に `.gitignore` に `/.harness_insights/` を追記する（重複時はスキップ）。
5. 完了後、解析フェーズへ進む際は [`templates/fallback_prompt.md`](fallback_prompt.md) を読み込み、定量指標を **力技で推計** する。

## 検知優先順序

| 優先 | Harness | パス例 |
|---|---|---|
| 1 | GitHub Copilot Chat | `%APPDATA%/Code/User/workspaceStorage/*/GitHub.copilot-chat/debug-logs/*` |
| 2 | Cursor | `%APPDATA%/Cursor/logs/**/*`, `~/.cursor/sessions/*.jsonl` |
| 3 | Claude Code | `~/.claude/projects/<encoded-cwd>/*.jsonl` |
| 4 | OpenAI Codex CLI | `~/.codex/sessions/*.jsonl`, `~/.codex/history/*.jsonl` |
| 5 | OpenClaw | `./.openclaw/sessions/*.jsonl` |
| 6 | HermesAgent | `./.hermes/runs/*/overview.txt` |
| 7 | Antigravity | `./.antigravity/transcripts/*.jsonl` |
| 99 | Unknown | ユーザーに添付 or パス入力を依頼 |

## 制約
- 生ログは **絶対に書き換えない**（読み取り専用）。
- API トークン・個人情報・ファイルパスのユーザー名部分は `***` でマスクする。
- 取得できなかった場合は、ユーザーに「該当ログファイルを添付してください」と 1 メッセージで依頼する（無断で推測しない）。
