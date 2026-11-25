#!/usr/bin/env python3
"""Validate Re:Zero Arc 10 manifest (data/manifest.js) and chapters (data/chapters/*.js).

Usage:
  python scripts/validate.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "manifest.js"
CHAPTERS_DIR = ROOT / "data" / "chapters"

ALLOWED_TAGS = {
    "cult", "dragon", "kingdom", "tongues", "six-tongues", "sword",
    "lust", "sloth", "gluttony", "blue-snake", "black-dog", "white-sheep",
}
ALLOWED_MOMENTS = {"shock", "anger", "resolve", "heavy", "warmth", "krusch", "battle"}
ALLOWED_FENCES = {"moment", "dragon-eye", "return", "inner-fire", "note"}


def load_manifest() -> dict:
    raw = MANIFEST_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.REZERO_MANIFEST\s*=\s*(\{.*\})\s*;", raw, re.S)
    if not m:
        raise ValueError("Cannot parse window.REZERO_MANIFEST object in data/manifest.js")
    return json.loads(m.group(1))


def extract_chapter_markdown(js_text: str, expected_id: str) -> str:
    m = re.match(
        r"^\s*window\.REZERO_REGISTER_CHAPTER\(\s*(['\"])([^'\"]+)\1\s*,\s*`(.*)`\s*\)\s*;\s*$",
        js_text,
        re.S,
    )
    if not m:
        raise ValueError("File must call window.REZERO_REGISTER_CHAPTER('<id>', `...`);")
    if m.group(2) != expected_id:
        raise ValueError(f"Registered id {m.group(2)!r} does not match filename id {expected_id!r}")
    return m.group(3).replace("\\`", "`").replace("\\${", "${").replace("\\\\", "\\")


def validate() -> list[str]:
    errors: list[str] = []

    legacy_html = sorted(p.name for p in ROOT.glob("10-*.html"))
    if legacy_html:
        errors.append(f"Found legacy root chapter HTML files ({len(legacy_html)}): {legacy_html[:5]}")

    if not MANIFEST_PATH.exists():
        return [f"Missing manifest: {MANIFEST_PATH}"]

    try:
        manifest = load_manifest()
    except Exception as exc:
        return [f"Manifest error: {exc}"]

    phase_ids = {p["id"] for p in manifest.get("phases", [])}
    chapters = manifest.get("chapters", [])

    seen_ids: set[str] = set()
    seen_orders: set[int] = set()
    referenced_files: set[str] = set()

    for ch in chapters:
        ch_id = ch.get("id", "")
        if not re.match(r"^[a-z0-9-]+$", ch_id):
            errors.append(f"Invalid chapter id: {ch_id!r}")
        if ch_id in seen_ids:
            errors.append(f"Duplicate chapter id: {ch_id}")
        seen_ids.add(ch_id)

        order = ch.get("order")
        if order in seen_orders:
            errors.append(f"Duplicate chapter order {order} on {ch_id}")
        seen_orders.add(order)

        if ch.get("phaseId") not in phase_ids:
            errors.append(f"Unknown phaseId {ch.get('phaseId')!r} on {ch_id}")

        js_path = CHAPTERS_DIR / f"{ch_id}.js"
        referenced_files.add(js_path.name)
        if not js_path.exists():
            errors.append(f"Missing chapter file: {js_path}")
            continue

        try:
            text = extract_chapter_markdown(js_path.read_text(encoding="utf-8"), ch_id)
        except Exception as exc:
            errors.append(f"{js_path.name}: {exc}")
            continue

        lines = text.splitlines()

        raw_html = re.findall(r"</?(?:p|div|span|script|style|iframe|figure|img)\b", text, re.I)
        if raw_html:
            errors.append(f"{js_path.name}: contains raw HTML tags: {raw_html[:5]}")

        in_fence = False
        for ln, raw in enumerate(lines, 1):
            stripped = raw.strip()
            if stripped.startswith(":::"):
                if stripped == ":::":
                    if not in_fence:
                        errors.append(f"{js_path.name}:{ln}: unexpected closing ':::'")
                    in_fence = False
                else:
                    if in_fence:
                        errors.append(f"{js_path.name}:{ln}: nested ':::' block")
                    header = stripped[3:].strip()
                    parts = header.split(None, 1)
                    kind = parts[0] if parts else ""
                    arg = parts[1] if len(parts) > 1 else ""
                    if kind not in ALLOWED_FENCES:
                        errors.append(f"{js_path.name}:{ln}: unknown block type ':::{kind}'")
                    if kind == "moment" and arg not in ALLOWED_MOMENTS:
                        errors.append(f"{js_path.name}:{ln}: unknown moment variant {arg!r}")
                    in_fence = True

            img_m = re.match(r"^!\[(?:\\\]|[^\]])*\]\(([^)]+)\)$", stripped)
            if img_m:
                url = img_m.group(1).strip()
                if not (url.startswith("https://") or url.startswith("http://") or url.startswith("./") or url.startswith("assets/")):
                    errors.append(f"{js_path.name}:{ln}: unsafe image URL {url!r}")

            for tag_m in re.finditer(r"\{([a-z-]+):[^}]+\}", stripped):
                if tag_m.group(1) not in ALLOWED_TAGS:
                    errors.append(f"{js_path.name}:{ln}: unknown inline tag {tag_m.group(1)!r}")

        if in_fence:
            errors.append(f"{js_path.name}: unclosed ':::' block at EOF")

    actual_files = {p.name for p in CHAPTERS_DIR.glob("*")}
    orphans = sorted(actual_files - referenced_files)
    if orphans:
        errors.append(f"Unreferenced files in data/chapters/: {orphans}")

    return errors


def main() -> int:
    errors = validate()
    if errors:
        print(f"VALIDATION FAILED ({len(errors)} error(s)):")
        for err in errors:
            print(f"  - {err}")
        return 1
    manifest = load_manifest()
    print(f"VALIDATION PASSED: {len(manifest['chapters'])} chapters, 0 errors, 0 legacy HTML files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
