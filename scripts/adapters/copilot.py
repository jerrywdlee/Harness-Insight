"""GitHub Copilot Chat debug-log adapter (Python)."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import Iterator


def _classify(line: str) -> str:
    l = line.lower()
    if "user prompt" in l or '"role":"user"' in l:
        return "prompt"
    if "assistant" in l or '"role":"assistant"' in l:
        return "ai_response"
    if "tool_call" in l or "invoke " in l:
        return "tool_call"
    if any(k in l for k in ("cancel", "interrupt", "aborted")):
        return "interrupt"
    if any(k in l for k in ("apply edit", "replace_string", "create_file")):
        return "code_edit"
    if "error" in l:
        return "error"
    return "system"


def parse(file_path: str) -> Iterator[dict]:
    text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    for raw in text.splitlines():
        if not raw.strip():
            continue
        ts = datetime.utcnow().isoformat() + "Z"
        actor = "system"
        action_type = "system"
        content: object = raw

        try:
            obj = json.loads(raw)
            ts = obj.get("timestamp") or obj.get("ts") or ts
            role = obj.get("role")
            actor = "user" if role == "user" else "ai" if role == "assistant" else "system"
            action_type = _classify(json.dumps(obj))
            content = obj.get("content") or obj.get("message") or raw
        except Exception:
            import re
            m = re.match(r"^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[\w+\]\s+(.*)$", raw)
            if m:
                ts, content = m.group(1), m.group(2)
            action_type = _classify(raw)
            if action_type == "prompt":
                actor = "user"
            elif action_type in ("ai_response", "tool_call", "code_edit"):
                actor = "ai"

        yield {
            "ts": ts,
            "actor": actor,
            "action_type": action_type,
            "content": content if isinstance(content, str) else json.dumps(content, ensure_ascii=False),
            "meta": {"source": "copilot"},
        }
