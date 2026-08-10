// ── Settings panel toggle ──
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel  = document.getElementById('settings-panel');

settingsToggle.addEventListener('click', () => {
  const open = settingsPanel.classList.toggle('open');
  settingsToggle.classList.toggle('active', open);
});

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  if (!settingsPanel.contains(e.target) && e.target !== settingsToggle && !settingsToggle.contains(e.target)) {
    settingsPanel.classList.remove('open');
    settingsToggle.classList.remove('active');
  }
});

// ── Font selector ──
const fontBtns = document.querySelectorAll('#font-btns .settings-btn');
const mainEl   = document.getElementById('main-content');

function applyFont(fontName) {
  document.body.style.fontFamily = `'${fontName}', Georgia, serif`;
  fontBtns.forEach(b => b.classList.toggle('active', b.dataset.font === fontName));
}

fontBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    applyFont(btn.dataset.font);
    saveSettings({ font: btn.dataset.font });
  });
});

// ── Font size ──
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeVal    = document.getElementById('font-size-val');

function applyFontSize(size) {
  document.body.style.fontSize = size + 'px';
  fontSizeVal.textContent = size + 'px';
  fontSizeSlider.value = size;
}

fontSizeSlider.addEventListener('input', () => {
  applyFontSize(parseInt(fontSizeSlider.value));
  saveSettings({ fontSize: fontSizeSlider.value });
});

// ── Container width ──
const widthSlider = document.getElementById('width-slider');
const widthVal    = document.getElementById('width-val');

function applyWidth(w) {
  const style = `${w}px`;
  document.getElementById('main-content').style.maxWidth = style;
  document.querySelector('.nav-buttons').style.maxWidth = style;
  widthVal.textContent = style;
  widthSlider.value = w;
}

widthSlider.addEventListener('input', () => {
  applyWidth(parseInt(widthSlider.value));
  saveSettings({ width: widthSlider.value });
});

// ── Animation toggle ──
const animOn  = document.getElementById('anim-on');
const animOff = document.getElementById('anim-off');

function applyAnim(enabled) {
  if (enabled) {
    document.body.classList.remove('no-anim');
    animOn.classList.add('active');
    animOff.classList.remove('active');
  } else {
    document.body.classList.add('no-anim');
    // Make all hidden elements visible immediately
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    animOff.classList.add('active');
    animOn.classList.remove('active');
  }
}

animOn.addEventListener('click', () => { applyAnim(true); saveSettings({ anim: true }); });
animOff.addEventListener('click', () => { applyAnim(false); saveSettings({ anim: false }); });

// ── Emotional blocks toggle ──
const momentsOn  = document.getElementById('moments-on');
const momentsOff = document.getElementById('moments-off');

function applyMomentBlocks(enabled) {
  document.body.classList.toggle('plain-moments', !enabled);
  momentsOn.classList.toggle('active', enabled);
  momentsOff.classList.toggle('active', !enabled);
}

momentsOn.addEventListener('click', () => { applyMomentBlocks(true); saveSettings({ momentBlocks: true }); });
momentsOff.addEventListener('click', () => { applyMomentBlocks(false); saveSettings({ momentBlocks: false }); });

// ── Text alignment ──
const alignBtns = document.querySelectorAll('#align-btns .settings-btn');

function applyAlign(align) {
  const content = document.getElementById('main-content');
  content.querySelectorAll('p, .moment-text, .dragon-eye-text, .return-text, .inner-fire').forEach(el => { el.style.textAlign = align; });
  alignBtns.forEach(b => b.classList.toggle('active', b.dataset.align === align));
}

alignBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    applyAlign(btn.dataset.align);
    saveSettings({ align: btn.dataset.align });
  });
});

// ── Load persisted settings ──
(function() {
  const s = loadSettings();
  if (s.font) applyFont(s.font);
  if (s.fontSize) applyFontSize(parseInt(s.fontSize));
  if (s.width) applyWidth(parseInt(s.width));
  if (s.anim === false) applyAnim(false);
  if (s.momentBlocks === false) applyMomentBlocks(false);
  if (s.align) applyAlign(s.align);
})();
