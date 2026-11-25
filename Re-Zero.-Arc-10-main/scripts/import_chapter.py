#!/usr/bin/env python3
"""Import a raw .txt chapter into data/chapters/<id>.js and register it in data/manifest.js.

Automatically highlights recurring Arc 10 lore terms using data/glossary.json
(cult, dragon, tongues, sword, kingdom) while preserving original casing and
avoiding nested tags.

Example:
  python scripts/import_chapter.py path/to/10-47.txt --id 10-47 --volume "Том 47" --phase phase-4 --number "Глава 47"
"""
from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "manifest.js"
GLOSSARY_PATH = ROOT / "data" / "glossary.json"
CHAPTERS_DIR = ROOT / "data" / "chapters"

DIVIDER_RE = re.compile(r"^[※*△▼─—=-]{3,}$")
EXISTING_TAG_RE = re.compile(r"\{[a-z-]+:[^}]+\}")


def escape_template_literal(text: str) -> str:
    return text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def load_glossary() -> list[tuple[str, re.Pattern[str]]]:
    if not GLOSSARY_PATH.exists():
        return []
    data = json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))
    compiled: list[tuple[str, re.Pattern[str]]] = []
    for rule in data.get("rules", []):
        tag = rule["tag"]
        for pat in rule.get("patterns", []):
            # Use Cyrillic/word boundary guards so partial words are never matched
            regex = re.compile(rf"(?<![А-Яа-яЁёA-Za-z0-9_])(?:{pat})(?![А-Яа-яЁёA-Za-z0-9_])", re.IGNORECASE)
            compiled.append((tag, regex))
    return compiled


def apply_glossary(text: str, rules: list[tuple[str, re.Pattern[str]]]) -> tuple[str, collections.Counter]:
    counts: collections.Counter = collections.Counter()
    if not rules:
        return text, counts

    def highlight_plain_segment(segment: str) -> str:
        # Iteratively highlight without touching already-tagged spans
        for tag, regex in rules:
            parts = EXISTING_TAG_RE.split(segment)
            tags = EXISTING_TAG_RE.findall(segment)
            new_parts = []
            for part in parts:
                def _repl(m: re.Match[str]) -> str:
                    counts[tag] += 1
                    return f"{{{tag}:{m.group(0)}}}"
                new_parts.append(regex.sub(_repl, part))
            rebuilt = []
            for idx, part in enumerate(new_parts):
                rebuilt.append(part)
                if idx < len(tags):
                    rebuilt.append(tags[idx])
            segment = "".join(rebuilt)
        return segment

    out_lines = []
    for line in text.splitlines():
        stripped = line.strip()
        # Don't alter directives, dividers, or image URLs
        if not stripped or stripped == "---" or stripped.startswith(("@", ":::", "![")):
            out_lines.append(line)
        else:
            out_lines.append(highlight_plain_segment(line))
    return "\n".join(out_lines), counts


def parse_raw_txt(raw_text: str, location: str = "") -> tuple[str, str, str]:
    lines = [l.strip() for l in raw_text.replace("\r\n", "\n").splitlines()]
    idx = 0
    while idx < len(lines) and not lines[idx]:
        idx += 1

    if idx < len(lines) and re.match(r"^АРКА\s+\d+", lines[idx], re.I):
        idx += 1

    header_title = lines[idx].strip() if idx < len(lines) else ""
    if header_title.isupper():
        header_title = header_title.capitalize()
    idx += 1

    kanji = lines[idx].strip() if idx < len(lines) else ""
    idx += 1

    body_blocks: list[str] = []
    if location:
        body_blocks.append(f"@location {location.strip()}")

    for raw in lines[idx:]:
        if not raw:
            continue
        if DIVIDER_RE.match(raw):
            if body_blocks and not body_blocks[-1].startswith("@location"):
                body_blocks.append("---")
            continue
        body_blocks.append(raw)

    return header_title, kanji, "\n\n".join(body_blocks)


def load_manifest() -> dict:
    raw = MANIFEST_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.REZERO_MANIFEST\s*=\s*(\{.*\})\s*;", raw, re.S)
    if not m:
        raise SystemExit(f"Cannot parse {MANIFEST_PATH}")
    return json.loads(m.group(1))


def save_manifest(manifest: dict) -> None:
    content = (
        "// Single source of truth for Re:Zero Arc 10 catalog (works on both https:// and file:///)\n"
        "window.REZERO_MANIFEST = "
        + json.dumps(manifest, ensure_ascii=False, indent=2)
        + ";\n"
    )
    MANIFEST_PATH.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import raw .txt chapter into data/chapters/<id>.js + data/manifest.js")
    parser.add_argument("txt_file", type=Path, help="Path to source .txt file")
    parser.add_argument("--id", required=True, help="Chapter slug ID, e.g. 10-47")
    parser.add_argument("--number", required=True, help="Display number, e.g. 'Глава 47' or 'Пролог'")
    parser.add_argument("--volume", required=True, help="Volume label, e.g. 'Том 47'")
    parser.add_argument("--phase", required=True, help="Phase ID from manifest.js, e.g. phase-4")
    parser.add_argument("--title", default="", help="Override chapter title (defaults to line 2 of txt)")
    parser.add_argument("--kanji", default="", help="Override kanji title (defaults to line 3 of txt)")
    parser.add_argument("--location", default="", help="Optional opening @location tag")
    parser.add_argument("--no-glossary", action="store_true", help="Disable automatic term highlighting from data/glossary.json")
    parser.add_argument("--dry-run", action="store_true", help="Preview highlighted stats without writing files")
    args = parser.parse_args()

    parsed_title, parsed_kanji, md_body = parse_raw_txt(
        args.txt_file.read_text(encoding="utf-8-sig"),
        location=args.location,
    )
    header_title = args.title or parsed_title
    kanji = args.kanji or parsed_kanji

    counts: collections.Counter = collections.Counter()
    if not args.no_glossary:
        md_body, counts = apply_glossary(md_body, load_glossary())

    if args.dry_run:
        print(f"[DRY RUN] id={args.id}, title={header_title!r}, kanji={kanji!r}")
        print(f"Auto-highlighted terms ({sum(counts.values())} total): {dict(counts)}")
        # Print first 5 lines containing highlights
        shown = 0
        for ln in md_body.splitlines():
            if "{" in ln:
                print("  Sample:", ln[:140])
                shown += 1
                if shown >= 5:
                    break
        return

    CHAPTERS_DIR.mkdir(parents=True, exist_ok=True)
    out_js = CHAPTERS_DIR / f"{args.id}.js"
    out_js.write_text(
        f"window.REZERO_REGISTER_CHAPTER({json.dumps(args.id)}, `\n"
        f"{escape_template_literal(md_body)}\n"
        f"`);\n",
        encoding="utf-8",
    )

    manifest = load_manifest()
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

    save_manifest(manifest)
    summary = ", ".join(f"{{{k}}} ×{v}" for k, v in counts.most_common()) if counts else "нет совпадений"
    print(f"Imported {out_js} and registered '{args.id}' (order={next_order}) in {MANIFEST_PATH}")
    print(f"Auto-highlighted terms: {summary}")


if __name__ == "__main__":
    main()
