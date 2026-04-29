#!/usr/bin/env node
/**
 * `npx skills add jerrywdlee/Harness-Insight` 互換のインストーラ。
 *
 * 動作:
 *  - skill.json の files[] を、対象プロジェクトの <destination>（既定 .skills/harness-insight/）にコピーする。
 *  - .gitignore に /.harness_insights/ を追記する。
 *  - 対象プロジェクトの AGENTS.md（無ければ作成）に SKILL の存在を追記する。
 *
 * 使い方:
 *   npx harness-insight                 # 現在の cwd にインストール
 *   npx harness-insight --dest <dir>    # 任意ディレクトリにインストール
 *   npx skills add jerrywdlee/Harness-Insight      # skills CLI 経由
 */
const fs = require('fs');
const path = require('path');

const PKG_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) argMap[args[i].replace(/^--/, '')] = args[i + 1];

const TARGET_PROJECT = path.resolve(argMap.project || process.cwd());
const manifest = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'skill.json'), 'utf8'));
const DEST = path.join(TARGET_PROJECT, argMap.dest || (manifest.install && manifest.install.destination) || '.skills/harness-insight');

function copyFile(rel) {
  const src = path.join(PKG_ROOT, rel);
  const dst = path.join(DEST, rel);
  if (!fs.existsSync(src)) {
    console.warn(`[harness-insight] missing source ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function ensureGitignore() {
  const gi = path.join(TARGET_PROJECT, '.gitignore');
  const line = '/.harness_insights/';
  let body = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!body.split(/\r?\n/).some(l => l.trim() === line)) {
    fs.writeFileSync(gi, body + (body && !body.endsWith('\n') ? '\n' : '') + line + '\n');
  }
}

function announceInAgentsMd() {
  const file = path.join(TARGET_PROJECT, 'AGENTS.md');
  const marker = '<!-- harness-insight: installed -->';
  const block = [
    marker,
    '## Harness-Insight SKILL',
    '- Trigger: `/harness-insight` (or `/reflect`)',
    `- Spec: see [${path.relative(TARGET_PROJECT, DEST).replace(/\\/g, '/')}/SKILL.md](${path.relative(TARGET_PROJECT, DEST).replace(/\\/g, '/')}/SKILL.md)`,
    '<!-- /harness-insight -->',
    '',
  ].join('\n');
  let body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (body.includes(marker)) return;
  fs.writeFileSync(file, body + (body && !body.endsWith('\n') ? '\n' : '') + '\n' + block);
}

function main() {
  console.log(`[harness-insight] Installing to ${DEST}`);
  fs.mkdirSync(DEST, { recursive: true });
  for (const f of manifest.files) copyFile(f);
  // 補助ファイル
  for (const f of ['package.json', 'skill.json', 'README.md']) {
    if (fs.existsSync(path.join(PKG_ROOT, f))) copyFile(f);
  }
  ensureGitignore();
  announceInAgentsMd();
  console.log('[harness-insight] Done.');
  if (manifest.install && manifest.install.post_install_message) {
    console.log(manifest.install.post_install_message);
  }
}

main();
