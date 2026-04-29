/**
 * GitHub Copilot Chat debug-log adapter.
 * 各行が JSON もしくは "timestamp [level] message" 形式の混在ログを共通スキーマへ変換する。
 */
const fs = require('fs');

function classify(line) {
  const lower = line.toLowerCase();
  if (lower.includes('user prompt') || lower.includes('"role":"user"')) return 'prompt';
  if (lower.includes('assistant') || lower.includes('"role":"assistant"')) return 'ai_response';
  if (lower.includes('tool_call') || lower.includes('invoke ')) return 'tool_call';
  if (lower.includes('cancel') || lower.includes('interrupt') || lower.includes('aborted')) return 'interrupt';
  if (lower.includes('apply edit') || lower.includes('replace_string') || lower.includes('create_file')) return 'code_edit';
  if (lower.includes('error')) return 'error';
  return 'system';
}

function* parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let ts = new Date().toISOString();
    let actor = 'system';
    let action_type = 'system';
    let content = raw;

    // try JSON
    try {
      const obj = JSON.parse(raw);
      ts = obj.timestamp || obj.ts || ts;
      actor = obj.role === 'user' ? 'user' : obj.role === 'assistant' ? 'ai' : 'system';
      action_type = classify(JSON.stringify(obj));
      content = obj.content || obj.message || raw;
    } catch {
      // plain text  e.g. "2026-04-29T10:15:32.120Z [info] user prompt: hello"
      const m = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[\w+\]\s+(.*)$/);
      if (m) { ts = m[1]; content = m[2]; }
      action_type = classify(raw);
      if (action_type === 'prompt') actor = 'user';
      else if (action_type === 'ai_response' || action_type === 'tool_call' || action_type === 'code_edit') actor = 'ai';
    }

    yield {
      ts,
      actor,
      action_type,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      meta: { source: 'copilot' },
    };
  }
}

module.exports = { parse };
