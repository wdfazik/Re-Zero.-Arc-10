#!/usr/bin/env python3
"""Build static Re:Zero pages from shared templates and chapter content.

Edit chapter text in content/chapters/*.html and metadata in content/chapters.json,
then run: python3 scripts/build.py
"""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS_PATH = ROOT / "content" / "chapters.json"
CHAPTER_TEMPLATE = ROOT / "templates" / "chapter.html"
INDEX_TEMPLATE = ROOT / "templates" / "index.html"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def render_template(template: str, values: dict[str, str]) -> str:
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", value)
    return template


def nav_button(href: str, css: str, icon_left: str, label: str, icon_right: str = "") -> str:
    if icon_left:
        body = f'    <span class="nav-icon">{icon_left}</span>\n    <span>{html.escape(label)}</span>'
    else:
        body = f'    <span>{html.escape(label)}</span>\n    <span class="nav-icon">{icon_right}</span>'
    return f'  <a href="{href}" class="nav-btn {css}">\n{body}\n  </a>'


def build_navigation(chapters: list[dict], index: int) -> str:
    prev_chapter = chapters[index - 1] if index > 0 else None
    next_chapter = chapters[index + 1] if index + 1 < len(chapters) else None
    parts = ['<nav class="nav-buttons">']
    if prev_chapter:
        parts.append(nav_button(prev_chapter["file"], "nav-btn-prev", "←", prev_chapter["number"]))
    parts.append(nav_button("index.html", "nav-btn-toc", "☰", "Оглавление"))
    if next_chapter:
        parts.append(nav_button(next_chapter["file"], "nav-btn-next", "", next_chapter["number"], "→"))
    parts.append("</nav>")
    return "\n".join(parts)


def chapter_card(chapter: dict) -> str:
    number = chapter["number"]
    title_source = chapter.get("cardTitle") or chapter.get("headerTitle") or chapter.get("subtitle", "")
    title = html.escape(title_source.strip("«»"))
    if number == "Пролог":
        card_num = "P"
    elif number == "Интерлюдия":
        card_num = "I"
    else:
        card_num = html.escape(number.replace("Глава ", ""))
    return f'''    <a class="chapter-card available" href="{chapter["file"]}">
      <div class="card-num">{card_num}</div>
      <div class="card-body">
        <div class="card-title">{title}</div>
        <div class="card-status status-available">Читать</div>
      </div>
      <div class="card-arrow">›</div>
    </a>'''


def locked_card(number: int) -> str:
    return f'''    <div class="chapter-card" style="opacity:0.38; pointer-events: none;">
      <div class="card-num">{number:02d}</div>
      <div class="card-body">
        <div class="card-title">Глава {number}</div>
        <div class="card-status status-locked">Не залита</div>
      </div>
      <div class="card-lock">⌘</div>
    </div>'''


def phase(title: str, volume: str, cards: list[str], extra_style: str = "") -> str:
    style = f' style="{extra_style}"' if extra_style else ""
    return f'''  <div class="phase-header reveal"{style}>
    <div class="phase-label">{html.escape(volume)}</div>
    <div class="phase-name">{html.escape(title)}</div>
  </div>

  <div class="chapters-grid">

{chr(10).join(cards)}
  </div>'''


def build_chapter_sections(chapters: list[dict]) -> str:
    by_file = {chapter["file"]: chapter for chapter in chapters}
    phase_one = [locked_card(i) for i in range(1, 13)]
    phase_two_names = ["10-prologue2.html"] + [f"10-{i}.html" for i in range(13, 25)] + ["10-interlude2.html"]
    phase_three_names = [f"10-{i}.html" for i in range(25, 29)] + ["10-interlude3.html", "10-29.html", "10-30.html"]
    phase_two = [chapter_card(by_file[name]) for name in phase_two_names if name in by_file]
    phase_three = [chapter_card(by_file[name]) for name in phase_three_names if name in by_file]
    return "\n\n".join([
        phase("Первая фаза", "Том 44", phase_one),
        phase("Вторая фаза", "Том 45", phase_two, "margin-top: 60px;"),
        phase("Третья фаза", "Том 46", phase_three, "margin-top: 60px;"),
    ])


def main() -> None:
    chapters = json.loads(read_text(CHAPTERS_PATH))
    chapters.sort(key=lambda item: item["order"])
    chapter_template = read_text(CHAPTER_TEMPLATE)

    for index, chapter in enumerate(chapters):
        content = read_text(ROOT / chapter["content"]).rstrip()
        html_text = render_template(chapter_template, {
            "title": chapter["title"],
            "headerTitle": chapter["headerTitle"],
            "volume": chapter["volume"],
            "kanji": chapter["kanji"],
            "number": chapter["number"],
            "subtitle": chapter["subtitle"],
            "content": content,
            "navigation": build_navigation(chapters, index),
            "jpNotesScript": '<script src="assets/jp-notes.js" defer></script>\n' if 'jp-minute-toggle' in content else '',
        })
        write_text(ROOT / chapter["file"], html_text)

    index_template = read_text(INDEX_TEMPLATE)
    write_text(ROOT / "index.html", render_template(index_template, {
        "chapterSections": build_chapter_sections(chapters),
    }))


if __name__ == "__main__":
    main()
