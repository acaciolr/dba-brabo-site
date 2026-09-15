/* ==========================================================================
   ECOSSISTEMA SUPER DBA — helpers compartilhados (Fase 1, estático)
   Usado por vm-manager, key-manager, terminal e páginas de ecossistema.
   ========================================================================== */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadJSON(rel) {
  const r = await fetch(rel, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${rel}`);
  return r.json();
}

let toastTimer = 0;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'etoast';
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

function relogio(sel = '#clock') {
  const el = $(sel);
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

function drawer() {
  const btn = $('#burger');
  if (!btn) return;
  btn.addEventListener('click', () => document.body.classList.toggle('drawer-on'));
  document.addEventListener('click', e => {
    if (document.body.classList.contains('drawer-on') && !e.target.closest('#navDrawer') && !e.target.closest('#burger')) {
      document.body.classList.remove('drawer-on');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.body.classList.remove('drawer-on');
  });
}

const qs = k => new URLSearchParams(location.search).get(k);
