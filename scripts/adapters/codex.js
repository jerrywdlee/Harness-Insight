/**
 * OpenAI Codex CLI session adapter.
 * Codex CLI は ~/.codex/sessions/<id>.jsonl 形式を採用し、各行は
 *   {timestamp, type|role, content|message, ...}
 * 形式の OpenAI Responses API 互換 JSON。
 */
const fs = require('fs');

function* parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }

    const ts = obj.timestamp || obj.ts || obj.created_at || new Date().toISOString();
    const role = (obj.role || obj.type || obj.message?.role || '').toLowerCase();

    let actor = 'system';
    let action_type = 'system';
    if (role === 'user' || role === 'user_input') {
      actor = 'user';
      action_type = 'prompt';
    } else if (role === 'assistant' || role === 'response') {
      actor = 'ai';
      action_type = 'ai_response';
    } else if (role === 'function_call' || role === 'tool_call' || role === 'shell_call') {
      actor = 'ai';
      action_type = 'tool_call';
    } else if (role === 'patch' || role === 'apply_patch' || obj.type === 'apply_patch') {
      actor = 'ai';
      action_type = 'code_edit';
    }

    let content = obj.content ?? obj.message ?? obj.text ?? raw;
    if (Array.isArray(content)) {
      content = content.map(c => (typeof c === 'string' ? c : c.text || JSON.stringify(c))).join('\n');
    } else if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    if (/abort|interrupt|cancel|sigint/i.test(content) || obj.stop_reason === 'interrupted') {
      action_type = 'interrupt';
    }

    const files = [];
    if (obj.file_path) files.push(obj.file_path);
    if (obj.path) files.push(obj.path);

    yield {
      ts,
      actor,
      action_type,
      content,
      meta: { source: 'codex', files: files.length ? files : undefined },
    };
  }
}

module.exports = { parse };
