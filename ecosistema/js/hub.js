/* ==========================================================================
   ECOSSISTEMA SUPER DBA — hub (Fase 1, estático)
   Lê json/*.json locais, monta menu + status + stats. Sem backend:
   START/STOP ALL é simulação visual (reseta no reload) e está marcado.
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
function emBreve(nome) {
  toast(`${nome} — mock v1: ainda sem página própria (fora do escopo inicial).`);
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

function renderStatus(groups) {
  const box = $('#statusGroups');
  if (!box) return;
  box.innerHTML = groups.map(g => `
    <div class="estatus__group">
      <h4>${esc(g.tech)}</h4>
      ${g.vms.map(v => `
        <a class="evm" href="terminal/?vm=${encodeURIComponent(v.name)}" data-vm="${esc(v.name)}" title="Abrir console de ${esc(v.name)} (mock v1)">
          <span class="evm__name">${esc(v.name)}</span>
          <span class="badge ${badgeClass(v.status)}" data-badge>${esc(v.status)}</span>
        </a>`).join('')}
    </div>`).join('');
}

function setAll(status) {
  $$('#statusGroups [data-badge]').forEach(b => {
    b.textContent = status;
    b.className = `badge ${badgeClass(status)}`;
  });
}

/* ---------- menu dinâmico (labs) ---------- */
function renderLabs(labs) {
  const box = $('#labsList');
  if (!box || !labs) return;
  box.innerHTML = labs.map((l, i) => `
    <a class="eopt" href="labs/#${esc(l.id)}">
      <span class="eopt__key">${i + 1})</span>
      <span>${esc(l.nome)}<span class="eopt__sub">— ${esc(l.desc)}</span></span>
    </a>`).join('');
}

/* ---------- stats ---------- */
function renderStats(modules, vms) {
  const box = $('#statsRow');
  if (!box) return;
  const nVms = vms.groups.reduce((a, g) => a + g.vms.length, 0);
  const nLabs = (window.__labs || []).length;
  const cards = [
    [nLabs || '—', 'Laboratórios'],
    [nVms, 'VMs'],
    [5, 'Ecossistemas'],
    [modules.aulas || '—', 'Aulas'],
  ];
  box.innerHTML = cards.map(([n, l]) => `
    <div class="estat"><div class="estat__num">${esc(n)}</div><div class="estat__label">${esc(l)}</div></div>`).join('');
}

/* ---------- gráficos SVG (donut VMs + barras labs, dados do JSON) ---------- */
const TECH_COLOR = { ORACLE: '#F0805A', MYSQL: '#34D3C4', 'SQL SERVER': '#F08A6E', POSTGRESQL: '#4FD1B0', MONGODB: '#47C98E', ALL: '#8B949E' };

function renderCharts(vms, labs) {
  const dv = $('#chartVms'), dl = $('#chartLabs');
  if (!dv || !dl) return;
  const grupos = (vms.groups || []).map(g => ({ tech: g.tech, n: (g.vms || []).length }));
  const total = grupos.reduce((a, g) => a + g.n, 0) || 1;
  // Donut: segmentos via stroke-dasharray sobre círculo r=54 (C≈339.3).
  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = grupos.map(g => {
    const frac = g.n / total, ini = acc;
    acc += frac;
    return `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${TECH_COLOR[g.tech] || '#8B949E'}" stroke-width="22" stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-ini * C).toFixed(1)}" transform="rotate(-90 70 70)"><title>${esc(g.tech)}: ${g.n}</title></circle>`;
  }).join('');
  const leg = grupos.map(g => `<text x="152" y="${24 + grupos.indexOf(g) * 20}" class="eleg-t">■</text>`.replace('■', `<tspan fill="${TECH_COLOR[g.tech]}">■</tspan>`) + `<text x="168" y="${24 + grupos.indexOf(g) * 20}" class="eleg-v">${esc(g.tech)} · ${g.n}</text>`).join('');
  dv.innerHTML = `<svg viewBox="0 0 340 140" role="img" aria-label="VMs por tecnologia">${segs}<text x="70" y="66" text-anchor="middle" class="eleg-v" style="font-size:20px">${total}</text><text x="70" y="84" text-anchor="middle" class="eleg-t">VMs</text>${leg}</svg>`;
  // Barras: labs por tecnologia (ALL conta como cross-tech, listado à parte).
  const porTech = {};
  (labs || []).forEach(l => { if (l.tech && l.tech !== 'ALL') porTech[l.tech] = (porTech[l.tech] || 0) + 1; });
  const cross = (labs || []).filter(l => l.tech === 'ALL').length;
  const chaves = Object.keys(TECH_COLOR).filter(k => k !== 'ALL' && porTech[k]);
  const max = Math.max(1, ...chaves.map(k => porTech[k]));
  dl.innerHTML = `<svg viewBox="0 0 340 ${30 + chaves.length * 26}" role="img" aria-label="Labs por tecnologia">` + chaves.map((k, i) => {
    const w = Math.max(8, (porTech[k] / max) * 150);
    const y = 14 + i * 26;
    return `<text x="0" y="${y + 10}" class="eleg-t">${esc(k)}</text><rect x="110" y="${y}" width="${w}" height="14" rx="3" fill="${TECH_COLOR[k]}"><title>${esc(k)}: ${porTech[k]}</title></rect><text x="${118 + w}" y="${y + 11}" class="eleg-v">${porTech[k]}</text>`;
  }).join('') + `<text x="0" y="${18 + chaves.length * 26}" class="eleg-t">+ ${cross} cross-tech (valem p/ as 5)</text></svg>`;
}

/* ---------- ações HOST ---------- */
function acoes() {
  const start = $('#btnStartAll'), stop = $('#btnStopAll');
  if (start) start.addEventListener('click', () => {
    setAll('STARTING');
    toast('START ALL — simulação local (Fase 1 sem backend).');
    setTimeout(() => setAll('ONLINE'), 2500);
  });
  if (stop) stop.addEventListener('click', () => {
    setAll('STOPPING');
    toast('STOP ALL — simulação local (Fase 1 sem backend).');
    setTimeout(() => setAll('OFFLINE'), 2500);
  });
  $$('[data-soon]').forEach(b => {
    if (b.closest('#labsList')) return;
    b.addEventListener('click', () => emBreve(b.dataset.soon || b.textContent.trim()));
  });
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

/* ---------- banner ASCII (mapa de fonte 5x5, alinhamento garantido) ---------- */
const FONT = {
  A: [' ##  ', '#  # ', '#### ', '#  # ', '#  # '],
  B: ['###  ', '#  # ', '###  ', '#  # ', '###  '],
  C: [' ### ', '#    ', '#    ', '#    ', ' ### '],
  D: ['###  ', '#  # ', '#  # ', '#  # ', '###  '],
  E: ['#### ', '#    ', '###  ', '#    ', '#### '],
  I: ['###  ', ' #   ', ' #   ', ' #   ', '###  '],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', ' ### '],
  P: ['###  ', '#  # ', '###  ', '#    ', '#    '],
  R: ['###  ', '#  # ', '###  ', '# #  ', '#  # '],
  S: [' ### ', '#    ', ' ### ', '    #', ' ### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
};
function banner(texto) {
  /* Herói atual é HTML estilizado (ehero__title), não ASCII. Mantém o
     fallback para páginas antigas que ainda tenham <pre id=asciiBanner>. */
  const el = $('#asciiBanner');
  if (!el || el.tagName !== 'PRE') return;
  const linhas = ['', '', '', '', ''];
  for (const ch of texto.toUpperCase()) {
    const g = FONT[ch] || ['      '];
    for (let i = 0; i < 5; i++) linhas[i] += g[i] + ' ';
  }
  el.textContent = linhas.join('\n');
}

/* ---------- boot ---------- */
(async function boot() {
  banner('ECOSSISTEMA SUPER DBA');
  relogio();
  drawer();
  acoes();
  teclado();
  try {
    const [vms, labs, modules] = await Promise.all([
      loadJSON('json/vms.json'), loadJSON('json/labs.json'), loadJSON('json/modules.json'),
    ]);
    window.__labs = labs.labs || [];
    const h = vms.host || {};
    const meta = $('#hostMeta');
    if (meta) meta.innerHTML =
      `<span><b>${esc(h.name || 'srv-lnx-01')}</b> (${esc(h.ip || '')})</span><span>|</span>`
      + `<span>${esc(new Date().toLocaleString('pt-BR'))}</span><span>|</span>`
      + `<span>UP ${esc(h.uptime || '')}</span><span>|</span>`
      + `<span>by DBA BRABO · ${esc(h.version || 'v1.0')}</span>`;
    renderStatus(vms.groups || []);
    renderLabs(window.__labs);
    renderStats(modules, vms);
    renderCharts(vms, window.__labs);
  } catch (err) {
    toast('Falha ao carregar json/*.json — rode via http://localhost:8080/ecosistema/ (fetch não funciona em file://).');
  }
})();
