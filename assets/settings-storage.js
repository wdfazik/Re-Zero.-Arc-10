// ── Helpers ──
const STORAGE_KEY = 'rezero-settings';

function saveSettings(obj) {
  try {
    const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...cur, ...obj}));
  } catch(e) {}
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
}

// ── Theme toggle ──
const themeBtn = document.getElementById('theme-toggle');
const iconSun  = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');
const THEME_KEY = 'rezero-theme';

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    iconSun.style.display  = 'block';
    iconMoon.style.display = 'none';
  } else {
    document.body.classList.remove('light-theme');
    iconSun.style.display  = 'none';
    iconMoon.style.display = 'block';
  }
}

const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
applyTheme(savedTheme);

themeBtn.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light-theme');
  const next = isLight ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});
