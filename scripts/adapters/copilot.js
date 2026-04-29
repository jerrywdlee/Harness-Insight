/**
 * GitHub Copilot Chat adapter.
 *
 * 優先: %APPDATA%/Code/User/workspaceStorage/<ws>/GitHub.copilot-chat/transcripts/<sessionId>.jsonl
 *       （実際の対話履歴: user.message / assistant.message / tool.execution_*）
 * フォールバック: debug-logs/<sessionId>/main.jsonl 等の telemetry ログ
 */
const fs = require('fs');

// 編集系ツール（code_edit に分類するもの）
const EDIT_TOOLS = new Set([
  'create_file',
  'replace_string_in_file',
  'multi_replace_string_in_file',
  'edit_notebook_file',
  'insert_edit_into_file',
  'apply_patch',
]);

function extractFiles(args) {
  if (!args || typeof args !== 'object') return [];
  const out = new Set();
  if (typeof args.filePath === 'string') out.add(args.filePath);
  if (Array.isArray(args.replacements)) {
    for (const r of args.replacements) if (r && typeof r.filePath === 'string') out.add(r.filePath);
  }
  if (Array.isArray(args.files)) for (const f of args.files) if (typeof f === 'string') out.add(f);
  return Array.from(out);
}

function isTranscriptLine(line) {
  return /"type"\s*:\s*"(user\.message|assistant\.message|tool\.execution_start|session\.start)"/.test(line);
}

function* parseTranscript(text) {
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }
    const ts = obj.timestamp || new Date().toISOString();
    const type = obj.type;
    const data = obj.data || {};

    if (type === 'user.message') {
      yield {
        ts,
        actor: 'user',
        action_type: 'prompt',
        content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || ''),
        meta: { source: 'copilot.transcript', message_id: obj.id },
      };
      continue;
    }

    if (type === 'assistant.message') {
      const reasoning = data.reasoningText || '';
      const content = data.content || '';
      const merged = [reasoning, content].filter(Boolean).join('\n');
      yield {
        ts,
        actor: 'ai',
        action_type: 'ai_response',
        content: typeof merged === 'string' ? merged : JSON.stringify(merged),
        meta: {
          source: 'copilot.transcript',
          message_id: obj.id,
          tool_requests: Array.isArray(data.toolRequests)
            ? data.toolRequests.map(t => t.name).filter(Boolean)
            : [],
        },
      };
      continue;
    }

    if (type === 'tool.execution_start') {
      const tool = data.toolName || 'unknown';
      const args = data.arguments || {};
      const files = extractFiles(args);
      const action_type = EDIT_TOOLS.has(tool) ? 'code_edit' : 'tool_call';
      yield {
        ts,
        actor: 'ai',
        action_type,
        content: `${tool}(${JSON.stringify(args).slice(0, 500)})`,
        meta: { source: 'copilot.transcript', tool, files },
      };
      continue;
    }

    if (type === 'session.start') {
      yield {
        ts,
        actor: 'system',
        action_type: 'system',
        content: `session.start sessionId=${data.sessionId || ''} version=${data.copilotVersion || ''}`,
        meta: { source: 'copilot.transcript' },
      };
      continue;
    }
    // assistant.turn_*, tool.execution_complete, function 等は無視
  }
}

// ---------- 旧 debug-logs (telemetry) フォールバック ----------
function classifyDebug(line) {
  const lower = line.toLowerCase();
  if (lower.includes('cancel') || lower.includes('interrupt') || lower.includes('aborted')) return 'interrupt';
  if (lower.includes('error')) return 'error';
  return 'system';
}

function* parseDebug(text) {
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let ts = new Date().toISOString();
    let action_type = 'system';
    let content = raw;
    try {
      const obj = JSON.parse(raw);
      ts = obj.timestamp || obj.ts || ts;
      action_type = classifyDebug(JSON.stringify(obj));
      content = obj.message || JSON.stringify(obj);
    } catch {
      action_type = classifyDebug(raw);
    }
    yield {
      ts,
      actor: 'system',
      action_type,
      content: typeof content === 'string' ? content.slice(0, 1000) : JSON.stringify(content),
      meta: { source: 'copilot.debug' },
    };
  }
}

function* parse(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const isTranscriptPath = /[\\/]transcripts[\\/]/.test(filePath);
  const sample = text.split(/\r?\n/, 10).join('\n');
  if (isTranscriptPath || isTranscriptLine(sample)) {
    yield* parseTranscript(text);
  } else {
    yield* parseDebug(text);
  }
}

module.exports = { parse, EDIT_TOOLS };
