#!/usr/bin/env python3
"""Harness-Insight analyzer (Python fallback). analyze.js と同等の指標を計算する。"""
from __future__ import annotations
import json, os, sys, re
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
IN_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".harness_insights" / "normalized.jsonl"
OUT_DIR = ROOT / ".harness_insights"
OUT_FILE = OUT_DIR / "metrics.json"
HISTORY = OUT_DIR / "history.jsonl"

CONSTRAINT_RE = re.compile(r"(must|do not|don'?t|format|json|markdown|step by step|制約|形式|必ず|禁止)", re.I)


def parse_ts(s: str) -> float:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000
    except Exception:
        return 0.0


def load_events(p: Path):
    if not p.exists():
        print(f"[harness-insight] missing {p}", file=sys.stderr)
        sys.exit(2)
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        o["_t"] = parse_ts(o.get("ts", ""))
        out.append(o)
    out.sort(key=lambda e: e["_t"])
    return out


def compute_manual(events):
    blocks, cur, in_window = [], None, False
    for e in events:
        if e["actor"] == "ai" and e["action_type"] == "ai_response":
            in_window, cur = True, None
            continue
        if e["actor"] == "user" and e["action_type"] == "prompt":
            if cur:
                blocks.append(cur)
            cur, in_window = None, False
            continue
        if in_window and e["actor"] == "user" and e["action_type"] == "code_edit":
            if not cur:
                cur = {"start": e["_t"], "end": e["_t"]}
            else:
                cur["end"] = e["_t"]
    if cur:
        blocks.append(cur)
    mins = [max(0.0, (b["end"] - b["start"]) / 60000) for b in blocks]
    return round(sum(mins), 1), sum(1 for m in mins if m >= 5)


def compute_clarity(prompts):
    if not prompts:
        return 0
    total = 0
    for p in prompts:
        c = p.get("content", "") or ""
        s = 50
        if len(c) > 60:
            s += 15
        if len(c) > 200:
            s += 10
        if CONSTRAINT_RE.search(c):
            s += 25
        total += min(100, s)
    return round(total / len(prompts))


def compute_rework(edits):
    counts: dict[str, int] = {}
    for e in edits:
        for f in (e.get("meta") or {}).get("files", []) or []:
            counts[f] = counts.get(f, 0) + 1
    total = sum(counts.values())
    repeated = sum(c for c in counts.values() if c > 1)
    return round((repeated / total) * 1000) / 10 if total else 0


def main():
    events = load_events(IN_FILE)
    ai = sum(1 for e in events if e["actor"] == "ai")
    usr = sum(1 for e in events if e["actor"] == "user")
    prompts = [e for e in events if e["action_type"] == "prompt"]
    edits = [e for e in events if e["action_type"] == "code_edit"]
    interrupts = sum(1 for e in events if e["action_type"] == "interrupt")

    manual_min, opp_loss = compute_manual(events)
    clarity = compute_clarity(prompts)
    rework = compute_rework(edits)
    delegation = round((ai / (ai + usr)) * 1000) / 10 if (ai + usr) else 0
    total = max(0, round(100 - opp_loss * 3 - interrupts * 4 - (max(0, rework - 30) * 0.5)))

    metrics = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "counts": {"events": len(events), "prompts": len(prompts), "edits": len(edits), "interrupts": interrupts},
        "delegation_score": delegation,
        "prompt_clarity": clarity,
        "manual_coding_time_min": manual_min,
        "opportunity_loss_count": opp_loss,
        "interrupt_count": interrupts,
        "rework_ratio": rework,
        "total_score": total,
    }
    OUT_DIR.mkdir(exist_ok=True)
    OUT_FILE.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    with HISTORY.open("a", encoding="utf-8") as f:
        f.write(json.dumps(metrics, ensure_ascii=False) + "\n")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
