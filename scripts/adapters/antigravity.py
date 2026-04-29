"""Antigravity adapter — JSONL の汎用パーサと同形式。"""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import Iterator


def parse(file_path: str) -> Iterator[dict]:
    text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    for raw in text.splitlines():
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue
        role = obj.get("role")
        actor = obj.get("actor") or ("user" if role == "user" else "ai" if role == "assistant" else "system")
        action_type = obj.get("action_type") or obj.get("type") or ("prompt" if role == "user" else "ai_response")
        content = obj.get("content")
        if not isinstance(content, str):
            content = json.dumps(obj.get("content") or obj.get("message") or obj, ensure_ascii=False)
        yield {
            "ts": obj.get("ts") or obj.get("timestamp") or (datetime.utcnow().isoformat() + "Z"),
            "actor": actor,
            "action_type": action_type,
            "content": content,
            "meta": {"source": "antigravity", **(obj.get("meta") or {})},
        }
