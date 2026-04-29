#!/usr/bin/env python3
"""Harness-Insight extractor (Python).

役割:
  1. 動作中のハーネス種別を検知
  2. アダプタ (scripts.adapters.<harness>.parse) を呼び出し共通スキーマへ正規化
  3. .harness_insights/normalized.jsonl へ書き出し
  4. .gitignore に /.harness_insights/ を自動追記

使い方:
  python scripts/extract.py [--harness <name>] [--source <path>]
"""
from __future__ import annotations
import argparse, glob, importlib, importlib.util, json, os, sys
from pathlib import Path
from datetime import datetime

ROOT = Path.cwd()
OUT_DIR = ROOT / ".harness_insights"
OUT_FILE = OUT_DIR / "normalized.jsonl"
META_FILE = OUT_DIR / "meta.json"
ADAPTER_DIR = Path(__file__).parent / "adapters"


def ensure_gitignore() -> None:
    gi = ROOT / ".gitignore"
    line = "/.harness_insights/"
    body = ""
    if gi.exists():
        try:
            body = gi.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            body = gi.read_text(encoding="utf-8", errors="ignore")
    if not any(l.strip() == line for l in body.splitlines()):
        sep = "" if (body == "" or body.endswith("\n")) else "\n"
        gi.write_text(body + sep + line + "\n", encoding="utf-8")


def detect_harness() -> tuple[str, list[str]] | None:
    candidates: list[tuple[str, list[str]]] = []

    # GitHub Copilot Chat
    appdata = os.environ.get("APPDATA", "")
    if appdata:
        base = Path(appdata) / "Code" / "User" / "workspaceStorage"
        if base.exists():
            transcripts: list[str] = []
            debug_logs: list[str] = []
            for ws in base.iterdir():
                root = ws / "GitHub.copilot-chat"
                if not root.exists():
                    continue
                t_dir = root / "transcripts"
                if t_dir.exists():
                    transcripts += [str(p) for p in t_dir.rglob("*.jsonl")]
                cs_dir = root / "chatSessions"
                if cs_dir.exists():
                    transcripts += [str(p) for p in cs_dir.rglob("*.jsonl")]
                    transcripts += [str(p) for p in cs_dir.rglob("*.json")]
                d_dir = root / "debug-logs"
                if d_dir.exists():
                    for ext in ("*.jsonl", "*.log", "*.json"):
                        debug_logs += [str(p) for p in d_dir.rglob(ext)]
            # transcripts を優先
            if transcripts:
                candidates.append(("copilot", sorted(set(transcripts))))
            elif debug_logs:
                candidates.append(("copilot", sorted(set(debug_logs))))

    # Cursor
    cursor_dir = Path.home() / ".cursor" / "sessions"
    if cursor_dir.exists():
        files = sorted(str(p) for p in cursor_dir.glob("*.jsonl"))
        if files:
            candidates.append(("cursor", files))

    # Claude Code: ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl
    claude_base = Path.home() / ".claude" / "projects"
    if claude_base.exists():
        files = sorted(str(p) for p in claude_base.glob("*/*.jsonl"))
        if files:
            candidates.append(("claude", files))

    # Codex CLI: ~/.codex/sessions/*.jsonl or ~/.codex/history/*.jsonl
    codex_files: list[str] = []
    for sub in ("sessions", "history"):
        d = Path.home() / ".codex" / sub
        if d.exists():
            codex_files += sorted(str(p) for p in list(d.glob("*.jsonl")) + list(d.glob("*.json")))
    if codex_files:
        candidates.append(("codex", codex_files))

    # OpenClaw
    oc = ROOT / ".openclaw" / "sessions"
    if oc.exists():
        files = sorted(str(p) for p in oc.glob("*.jsonl"))
        if files:
            candidates.append(("openclaw", files))

    # HermesAgent
    hm = ROOT / ".hermes" / "runs"
    if hm.exists():
        files = sorted(str(p) for p in hm.glob("*/overview.txt"))
        if files:
            candidates.append(("hermes", files))

    # Antigravity
    ag = ROOT / ".antigravity" / "transcripts"
    if ag.exists():
        files = sorted(str(p) for p in ag.glob("*.jsonl"))
        if files:
            candidates.append(("antigravity", files))

    return candidates[0] if candidates else None


def load_adapter(name: str):
    path = ADAPTER_DIR / f"{name}.py"
    if not path.exists():
        sys.exit(f"[harness-insight] Adapter not found: {path}")
    spec = importlib.util.spec_from_file_location(f"hi_adapter_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    if not hasattr(mod, "parse"):
        sys.exit(f"[harness-insight] Adapter missing parse(): {path}")
    return mod


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--harness")
    ap.add_argument("--source")
    ap.add_argument("--session", help="filter detected sessions by substring (multi-session projects)")
    ap.add_argument("--list", action="store_true", help="only list detected sessions and exit")
    ap.add_argument("--out", help="custom output path (default: .harness_insights/normalized.jsonl)")
    ap.add_argument("--append", action="store_true", help="append to --out instead of overwrite")
    args = ap.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    ensure_gitignore()

    if args.harness and args.source:
        harness, sources = args.harness, [args.source]
    else:
        det = detect_harness()
        if not det:
            sys.exit("[harness-insight] No harness detected. Pass --harness <name> --source <path>.")
        harness, sources = det

    if args.session:
        before = len(sources)
        sources = [s for s in sources if args.session in s]
        if not sources:
            sys.exit(f"[harness-insight] No sessions match --session {args.session} (had {before}).")

    if args.list:
        print(f"[harness-insight] Detected harness: {harness}")
        print(f"[harness-insight] Sessions ({len(sources)}):")
        for s in sources:
            print(f"  - {s}")
        return

    adapter = load_adapter(harness)

    out_path = Path(args.out).resolve() if args.out else OUT_FILE
    out_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if args.append else "w"

    total = 0
    with out_path.open(mode, encoding="utf-8") as out:
        for src in sources:
            for evt in adapter.parse(src):
                out.write(json.dumps(evt, ensure_ascii=False) + "\n")
                total += 1

    META_FILE.write_text(
        json.dumps(
            {"harness": harness, "sources": sources, "events": total,
             "output": str(out_path),
             "extracted_at": datetime.utcnow().isoformat() + "Z"},
            indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[harness-insight] Extracted {total} events from {harness} -> {out_path}")


if __name__ == "__main__":
    main()
