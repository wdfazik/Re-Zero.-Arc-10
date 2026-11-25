#!/usr/bin/env python3
"""Import a raw .txt chapter into data/chapters/<id>.md and register it in data/chapters.json.

Example:
  python scripts/import_chapter.py path/to/10-47.txt --id 10-47 --volume "Том 47" --phase phase-4 --number "Глава 47"
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "chapters.json"
CHAPTERS_DIR = ROOT / "data" / "chapters"

DIVIDER_RE = re.compile(r"^[※*△▼─—=-]{3,}$")


def parse_raw_txt(raw_text: str) -> tuple[str, str, str]:
    """Return (header_title, kanji, markdown_body) from standard Arc 10 .txt upload."""
    lines = [l.strip() for l in raw_text.replace("\r\n", "\n").splitlines()]
    idx = 0
    while idx < len(lines) and not lines[idx]:
        idx += 1

    # Skip optional "АРКА 10 — ГЛАВА XX" line
    if idx < len(lines) and re.match(r"^АРКА\s+\d+", lines[idx], re.I):
        idx += 1

    header_title = lines[idx].strip() if idx < len(lines) else ""
    if header_title.isupper():
        header_title = header_title.capitalize()
    idx += 1

    kanji = lines[idx].strip() if idx < len(lines) else ""
    idx += 1

    body_blocks: list[str] = []
    for raw in lines[idx:]:
        if not raw:
            continue
        if DIVIDER_RE.match(raw):
            if body_blocks:
                body_blocks.append("---")
            continue
        body_blocks.append(raw)

    return header_title, kanji, "\n\n".join(body_blocks) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Import raw .txt chapter into Markdown + chapters.json")
    parser.add_argument("txt_file", type=Path, help="Path to source .txt file")
    parser.add_argument("--id", required=True, help="Chapter slug ID, e.g. 10-47")
    parser.add_argument("--number", required=True, help="Display number, e.g. 'Глава 47' or 'Пролог'")
    parser.add_argument("--volume", required=True, help="Volume label, e.g. 'Том 47'")
    parser.add_argument("--phase", required=True, help="Phase ID from chapters.json, e.g. phase-4")
    parser.add_argument("--title", default="", help="Override chapter title (defaults to line 2 of txt)")
    parser.add_argument("--kanji", default="", help="Override kanji title (defaults to line 3 of txt)")
    args = parser.parse_args()

    parsed_title, parsed_kanji, md_body = parse_raw_txt(args.txt_file.read_text(encoding="utf-8"))
    header_title = args.title or parsed_title
    kanji = args.kanji or parsed_kanji

    CHAPTERS_DIR.mkdir(parents=True, exist_ok=True)
    out_md = CHAPTERS_DIR / f"{args.id}.md"
    out_md.write_text(md_body, encoding="utf-8")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    chapters = manifest["chapters"]
    if any(c["id"] == args.id for c in chapters):
        raise SystemExit(f"Chapter '{args.id}' already exists in {MANIFEST_PATH}")

    next_order = max((c["order"] for c in chapters), default=0) + 1
    if args.number == "Пролог":
        badge, end_label = "P", "Конец пролога"
    elif args.number == "Интерлюдия":
        badge, end_label = "I", "Конец интерлюдии"
    else:
        badge = args.number.replace("Глава ", "")
        end_label = "Конец главы"

    subtitle = header_title if header_title.startswith("«") else f"«{header_title}»"
    chapters.append({
        "id": args.id,
        "order": next_order,
        "phaseId": args.phase,
        "volume": args.volume,
        "number": args.number,
        "badge": badge,
        "title": f"Re:Zero — Арка 10, {args.number}",
        "headerTitle": header_title,
        "cardTitle": header_title.strip("«»"),
        "subtitle": subtitle,
        "kanji": kanji,
        "endLabel": end_label,
    })

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {out_md} and registered '{args.id}' (order={next_order}) in {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
