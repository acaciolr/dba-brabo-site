/* ==========================================================================
   ECOSSISTEMA SUPER DBA — hub (ponte para as VMs)
   Lê json/vms.json local e monta o status. Sem backend (mock v1).
   ========================================================================== */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadJSON(rel) {
  const r = await fetch(rel, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${rel}`);
  return r.json();
}

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}
/* ---------- relógio ---------- */
function relogio() {
  const el = $('#clock');
  const tick = () => {
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- drawer mobile ---------- */
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

/* ---------- status ---------- */
const badgeClass = s => ({
  ONLINE: 'badge--online', OFFLINE: 'badge--offline',
  STARTING: 'badge--starting', STOPPING: 'badge--stopping',
}[s] || 'badge--offline');
const TECH_COLOR = { ORACLE: '#F0805A', MYSQL: '#34D3C4', 'SQL SERVER': '#F08A6E', POSTGRESQL: '#4FD1B0', MONGODB: '#47C98E' };

function renderStatus(groups) {
  const box = $('#statusGroups');
  if (!box) return;
  box.innerHTML = groups.map(g => {
    const cor = TECH_COLOR[g.tech] || '#8B949E';
    return `
    <div class="estatus__group">
      <h4><span class="edot" style="background:${cor};color:${cor}"></span>${esc(g.tech)}</h4>
      ${g.vms.map(v => `
        <a class="evm" href="terminal/?vm=${encodeURIComponent(v.name)}" data-vm="${esc(v.name)}" title="Abrir console de ${esc(v.name)} (mock v1)">
          <span class="evm__name">${esc(v.name)}</span>
          <span class="badge ${badgeClass(v.status)}" data-badge>${esc(v.status)}</span>
        </a>`).join('')}
    </div>`;
  }).join('');
}

/* ---------- teclado: 1–5 abrem ecossistemas ---------- */
function teclado() {
  const mapa = { 1: 'oracle/', 2: 'mysql/', 3: 'sqlserver/', 4: 'postgresql/', 5: 'mongodb/' };
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    const dest = mapa[e.key];
    if (dest) location.href = dest;
  });
}

/* ---------- boot: o hub é só a ponte para as VMs ---------- */
(async function boot() {
  relogio();
  drawer();
  teclado();
  try {
    const vms = await loadJSON('json/vms.json');
    const h = vms.host || {};
    const meta = $('#hostMeta');
    if (meta) meta.innerHTML =
      `<span><b>${esc(h.name || 'srv-lnx-01')}</b> (${esc(h.ip || '')})</span><span>|</span>`
      + `<span>${esc(new Date().toLocaleString('pt-BR'))}</span><span>|</span>`
      + `<span>UP ${esc(h.uptime || '')}</span><span>|</span>`
      + `<span>by DBA BRABO · ${esc(h.version || 'v1.0')}</span>`;
    renderStatus(vms.groups || []);
  } catch (err) {
    toast('Falha ao carregar json/vms.json — rode via http://localhost:8080/ecosistema/ (fetch não funciona em file://).');
  }
})();
