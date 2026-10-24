(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- Nav: compact on scroll, mobile toggle ---------- */
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('nav-menu');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };

  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });

  /* ---------- Copy to clipboard ---------- */
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for file:// and older browsers
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy failed');
  }

  const copyBtn = document.querySelector('.term__copy');
  const copyLabel = copyBtn.querySelector('.term__copy-text');
  copyBtn.addEventListener('click', async () => {
    try {
      await copyText(copyBtn.dataset.copy);
      copyLabel.textContent = 'copied';
    } catch {
      copyLabel.textContent = 'failed';
    }
    setTimeout(() => { copyLabel.textContent = 'copy'; }, 1600);
  });

  /* ---------- Contact terminal tabs ---------- */
  const cmd = document.getElementById('term-cmd');
  const tabs = Array.from(document.querySelectorAll('.term__tab'));
  let typeId = 0;

  async function typeCommand(text) {
    const id = ++typeId;
    if (reduceMotion) {
      cmd.textContent = text;
      return;
    }
    cmd.textContent = '';
    for (const ch of text) {
      if (id !== typeId) return;
      cmd.textContent += ch;
      await sleep(14);
    }
  }

  function selectTab(tab) {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    copyBtn.dataset.copy = tab.dataset.copy;
    typeCommand(tab.dataset.cmd);
  }

  tabs.forEach((tab, i) => {
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });

  /* ---------- Dithered artwork ----------
     Each piece is drawn in greyscale on an offscreen canvas, then reduced to
     two tones with a dither pass — the engraved / halftone look of the art. */

  function mulberry32(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(rand) {
    const N = 64;
    const grid = new Float32Array(N * N).map(() => rand());
    const at = (x, y) => grid[((y % N + N) % N) * N + ((x % N + N) % N)];
    const smooth = (t) => t * t * (3 - 2 * t);
    const value = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const u = smooth(x - xi), v = smooth(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y) => {
      let sum = 0, amp = 0.5, freq = 1;
      for (let o = 0; o < 4; o++) {
        sum += amp * value(x * freq, y * freq);
        amp *= 0.5;
        freq *= 2;
      }
      return sum;
    };
  }

  const DITHER = {
    // Error diffusion: fine engraved grain
    fs(lum, w, h) {
      const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const on = lum[i] > 0.5 ? 1 : 0;
          const err = lum[i] - on;
          out[i] = on;
          if (x + 1 < w) lum[i + 1] += err * 7 / 16;
          if (y + 1 < h) {
            if (x > 0) lum[i + w - 1] += err * 3 / 16;
            lum[i + w] += err * 5 / 16;
            if (x + 1 < w) lum[i + w + 1] += err * 1 / 16;
          }
        }
      }
      return out;
    },
    // Line screen: horizontal scanlines whose thickness follows brightness
    lines(lum, w, h) {
      const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const t = ((y % 4) + 0.5) / 4;
        for (let x = 0; x < w; x++) out[y * w + x] = lum[y * w + x] > t ? 1 : 0;
      }
      return out;
    },
    // Round halftone dots
    dots(lum, w, h) {
      const out = new Uint8Array(w * h);
      const cell = 4;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x % cell) - (cell - 1) / 2;
          const dy = (y % cell) - (cell - 1) / 2;
          const d = Math.hypot(dx, dy) / (cell * 0.72);
          out[y * w + x] = lum[y * w + x] * 1.05 > d ? 1 : 0;
        }
      }
      return out;
    },
  };

  const grey = (v) => `rgb(${v * 255},${v * 255},${v * 255})`;

  function line(g, x1, y1, x2, y2) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  function glow(g, x, y, r, v) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, grey(v));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Hero: AR monogram in a marbled panel, ringed by rays and bundles of strands
  function drawHero(g, w, h, rand) {
    const cx = w / 2, cy = h / 2;
    glow(g, cx, cy, w * 0.55, 0.22);

    g.strokeStyle = grey(0.78);
    g.lineWidth = 0.7;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 80) {
      const r1 = w * 0.3, r2 = w * (0.46 + rand() * 0.03);
      line(g, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    }

    const s = Math.round(w * 0.5);
    const x0 = Math.round(cx - s / 2), y0 = Math.round(cy - s / 2);
    const noise = makeNoise(rand);
    const panel = g.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = noise(x * 0.045, y * 0.045);
        const vein = Math.abs(Math.sin((x * 0.018 + y * 0.01 + n * 2.6) * Math.PI));
        const v = 0.06 + 0.9 * Math.pow(1 - vein, 9) + 0.1 * n;
        const i = (y * s + x) * 4;
        panel.data[i] = panel.data[i + 1] = panel.data[i + 2] = Math.min(1, v) * 255;
        panel.data[i + 3] = 255;
      }
    }
    g.putImageData(panel, x0, y0);
    g.strokeStyle = grey(0.85);
    g.lineWidth = 1;
    g.strokeRect(x0 + 0.5, y0 + 0.5, s - 1, s - 1);

    const anchors = [
      [x0 - s * 0.04, y0 + s * 0.12], [x0 + s * 1.04, y0 + s * 0.06], [x0 - s * 0.1, y0 + s * 0.72],
      [x0 + s * 1.08, y0 + s * 0.66], [x0 + s * 0.28, y0 + s * 1.06], [x0 + s * 0.8, y0 - s * 0.06],
    ];
    g.lineWidth = 0.6;
    for (const [ax, ay] of anchors) {
      const base = Math.atan2(ay - cy, ax - cx);
      g.strokeStyle = grey(0.9);
      for (let k = 0; k < 18; k++) {
        const ang = base + (rand() - 0.5) * 0.55;
        const len = w * (0.3 + rand() * 0.4);
        line(g, ax, ay, ax + Math.cos(ang) * len, ay + Math.sin(ang) * len);
      }
      glow(g, ax, ay, 9, 0.95);
    }

    const size = s * 0.66;
    g.font = `400 ${size}px Antonio, "Arial Narrow", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 7;
    g.strokeStyle = '#000';
    g.strokeText('AR', cx, cy + size * 0.04);
    const fill = g.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    fill.addColorStop(0, grey(1));
    fill.addColorStop(1, grey(0.55));
    g.fillStyle = fill;
    g.fillText('AR', cx, cy + size * 0.04);
  }

  // #1 Collaborative Workspace: two offset editor windows, code lines, two cursors
  function drawWorkspace(g, w, h, rand) {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, grey(0.12));
    bg.addColorStop(1, grey(0.42));
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = grey(0.6);
    g.lineWidth = 1;
    g.strokeRect(34.5, 30.5, w - 46, h - 48);

    const x0 = 16, y0 = 18, ww = w - 44, wh = h - 44;
    g.fillStyle = grey(0.1);
    g.fillRect(x0, y0, ww, wh);
    g.fillStyle = grey(0.5);
    g.fillRect(x0, y0, ww, 12);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = grey(0.95);
      g.beginPath();
      g.arc(x0 + 8 + i * 8, y0 + 6, 2, 0, Math.PI * 2);
      g.fill();
    }

    const rows = Math.floor((wh - 22) / 9);
    let indent = 0;
    for (let r = 0; r < rows; r++) {
      const y = y0 + 20 + r * 9;
      g.fillStyle = grey(0.35);
      g.fillRect(x0 + 5, y, 6, 4);
      indent = Math.max(0, Math.min(3, indent + Math.round((rand() - 0.45) * 2)));
      let x = x0 + 18 + indent * 9;
      const segs = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < segs && x < x0 + ww - 10; k++) {
        const len = Math.min(8 + rand() * 36, x0 + ww - 8 - x);
        g.fillStyle = grey(0.5 + rand() * 0.45);
        g.fillRect(x, y, len, 4);
        x += len + 5;
      }
    }

    const cursors = [[x0 + 70, y0 + 20 + 4 * 9, 'A'], [x0 + 46, y0 + 20 + 10 * 9, 'B']];
    for (const [cx, cy, label] of cursors) {
      glow(g, cx, cy + 3, 22, 0.55);
      g.fillStyle = grey(1);
      g.fillRect(cx, cy - 3, 2, 11);
      g.fillRect(cx, cy - 13, 12, 10);
      g.fillStyle = '#000';
      g.font = '600 8px "JetBrains Mono", monospace';
      g.textBaseline = 'top';
      g.fillText(label, cx + 3, cy - 12);
    }
  }

  // #2 Mailoo: agent nodes flowing along a curve into an envelope
  function drawMailoo(g, w, h, rand) {
    g.fillStyle = grey(0.06);
    g.fillRect(0, 0, w, h);
    glow(g, w * 0.55, h * 0.6, w * 0.7, 0.4);

    const ex = w * 0.16, ey = h * 0.5, ew = w * 0.68, eh = h * 0.38;
    g.fillStyle = grey(0.22);
    g.fillRect(ex, ey, ew, eh);
    g.strokeStyle = grey(0.95);
    g.lineWidth = 3;
    g.strokeRect(ex, ey, ew, eh);
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(ex + ew / 2, ey + eh * 0.58);
    g.lineTo(ex + ew, ey);
    g.stroke();

    const nodes = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      nodes.push([w * (0.12 + t * 0.76), h * (0.2 + Math.sin(t * Math.PI) * -0.08 + t * 0.14) + (rand() - 0.5) * 6]);
    }
    g.strokeStyle = grey(0.85);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(nodes[0][0], nodes[0][1]);
    for (let i = 1; i < nodes.length; i++) {
      const [px, py] = nodes[i - 1], [nx, ny] = nodes[i];
      g.bezierCurveTo(px + 12, py - 14, nx - 12, ny + 14, nx, ny);
    }
    g.stroke();
    const last = nodes[nodes.length - 1];
    g.setLineDash([3, 3]);
    line(g, last[0], last[1], ex + ew / 2, ey + eh * 0.4);
    g.setLineDash([]);

    nodes.forEach(([x, y], i) => {
      const big = i === nodes.length - 1;
      glow(g, x, y, big ? 26 : 16, 0.9);
      g.fillStyle = grey(1);
      g.beginPath();
      g.arc(x, y, big ? 6 : 4, 0, Math.PI * 2);
      g.fill();
    });
  }

  // #3 Signature Verification: two near-identical signatures under a starburst
  function drawSignature(g, w, h, rand) {
    g.fillStyle = grey(0.1);
    g.fillRect(0, 0, w, h);

    const sx = w * 0.7, sy = h * 0.22;
    glow(g, sx, sy, w * 0.35, 0.85);
    g.lineWidth = 0.8;
    for (let i = 0; i < 140; i++) {
      const a = rand() * Math.PI * 2;
      const len = w * (0.08 + rand() * 0.42);
      g.strokeStyle = grey(0.55 + rand() * 0.45);
      line(g, sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    }

    const phase = rand() * Math.PI;
    const signature = (baseY, jitter) => {
      g.beginPath();
      for (let i = 0; i <= 260; i++) {
        const t = i / 260;
        const x = w * 0.1 + t * w * 0.78 + Math.sin(t * Math.PI * 15 + phase) * w * 0.035;
        const y = baseY + Math.sin(t * Math.PI * 7 + phase) * Math.cos(t * Math.PI * 2.5) * h * 0.08
          + Math.sin(t * 40) * jitter;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };
    g.strokeStyle = grey(1);
    g.lineWidth = 2.6;
    g.lineJoin = g.lineCap = 'round';
    signature(h * 0.56, 0);
    signature(h * 0.82, 1.2);

    g.strokeStyle = grey(0.5);
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    line(g, w * 0.08, h * 0.69, w * 0.92, h * 0.69);
    g.setLineDash([]);
  }

  // dark: null leaves the background transparent so the page colour shows through
  const ART = {
    hero: { w: 300, h: 340, seed: 23, draw: drawHero, mode: 'fs', light: [220, 220, 234], dark: null },
    workspace: { w: 180, h: 180, seed: 5, draw: drawWorkspace, mode: 'lines', light: [160, 160, 186], dark: [33, 33, 168] },
    mailoo: { w: 180, h: 180, seed: 11, draw: drawMailoo, mode: 'dots', light: [160, 160, 186], dark: [33, 33, 168] },
    signature: { w: 180, h: 180, seed: 7, draw: drawSignature, mode: 'fs', light: [160, 160, 186], dark: [33, 33, 168] },
  };

  function renderArt(canvas) {
    const cfg = ART[canvas.dataset.art];
    if (!cfg) return;
    const { w, h } = cfg;

    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const g = src.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    cfg.draw(g, w, h, mulberry32(cfg.seed));

    const px = g.getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) lum[i] = px[i * 4] / 255;
    const bits = DITHER[cfg.mode](lum, w, h);

    canvas.width = w;
    canvas.height = h;
    const out = canvas.getContext('2d');
    const img = out.createImageData(w, h);
    for (let i = 0; i < bits.length; i++) {
      const c = bits[i] ? cfg.light : cfg.dark;
      if (!c) continue;
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 255;
    }
    out.putImageData(img, 0, 0);
  }

  const renderAll = () => document.querySelectorAll('canvas[data-art]').forEach(renderArt);
  // Wait for Antonio so the monogram is drawn in the right face
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('400 100px Antonio'), document.fonts.load('600 8px "JetBrains Mono"')])
      .catch(() => {})
      .then(renderAll);
  } else {
    renderAll();
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => revealer.observe(el));
  }

  /* ---------- Active nav link ---------- */
  const navLinks = new Map(
    Array.from(document.querySelectorAll('.nav__link')).map((a) => [a.getAttribute('href').slice(1), a])
  );

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link, id) => {
          if (id === entry.target.id) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
