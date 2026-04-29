#!/usr/bin/env node
/**
 * Harness-Insight apply (Step 5).
 *
 * 提案ルール (.harness_insights/proposed_rules.md) を、
 * ユーザー選択スコープ (none / project / global) に応じて反映する。
 *
 * 使い方:
 *   node scripts/apply.js                       # 対話モード（既定 project）
 *   node scripts/apply.js --scope project       # 非対話
 *   node scripts/apply.js --scope global
 *   node scripts/apply.js --scope none
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const ROOT = process.cwd();
const PROPOSED = path.join(ROOT, '.harness_insights', 'proposed_rules.md');
const HISTORY = path.join(ROOT, '.harness_insights', 'history.jsonl');

const PROJECT_TARGETS = [
  path.join(ROOT, 'AGENTS.md'),
  path.join(ROOT, '.github', 'copilot-instructions.md'),
  path.join(ROOT, '.cursor', 'rules', 'harness-insight.md'),
];
const GLOBAL_TARGETS = [
  path.join(os.homedir(), '.agents', 'AGENTS.md'),
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
            'Code', 'User', 'prompts', 'harness-insight.instructions.md'),
  path.join(os.homedir(), '.cursor', 'rules', 'harness-insight.md'),
];

function parseArgs() {
  const a = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < a.length; i += 2) map[a[i].replace(/^--/, '')] = a[i + 1];
  return map;
}

async function askScope() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (s) => new Promise((res) => rl.question(s, res));
  console.log('[harness-insight] Apply proposed rules?');
  console.log('  1) none      - 反映しない');
  console.log('  2) project   - このプロジェクトに反映 (default)');
  console.log('  3) global    - 全プロジェクト共通に反映');
  const ans = (await q('> ')).trim().toLowerCase();
  rl.close();
  if (!ans) return 'project';
  if (['1', 'none'].includes(ans)) return 'none';
  if (['3', 'global'].includes(ans)) return 'global';
  return 'project';
}

function pickTarget(candidates) {
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return candidates[0]; // 無ければ先頭を新規作成
}

function readProposed() {
  if (!fs.existsSync(PROPOSED)) {
    console.error(`[harness-insight] No proposed rules at ${PROPOSED}. Run analyze first.`);
    process.exit(2);
  }
  return fs.readFileSync(PROPOSED, 'utf8').trim();
}

function applyToFile(file, body, scope) {
  const today = new Date().toISOString().slice(0, 10);
  const open = `<!-- harness-insight: ${today} scope=${scope} -->`;
  const close = `<!-- /harness-insight -->`;
  const block = `${open}\n${body}\n${close}\n`;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  let original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const re = /<!--\s*harness-insight:[^>]*-->[\s\S]*?<!--\s*\/harness-insight\s*-->\s*/g;
  const replaced = original.replace(re, '');
  const sep = replaced && !replaced.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, replaced + sep + block, 'utf8');
  return file;
}

function recordHistory(scope, applied) {
  const entry = { ts: new Date().toISOString(), step: 'apply', scope, applied_files: applied };
  fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
  fs.appendFileSync(HISTORY, JSON.stringify(entry) + '\n');
}

async function main() {
  const args = parseArgs();
  const scope = args.scope || (await askScope());

  if (scope === 'none') {
    console.log('[harness-insight] Skipped. proposed_rules.md is preserved.');
    recordHistory(scope, []);
    return;
  }

  const body = readProposed();
  const targets = scope === 'global' ? GLOBAL_TARGETS : PROJECT_TARGETS;
  const target = pickTarget(targets);
  const applied = applyToFile(target, body, scope);
  console.log(`[harness-insight] Applied (${scope}) -> ${applied}`);
  recordHistory(scope, [applied]);
}

main().catch((e) => { console.error(e); process.exit(1); });
