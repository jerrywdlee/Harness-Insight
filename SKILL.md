---
name: harness-insight
description: |
  Vibe coding セッションの自己評価＝＞自己改善ループを実行する汎用 SKILL。
  GitHub Copilot / Cursor / Claude Code / OpenAI Codex CLI / OpenClaw / HermesAgent / Antigravity など各種 AI ハーネスのセッションログを
  共通スキーマに正規化し、別コンテキスト（context: fork）でメタ分析を行い、
  ユーザー向けコーチングと AGENTS.md 系ファイルへのルール追記（プロジェクト/グローバル選択可）を行う。
  USE FOR: /reflect, セッション振り返り, AI 委任度スコア算出, プロンプト改善, AGENTS.md 自動更新,
  機会損失検知, 強制停止(interrupt)分析。
  DO NOT USE FOR: 通常のコード生成タスク、単発のリファクタ依頼。
trigger:
  - "/harness-insight"          # 推奨（優先）
  - "/reflect"                  # 後方互換エイリアス
  - "/self-review"
  - セッション終了時の自動起動（任意）
subcommands:
  - "/harness-insight extract"  # Step 1+2 のみ実行（複数セッション PJ 用）
  - "/harness-insight list"     # 検知セッション一覧のみ表示
install:
  - "npx skills add Harness-Insight"
---

# Harness-Insight SKILL：AI 自己評価 ＆ 自己改善

> このリポジトリ自身が SKILL パッケージです。`npx skills add Harness-Insight` で他プロジェクトにインストールできます。

## 0. 前提
- 本 SKILL は **対象プロジェクトのルートで実行** されることを前提とする。
- 一時成果物は `.harness_insights/` に保存し、必ず `.gitignore` に登録する。
- 分析は **必ず別コンテキスト (`context: fork`)** で行い、メインセッションのトークンを汚染しない。

## 1. 実行フローさ（5 ステップ）

```
[Step 1] DETECT   → ハーネス種別を判定
[Step 2] EXTRACT  → 多言語フォールバック（JS → Python → Agent 自力）で正規化
[Step 3] ANALYZE  → 多言語パーサー → LLM フォールバック
[Step 4] REPORT   → 二元化レポート（Human / System）
[Step 5] APPLY    → 反映スコープを 3 値選択（none / project / global）
```

### 1.1 サブコマンド

| トリガー | 動作 | 用途 |
|---|---|---|
| `/harness-insight` (推奨) / `/reflect` | Step 1 〜 5 を全実行 | 通常の振り返り |
| `/harness-insight extract` | **Step 1 + 2 のみ**（抽出だけ） | 複数セッションを持つ PJ で、それぞれのセッションを個別に保存・貄めるようなケース |
| `/harness-insight list` | 検知されたセッション一覧を表示するのみ | 抽出対象セッションを選ぶ前の下調べ |

---

## Step 1: DETECT — ハーネス種別判定

| 優先 | Harness | 検知パス（例） |
|---|---|---|
| 1 | GitHub Copilot Chat | `%APPDATA%/Code/User/workspaceStorage/*/GitHub.copilot-chat/transcripts/*.jsonl`（優先：実対話履歴）<br>`%APPDATA%/.../GitHub.copilot-chat/debug-logs/*`（フォールバック：telemetry） |
| 2 | Cursor | `%APPDATA%/Cursor/logs/**/*`, `~/.cursor/sessions/*.jsonl` |
| 3 | Claude Code | `~/.claude/projects/<encoded-cwd>/*.jsonl` |
| 4 | OpenAI Codex CLI | `~/.codex/sessions/*.jsonl`, `~/.codex/history/*.jsonl` |
| 5 | OpenClaw | `./.openclaw/sessions/*.jsonl` |
| 6 | HermesAgent | `./.hermes/runs/*/overview.txt` |
| 7 | Antigravity | `./.antigravity/transcripts/*.jsonl` |
| 99 | Unknown | ユーザーに保存先を問い合わせ |

判定後、`.harness_insights/meta.json` に `{ "harness": "...", "source_path": "..." }` を記録。

---

## Step 2: EXTRACT — ログ取得と正規化（多言語フォールバック）

### 2.1 共通スキーマ（Standardized JSON）

`.harness_insights/normalized.jsonl` に **1 イベント 1 行** で出力。

```json
{
  "ts": "2026-04-29T10:15:32.120Z",
  "actor": "user | ai | system",
  "action_type": "prompt | ai_response | code_edit | tool_call | interrupt | error",
  "content": "発話本文 or diff (unified format)",
  "meta": { "tokens_in": 0, "tokens_out": 0, "files": ["src/foo.ts"], "tool": "edit_file", "duration_ms": 0 }
}
```

### 2.2 抽出フォールバック・チェーン（必須順序）

| 順 | 条件 | 実行 |
|---|---|---|
| 1 | `node -v` が成功 | `node scripts/extract.js` |
| 2 | `python --version` または `python3 --version` が成功 | `python scripts/extract.py` |
| 3 | 上記いずれも不可 / クラッシュ | 実行中の AI Agent が [templates/manual_extract_prompt.md](templates/manual_extract_prompt.md) に従い **自力で** ログを取得・正規化する |

### 2.3 オプション（複数セッション PJ 用）

| オプション | 効果 |
|---|---|
| `--list` | 検知したセッションパスを一覧表示して終了（抽出しない） |
| `--session <substring>` | 検知したセッションのうち、パスに該当部分文字列を含むものだけ抽出 |
| `--out <path>` | 出力先ファイルを変更（例: `.harness_insights/sessionA.jsonl`） |
| `--append` | `--out` と併用して追記（複数セッションを貄めるケース） |

実行例：
```bash
# 1) セッション一覧確認
node scripts/extract.js --list

# 2) 特定セッションだけを別ファイルへ
node scripts/extract.js --session 728d494b --out .harness_insights/728d494b.jsonl

# 3) 複数セッションを単一出力に貄める
node scripts/extract.js --session 2026-04-29 --out .harness_insights/today.jsonl
node scripts/extract.js --session 2026-04-30 --out .harness_insights/today.jsonl --append
```

### 2.4 .gitignore 自動追記
JS / Python の extractor は `/.harness_insights/` 行が無ければ自動追記する。Agent 自力モードでも必ず同等の処理を行う。

### 2.5 アダプタ実装ポリシー
- 各 Harness の生ログ → 共通スキーマへの変換は `scripts/adapters/<harness>.{js,py}` に分離。
- すべて **読み取り専用**（生ログを書き換えない）。
- JS と Python で同じ harness 名 → 同じ出力になることを保証。

---

## Step 3: ANALYZE — 多言語パーサー＋ LLM フォールバック

### 3.1 環境チェック順序
```
1. node -v          → scripts/analyze.js
2. python --version → scripts/analyze.py
3. pwsh / powershell → scripts/analyze.ps1
4. すべて失敗 / クラッシュ → LLM フォールバック (Few-shot)
```

### 3.2 評価マトリクス（定量）

| 指標 | 計算方法 | 重み |
|---|---|---|
| `delegation_score` | (AI への委任 actions / 全 actions) × 100 | 30% |
| `prompt_clarity` | 平均プロンプト長・指示語密度・制約有無のヒューリスティクス | 20% |
| `manual_coding_time_min` | `ai_response → 次 prompt` の間に発生した連続 user `code_edit` の合計分数（5 分以上を opportunity loss と判定） | 20% |
| `interrupt_count` | `action_type == "interrupt"` の総数 | 15% |
| `rework_ratio` | 同一ファイルの再編集回数 / 総編集回数 | 15% |

総合スコア = 100 - 機会損失×3 - interrupt×4 - max(0, rework−30)×0.5。

### 3.3 評価マトリクス（定性 / LLM 担当）
別コンテキストで以下を判定：
- ハルシネーションの主因
- 強制停止が起きた直前のプロンプトの不足制約
- 手戻りパターン（ライブラリ誤用 / 出力フォーマット違い / ドメイン誤解）

### 3.4 LLM フォールバック・プロンプト
[templates/fallback_prompt.md](templates/fallback_prompt.md) を読み込み、`normalized.jsonl` を直接 LLM に渡して定量値も推計。

### 3.5 トレンド分析
`.harness_insights/history.jsonl` に過去スコアを追記し、前回比 / 改善トラック を出力。

### 3.6 Git Diff 連携（任意）
`git log --since="<セッション開始>"` の差分とログを突合し、AI 指示の無いコード変更 = 機会損失 を検出。

---

## Step 4: REPORT — 二元化レポート

### 4.1 Human-facing

**必ず以下のフォーマット**で出力する。特に「採点内訳」セクションは **省略禁止**。`metrics.json` の各値をそのまま転記し、減点理由・寄与度も明示する。

```markdown
## 🪞 Self-Reflection Report

**総合 AI 委任度スコア:** 68 / 100  （前回 63 / +5）

### 📊 採点内訳（必須）

| 指標 | 実測値 | 重み | 寄与/減点 | コメント |
|---|---|---|---|---|
| delegation_score      | 72 / 100 | 30% | +21.6 | AI 委任比率は良好 |
| prompt_clarity        | 64 / 100 | 20% | +12.8 | 制約語不足が散見 |
| manual_coding_time_min| 18 min   | 20% | -3 (機会損失×3) | `src/foo.ts` で 18 分の手動編集 |
| interrupt_count       | 3        | 15% | -12 (×4) | 出力形式不一致が原因 |
| rework_ratio          | 35%      | 15% | -2.5 (max(0,35-30)×0.5) | 同一ファイル再編集 |
| **total_score**       | **68**   | —   | 100 − 3 − 12 − 2.5 ≈ 68 | |

> 計算式: `total = 100 − opportunity_loss×3 − interrupt_count×4 − max(0, rework_ratio−30)×0.5`

### あなたへのコーチング
- `src/foo.ts` の手動修正に 18 分かけていました。次回は AI に委任を検討してください。
- AI を 3 回強制停止しています。最初に出力フォーマット制約（例: "TypeScript only, no comments"）を渡すと回避できます。

### 良かった点
- 制約条件の明示が前回より改善されています。
```

### 4.2 System-facing
`.harness_insights/proposed_rules.md` に保存：
```markdown
## Proposed Rule (auto-generated 2026-04-29)
- Trigger: 強制停止 ×3 / "JSON で返して" の指示無視
- Rule: 出力が要求形式（JSON / Markdown / コードのみ）と異なる場合は応答前に自己検証する。
- Apply to: AGENTS.md
```

---

## Step 5: APPLY — 反映スコープを 3 値選択

### 5.1 ユーザーへの選択肢提示

提案ルールを表示後、必ず以下 3 択を提示する（**デフォルト = 2: project**）。

| 値 | スコープ | 反映先（優先順） |
|---|---|---|
| `1` / `none` | 反映しない | （何もしない。`proposed_rules.md` には残す） |
| `2` / `project` ★既定 | プロジェクト単位 | ① `./AGENTS.md` ② `./.github/copilot-instructions.md` ③ `./.cursor/rules/harness-insight.md` ／いずれも無ければ `./AGENTS.md` を新規作成 |
| `3` / `global` | グローバル（ユーザー単位） | ① `~/.agents/AGENTS.md` ② `%APPDATA%/Code/User/prompts/harness-insight.instructions.md` ③ `~/.cursor/rules/harness-insight.md` ／無ければ `~/.agents/AGENTS.md` を新規作成 |

### 5.2 反映ルール

1. 追記は必ず以下マーカーで囲み、後続セッションで上書き判定可能にする：
   ```
   <!-- harness-insight: <YYYY-MM-DD> scope=<project|global> -->
   ...rule body...
   <!-- /harness-insight -->
   ```
2. 既に同一マーカーブロックが存在する場合は **置換**（重複追記しない）。
3. `global` を選んだ場合、ターゲットファイルの親ディレクトリが無ければ作成する。
4. 反映後、`history.jsonl` に `{score, scope, applied_files}` を追記する。
5. ユーザーが追加で `edit` 指示をした場合は、提案ルールをそのまま編集モードで開く（VS Code なら `code -r <path>`）。

### 5.3 確認 UI（CLI 例）
```
[harness-insight] Apply proposed rules?
  1) none      - 反映しない
  2) project   - このプロジェクトに反映 (default)
  3) global    - 全プロジェクト共通に反映
> _
```
無入力 / Enter のみは **2 (project)** として扱う。

---

## 6. ファイル構成

```
Harness-Insight/                   ← この repo 自身が SKILL package
├── SKILL.md                       ← 本ファイル（AI が参照する仕様）
├── README.md                      ← 人間向け導入手順
├── package.json                   ← npm パッケージ定義 (npx skills add 用)
├── skill.json                     ← skills CLI 用マニフェスト
├── bin/
│   └── install.js                 ← `npx skills add Harness-Insight` 実装
├── scripts/
│   ├── extract.js                 ← Step2 抽出 (Node)
│   ├── extract.py                 ← Step2 抽出 (Python)
│   ├── analyze.js                 ← Step3 解析 (Node)
│   ├── analyze.py                 ← Step3 解析 (Python)
│   ├── analyze.ps1                ← Step3 解析 (PowerShell)
│   ├── apply.js                   ← Step5 反映 (Node)
│   └── adapters/
│       ├── copilot.{js,py}
│       ├── cursor.{js,py}
│       ├── claude.{js,py}
│       ├── codex.{js,py}
│       ├── openclaw.{js,py}
│       ├── hermes.{js,py}
│       └── antigravity.{js,py}
├── templates/
│   ├── normalized.schema.json
│   ├── analysis_prompt.md
│   ├── fallback_prompt.md
│   ├── manual_extract_prompt.md   ← JS/PY 両方不可時の Agent 指示書
│   └── proposed_rule.md
└── docs/
    └── 詳細設計.md
```

## 7. AI 実行手順（Copilot 向けプロンプト要約）

ユーザーが `/harness-insight`（またはエイリアス `/reflect` / `/self-review`）を発した場合、Copilot は以下を順守：

1. `SKILL.md` を再読込。
2. **必ず別コンテキスト** で Step 3-4 を実行（メイン汚染防止）。
3. Step 2 は JS → Python → Agent 自力 の順でフォールバック。Agent 自力時は [templates/manual_extract_prompt.md](templates/manual_extract_prompt.md) に必ず従う。
4. 解析中は中間ログをユーザーに垂れ流さない。Step 4 のレポートのみ表示。
5. Step 5 は **必ず 3 択（none/project/global）の確認** を取り、**デフォルトは project**。無断で書き換えない。
6. 失敗時はフォールバックチェーンを順に試し、全失敗なら原因と次の一手を 1 メッセージで報告する。
