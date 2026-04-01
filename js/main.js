/* ===================================================
  ROTALIZA — Main JS
  Particles, Scroll Reveal, Navbar Shrink, Counters
  =================================================== */

// ─── PARTICLE SYSTEM (floating route lights) ───
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const PARTICLE_COUNT = 60;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(true); }
    reset(init) {
      this.x = Math.random() * w;
      this.y = init ? Math.random() * h : h + 10;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedY = -(Math.random() * 0.6 + 0.15);
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.6 + 0.2;
      this.decay = Math.random() * 0.003 + 0.001;
      this.hue = Math.random() > 0.55 ? 42 : 170;
      this.saturation = 85 + Math.random() * 10;
      this.lightness = 55 + Math.random() * 18;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.y * 0.01) * 0.15;
      this.opacity -= this.decay;
      if (this.opacity <= 0 || this.y < -10) this.reset(false);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.opacity})`;
      ctx.shadowColor = `hsla(${this.hue}, 100%, 50%, ${this.opacity * 0.5})`;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, w, h);
    ctx.shadowBlur = 0;
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
})();

// ─── SCROLL REVEAL ───
(function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => observer.observe(el));
})();

// ─── NAVBAR SHRINK ON SCROLL ───
(function initNavShrink() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
})();

// ─── COUNTER ANIMATION ───
(function initCounters() {
  const numbers = document.querySelectorAll('.stat-item .number');
  if (!numbers.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const raw = el.textContent.trim();

      // skip non-numeric (like ∞)
      const match = raw.match(/^(\d+)/);
      if (!match) return;

      const target = parseInt(match[1], 10);
      const suffix = raw.replace(/^\d+/, '');
      let current = 0;
      const step = Math.max(1, Math.floor(target / 60));

      const interval = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        el.textContent = current + suffix;
      }, 18);

      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  numbers.forEach(el => observer.observe(el));
})();

// ─── SMOOTH PAGE TRANSITIONS ───
document.querySelectorAll('a[href]').forEach(link => {
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;

  // don't intercept clicks inside the game area
  if (link.closest('#game-container') || link.closest('.game-frame')) return;

  link.addEventListener('click', function (e) {
    e.preventDefault();
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    setTimeout(() => { window.location.href = href; }, 300);
  });
});

// fade-in on load
window.addEventListener('load', () => {
  document.body.style.transition = 'opacity 0.4s ease';
  document.body.style.opacity = '1';
});
