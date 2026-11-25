/**
 * Single-Page Application router and reader controller for Re:Zero Arc 10.
 * Loads chapter data lazily via dynamic <script> registration (data/chapters/<id>.js),
 * working seamlessly on both https:// (GitHub Pages) and direct file:/// double-click
 * with zero per-chapter HTML files and zero CORS errors.
 */
(function (global) {
  'use strict';

  const {
    renderChapterMarkdown,
    initSettings,
    readStorage,
    writeStorage,
    initEffects,
    observeChapterSpecials,
    observeReveals,
    setAnimationsEnabled,
  } = global.ReZeroReader;

  const PROGRESS_KEY = 'rezero-reading-progress';
  const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

  let manifest = null;
  const chaptersById = new Map();
  const chapterCache = new Map();
  const pendingChapterLoads = new Map();
  let currentChapterId = null;
  let renderToken = 0;

  const heroSection = document.getElementById('hero-section');
  const mainEl = document.getElementById('main-content');
  const navEl = document.getElementById('chapter-nav');
  const headerTitleEl = document.getElementById('header-title');
  const headerPovEl = document.getElementById('pov-indicator');
  const headerHomeLink = document.getElementById('header-home-link');

  // Global callback invoked by lazily-loaded data/chapters/<id>.js files
  global.REZERO_REGISTER_CHAPTER = function registerChapter(chapterId, markdownText) {
    chapterCache.set(chapterId, markdownText);
    const pending = pendingChapterLoads.get(chapterId);
    if (pending) {
      pending.resolve(markdownText);
      pendingChapterLoads.delete(chapterId);
    }
  };

  function loadProgress() {
    const raw = readStorage(PROGRESS_KEY);
    if (!raw) return { lastChapter: null, visited: [] };
    try {
      const data = JSON.parse(raw);
      return {
        lastChapter: typeof data.lastChapter === 'string' ? data.lastChapter : null,
        visited: Array.isArray(data.visited) ? data.visited : [],
      };
    } catch {
      return { lastChapter: null, visited: [] };
    }
  }

  function recordChapterVisit(chapterId) {
    const progress = loadProgress();
    const visitedSet = new Set(progress.visited);
    visitedSet.add(chapterId);
    writeStorage(
      PROGRESS_KEY,
      JSON.stringify({
        lastChapter: chapterId,
        visited: Array.from(visitedSet),
      })
    );
  }

  function getRouteChapterId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('chapter');
    if (fromQuery) return fromQuery.trim().toLowerCase();

    const hash = window.location.hash.replace(/^#/, '').trim();
    if (hash.startsWith('chapter=')) {
      return decodeURIComponent(hash.slice('chapter='.length)).trim().toLowerCase();
    }
    if (/^10-[a-z0-9-]+$/i.test(hash)) {
      return hash.toLowerCase();
    }
    return null;
  }

  function buildChapterHref(chapterId) {
    if (!chapterId) {
      return IS_FILE_PROTOCOL ? '#toc' : 'index.html';
    }
    return IS_FILE_PROTOCOL
      ? `#chapter=${encodeURIComponent(chapterId)}`
      : `?chapter=${encodeURIComponent(chapterId)}`;
  }

  function navigateTo(chapterId, { replace = false } = {}) {
    if (IS_FILE_PROTOCOL) {
      const targetHash = chapterId ? `#chapter=${encodeURIComponent(chapterId)}` : '#';
      if (replace) {
        window.location.replace(targetHash);
      } else if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      renderRoute(chapterId);
      return;
    }

    const href = chapterId ? `?chapter=${encodeURIComponent(chapterId)}` : './';
    try {
      if (replace) {
        window.history.replaceState({ chapterId }, '', href);
      } else {
        window.history.pushState({ chapterId }, '', href);
      }
    } catch {
      window.location.hash = chapterId ? `chapter=${encodeURIComponent(chapterId)}` : '';
    }
    renderRoute(chapterId);
  }

  function handleSpaLinkClick(event, chapterId) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigateTo(chapterId);
  }

  function loadChapterMarkdown(chapterId) {
    if (chapterCache.has(chapterId)) {
      return Promise.resolve(chapterCache.get(chapterId));
    }
    if (pendingChapterLoads.has(chapterId)) {
      return pendingChapterLoads.get(chapterId).promise;
    }

    let resolveFn;
    let rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    pendingChapterLoads.set(chapterId, { promise, resolve: resolveFn, reject: rejectFn });

    const script = document.createElement('script');
    script.src = `data/chapters/${encodeURIComponent(chapterId)}.js`;
    script.async = true;
    script.addEventListener('load', () => {
      script.remove();
      if (!chapterCache.has(chapterId) && pendingChapterLoads.has(chapterId)) {
        pendingChapterLoads.delete(chapterId);
        rejectFn(new Error('Глава не зарегистрировала содержимое'));
      }
    });
    script.addEventListener('error', () => {
      script.remove();
      if (pendingChapterLoads.has(chapterId)) {
        pendingChapterLoads.delete(chapterId);
        rejectFn(new Error(`Не удалось загрузить файл data/chapters/${chapterId}.js`));
      }
    });
    document.head.appendChild(script);

    return promise;
  }

  function prefetchNextChapter(chapterId) {
    const list = manifest?.chapters || [];
    const idx = list.findIndex((c) => c.id === chapterId);
    if (idx === -1 || idx + 1 >= list.length) return;
    const nextId = list[idx + 1].id;
    if (chapterCache.has(nextId)) return;

    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    schedule(() => {
      loadChapterMarkdown(nextId).catch(() => {});
    });
  }

  function createHeroArc(arc) {
    const wrap = document.createElement('div');
    wrap.className = 'arc-title-block';

    const kanji = document.createElement('div');
    kanji.className = 'arc-kanji';
    kanji.textContent = arc.kanji;

    const label = document.createElement('div');
    label.className = 'arc-label';
    label.textContent = arc.series;

    const h1 = document.createElement('h1');
    h1.className = 'arc-num';
    h1.textContent = arc.number;

    const title = document.createElement('div');
    title.className = 'arc-title';
    title.textContent = arc.subtitle;

    const tagline = document.createElement('div');
    tagline.className = 'arc-tagline';
    tagline.textContent = arc.tagline;

    const hint = document.createElement('a');
    hint.className = 'scroll-hint';
    hint.href = '#main-content';
    hint.textContent = '↓ К главам';
    hint.addEventListener('click', (e) => {
      e.preventDefault();
      mainEl.scrollIntoView({ behavior: document.body.classList.contains('no-anim') ? 'instant' : 'smooth' });
    });

    const scrollDown = document.createElement('div');
    scrollDown.className = 'scroll-down';
    scrollDown.setAttribute('aria-hidden', 'true');
    const ch1 = document.createElement('div');
    ch1.className = 'scroll-chevron';
    const ch2 = document.createElement('div');
    ch2.className = 'scroll-chevron scroll-chevron-secondary';
    scrollDown.append(ch1, ch2);

    wrap.append(kanji, label, h1, title, tagline, hint, scrollDown);
    return wrap;
  }

  function createHeroChapter(chapter, arc) {
    const wrap = document.createElement('div');
    wrap.className = 'chapter-title-block';

    const kanji = document.createElement('div');
    kanji.className = 'chapter-kanji';
    kanji.textContent = chapter.kanji;

    const arcLabel = document.createElement('div');
    arcLabel.className = 'chapter-arc';
    arcLabel.textContent = `${arc.series} · ${arc.number}`;

    const h1 = document.createElement('h1');
    h1.className = 'chapter-num';
    h1.textContent = chapter.number;

    const sub = document.createElement('div');
    sub.className = 'chapter-subtitle';
    sub.textContent = chapter.subtitle;

    const hint = document.createElement('a');
    hint.className = 'scroll-hint';
    hint.href = '#main-content';
    hint.textContent = '↓ Читать';
    hint.addEventListener('click', (e) => {
      e.preventDefault();
      mainEl.scrollIntoView({ behavior: document.body.classList.contains('no-anim') ? 'instant' : 'smooth' });
    });

    const scrollDown = document.createElement('div');
    scrollDown.className = 'scroll-down';
    scrollDown.setAttribute('aria-hidden', 'true');
    const ch1 = document.createElement('div');
    ch1.className = 'scroll-chevron';
    const ch2 = document.createElement('div');
    ch2.className = 'scroll-chevron scroll-chevron-secondary';
    scrollDown.append(ch1, ch2);

    wrap.append(kanji, arcLabel, h1, sub, hint, scrollDown);
    return wrap;
  }

  function createDividerEl() {
    const div = document.createElement('div');
    div.className = 'section-divider reveal';
    div.setAttribute('aria-hidden', 'true');
    const l1 = document.createElement('span');
    l1.className = 'divider-line';
    const sig = document.createElement('span');
    sig.className = 'divider-sigil';
    sig.textContent = '△▼△▼△▼△';
    const l2 = document.createElement('span');
    l2.className = 'divider-line';
    div.append(l1, sig, l2);
    return div;
  }

  function createChapterCard(chapter, isVisited) {
    const link = document.createElement('a');
    link.className = isVisited ? 'chapter-card available visited' : 'chapter-card available';
    link.href = buildChapterHref(chapter.id);
    link.addEventListener('click', (e) => handleSpaLinkClick(e, chapter.id));

    const num = document.createElement('div');
    num.className = 'card-num';
    num.textContent = chapter.badge;

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = chapter.cardTitle;

    const status = document.createElement('div');
    status.className = 'card-status status-available';
    status.textContent = isVisited ? 'Прочитано · Открыть' : 'Читать';

    body.append(title, status);

    const arrow = document.createElement('div');
    arrow.className = 'card-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';

    link.append(num, body, arrow);
    return link;
  }

  function createLockedCard(numVal) {
    const card = document.createElement('div');
    card.className = 'chapter-card locked';
    card.setAttribute('aria-disabled', 'true');

    const num = document.createElement('div');
    num.className = 'card-num';
    num.textContent = String(numVal).padStart(2, '0');

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = `Глава ${numVal}`;

    const status = document.createElement('div');
    status.className = 'card-status status-locked';
    status.textContent = 'Не залита';

    body.append(title, status);

    const lock = document.createElement('div');
    lock.className = 'card-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = '⌘';

    card.append(num, body, lock);
    return card;
  }

  function renderTocView() {
    currentChapterId = null;
    document.body.classList.remove('mode-reader');
    document.body.classList.add('mode-toc');

    const { arc, phases, chapters } = manifest;
    document.title = `Re:Zero — ${arc.number} · ${arc.title}`;
    headerTitleEl.textContent = arc.title;
    headerPovEl.textContent = arc.volumesLabel;
    navEl.hidden = true;
    navEl.replaceChildren();

    heroSection.replaceChildren(createHeroArc(arc));

    const frag = document.createDocumentFragment();
    const progress = loadProgress();
    const visitedSet = new Set(progress.visited);

    const synopsis = document.createElement('section');
    synopsis.className = 'synopsis-block reveal';
    const synLabel = document.createElement('div');
    synLabel.className = 'synopsis-label';
    synLabel.textContent = 'Об арке';
    const synText = document.createElement('p');
    synText.className = 'synopsis-text';
    synText.textContent = arc.synopsis;
    synopsis.append(synLabel, synText);
    frag.appendChild(synopsis);

    if (progress.lastChapter && chaptersById.has(progress.lastChapter)) {
      const lastCh = chaptersById.get(progress.lastChapter);
      const resume = document.createElement('a');
      resume.className = 'resume-card reveal';
      resume.href = buildChapterHref(lastCh.id);
      resume.addEventListener('click', (e) => handleSpaLinkClick(e, lastCh.id));

      const meta = document.createElement('div');
      meta.className = 'resume-meta';
      const rLabel = document.createElement('span');
      rLabel.className = 'resume-label';
      rLabel.textContent = 'Продолжить чтение';
      const rTitle = document.createElement('span');
      rTitle.className = 'resume-title';
      rTitle.textContent = `${lastCh.number} · ${lastCh.cardTitle}`;
      meta.append(rLabel, rTitle);

      const action = document.createElement('span');
      action.className = 'resume-action';
      action.textContent = 'Открыть →';

      resume.append(meta, action);
      frag.appendChild(resume);
    }

    const volTag = document.createElement('div');
    volTag.className = 'volume-tag reveal';
    volTag.textContent = arc.volumesTag;
    frag.appendChild(volTag);

    frag.appendChild(createDividerEl());

    const toolbar = document.createElement('div');
    toolbar.className = 'toc-toolbar reveal';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'toc-search';
    searchInput.placeholder = 'Поиск главы по номеру, названию или тому…';
    searchInput.setAttribute('aria-label', 'Поиск по главам');

    const countBadge = document.createElement('span');
    countBadge.className = 'toc-count';
    countBadge.textContent = `Доступно глав: ${chapters.length}`;

    toolbar.append(searchInput, countBadge);
    frag.appendChild(toolbar);

    const phasesContainer = document.createElement('div');
    phasesContainer.id = 'toc-phases';
    frag.appendChild(phasesContainer);

    function renderPhases(queryText) {
      const q = queryText.trim().toLowerCase();
      const listFrag = document.createDocumentFragment();
      let visibleCount = 0;

      for (const phase of phases) {
        const section = document.createElement('section');
        section.className = 'phase-section';

        const cards = [];
        if (phase.lockedRange) {
          if (!q) {
            const [start, end] = phase.lockedRange;
            for (let n = start; n <= end; n++) {
              cards.push(createLockedCard(n));
            }
          }
        } else {
          const phaseChapters = chapters.filter((c) => c.phaseId === phase.id);
          for (const ch of phaseChapters) {
            const hay = `${ch.number} ${ch.cardTitle} ${ch.headerTitle} ${ch.kanji} ${ch.volume} ${ch.id}`.toLowerCase();
            if (!q || hay.includes(q)) {
              cards.push(createChapterCard(ch, visitedSet.has(ch.id)));
              visibleCount += 1;
            }
          }
        }

        if (!cards.length) continue;

        const pHeader = document.createElement('div');
        pHeader.className = 'phase-header reveal';
        const pLabel = document.createElement('div');
        pLabel.className = 'phase-label';
        pLabel.textContent = phase.volume;
        const pName = document.createElement('h2');
        pName.className = 'phase-name';
        pName.textContent = phase.title;
        pHeader.append(pLabel, pName);

        const grid = document.createElement('div');
        grid.className = 'chapters-grid';
        grid.append(...cards);

        section.append(pHeader, grid);
        listFrag.appendChild(section);
      }

      if (q && visibleCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'status-card';
        const msg = document.createElement('p');
        msg.className = 'status-message';
        msg.textContent = `По запросу «${queryText.trim()}» главы не найдены.`;
        empty.appendChild(msg);
        listFrag.appendChild(empty);
      }

      countBadge.textContent = q
        ? `Найдено: ${visibleCount} из ${chapters.length}`
        : `Доступно глав: ${chapters.length}`;

      phasesContainer.replaceChildren(listFrag);
      observeReveals(phasesContainer);
    }

    searchInput.addEventListener('input', () => renderPhases(searchInput.value));

    const endMark = document.createElement('div');
    endMark.className = 'arc-end-mark reveal';
    const ek = document.createElement('span');
    ek.className = 'kanji';
    ek.textContent = arc.kanjiCompact;
    const el = document.createElement('span');
    el.className = 'label';
    el.textContent = `${arc.number} · ${arc.title}`;
    endMark.append(ek, el);
    frag.appendChild(endMark);

    mainEl.replaceChildren(frag);
    renderPhases('');
    observeReveals(mainEl);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function buildChapterNav(chapterIndex) {
    const chapters = manifest.chapters;
    const prev = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
    const next = chapterIndex + 1 < chapters.length ? chapters[chapterIndex + 1] : null;
    const current = chapters[chapterIndex];

    const frag = document.createDocumentFragment();
    const primaryRow = document.createElement('div');
    primaryRow.className = 'nav-primary-row';

    if (prev) {
      const a = document.createElement('a');
      a.className = 'nav-btn nav-btn-prev';
      a.href = buildChapterHref(prev.id);
      a.addEventListener('click', (e) => handleSpaLinkClick(e, prev.id));
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '←';
      const text = document.createElement('span');
      text.textContent = prev.number;
      a.append(icon, text);
      primaryRow.appendChild(a);
    }

    const tocBtn = document.createElement('a');
    tocBtn.className = 'nav-btn nav-btn-toc';
    tocBtn.href = buildChapterHref(null);
    tocBtn.addEventListener('click', (e) => handleSpaLinkClick(e, null));
    const tocIcon = document.createElement('span');
    tocIcon.setAttribute('aria-hidden', 'true');
    tocIcon.textContent = '☰';
    const tocText = document.createElement('span');
    tocText.textContent = 'Оглавление';
    tocBtn.append(tocIcon, tocText);
    primaryRow.appendChild(tocBtn);

    if (next) {
      const a = document.createElement('a');
      a.className = 'nav-btn nav-btn-next';
      a.href = buildChapterHref(next.id);
      a.addEventListener('click', (e) => handleSpaLinkClick(e, next.id));
      const text = document.createElement('span');
      text.textContent = next.number;
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '→';
      a.append(text, icon);
      primaryRow.appendChild(a);
    }

    frag.appendChild(primaryRow);

    const jumpRow = document.createElement('div');
    jumpRow.className = 'nav-jump-row';

    const select = document.createElement('select');
    select.className = 'nav-jump-select';
    select.setAttribute('aria-label', 'Быстрый переход к главе');
    for (const ch of chapters) {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `${ch.number} — ${ch.cardTitle}`;
      if (ch.id === current.id) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      if (select.value && select.value !== currentChapterId) {
        navigateTo(select.value);
      }
    });
    jumpRow.appendChild(select);
    frag.appendChild(jumpRow);

    navEl.replaceChildren(frag);
    navEl.hidden = false;
  }

  function createChapterEndMark(chapter) {
    const wrap = document.createElement('div');
    wrap.className = 'chapter-end-mark reveal';

    const label = document.createElement('div');
    label.className = 'chapter-end-mark-label';
    label.textContent = chapter.endLabel || 'Конец главы';

    const kanji = document.createElement('div');
    kanji.className = 'chapter-end-mark-kanji';
    kanji.textContent = chapter.kanji;

    const meta = document.createElement('div');
    meta.className = 'chapter-end-mark-meta';
    meta.textContent = `${manifest.arc.number} · ${chapter.number}`;

    wrap.append(label, kanji, meta);
    return wrap;
  }

  function renderErrorCard(message, retryFn) {
    const card = document.createElement('div');
    card.className = 'status-card';

    const p = document.createElement('p');
    p.className = 'status-message';
    p.textContent = message;
    card.appendChild(p);

    const actions = document.createElement('div');
    actions.className = 'nav-primary-row';
    actions.style.marginTop = '8px';

    if (retryFn) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'nav-btn';
      retry.textContent = 'Повторить';
      retry.addEventListener('click', retryFn);
      actions.appendChild(retry);
    }

    const back = document.createElement('a');
    back.className = 'nav-btn nav-btn-toc';
    back.href = buildChapterHref(null);
    back.textContent = 'К оглавлению';
    back.addEventListener('click', (e) => handleSpaLinkClick(e, null));
    actions.appendChild(back);

    card.appendChild(actions);
    mainEl.replaceChildren(card);
  }

  async function renderChapterView(chapterId) {
    const token = ++renderToken;
    const chapter = chaptersById.get(chapterId);

    if (!chapter) {
      document.body.classList.remove('mode-reader');
      document.body.classList.add('mode-toc');
      heroSection.replaceChildren();
      navEl.hidden = true;
      renderErrorCard(`Глава «${chapterId}» не найдена в каталоге.`, null);
      return;
    }

    currentChapterId = chapterId;
    document.body.classList.remove('mode-toc');
    document.body.classList.add('mode-reader');

    document.title = chapter.title;
    headerTitleEl.textContent = chapter.headerTitle;
    headerPovEl.textContent = chapter.volume;
    heroSection.replaceChildren(createHeroChapter(chapter, manifest.arc));

    const loading = document.createElement('div');
    loading.className = 'status-card';
    const loadingMsg = document.createElement('p');
    loadingMsg.className = 'status-message';
    loadingMsg.textContent = `Загрузка: ${chapter.number}…`;
    loading.appendChild(loadingMsg);
    mainEl.replaceChildren(loading);
    navEl.hidden = true;

    window.scrollTo({ top: 0, behavior: 'instant' });

    try {
      const mdText = await loadChapterMarkdown(chapterId);
      if (token !== renderToken) return;

      const contentFrag = renderChapterMarkdown(mdText);

      const endMark = createChapterEndMark(chapter);
      const firstNote = contentFrag.querySelector('.jp-minute');
      if (firstNote) {
        contentFrag.insertBefore(endMark, firstNote);
      } else {
        contentFrag.appendChild(endMark);
      }

      mainEl.replaceChildren(contentFrag);
      recordChapterVisit(chapterId);

      const chapterIndex = manifest.chapters.findIndex((c) => c.id === chapterId);
      buildChapterNav(chapterIndex);

      observeReveals(mainEl);
      observeChapterSpecials(mainEl);
      prefetchNextChapter(chapterId);
    } catch (err) {
      if (token !== renderToken) return;
      renderErrorCard(
        `Не удалось загрузить текст главы (${err.message}).`,
        () => renderChapterView(chapterId)
      );
    }
  }

  function renderRoute(chapterId) {
    if (!manifest) return;
    if (chapterId) {
      renderChapterView(chapterId);
    } else {
      renderTocView();
    }
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (!currentChapterId || !manifest) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const idx = manifest.chapters.findIndex((c) => c.id === currentChapterId);
      if (idx === -1) return;

      if (event.key === 'ArrowLeft' && idx > 0) {
        navigateTo(manifest.chapters[idx - 1].id);
      } else if (event.key === 'ArrowRight' && idx + 1 < manifest.chapters.length) {
        navigateTo(manifest.chapters[idx + 1].id);
      }
    });
  }

  function bootstrap() {
    initEffects();
    initSettings({ onAnimChange: setAnimationsEnabled });
    initKeyboardShortcuts();

    if (headerHomeLink) {
      headerHomeLink.href = buildChapterHref(null);
      headerHomeLink.addEventListener('click', (e) => handleSpaLinkClick(e, null));
    }

    window.addEventListener('popstate', () => {
      renderRoute(getRouteChapterId());
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#main-content') return;
      const id = getRouteChapterId();
      if (id !== currentChapterId) {
        renderRoute(id);
      }
    });

    if (!global.REZERO_MANIFEST || !Array.isArray(global.REZERO_MANIFEST.chapters)) {
      renderErrorCard('Не удалось загрузить каталог глав (data/manifest.js).', () => window.location.reload());
      return;
    }

    manifest = global.REZERO_MANIFEST;
    manifest.chapters.sort((a, b) => a.order - b.order);
    chaptersById.clear();
    for (const ch of manifest.chapters) {
      chaptersById.set(ch.id, ch);
    }
    renderRoute(getRouteChapterId());
  }

  bootstrap();
})(window);
