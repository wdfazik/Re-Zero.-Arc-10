// ── Progress bar ──
const progressBar = document.getElementById('progress-bar');
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  progressBar.style.width = progress + '%';
});

// ── Reveal on scroll ──
const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

revealEls.forEach(el => observer.observe(el));

// ── Ambient particle canvas ──
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let W, H;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

function Particle() {
  this.reset();
}
Particle.prototype.reset = function() {
  this.x = Math.random() * W;
  this.y = Math.random() * H;
  this.vx = (Math.random() - 0.5) * 0.15;
  this.vy = -Math.random() * 0.3 - 0.05;
  this.r = Math.random() * 1.2 + 0.3;
  this.alpha = Math.random() * 0.4 + 0.05;
  this.life = 1;
  this.decay = Math.random() * 0.002 + 0.001;
  // Gold, green (Krusch), and purple (Beatrice) particles
  const roll = Math.random();
  if (roll > 0.65) {
    this.color = `rgba(200,164,106,${this.alpha})`;
  } else if (roll > 0.35) {
    this.color = `rgba(90,170,122,${this.alpha * 0.7})`;
  } else {
    this.color = `rgba(160,100,220,${this.alpha * 0.5})`;
  }
};

for (let i = 0; i < 80; i++) {
  const p = new Particle();
  p.y = Math.random() * H;
  particles.push(p);
}

function animParticles() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0 || p.y < -10) p.reset();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life * 0.6;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(animParticles);
}
animParticles();

// ── Dragon Eye dramatic entrance ──
// When the dragon-eye-reveal becomes visible, add extra flare
const dragonEye = document.querySelector('.dragon-eye-reveal');
if (dragonEye) {
  const eyeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Spawn a burst of golden particles from center
        for (let i = 0; i < 20; i++) {
          setTimeout(() => {
            const burst = new Particle();
            burst.x = W / 2 + (Math.random() - 0.5) * 200;
            burst.y = H / 2;
            burst.vy = -(Math.random() * 1.5 + 0.5);
            burst.vx = (Math.random() - 0.5) * 1.2;
            burst.alpha = 0.8;
            burst.r = Math.random() * 2 + 1;
            burst.color = `rgba(220,180,40,${burst.alpha})`;
            burst.decay = 0.008;
            particles.push(burst);
            if (particles.length > 120) particles.splice(0, 1);
          }, i * 60);
        }
        eyeObserver.disconnect();
      }
    });
  }, { threshold: 0.5 });
  eyeObserver.observe(dragonEye);
}

// ── Return block: activate rings when visible ──
const returnBlock = document.querySelector('.return-block');
if (returnBlock) {
  const retObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        returnBlock.querySelectorAll('.return-ring').forEach(r => {
          r.style.opacity = '1';
        });
      }
    });
  }, { threshold: 0.3 });
  retObserver.observe(returnBlock);
}
