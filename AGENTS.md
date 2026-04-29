# AGENTS.md — Harness-Insight Repository

このリポジトリは **Harness-Insight SKILL** の開発・配布元であると同時に、
**自分自身でもこの SKILL を使う** ドッグフーディング環境です。

## このプロジェクトの正体
- 種別: Universal AI Self-Reflection & Improvement SKILL のソースリポジトリ
- 配布形態: `npx skills add Harness-Insight` / `npx harness-insight`
- 詳細仕様: [SKILL.md](SKILL.md)

## ここで作業する AI Agent (Copilot / Claude Code / Codex / Cursor 等) への指示

### 1. 役割
- あなたはこの SKILL の開発者である。
- ユーザーから機能追加・修正依頼があったら、対応するファイル
  ([scripts/](scripts/) / [templates/](templates/) / [bin/install.js](bin/install.js))
  を直接編集すること。

### 2. 構成ルール
- アダプタは **必ず JS と Python の両方** を対で実装する（命名: `scripts/adapters/<harness>.{js,py}`）。
- 新しい harness を追加した場合は **必ず 4 箇所** を同時更新：
  1. `scripts/adapters/<harness>.{js,py}` の追加
  2. [scripts/extract.js](scripts/extract.js) と [scripts/extract.py](scripts/extract.py) の `detectHarness()` / `detect_harness()` への登録
  3. [SKILL.md](SKILL.md) の DETECT 表とファイル構成
  4. [skill.json](skill.json) の `files[]` と [README.md](README.md) の対応ハーネス行
- 生ログは **読み取り専用**（書き換え禁止）。
- 出力先は必ず `.harness_insights/`、`.gitignore` 自動追記を維持。

### 3. Step 5 (APPLY) のスコープ
- デフォルトは **`project`**。`global` を勝手に既定にしない。
- 反映時は `<!-- harness-insight: <date> scope=<...> -->` マーカーで囲む。

### 4. このリポジトリで `/harness-insight` (`/reflect`) を実行されたとき
- [SKILL.md](SKILL.md) の **Step 1、5 を全実行**する。
- 抽出のみ適用したい場合は `/harness-insight extract` サブコマンドを使う（独立トリガーは追加しない — §11 Lesson 2 参照）。
1. このリポジトリ自身のセッションログに対して [SKILL.md](SKILL.md) の 5 ステップを実行する。
2. 抽出には **本リポジトリ直下の** [scripts/extract.js](scripts/extract.js) または [scripts/extract.py](scripts/extract.py) を使う（`.skills/harness-insight/...` ではない）。
3. 反映先 `project` の場合の優先順は本ファイル (`./AGENTS.md`) → `./.github/copilot-instructions.md` → `./.cursor/rules/harness-insight.md`。
4. 自分自身が SKILL の開発元なので、**機能改善のヒント** を Section A に必ず 1 件含めること。

### 5. 編集ポリシー
- ドキュメント変更を勝手に行わない（ユーザー指示があったときのみ）。
- 詳細設計書 [docs/詳細設計.md](docs/%E8%A9%B3%E7%B4%B0%E8%A8%AD%E8%A8%88.md) は実装ベースの正本。仕様変更時はこちらを更新する（旧 v1/v2 は存在しない前提）。
- コミットメッセージは Conventional Commits 推奨（`feat:`, `fix:`, `docs:`, `chore:`）。

### 6. テスト・実行コマンド
```bash
# Self-reflect（このリポジトリのセッションを分析）
npm run reflect

# 個別実行
npm run extract
npm run analyze
npm run apply -- --scope project
```

---

<!-- harness-insight: 2026-04-29 scope=project -->
# Harness-Insight Proposed Rules
generated_at: 2026-04-29
session: copilot/728d494b-dd8d-4d3c-ad38-5bd73d2235d5
mode: llm-fallback (copilot adapter が telemetry 主体のため AI が対話履歴から直接推計)

---

## Proposed Rule 1
- **Trigger**: 「採点の詳細が出されていない」とユーザー報告。実装側で `breakdown` を出していなかった（SKILL.md / templates の出力仕様にも未記載）。
- **Rule**: SKILL/レポート系機能を新設する際は、**出力サンプル（人間可読 + JSON 構造）を SKILL.md / templates/ の両方に先に固定**してから実装着手する。
- **Apply to**: AGENTS.md
- **Evidence**: 別 PC の Antigravity 実機で採点表が空欄のまま出力された。

## Proposed Rule 2
- **Trigger**: `/extract-logs` 独立トリガーを追加直後、ユーザーが「サブコマンド機能を知らなかった、不要」と全変更を undo。
- **Rule**: 既存 SKILL 仕様に **新トリガー / 新サブコマンド** を追加する変更要望が来たら、まず「既存の `/<trigger> <sub>` 形式で代用可能ではないか？」を **1 ターン確認**してから着手する。
- **Apply to**: AGENTS.md
- **Evidence**: 5 ファイル横断編集 → 数ターン後に全 undo、というロスが発生。

## Proposed Rule 3 (SKILL 改善ヒント — 開発元として必須)
- **Trigger**: copilot adapter が `debug-logs/*/main.jsonl` の telemetry を 1824 件取得したが、`prompts/edits/interrupts` がすべて 0。前回 `/reflect` でも同じ問題を指摘済み（**未対応のまま残存**）。
- **Rule (SKILL コード側で対応)**: `scripts/adapters/copilot.{js,py}` を **Chat Sessions / Transcripts の保存先**（`%APPDATA%/Code/User/workspaceStorage/<ws>/GitHub.copilot-chat/transcripts/*.jsonl` および `chatSessions/*.json`）にも対応させる。`type=request|response` を含むファイルを優先採用し、telemetry のみのファイルは無視する。
- **Apply to**: SKILL コード側 issue / `scripts/adapters/copilot.{js,py}`
- **Evidence**: 2 セッション連続で定量パーサーが 0 件しか拾えていない。
<!-- /harness-insight -->
