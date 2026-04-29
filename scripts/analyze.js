#!/usr/bin/env node
/**
 * Harness-Insight analyzer (Node.js)
 *
 * 入力: .harness_insights/normalized.jsonl
 * 出力: .harness_insights/metrics.json
 *
 * 計算する定量指標:
 *  - delegation_score        : AI に委任した action 比率
 *  - prompt_clarity          : プロンプトの平均長／制約語の有無に基づくヒューリスティクス
 *  - manual_coding_time_min  : ai_response→次 prompt 間の連続 user code_edit 合計分
 *  - opportunity_loss_count  : 5 分以上の連続手動編集回数
 *  - interrupt_count         : interrupt event の数
 *  - rework_ratio            : 同一ファイルの再編集比率
 *  - total_score             : 100 - 機会損失×3 - interrupt×4
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IN_FILE = process.argv[2] || path.join(ROOT, '.harness_insights', 'normalized.jsonl');
const OUT_FILE = path.join(ROOT, '.harness_insights', 'metrics.json');
const HISTORY = path.join(ROOT, '.harness_insights', 'history.jsonl');

function loadEvents(file) {
  if (!fs.existsSync(file)) {
    console.error(`[harness-insight] missing ${file}`);
    process.exit(2);
  }
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .map(e => ({ ...e, _t: Date.parse(e.ts) || 0 }))
    .sort((a, b) => a._t - b._t);
}

function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10; }

function computeManualCoding(events) {
  // ai_response → 次の prompt の間に発生した user code_edit の連続塊
  let blocks = [];
  let cur = null;
  let inWindow = false;
  for (const e of events) {
    if (e.actor === 'ai' && e.action_type === 'ai_response') { inWindow = true; cur = null; continue; }
    if (e.actor === 'user' && e.action_type === 'prompt') { if (cur) blocks.push(cur); cur = null; inWindow = false; continue; }
    if (inWindow && e.actor === 'user' && e.action_type === 'code_edit') {
      if (!cur) cur = { start: e._t, end: e._t };
      else cur.end = e._t;
    }
  }
  if (cur) blocks.push(cur);
  const minutes = blocks.map(b => Math.max(0, (b.end - b.start) / 60000));
  const total = minutes.reduce((a, b) => a + b, 0);
  const losses = minutes.filter(m => m >= 5).length;
  return { manual_coding_time_min: Math.round(total * 10) / 10, opportunity_loss_count: losses };
}

function computePromptClarity(prompts) {
  if (!prompts.length) return 0;
  const constraintTerms = /(must|do not|don'?t|format|json|markdown|step by step|制約|形式|必ず|禁止)/i;
  let score = 0;
  for (const p of prompts) {
    const len = (p.content || '').length;
    let s = 50;
    if (len > 60) s += 15;
    if (len > 200) s += 10;
    if (constraintTerms.test(p.content || '')) s += 25;
    score += Math.min(100, s);
  }
  return Math.round(score / prompts.length);
}

function computeReworkRatio(edits) {
  const counts = {};
  for (const e of edits) {
    for (const f of (e.meta && e.meta.files) || []) counts[f] = (counts[f] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const repeated = Object.values(counts).filter(c => c > 1).reduce((a, b) => a + b, 0);
  return pct(repeated, total || 1);
}

function main() {
  const events = loadEvents(IN_FILE);
  const aiActions = events.filter(e => e.actor === 'ai').length;
  const userActions = events.filter(e => e.actor === 'user').length;
  const prompts = events.filter(e => e.action_type === 'prompt');
  const edits = events.filter(e => e.action_type === 'code_edit');
  const interrupts = events.filter(e => e.action_type === 'interrupt').length;

  const manual = computeManualCoding(events);
  const clarity = computePromptClarity(prompts);
  const delegation = pct(aiActions, aiActions + userActions);
  const rework = computeReworkRatio(edits);

  const total = Math.max(0, Math.round(
    100
    - manual.opportunity_loss_count * 3
    - interrupts * 4
    - (rework > 30 ? (rework - 30) * 0.5 : 0)
  ));

  const metrics = {
    generated_at: new Date().toISOString(),
    counts: { events: events.length, prompts: prompts.length, edits: edits.length, interrupts },
    delegation_score: delegation,
    prompt_clarity: clarity,
    manual_coding_time_min: manual.manual_coding_time_min,
    opportunity_loss_count: manual.opportunity_loss_count,
    interrupt_count: interrupts,
    rework_ratio: rework,
    total_score: total,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(metrics, null, 2));
  fs.appendFileSync(HISTORY, JSON.stringify(metrics) + '\n');
  console.log(JSON.stringify(metrics, null, 2));
}

if (require.main === module) main();
