(function () {
  'use strict';
  const KEY = 'rezero-bookmarks-v1';
  const main = document.getElementById('main-content');
  if (!main) return;
  let items = read();
  let toolbar = null;
  let panel = null;
  let toastTimer = null;

  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data.filter(x => x && typeof x.id === 'string' && typeof x.chapterId === 'string' && Number.isInteger(x.blockIndex) && typeof x.quote === 'string') : [];
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch { toast('Не удалось сохранить: хранилище недоступно.'); return false; }
  }
  function chapterId() {
    const params = new URLSearchParams(location.search);
    if (params.get('chapter')) return params.get('chapter').trim().toLowerCase();
    const hash = location.hash.slice(1);
    if (hash.startsWith('chapter=')) return decodeURIComponent(hash.slice(8)).toLowerCase();
    return /^10-[a-z0-9-]+$/i.test(hash) ? hash.toLowerCase() : null;
  }
  function title() { return document.getElementById('header-title')?.textContent?.trim() || 'Глава'; }
  function blocks() { return Array.from(main.querySelectorAll('p, .dialogue-block')); }
  function indexBlocks() { blocks().forEach((el, i) => { el.dataset.readerBlock = String(i); }); }
  function toast(message) {
    let el = document.getElementById('bookmark-toast');
    if (!el) { el = document.createElement('div'); el.id = 'bookmark-toast'; el.setAttribute('role', 'status'); document.body.append(el); }
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2300);
  }
  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', '');
    area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.append(area); area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    area.remove();
    toast(ok ? 'Текст скопирован.' : 'Не удалось скопировать текст.');
  }
  function copy(text) {
    if (!text) return;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('Текст скопирован.'), () => fallbackCopy(text));
    else fallbackCopy(text);
  }
  function addBookmark(quote, index) {
    const id = chapterId();
    if (!id || index < 0) return;
    if (items.some(x => x.chapterId === id && x.blockIndex === index && x.quote === quote)) { toast('Такая закладка уже существует.'); return; }
    items.unshift({ id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8), chapterId: id, chapterTitle: title(), blockIndex: index, quote: quote.slice(0, 500), createdAt: new Date().toISOString() });
    if (save()) { renderPanel(); toast('Закладка добавлена.'); }
  }
  function hideToolbar() { if (toolbar) toolbar.classList.remove('visible'); }
  function ensureToolbar() {
    if (toolbar) return;
    toolbar = document.createElement('div');
    toolbar.id = 'selection-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Действия с выделенным текстом');
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button'; copyBtn.textContent = 'Копировать';
    copyBtn.addEventListener('click', () => { const text = window.getSelection()?.toString().trim(); if (text) copy(text); hideToolbar(); });
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; saveBtn.textContent = 'В закладки';
    saveBtn.addEventListener('click', () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      const node = selection?.anchorNode;
      const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      const block = el?.closest('[data-reader-block]');
      if (text && block) addBookmark(text, Number(block.dataset.readerBlock));
      hideToolbar();
    });
    toolbar.append(copyBtn, saveBtn);
    toolbar.addEventListener('mousedown', e => e.preventDefault());
    document.body.append(toolbar);
  }
  function updateToolbar() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection.rangeCount || !chapterId()) { hideToolbar(); return; }
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el || !main.contains(el) || !el.closest('[data-reader-block]')) { hideToolbar(); return; }
    ensureToolbar();
    const rect = range.getBoundingClientRect();
    toolbar.style.top = Math.max(8, rect.top - 48) + 'px';
    toolbar.style.left = Math.min(Math.max(8, rect.left + rect.width / 2 - 112), window.innerWidth - 232) + 'px';
    toolbar.classList.add('visible');
  }
  function ensurePanel() {
    const button = document.createElement('button');
    button.id = 'bookmarks-toggle'; button.type = 'button'; button.title = 'Закладки';
    button.setAttribute('aria-label', 'Открыть закладки'); button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.75h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.75a1 1 0 0 1 1-1Z"/></svg>';
    panel = document.createElement('aside');
    panel.id = 'bookmarks-panel'; panel.setAttribute('aria-label', 'Сохранённые закладки');
    panel.innerHTML = '<div class="bookmarks-heading"><span>Закладки</span><button type="button" class="bookmarks-close" aria-label="Закрыть">×</button></div><div class="bookmarks-list"></div>';
    button.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      button.classList.toggle('active', open); button.setAttribute('aria-expanded', String(open));
      if (open) renderPanel();
    });
    panel.querySelector('.bookmarks-close').addEventListener('click', closePanel);
    document.body.append(button, panel);
    renderPanel();
  }
  function closePanel() {
    panel?.classList.remove('open');
    const button = document.getElementById('bookmarks-toggle');
    button?.classList.remove('active'); button?.setAttribute('aria-expanded', 'false');
  }
  function renderPanel() {
    if (!panel) return;
    const list = panel.querySelector('.bookmarks-list');
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p'); empty.className = 'bookmarks-empty';
      empty.textContent = 'Здесь пока нет закладок. Выдели фрагмент текста и нажми «В закладки».';
      list.append(empty); return;
    }
    items.forEach(item => {
      const card = document.createElement('article'); card.className = 'bookmark-item';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'bookmark-open';
      const heading = document.createElement('span'); heading.className = 'bookmark-chapter'; heading.textContent = item.chapterTitle || item.chapterId;
      const quote = document.createElement('span'); quote.className = 'bookmark-quote'; quote.textContent = '«' + item.quote + '»';
      open.append(heading, quote); open.addEventListener('click', () => openBookmark(item));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'bookmark-remove'; remove.textContent = 'Удалить';
      remove.setAttribute('aria-label', 'Удалить закладку: ' + item.quote.slice(0, 60));
      remove.addEventListener('click', () => { items = items.filter(x => x.id !== item.id); save(); renderPanel(); });
      card.append(open, remove); list.append(card);
    });
  }
  function openBookmark(item) {
    const url = new URL(location.href);
    url.searchParams.set('chapter', item.chapterId);
    url.hash = 'bookmark-' + item.blockIndex;
    if (chapterId() === item.chapterId) {
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      scrollToBookmark(item.blockIndex);
    } else location.href = url.pathname + url.search + url.hash;
    closePanel();
  }
  function scrollToBookmark(index) {
    indexBlocks();
    const target = blocks()[index];
    if (!target) return;
    target.classList.add('bookmark-target');
    target.scrollIntoView({ behavior: document.body.classList.contains('no-anim') ? 'instant' : 'smooth', block: 'center' });
    setTimeout(() => target.classList.remove('bookmark-target'), 2400);
  }
  function restoreFromHash() {
    const match = location.hash.match(/^#bookmark-(\d+)$/);
    if (match) requestAnimationFrame(() => requestAnimationFrame(() => scrollToBookmark(Number(match[1]))));
  }
  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains('mode-reader')) return;
    indexBlocks(); restoreFromHash();
  });
  observer.observe(main, { childList: true, subtree: true });
  document.addEventListener('selectionchange', updateToolbar);
  document.addEventListener('scroll', hideToolbar, { passive: true, capture: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideToolbar(); closePanel(); } });
  ensurePanel();
})();