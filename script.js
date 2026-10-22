(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- Mobile nav ---------- */
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('nav-menu');

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

  /* ---------- Hero terminal ---------- */
  const SCRIPTS = {
    about: [
      ['$ whoami', 'abhinandh rajeev — cs undergrad, iiit kottayam (2023–27)'],
      ['$ cat location.txt', 'thalassery, kerala, india'],
      ['$ cat interests.txt', 'real-time systems · ai agents · computer vision'],
    ],
    stack: [
      ['$ ls ~/stack/backend', 'django  drf  channels  redis  postgresql'],
      ['$ ls ~/stack/frontend', 'react  monaco  javascript'],
      ['$ ls ~/stack/ml', 'tensorflow  keras  opencv  langgraph'],
      ['$ ls ~/stack/ops', 'docker  github-actions  render  vercel  aws'],
    ],
    now: [
      ['$ ls ~/projects', 'collaborative-workspace/  mailoo/  signature-verification/'],
      ['$ pytest && npx jest', '135 tests passed · coverage ≥95%'],
      ['$ echo $FOCUS', 'shipping tested, containerised, real-time software'],
    ],
  };

  const output = document.getElementById('terminal-output');
  const tabs = Array.from(document.querySelectorAll('.terminal__tab'));
  let runId = 0;

  async function play(name) {
    const id = ++runId;
    output.textContent = '';

    for (const [i, [cmd, result]] of SCRIPTS[name].entries()) {
      if (i > 0) output.append('\n');

      const cmdEl = document.createElement('span');
      cmdEl.className = 'cmd';
      output.append(cmdEl);

      if (reduceMotion) {
        cmdEl.textContent = cmd;
      } else {
        for (const ch of cmd) {
          if (id !== runId) return;
          cmdEl.textContent += ch;
          await sleep(26 + Math.random() * 40);
        }
        await sleep(220);
        if (id !== runId) return;
      }

      output.append('\n', result);
      if (!reduceMotion) await sleep(380);
    }
  }

  function selectTab(tab) {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    play(tab.dataset.tab);
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

  play('about');

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

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('.copy-btn__text');
    btn.addEventListener('click', async () => {
      try {
        await copyText(btn.dataset.copy);
        label.textContent = 'copied';
      } catch {
        label.textContent = 'failed';
      }
      setTimeout(() => { label.textContent = 'copy'; }, 1600);
    });
  });

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
    Array.from(document.querySelectorAll('.nav__links a')).map((a) => [a.getAttribute('href').slice(1), a])
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
