"""HermesAgent overview.txt adapter (Python)."""
from __future__ import annotations
import re
from datetime import datetime
from pathlib import Path
from typing import Iterator

_RE = re.compile(r"^\[([^\]]+)\]\s+(user|ai|assistant|system|tool):\s*(.*)$", re.I)


def parse(file_path: str) -> Iterator[dict]:
    text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    for line in text.splitlines():
        m = _RE.match(line)
        if not m:
            continue
        role = m.group(2).lower()
        actor = "user" if role == "user" else "ai" if role in ("ai", "assistant", "tool") else "system"
        action_type = "system"
        if actor == "user":
            action_type = "prompt"
        elif role == "tool":
            action_type = "tool_call"
        elif actor == "ai":
            action_type = "ai_response"
        content = m.group(3)
        if re.search(r"abort|interrupt|cancel", content, re.I):
            action_type = "interrupt"
        try:
            ts = datetime.fromisoformat(m.group(1).replace("Z", "+00:00")).isoformat()
        except Exception:
            ts = datetime.utcnow().isoformat() + "Z"
        yield {
            "ts": ts,
            "actor": actor,
            "action_type": action_type,
            "content": content,
            "meta": {"source": "hermes"},
        }
