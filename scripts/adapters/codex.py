"""OpenAI Codex CLI adapter (Python)."""
from __future__ import annotations
import json, re
from datetime import datetime
from pathlib import Path
from typing import Iterator

_INTERRUPT = re.compile(r"abort|interrupt|cancel|sigint", re.I)


def _flatten(c) -> str:
    if isinstance(c, list):
        return "\n".join(
            (it if isinstance(it, str) else it.get("text") or json.dumps(it, ensure_ascii=False))
            for it in c
        )
    if isinstance(c, str):
        return c
    return json.dumps(c, ensure_ascii=False)


def parse(file_path: str) -> Iterator[dict]:
    text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    for raw in text.splitlines():
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue

        ts = obj.get("timestamp") or obj.get("ts") or obj.get("created_at") or (datetime.utcnow().isoformat() + "Z")
        role = (obj.get("role") or obj.get("type") or (obj.get("message") or {}).get("role") or "").lower()

        actor, action_type = "system", "system"
        if role in ("user", "user_input"):
            actor, action_type = "user", "prompt"
        elif role in ("assistant", "response"):
            actor, action_type = "ai", "ai_response"
        elif role in ("function_call", "tool_call", "shell_call"):
            actor, action_type = "ai", "tool_call"
        elif role in ("patch", "apply_patch") or obj.get("type") == "apply_patch":
            actor, action_type = "ai", "code_edit"

        content = _flatten(obj.get("content") or obj.get("message") or obj.get("text") or raw)
        if _INTERRUPT.search(content) or obj.get("stop_reason") == "interrupted":
            action_type = "interrupt"

        files = [p for p in (obj.get("file_path"), obj.get("path")) if p]
        meta = {"source": "codex"}
        if files:
            meta["files"] = files

        yield {"ts": ts, "actor": actor, "action_type": action_type, "content": content, "meta": meta}
