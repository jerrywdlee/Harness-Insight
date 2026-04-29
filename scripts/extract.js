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
        for (const ws of fs.readdirSync(base)) {
          const dir = path.join(base, ws, 'GitHub.copilot-chat', 'debug-logs');
          if (fs.existsSync(dir)) {
            for (const f of fs.readdirSync(dir)) sessions.push(path.join(dir, f));
          }
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
function main() {
  const args = process.argv.slice(2);
  const argMap = {};
  for (let i = 0; i < args.length; i += 2) argMap[args[i].replace(/^--/, '')] = args[i + 1];

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

  const adapterPath = path.join(__dirname, 'adapters', `${harness}.js`);
  if (!fs.existsSync(adapterPath)) {
    console.error(`[harness-insight] Adapter not found: ${adapterPath}`);
    process.exit(3);
  }
  const adapter = require(adapterPath);

  const out = fs.createWriteStream(OUT_FILE, { flags: 'w' });
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
    JSON.stringify({ harness, sources, events: total, extracted_at: new Date().toISOString() }, null, 2)
  );
  console.log(`[harness-insight] Extracted ${total} events from ${harness} → ${OUT_FILE}`);
}

if (require.main === module) main();
module.exports = { detectHarness };
