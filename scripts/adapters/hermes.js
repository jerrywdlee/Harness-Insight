/**
 * HermesAgent overview.txt adapter.
 * "[ts] actor: content" 形式の人間可読ログを共通スキーマへ変換する。
 */
const fs = require('fs');

function* parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const re = /^\[([^\]]+)\]\s+(user|ai|assistant|system|tool):\s*(.*)$/i;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const role = m[2].toLowerCase();
    const actor = role === 'user' ? 'user'
      : role === 'ai' || role === 'assistant' ? 'ai'
      : role === 'tool' ? 'ai' : 'system';
    let action_type = 'system';
    if (actor === 'user') action_type = 'prompt';
    else if (role === 'tool') action_type = 'tool_call';
    else if (actor === 'ai') action_type = 'ai_response';
    const content = m[3];
    if (/abort|interrupt|cancel/i.test(content)) action_type = 'interrupt';
    yield {
      ts: new Date(m[1]).toISOString().replace('Invalid Date', new Date().toISOString()),
      actor,
      action_type,
      content,
      meta: { source: 'hermes' },
    };
  }
}

module.exports = { parse };
