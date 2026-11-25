/**
 * Unified settings, theme management, lazy Google Font loading,
 * and conditional Popover / Invoker Commands polyfills.
 * Works identically on https:// (GitHub Pages) and direct file:/// opens.
 */
(function (global) {
  'use strict';

  const SETTINGS_KEY = 'rezero-settings';
  const THEME_KEY = 'rezero-theme';

  const OPTIONAL_GOOGLE_FONTS = Object.freeze({
    Merriweather: 'Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400',
    Lora: 'Lora:ital,wght@0,400;0,600;1,400',
    'PT Serif': 'PT+Serif:ital,wght@0,400;0,700;1,400',
    'Libre Baskerville': 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
    'Source Serif 4': 'Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400',
    Nunito: 'Nunito:ital,wght@0,300;0,400;0,600;1,300;1,400',
    'Comic Neue': 'Comic+Neue:ital,wght@0,400;0,700;1,400',
  });

  const FONT_STACKS = Object.freeze({
    'EB Garamond': "'EB Garamond', Georgia, serif",
    Merriweather: "'Merriweather', Georgia, serif",
    Lora: "'Lora', Georgia, serif",
    'PT Serif': "'PT Serif', Georgia, serif",
    'Libre Baskerville': "'Libre Baskerville', Georgia, serif",
    'Source Serif 4': "'Source Serif 4', Georgia, serif",
    Nunito: "'Nunito', system-ui, sans-serif",
    'Comic Neue': "'Comic Neue', 'Comic Sans MS', cursive",
  });

  const loadedFonts = new Set(['EB Garamond']);

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors (private mode / blocked storage)
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }

  function loadSettings() {
    const raw = readStorage(SETTINGS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveSettings(patch) {
    const current = loadSettings();
    writeStorage(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
  }

  function ensureFontLoaded(fontName) {
    if (loadedFonts.has(fontName)) return;
    const spec = OPTIONAL_GOOGLE_FONTS[fontName];
    if (!spec) return;
    loadedFonts.add(fontName);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
  }

  function getSystemScheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyColorSchemeMeta(override) {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (override === 'light' || override === 'dark') {
      if (meta) meta.content = override;
      document.documentElement.dataset.theme = override;
    } else {
      if (meta) meta.content = 'light dark';
      delete document.documentElement.dataset.theme;
    }
  }

  async function initPopoverFallbacks(toggleBtn, panel) {
    const hasPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
    const hasCommands = 'commandForElement' in HTMLButtonElement.prototype;

    if (!hasPopover) {
      try {
        await import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js');
      } catch {
        // Offline / file:// fallback handled below
      }
    }

    if (!hasCommands) {
      try {
        await import('https://esm.run/invokers-polyfill');
      } catch {
        // Offline / file:// fallback handled below
      }
    }

    if (!('commandForElement' in HTMLButtonElement.prototype)) {
      toggleBtn.addEventListener('click', () => {
        if (typeof panel.togglePopover === 'function') {
          panel.togglePopover();
        } else {
          const isOpen = panel.classList.toggle(':popover-open');
          toggleBtn.setAttribute('aria-expanded', String(isOpen));
          toggleBtn.classList.toggle('active', isOpen);
        }
      });

      if (typeof panel.togglePopover !== 'function') {
        document.addEventListener('click', (e) => {
          if (
            panel.classList.contains(':popover-open') &&
            !panel.contains(e.target) &&
            e.target !== toggleBtn &&
            !toggleBtn.contains(e.target)
          ) {
            panel.classList.remove(':popover-open');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.classList.remove('active');
          }
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && panel.classList.contains(':popover-open')) {
            panel.classList.remove(':popover-open');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.classList.remove('active');
            toggleBtn.focus();
          }
        });
      }
    }
  }

  function initSettings({ onAnimChange } = {}) {
    const themeBtn = document.getElementById('theme-toggle');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const fontBtns = document.querySelectorAll('#font-btns .settings-btn');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');
    const widthSlider = document.getElementById('width-slider');
    const widthVal = document.getElementById('width-val');
    const alignBtns = document.querySelectorAll('#align-btns .settings-btn');
    const animOn = document.getElementById('anim-on');
    const animOff = document.getElementById('anim-off');
    const momentsOn = document.getElementById('moments-on');
    const momentsOff = document.getElementById('moments-off');

    const initialTheme = readStorage(THEME_KEY);
    applyColorSchemeMeta(initialTheme === 'light' || initialTheme === 'dark' ? initialTheme : null);

    themeBtn?.addEventListener('click', () => {
      const stored = readStorage(THEME_KEY);
      const system = getSystemScheme();
      const currentRendered = stored === 'light' || stored === 'dark' ? stored : system;
      const target = currentRendered === 'dark' ? 'light' : 'dark';

      if (target === system) {
        removeStorage(THEME_KEY);
        applyColorSchemeMeta(null);
      } else {
        writeStorage(THEME_KEY, target);
        applyColorSchemeMeta(target);
      }
    });

    window.addEventListener('storage', (event) => {
      if (event.key === THEME_KEY) {
        const val = event.newValue;
        applyColorSchemeMeta(val === 'light' || val === 'dark' ? val : null);
      } else if (event.key === SETTINGS_KEY) {
        applyAllFromStorage();
      }
    });

    if (settingsToggle && settingsPanel) {
      initPopoverFallbacks(settingsToggle, settingsPanel);
      settingsPanel.addEventListener('toggle', (event) => {
        const isOpen = event.newState === 'open';
        settingsToggle.setAttribute('aria-expanded', String(isOpen));
        settingsToggle.classList.toggle('active', isOpen);
      });
    }

    function applyFont(rawFontName) {
      const normalized = rawFontName === 'Comic Sans MS' ? 'Comic Neue' : rawFontName;
      const stack = FONT_STACKS[normalized] || FONT_STACKS['EB Garamond'];
      ensureFontLoaded(normalized);
      document.documentElement.style.setProperty('--reader-font', stack);
      fontBtns.forEach((btn) => {
        const active = btn.dataset.font === normalized;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }

    fontBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        applyFont(btn.dataset.font);
        saveSettings({ font: btn.dataset.font });
      });
    });

    function applyFontSize(size) {
      const clamped = Math.min(28, Math.max(14, Number(size) || 19));
      document.documentElement.style.setProperty('--reader-font-size', `${clamped}px`);
      if (fontSizeVal) fontSizeVal.textContent = `${clamped}px`;
      if (fontSizeSlider) fontSizeSlider.value = String(clamped);
    }

    fontSizeSlider?.addEventListener('input', () => {
      const val = parseInt(fontSizeSlider.value, 10);
      applyFontSize(val);
      saveSettings({ fontSize: val });
    });

    function applyWidth(width) {
      const clamped = Math.min(1100, Math.max(480, Number(width) || 760));
      document.documentElement.style.setProperty('--reader-max-width', `${clamped}px`);
      if (widthVal) widthVal.textContent = `${clamped}px`;
      if (widthSlider) widthSlider.value = String(clamped);
    }

    widthSlider?.addEventListener('input', () => {
      const val = parseInt(widthSlider.value, 10);
      applyWidth(val);
      saveSettings({ width: val });
    });

    function applyTextAlign(mode) {
      const justify = mode === 'justify';
      document.body.classList.toggle('justify-text', justify);
      alignBtns.forEach((btn) => {
        const active = btn.dataset.align === (justify ? 'justify' : 'left');
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }

    alignBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        applyTextAlign(btn.dataset.align);
        saveSettings({ textAlign: btn.dataset.align });
      });
    });

    function applyAnim(enabled) {
      document.body.classList.toggle('no-anim', !enabled);
      if (!enabled) {
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
      }
      animOn?.classList.toggle('active', enabled);
      animOn?.setAttribute('aria-pressed', String(enabled));
      animOff?.classList.toggle('active', !enabled);
      animOff?.setAttribute('aria-pressed', String(!enabled));
      onAnimChange?.(enabled);
    }

    animOn?.addEventListener('click', () => {
      applyAnim(true);
      saveSettings({ anim: true });
    });
    animOff?.addEventListener('click', () => {
      applyAnim(false);
      saveSettings({ anim: false });
    });

    function applyMomentBlocks(enabled) {
      document.body.classList.toggle('plain-moments', !enabled);
      momentsOn?.classList.toggle('active', enabled);
      momentsOn?.setAttribute('aria-pressed', String(enabled));
      momentsOff?.classList.toggle('active', !enabled);
      momentsOff?.setAttribute('aria-pressed', String(!enabled));
    }

    momentsOn?.addEventListener('click', () => {
      applyMomentBlocks(true);
      saveSettings({ momentBlocks: true });
    });
    momentsOff?.addEventListener('click', () => {
      applyMomentBlocks(false);
      saveSettings({ momentBlocks: false });
    });

    function applyAllFromStorage() {
      const s = loadSettings();
      applyFont(s.font || 'EB Garamond');
      applyFontSize(s.fontSize ?? 19);
      applyWidth(s.width ?? 760);
      applyTextAlign(s.textAlign || s.align || 'left');
      applyAnim(s.anim !== false);
      applyMomentBlocks(s.momentBlocks !== false);
    }

    applyAllFromStorage();
  }

  global.ReZeroReader = global.ReZeroReader || {};
  global.ReZeroReader.readStorage = readStorage;
  global.ReZeroReader.writeStorage = writeStorage;
  global.ReZeroReader.removeStorage = removeStorage;
  global.ReZeroReader.initSettings = initSettings;
})(window);
