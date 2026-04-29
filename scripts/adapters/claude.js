/**
 * Claude Code session adapter.
 * Claude Code は ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl 形式でセッションを保存する。
 * 各行は {type: "user"|"assistant"|"tool_use"|"tool_result", message:{role, content}, timestamp, ...} の JSON。
 */
const fs = require('fs');

function* parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }

    const ts = obj.timestamp || obj.ts || new Date().toISOString();
    const type = (obj.type || obj.message?.role || '').toLowerCase();
    let actor = 'system';
    let action_type = 'system';

    if (type === 'user' || obj.message?.role === 'user') {
      actor = 'user';
      action_type = 'prompt';
    } else if (type === 'assistant' || obj.message?.role === 'assistant') {
      actor = 'ai';
      action_type = 'ai_response';
    } else if (type === 'tool_use' || type === 'tool_call') {
      actor = 'ai';
      action_type = 'tool_call';
    } else if (type === 'tool_result') {
      actor = 'ai';
      action_type = 'tool_call';
    }

    let content = obj.message?.content ?? obj.content ?? raw;
    if (Array.isArray(content)) {
      content = content.map(c => (typeof c === 'string' ? c : c.text || c.input?.command || JSON.stringify(c))).join('\n');
    } else if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    if (/aborted|interrupt|cancelled|user_cancel/i.test(content) || obj.stop_reason === 'cancelled') {
      action_type = 'interrupt';
    }

    const tool = obj.message?.content?.[0]?.name || obj.tool_name;
    const files = [];
    const editTools = /^(Edit|Write|MultiEdit|str_replace_editor|create_file|apply_patch)$/i;
    if (tool && editTools.test(tool)) {
      action_type = 'code_edit';
      const fp = obj.message?.content?.[0]?.input?.file_path
              || obj.message?.content?.[0]?.input?.path;
      if (fp) files.push(fp);
    }

    yield {
      ts,
      actor,
      action_type,
      content,
      meta: { source: 'claude-code', tool: tool || undefined, files: files.length ? files : undefined },
    };
  }
}

module.exports = { parse };
