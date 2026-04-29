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

### 4. このリポジトリで `/harness-insight` (`/reflect`) または `/extract-logs` を実行されたとき
- `/harness-insight` / `/reflect`: [SKILL.md](SKILL.md) の **Step 1〜5 を全実行**。
- `/extract-logs`: **Step 1+2 のみ実行**して終了する（解析・反映を行わない）。複数セッションを段階的に取り込みたい場合に使う。
1. このリポジトリ自身のセッションログに対して [SKILL.md](SKILL.md) の 5 ステップを実行する。
2. 抽出には **本リポジトリ直下の** [scripts/extract.js](scripts/extract.js) または [scripts/extract.py](scripts/extract.py) を使う（`.skills/harness-insight/...` ではない）。
3. 反映先 `project` の場合の優先順は本ファイル (`./AGENTS.md`) → `./.github/copilot-instructions.md` → `./.cursor/rules/harness-insight.md`。
4. 自分自身が SKILL の開発元なので、**機能改善のヒント** を Section A に必ず 1 件含めること。

### 5. 編集ポリシー
- ドキュメント変更を勝手に行わない（ユーザー指示があったときのみ）。
- 設計書 [docs/設計書v1.md](docs/%E8%A8%AD%E8%A8%88%E6%9B%B8v1.md) / [docs/設計書v2.md](docs/%E8%A8%AD%E8%A8%88%E6%9B%B8v2.md) は履歴用なので **書き換えない**。
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
mode: llm-fallback (telemetry-only debug-logs のため定量パーサー結果を使用せず、AI が直接対話履歴から推計)

---

## Proposed Rule 1
- **Trigger**: ユーザー要望が「設計書 v2 をベースに作って」のように **既存資産を活用しろ** と明示しているのに、AI が空ファイルから組み立てようとした事例（v2 を読まずに着手しかけた）。
- **Rule**: ユーザーが既存ドキュメント名を指す場合、最初の 1 ターンで対象を **必ず read_file** してから設計に着手する。読まずに進めない。
- **Apply to**: AGENTS.md
- **Evidence**: 初回 /reflect 依頼時、`設計書v2.md` 添付前に AI 側で skill 構造を提案しかけた挙動。

## Proposed Rule 2
- **Trigger**: ユーザーが「JS 不可なら Python 版」「両方不可ならエージェント自力」のように **段階的フォールバック** を明示する傾向あり。
- **Rule**: 多言語対応ロジックを実装する際は **必ず 2 言語以上を対で実装** し、両方失敗時の AI 自力フォールバック手順を `templates/` に明文化する。1 言語のみで完了させない。
- **Apply to**: AGENTS.md
- **Evidence**: 2 ターン目で「Python 版も併記」、3 ターン目で「`/reflect` 実行」と段階要求が連続。

## Proposed Rule 3
- **Trigger**: ユーザーは追加要望時に **「対応ハーネスに claude code と codex も入れて」** のように、既存リスト型仕様への増分を頻繁に指示する。
- **Rule**: harness リスト・スコープ選択肢など **列挙系仕様** を変更したら、SKILL.md / README / skill.json / extract.{js,py} / adapters の **5 箇所** を必ず同時更新する（チェックリスト化）。
- **Apply to**: AGENTS.md
- **Evidence**: claude / codex 追加時に 4 箇所の同時更新が必要だった経緯。

## Proposed Rule 4 (SKILL 自体への改善ヒント — 開発元として必須)
- **Trigger**: Copilot Chat の `debug-logs/*/main.jsonl` は telemetry イベントしか含まず、ユーザー発話・AI 応答が取れないため定量解析が機能しない。
- **Rule (SKILL コード側で対応)**: `scripts/adapters/copilot.js` を **Chat Sessions の保存先**（`%APPDATA%/Code/User/workspaceStorage/<ws>/chatSessions/*.json` や `%APPDATA%/Code/User/History/` 配下）にも対応させる。telemetry のみのファイルは **無視**し、`type=request|response` を含むセッション JSON を優先採用する。
- **Apply to**: SKILL 改善 issue / scripts/adapters/copilot.{js,py}
- **Evidence**: 本セッションで extract が 1 イベント (session_start telemetry) のみ取得。
<!-- /harness-insight -->
