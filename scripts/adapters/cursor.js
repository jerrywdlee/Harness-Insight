/** Generic JSONL adapter: 1 行 1 JSON で actor/action/ts/content を持つ系統 (cursor / openclaw / antigravity) */
const fs = require('fs');

function makeParse(harness) {
  return function* parse(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      if (!raw.trim()) continue;
      let obj;
      try { obj = JSON.parse(raw); } catch { continue; }
      yield {
        ts: obj.ts || obj.timestamp || obj.created_at || new Date().toISOString(),
        actor: obj.actor || (obj.role === 'user' ? 'user' : obj.role === 'assistant' ? 'ai' : 'system'),
        action_type: obj.action_type || obj.type || (obj.role === 'user' ? 'prompt' : 'ai_response'),
        content: typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content || obj.message || obj),
        meta: { source: harness, ...(obj.meta || {}) },
      };
    }
  };
}

module.exports = { parse: makeParse('cursor') };
