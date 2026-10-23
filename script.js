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

})();
