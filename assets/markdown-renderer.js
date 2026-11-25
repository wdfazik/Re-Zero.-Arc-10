/**
 * Pure-DOM Markdown renderer for Re:Zero Arc 10 chapters.
 * Builds DOM nodes exclusively via createElement/textContent (zero innerHTML)
 * to eliminate DOM-XSS surface by construction.
 */

const INLINE_TAG_CLASSES = Object.freeze({
  cult: 'cult-mention',
  dragon: 'dragon-mention',
  kingdom: 'kingdom-mention',
  tongues: 'tongues-mention',
  'six-tongues': 'org-six-tongues',
  sword: 'dragon-sword',
  lust: 'archbishop-lust',
  sloth: 'archbishop-sloth',
  gluttony: 'archbishop-gluttony',
  'blue-snake': 'blue-snake',
  'black-dog': 'black-dog',
  'white-sheep': 'white-sheep',
});

const MOMENT_VARIANTS = new Set([
  'shock',
  'anger',
  'resolve',
  'heavy',
  'warmth',
  'krusch',
  'battle',
]);

const SAFE_SPEAKER_CLASS = /^sp-[a-z0-9-]+$/;

function isSafeImageUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('./') || trimmed.startsWith('assets/') || trimmed.startsWith('../')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, window.location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Append inline formatted text supporting:
 * - {tag:content} semantic lore spans (strict allowlist)
 * - *emphasis* italic spans (may contain {tag:...} inside)
 */
function appendInline(parent, text) {
  let i = 0;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      parent.appendChild(document.createTextNode(buffer));
      buffer = '';
    }
  };

  while (i < text.length) {
    const ch = text[i];

    // Semantic highlight: {tag:inner}
    if (ch === '{') {
      const colonIdx = text.indexOf(':', i + 1);
      const closeIdx = colonIdx !== -1 ? text.indexOf('}', colonIdx + 1) : -1;
      if (colonIdx !== -1 && closeIdx !== -1) {
        const tagKey = text.slice(i + 1, colonIdx);
        const cssClass = INLINE_TAG_CLASSES[tagKey];
        if (cssClass) {
          flush();
          const span = document.createElement('span');
          span.className = cssClass;
          appendInline(span, text.slice(colonIdx + 1, closeIdx));
          parent.appendChild(span);
          i = closeIdx + 1;
          continue;
        }
      }
    }

    // Emphasis: *inner*
    if (ch === '*') {
      const closeIdx = text.indexOf('*', i + 1);
      if (closeIdx !== -1 && closeIdx > i + 1) {
        flush();
        const em = document.createElement('em');
        appendInline(em, text.slice(i + 1, closeIdx));
        parent.appendChild(em);
        i = closeIdx + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
}

function createParagraph(className, text) {
  const p = document.createElement('p');
  p.className = className;
  appendInline(p, text);
  return p;
}

function createDialogue(line, addReveal) {
  // Format: @dialogue [sp-krusch emotional] Круш: — Текст...
  let rest = line.slice('@dialogue'.length).trim();
  let speakerClass = '';
  let emotional = false;

  if (rest.startsWith('[')) {
    const endBracket = rest.indexOf(']');
    if (endBracket !== -1) {
      const tokens = rest.slice(1, endBracket).trim().split(/\s+/);
      for (const tok of tokens) {
        if (tok === 'emotional') {
          emotional = true;
        } else if (SAFE_SPEAKER_CLASS.test(tok)) {
          speakerClass = tok;
        }
      }
      rest = rest.slice(endBracket + 1).trim();
    }
  }

  let speakerName = '';
  let dialogueText = rest;
  if (rest.startsWith('—:')) {
    dialogueText = rest.slice(2).trim();
  } else {
    const colonIdx = rest.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40 && !rest.startsWith('—')) {
      speakerName = rest.slice(0, colonIdx).trim();
      dialogueText = rest.slice(colonIdx + 1).trim();
    }
  }

  const block = document.createElement('div');
  block.className = addReveal ? 'dialogue-block reveal' : 'dialogue-block';

  if (speakerName) {
    const tag = document.createElement('span');
    tag.className = speakerClass ? `speaker-tag ${speakerClass}` : 'speaker-tag';
    tag.textContent = speakerName;
    block.appendChild(tag);
  }

  const textSpan = document.createElement('span');
  const textClasses = ['dialogue-text'];
  if (speakerClass) textClasses.push(speakerClass);
  if (emotional) textClasses.push('emotional');
  textSpan.className = textClasses.join(' ');
  appendInline(textSpan, dialogueText);
  block.appendChild(textSpan);

  return block;
}

function createDivider() {
  const div = document.createElement('div');
  div.className = 'section-divider reveal';
  div.setAttribute('aria-hidden', 'true');

  const line1 = document.createElement('span');
  line1.className = 'divider-line';

  const sigil = document.createElement('span');
  sigil.className = 'divider-sigil';
  sigil.textContent = '△▼△▼△▼△';

  const line2 = document.createElement('span');
  line2.className = 'divider-line';

  div.append(line1, sigil, line2);
  return div;
}

function createIllustration(altText, url) {
  const figure = document.createElement('figure');
  figure.className = 'chapter-illustration reveal';

  if (isSafeImageUrl(url)) {
    const img = document.createElement('img');
    img.src = url.trim();
    img.alt = altText;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      figure.classList.add('img-failed');
      if (!figure.querySelector('figcaption')) {
        const cap = document.createElement('figcaption');
        cap.textContent = altText
          ? `Иллюстрация недоступна: ${altText}`
          : 'Иллюстрация временно недоступна';
        figure.appendChild(cap);
      }
    });
    figure.appendChild(img);
  }

  return figure;
}

function createFencedBlock(kind, arg, bodyLines) {
  const paragraphs = splitParagraphs(bodyLines);

  if (kind === 'moment') {
    const variant = MOMENT_VARIANTS.has(arg) ? arg : 'resolve';
    const box = document.createElement('div');
    box.className = `moment moment-${variant} reveal`;
    for (const para of paragraphs) {
      if (para.startsWith('@dialogue')) {
        box.appendChild(createDialogue(para, false));
      } else if (para.startsWith('@italic-center ')) {
        box.appendChild(
          createParagraph('moment-text moment-text-italic-center', para.slice('@italic-center '.length))
        );
      } else {
        box.appendChild(createParagraph('moment-text', para));
      }
    }
    return box;
  }

  if (kind === 'dragon-eye') {
    const box = document.createElement('div');
    box.className = 'dragon-eye-reveal reveal';
    for (const para of paragraphs) {
      box.appendChild(createParagraph('dragon-eye-text', para));
    }
    return box;
  }

  if (kind === 'return') {
    const box = document.createElement('div');
    box.className = 'return-block reveal';
    for (const para of paragraphs) {
      box.appendChild(createParagraph('return-text', para));
    }
    return box;
  }

  if (kind === 'inner-fire') {
    const box = document.createElement('div');
    box.className = 'inner-fire reveal';
    for (const para of paragraphs) {
      box.appendChild(createParagraph('', para));
    }
    return box;
  }

  if (kind === 'note') {
    const details = document.createElement('details');
    details.className = 'jp-minute reveal';

    const summary = document.createElement('summary');
    summary.className = 'jp-minute-toggle';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = arg || 'Примечание переводчика';
    const arrow = document.createElement('span');
    arrow.className = 'jp-minute-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '▾';
    summary.append(titleSpan, arrow);

    const content = document.createElement('div');
    content.className = 'jp-minute-content';
    for (const para of paragraphs) {
      content.appendChild(createParagraph('narr', para));
    }

    details.append(summary, content);
    return details;
  }

  const fallback = document.createElement('div');
  for (const para of paragraphs) {
    fallback.appendChild(createParagraph('narr reveal', para));
  }
  return fallback;
}

function splitParagraphs(lines) {
  const result = [];
  let current = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) {
        result.push(current.join(' '));
        current = [];
      }
    } else if (trimmed.startsWith('@dialogue') || trimmed.startsWith('@italic-center')) {
      if (current.length) {
        result.push(current.join(' '));
        current = [];
      }
      result.push(trimmed);
    } else {
      current.push(trimmed);
    }
  }
  if (current.length) {
    result.push(current.join(' '));
  }
  return result;
}

export function renderChapterMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    // Fenced blocks: :::moment shock ... :::
    if (line.startsWith(':::')) {
      const header = line.slice(3).trim();
      const spaceIdx = header.indexOf(' ');
      const kind = spaceIdx === -1 ? header : header.slice(0, spaceIdx);
      const arg = spaceIdx === -1 ? '' : header.slice(spaceIdx + 1).trim();
      const bodyLines = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== ':::') {
        bodyLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing :::
      fragment.appendChild(createFencedBlock(kind, arg, bodyLines));
      continue;
    }

    if (line === '---') {
      fragment.appendChild(createDivider());
      i += 1;
      continue;
    }

    if (line.startsWith('@location ')) {
      const loc = document.createElement('div');
      loc.className = 'location-tag reveal';
      appendInline(loc, line.slice('@location '.length).trim());
      fragment.appendChild(loc);
      i += 1;
      continue;
    }

    if (line.startsWith('@pov ')) {
      const rest = line.slice('@pov '.length).trim();
      let povName = '';
      let subtitle = rest;
      if (rest.startsWith('[')) {
        const end = rest.indexOf(']');
        if (end !== -1) {
          povName = rest.slice(1, end).trim();
          subtitle = rest.slice(end + 1).trim();
        }
      }
      const povEl = document.createElement('div');
      povEl.className = 'pov-header';
      if (povName) povEl.dataset.pov = povName;
      const subEl = document.createElement('div');
      subEl.className = 'pov-subtitle';
      subEl.textContent = subtitle;
      povEl.appendChild(subEl);
      fragment.appendChild(povEl);
      i += 1;
      continue;
    }

    if (line.startsWith('@dialogue')) {
      fragment.appendChild(createDialogue(line, true));
      i += 1;
      continue;
    }

    if (line.startsWith('@italic ')) {
      fragment.appendChild(createParagraph('italic-narr reveal', line.slice('@italic '.length).trim()));
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      fragment.appendChild(createParagraph('thought reveal', line.slice(2).trim()));
      i += 1;
      continue;
    }

    // Markdown image: ![alt](url)
    const imgMatch = line.match(/^!\[((?:\\\]|[^\]])*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1].replace(/\\\]/g, ']');
      const url = imgMatch[2];
      fragment.appendChild(createIllustration(alt, url));
      i += 1;
      continue;
    }

    // Standard paragraph (collect consecutive plain lines)
    const paraLines = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next === '---' ||
        next.startsWith(':::') ||
        next.startsWith('@') ||
        next.startsWith('> ') ||
        next.startsWith('![')
      ) {
        break;
      }
      paraLines.push(next);
      i += 1;
    }
    fragment.appendChild(createParagraph('narr reveal', paraLines.join(' ')));
  }

  return fragment;
}
