/**
 * Visual effects module:
 * - Scroll progress indicator fallback (only when CSS Scroll-Driven Animations unsupported)
 * - Self-unobserving IntersectionObserver for `.reveal` elements
 * - Visibility-, scroll-, and reduced-motion-aware ambient particle Canvas
 * - Chapter-specific Dragon Eye golden particle burst
 */

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let revealObserver = null;
let dragonEyeObserver = null;
let animEnabled = true;
let canvasController = null;

function isMotionAllowed() {
  return animEnabled && !reducedMotionQuery.matches;
}

function initProgressBarFallback() {
  const progressBar = document.getElementById('progress-bar');
  if (!progressBar) return;

  // Use native CSS Scroll-Driven Animations whenever supported
  if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()')) {
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    progressBar.style.transform = `scaleX(${ratio})`;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  window.addEventListener('resize', update, { passive: true });
  update();
}

function createRevealObserver() {
  if (revealObserver) {
    revealObserver.disconnect();
  }
  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      visible.forEach((entry, idx) => {
        const el = entry.target;
        observer.unobserve(el); // Free observer immediately once revealed
        const delay = Math.min(idx * 25, 100);
        if (delay > 0) {
          el.style.transitionDelay = `${delay}ms`;
          el.addEventListener(
            'transitionend',
            () => {
              el.style.transitionDelay = '';
            },
            { once: true }
          );
        }
        el.classList.add('visible');
      });
    },
    {
      threshold: 0.01,
      rootMargin: '160px 0px 160px 0px',
    }
  );
}

function revealInOrAboveViewport(container = document) {
  const thresholdY = window.innerHeight + 160;
  const els = container.querySelectorAll('.reveal:not(.visible)');
  els.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top <= thresholdY) {
      el.classList.add('visible');
      revealObserver?.unobserve(el);
    }
  });
}

export function observeReveals(container = document) {
  const els = container.querySelectorAll('.reveal');
  if (!isMotionAllowed() || typeof IntersectionObserver === 'undefined') {
    els.forEach((el) => el.classList.add('visible'));
    return;
  }
  if (!revealObserver) createRevealObserver();
  const thresholdY = window.innerHeight + 160;
  els.forEach((el) => {
    if (el.classList.contains('visible')) return;
    if (el.getBoundingClientRect().top <= thresholdY) {
      el.classList.add('visible');
    } else {
      revealObserver.observe(el);
    }
  });
}

function createCanvasController() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = null;
  let scrolling = false;
  let scrollTimer = null;
  const particles = [];

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.15;
      this.vy = -Math.random() * 0.28 - 0.05;
      this.r = Math.random() * 1.2 + 0.35;
      this.alpha = Math.random() * 0.38 + 0.06;
      this.life = 1;
      this.decay = Math.random() * 0.002 + 0.001;
      const roll = Math.random();
      if (roll > 0.62) {
        this.color = `rgba(212,168,64,${this.alpha})`;
      } else if (roll > 0.32) {
        this.color = `rgba(120,176,196,${this.alpha * 0.8})`;
      } else {
        this.color = `rgba(170,115,220,${this.alpha * 0.55})`;
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetCount = width <= 768 ? 28 : 65;
    while (particles.length < targetCount) {
      particles.push(new Particle());
    }
    if (particles.length > targetCount) {
      particles.length = targetCount;
    }
  }

  function frame() {
    if (!isMotionAllowed() || document.hidden) {
      rafId = null;
      return;
    }
    if (!scrolling) {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || p.y < -10) p.reset();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.6;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (!isMotionAllowed() || document.hidden) {
      stop();
      return;
    }
    if (rafId === null) {
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (!isMotionAllowed()) {
      ctx.clearRect(0, 0, width, height);
    }
  }

  function burstGold() {
    if (!isMotionAllowed()) return;
    for (let i = 0; i < 18; i++) {
      setTimeout(() => {
        if (!isMotionAllowed()) return;
        const burst = new Particle();
        burst.x = width / 2 + (Math.random() - 0.5) * 200;
        burst.y = height / 2;
        burst.vx = (Math.random() - 0.5) * 1.2;
        burst.vy = -(Math.random() * 1.5 + 0.5);
        burst.r = Math.random() * 2 + 1;
        burst.color = 'rgba(220,180,40,0.8)';
        burst.decay = 0.008;
        particles.push(burst);
        if (particles.length > 100) particles.shift();
      }, i * 55);
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener(
    'scroll',
    () => {
      scrolling = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrolling = false;
      }, 140);
    },
    { passive: true }
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  return { start, stop, burstGold };
}

export function observeChapterSpecials(container) {
  if (dragonEyeObserver) {
    dragonEyeObserver.disconnect();
    dragonEyeObserver = null;
  }
  const dragonEye = container.querySelector('.dragon-eye-reveal');
  if (!dragonEye || !isMotionAllowed() || !canvasController) return;

  dragonEyeObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          canvasController.burstGold();
          observer.disconnect();
          break;
        }
      }
    },
    { threshold: 0.45 }
  );
  dragonEyeObserver.observe(dragonEye);
}

export function setAnimationsEnabled(enabled) {
  animEnabled = enabled;
  if (enabled && isMotionAllowed()) {
    canvasController?.start();
  } else {
    canvasController?.stop();
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }
}

export function initEffects() {
  initProgressBarFallback();
  canvasController = createCanvasController();

  // Safety reveal sweep on rapid scroll jumps or viewport resize
  let sweepScheduled = false;
  const scheduleSweep = () => {
    if (sweepScheduled || !isMotionAllowed()) return;
    sweepScheduled = true;
    requestAnimationFrame(() => {
      sweepScheduled = false;
      revealInOrAboveViewport(document);
    });
  };
  window.addEventListener('scroll', scheduleSweep, { passive: true });
  window.addEventListener('resize', scheduleSweep, { passive: true });

  reducedMotionQuery.addEventListener('change', () => {
    if (isMotionAllowed()) {
      canvasController?.start();
    } else {
      canvasController?.stop();
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
    }
  });

  canvasController?.start();
}
