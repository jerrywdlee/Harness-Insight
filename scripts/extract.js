#!/usr/bin/env node
/**
 * Harness-Insight extractor (Node.js)
 *
 * 役割:
 *  1. ハーネス種別を検知
 *  2. 各 adapter を呼び出して生ログ → 共通スキーマへ正規化
 *  3. .harness_insights/normalized.jsonl へ書き出し
 *  4. .gitignore に /.harness_insights/ を追記
 *
 * 使い方:
 *   node skills/harness-insight/scripts/extract.js [--harness <name>] [--source <path>]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '.harness_insights');
const OUT_FILE = path.join(OUT_DIR, 'normalized.jsonl');
const META_FILE = path.join(OUT_DIR, 'meta.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ensureGitignore() {
  const gi = path.join(ROOT, '.gitignore');
  const line = '/.harness_insights/';
  let body = '';
  if (fs.existsSync(gi)) body = fs.readFileSync(gi, 'utf8');
  if (!body.split(/\r?\n/).some(l => l.trim() === line)) {
    fs.appendFileSync(gi, (body.endsWith('\n') || body === '' ? '' : '\n') + line + '\n');
  }
}

// ---------- detection ----------
function detectHarness() {
  const candidates = [
    {
      name: 'copilot',
      probe: () => {
        const base = path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');
        if (!fs.existsSync(base)) return null;
        const sessions = [];
        const walk = (d) => {
          for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(jsonl|log|json)$/i.test(entry.name)) sessions.push(full);
          }
        };
        for (const ws of fs.readdirSync(base)) {
          const dir = path.join(base, ws, 'GitHub.copilot-chat', 'debug-logs');
          if (fs.existsSync(dir)) walk(dir);
        }
        return sessions.length ? sessions : null;
      },
    },
    {
      name: 'cursor',
      probe: () => {
        const dir = path.join(os.homedir(), '.cursor', 'sessions');
        return fs.existsSync(dir)
          ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => path.join(dir, f))
          : null;
      },
    },
    {
      name: 'claude',
      probe: () => {
        // Claude Code: ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl
        const base = path.join(os.homedir(), '.claude', 'projects');
        if (!fs.existsSync(base)) return null;
        const out = [];
        for (const proj of fs.readdirSync(base)) {
          const dir = path.join(base, proj);
          if (!fs.statSync(dir).isDirectory()) continue;
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.jsonl')) out.push(path.join(dir, f));
          }
        }
        return out.length ? out : null;
      },
    },
    {
      name: 'codex',
      probe: () => {
        // Codex CLI: ~/.codex/sessions/*.jsonl もしくは ~/.codex/history/*.jsonl
        const candidates = [
          path.join(os.homedir(), '.codex', 'sessions'),
          path.join(os.homedir(), '.codex', 'history'),
        ];
        const out = [];
        for (const dir of candidates) {
          if (!fs.existsSync(dir)) continue;
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.jsonl') || f.endsWith('.json')) out.push(path.join(dir, f));
          }
        }
        return out.length ? out : null;
      },
    },
    {
      name: 'openclaw',
      probe: () => {
        const dir = path.join(ROOT, '.openclaw', 'sessions');
        return fs.existsSync(dir)
          ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => path.join(dir, f))
          : null;
      },
    },
    {
      name: 'hermes',
      probe: () => {
        const dir = path.join(ROOT, '.hermes', 'runs');
        if (!fs.existsSync(dir)) return null;
        const list = [];
        for (const r of fs.readdirSync(dir)) {
          const ov = path.join(dir, r, 'overview.txt');
          if (fs.existsSync(ov)) list.push(ov);
        }
        return list.length ? list : null;
      },
    },
    {
      name: 'antigravity',
      probe: () => {
        const dir = path.join(ROOT, '.antigravity', 'transcripts');
        return fs.existsSync(dir)
          ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => path.join(dir, f))
          : null;
      },
    },
  ];
  for (const c of candidates) {
    const found = c.probe();
    if (found && found.length) return { name: c.name, sources: found };
  }
  return null;
}

// ---------- main ----------
function parseArgs(argv) {
  const map = { _flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      map._flags.add(key); // boolean flag
    } else {
      map[key] = next;
      i++;
    }
  }
  return map;
}

function main() {
  const argMap = parseArgs(process.argv.slice(2));

  ensureDir(OUT_DIR);
  ensureGitignore();

  let harness, sources;
  if (argMap.harness && argMap.source) {
    harness = argMap.harness;
    sources = [argMap.source];
  } else {
    const detected = detectHarness();
    if (!detected) {
      console.error('[harness-insight] No harness detected. Pass --harness <name> --source <path>.');
      process.exit(2);
    }
    harness = detected.name;
    sources = detected.sources;
  }

  // --session <substring>: 複数セッション対応のため、ファイルパスにマッチするものだけ採用
  if (argMap.session) {
    const before = sources.length;
    sources = sources.filter(s => s.includes(argMap.session));
    if (!sources.length) {
      console.error(`[harness-insight] No sessions match --session ${argMap.session} (had ${before}).`);
      process.exit(4);
    }
  }

  // --list: 検知したセッション一覧のみを表示して終了（抽出しない）
  if (argMap._flags.has('list')) {
    console.log(`[harness-insight] Detected harness: ${harness}`);
    console.log(`[harness-insight] Sessions (${sources.length}):`);
    for (const s of sources) console.log(`  - ${s}`);
    return;
  }

  const adapterPath = path.join(__dirname, 'adapters', `${harness}.js`);
  if (!fs.existsSync(adapterPath)) {
    console.error(`[harness-insight] Adapter not found: ${adapterPath}`);
    process.exit(3);
  }
  const adapter = require(adapterPath);

  // --out <path>: 任意の出力先（複数セッションを別々に保存したい場合に使う）
  const outFile = argMap.out
    ? path.resolve(ROOT, argMap.out)
    : OUT_FILE;
  const append = argMap._flags.has('append');
  ensureDir(path.dirname(outFile));
  const out = fs.createWriteStream(outFile, { flags: append ? 'a' : 'w' });
  let total = 0;
  for (const src of sources) {
    for (const evt of adapter.parse(src)) {
      out.write(JSON.stringify(evt) + '\n');
      total++;
    }
  }
  out.end();

  fs.writeFileSync(
    META_FILE,
    JSON.stringify({ harness, sources, events: total, output: outFile, extracted_at: new Date().toISOString() }, null, 2)
  );
  console.log(`[harness-insight] Extracted ${total} events from ${harness} -> ${outFile}`);
}

if (require.main === module) main();
module.exports = { detectHarness };
