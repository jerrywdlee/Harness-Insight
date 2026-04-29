# Harness-Insight

> Vibe coding セッションの **自己評価 ＝＞ 自己改善** ループを後付けする汎用 SKILL。
> このリポジトリ自身が SKILL パッケージです。

対応ハーネス: GitHub Copilot Chat / Cursor / OpenClaw / HermesAgent / Antigravity

## インストール

### 推奨：skills CLI 経由
```bash
npx skills add Harness-Insight
```

### または直接インストーラ実行
```bash
# 現在のプロジェクトに導入
npx harness-insight

# 任意ディレクトリに導入
npx harness-insight --dest skills/harness-insight
```

インストーラは以下を行います:
1. SKILL ファイル一式を `<project>/.skills/harness-insight/` にコピー
2. `.gitignore` に `/.harness_insights/` を自動追記
3. `AGENTS.md` に SKILL 存在マーカーを追記（既にあればスキップ）

## 使い方

導入後、対象プロジェクト内で AI Agent に **`/reflect`** と打つだけ。
あるいは手動で：

```bash
# Step 2: ログ抽出（Node が無ければ Python に自動フォールバック）
node .skills/harness-insight/scripts/extract.js
# あるいは
python .skills/harness-insight/scripts/extract.py

# Step 3: 解析
node .skills/harness-insight/scripts/analyze.js
# あるいは
python .skills/harness-insight/scripts/analyze.py
# あるいは
pwsh .skills/harness-insight/scripts/analyze.ps1

# Step 5: 反映スコープを 3 値選択 (none / project / global, 既定 project)
node .skills/harness-insight/scripts/apply.js
```

**JS / Python のいずれも利用不可** な場合は、AI Agent 自身が
[`templates/manual_extract_prompt.md`](templates/manual_extract_prompt.md) に従い
セッションログを直接取得して共通スキーマへ正規化します。

## 反映スコープ（Step 5）

| 値 | スコープ | 反映先 |
|---|---|---|
| `1` / `none` | 反映しない | （`proposed_rules.md` のみ残す） |
| `2` / `project` ★既定 | プロジェクト | `./AGENTS.md` → `./.github/copilot-instructions.md` → `./.cursor/rules/harness-insight.md` |
| `3` / `global` | グローバル | `~/.agents/AGENTS.md` → `%APPDATA%/Code/User/prompts/harness-insight.instructions.md` → `~/.cursor/rules/harness-insight.md` |

## ファイル構成

| パス | 役割 |
|---|---|
| [SKILL.md](SKILL.md) | SKILL 仕様（AI が参照） |
| [skill.json](skill.json) | skills CLI 用マニフェスト |
| [package.json](package.json) | npm パッケージ定義（`bin: harness-insight`） |
| [bin/install.js](bin/install.js) | インストーラ |
| [scripts/extract.js](scripts/extract.js) / [extract.py](scripts/extract.py) | ログ抽出（多言語） |
| [scripts/adapters/](scripts/adapters/) | ハーネス別アダプタ（JS / PY） |
| [scripts/analyze.js](scripts/analyze.js) / [analyze.py](scripts/analyze.py) / [analyze.ps1](scripts/analyze.ps1) | 定量解析（多言語） |
| [scripts/apply.js](scripts/apply.js) | Step5 反映（none/project/global） |
| [templates/](templates/) | LLM プロンプト・スキーマ・ルールテンプレ |
| [docs/設計書v1.md](docs/%E8%A8%AD%E8%A8%88%E6%9B%B8v1.md) / [docs/設計書v2.md](docs/%E8%A8%AD%E8%A8%88%E6%9B%B8v2.md) | 設計ドキュメント |

## 出力物（`.harness_insights/` 以下）

- `meta.json` — 検知したハーネス情報
- `normalized.jsonl` — 共通スキーマに変換したセッションログ
- `metrics.json` — 定量スコア
- `history.jsonl` — 履歴（トレンド表示用）
- `proposed_rules.md` — AGENTS.md 追記候補

## 安全性
- 解析は **別コンテキスト (`context: fork`)** で行い、メインセッションのトークンを汚染しない。
- 生ログは **読み取り専用**。
- ルール反映 (Step 5) は **必ずユーザー承認** を経由（無入力 = project）。

## ライセンス
MIT
