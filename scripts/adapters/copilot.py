"""GitHub Copilot Chat adapter (Python).

優先: transcripts/<sessionId>.jsonl の対話履歴 (user.message / assistant.message / tool.execution_*)
フォールバック: debug-logs/<sessionId>/main.jsonl 等の telemetry ログ
"""
from __future__ import annotations
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Iterator

EDIT_TOOLS = {
    "create_file",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "edit_notebook_file",
    "insert_edit_into_file",
    "apply_patch",
}

_TRANSCRIPT_RE = re.compile(
    r'"type"\s*:\s*"(user\.message|assistant\.message|tool\.execution_start|session\.start)"'
)


def _extract_files(args):
    if not isinstance(args, dict):
        return []
    out = []
    fp = args.get("filePath")
    if isinstance(fp, str):
        out.append(fp)
    reps = args.get("replacements")
    if isinstance(reps, list):
        for r in reps:
            if isinstance(r, dict) and isinstance(r.get("filePath"), str):
                out.append(r["filePath"])
    files = args.get("files")
    if isinstance(files, list):
        for f in files:
            if isinstance(f, str):
                out.append(f)
    # de-dup preserving order
    seen = set()
    uniq = []
    for f in out:
        if f not in seen:
            seen.add(f)
            uniq.append(f)
    return uniq


def _parse_transcript(text: str) -> Iterator[dict]:
    for raw in text.splitlines():
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue
        ts = obj.get("timestamp") or datetime.utcnow().isoformat() + "Z"
        t = obj.get("type")
        data = obj.get("data") or {}

        if t == "user.message":
            content = data.get("content")
            yield {
                "ts": ts,
                "actor": "user",
                "action_type": "prompt",
                "content": content if isinstance(content, str) else json.dumps(content or "", ensure_ascii=False),
                "meta": {"source": "copilot.transcript", "message_id": obj.get("id")},
            }
        elif t == "assistant.message":
            reasoning = data.get("reasoningText") or ""
            content = data.get("content") or ""
            merged = "\n".join(x for x in (reasoning, content) if x)
            tool_reqs = []
            tr = data.get("toolRequests")
            if isinstance(tr, list):
                tool_reqs = [x.get("name") for x in tr if isinstance(x, dict) and x.get("name")]
            yield {
                "ts": ts,
                "actor": "ai",
                "action_type": "ai_response",
                "content": merged if isinstance(merged, str) else json.dumps(merged, ensure_ascii=False),
                "meta": {
                    "source": "copilot.transcript",
                    "message_id": obj.get("id"),
                    "tool_requests": tool_reqs,
                },
            }
        elif t == "tool.execution_start":
            tool = data.get("toolName") or "unknown"
            args = data.get("arguments") or {}
            files = _extract_files(args)
            action_type = "code_edit" if tool in EDIT_TOOLS else "tool_call"
            yield {
                "ts": ts,
                "actor": "ai",
                "action_type": action_type,
                "content": f"{tool}({json.dumps(args, ensure_ascii=False)[:500]})",
                "meta": {"source": "copilot.transcript", "tool": tool, "files": files},
            }
        elif t == "session.start":
            yield {
                "ts": ts,
                "actor": "system",
                "action_type": "system",
                "content": f"session.start sessionId={data.get('sessionId','')} version={data.get('copilotVersion','')}",
                "meta": {"source": "copilot.transcript"},
            }
        # その他 (turn_*, execution_complete, function) は無視


def _classify_debug(line: str) -> str:
    l = line.lower()
    if any(k in l for k in ("cancel", "interrupt", "aborted")):
        return "interrupt"
    if "error" in l:
        return "error"
    return "system"


def _parse_debug(text: str) -> Iterator[dict]:
    for raw in text.splitlines():
        if not raw.strip():
            continue
        ts = datetime.utcnow().isoformat() + "Z"
        action_type = "system"
        content: object = raw
        try:
            obj = json.loads(raw)
            ts = obj.get("timestamp") or obj.get("ts") or ts
            action_type = _classify_debug(json.dumps(obj))
            content = obj.get("message") or json.dumps(obj, ensure_ascii=False)
        except Exception:
            action_type = _classify_debug(raw)
        if isinstance(content, str):
            content = content[:1000]
        else:
            content = json.dumps(content, ensure_ascii=False)
        yield {
            "ts": ts,
            "actor": "system",
            "action_type": action_type,
            "content": content,
            "meta": {"source": "copilot.debug"},
        }


def parse(file_path: str) -> Iterator[dict]:
    p = Path(file_path)
    text = p.read_text(encoding="utf-8", errors="ignore")
    is_transcript_path = "transcripts" in p.parts
    sample = "\n".join(text.splitlines()[:10])
    if is_transcript_path or _TRANSCRIPT_RE.search(sample):
        yield from _parse_transcript(text)
    else:
        yield from _parse_debug(text)
