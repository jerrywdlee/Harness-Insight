"""Claude Code adapter (Python)."""
from __future__ import annotations
import json, re
from datetime import datetime
from pathlib import Path
from typing import Iterator

_EDIT_TOOLS = re.compile(r"^(Edit|Write|MultiEdit|str_replace_editor|create_file|apply_patch)$", re.I)
_INTERRUPT = re.compile(r"aborted|interrupt|cancelled|user_cancel", re.I)


def _flatten_content(c) -> tuple[str, str | None, str | None]:
    """Return (text, tool_name, file_path)."""
    tool, fp = None, None
    if isinstance(c, list):
        parts = []
        for it in c:
            if isinstance(it, str):
                parts.append(it)
            elif isinstance(it, dict):
                if it.get("type") == "tool_use" and not tool:
                    tool = it.get("name")
                    inp = it.get("input") or {}
                    fp = inp.get("file_path") or inp.get("path") or fp
                parts.append(it.get("text") or it.get("input", {}).get("command") or json.dumps(it, ensure_ascii=False))
        return "\n".join(parts), tool, fp
    if isinstance(c, str):
        return c, None, None
    return json.dumps(c, ensure_ascii=False), None, None


def parse(file_path: str) -> Iterator[dict]:
    text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    for raw in text.splitlines():
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue

        ts = obj.get("timestamp") or obj.get("ts") or (datetime.utcnow().isoformat() + "Z")
        msg = obj.get("message") or {}
        otype = (obj.get("type") or msg.get("role") or "").lower()

        actor, action_type = "system", "system"
        if otype == "user" or msg.get("role") == "user":
            actor, action_type = "user", "prompt"
        elif otype == "assistant" or msg.get("role") == "assistant":
            actor, action_type = "ai", "ai_response"
        elif otype in ("tool_use", "tool_call", "tool_result"):
            actor, action_type = "ai", "tool_call"

        content_raw = msg.get("content", obj.get("content", raw))
        content, tool, fp = _flatten_content(content_raw)

        if _INTERRUPT.search(content) or obj.get("stop_reason") == "cancelled":
            action_type = "interrupt"
        if tool and _EDIT_TOOLS.match(tool):
            action_type = "code_edit"

        meta = {"source": "claude-code"}
        if tool:
            meta["tool"] = tool
        if fp:
            meta["files"] = [fp]

        yield {"ts": ts, "actor": actor, "action_type": action_type, "content": content, "meta": meta}
