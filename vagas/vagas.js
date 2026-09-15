/* ==========================================================================
   DBA BRABO — /vagas/ (curadoria de vagas por área)
   --------------------------------------------------------------------------
   Lê data/jobs.json (curadoria manual). Cada vaga aponta SEMPRE para o
   anúncio oficial — aqui vai só resumo próprio + link. Sem vaga curada, a
   área mostra os portais externos (LinkedIn/Gupy/Indeed) com a busca pronta.

   Chrome (tema, idioma, menu mobile, data-i18n estático) vem de ../script.js,
   igual às páginas de mentoria. Aqui cuidamos só do dinâmico: stats, chips
   de área e cards — com o mesmo dicionário data/i18n.json.
   ========================================================================== */
'use strict';

const BASE = (document.documentElement.dataset.base || '.').replace(/\/$/, '');
const url = p => `${BASE}/${p}`.replace(/([^:])\/{2,}/g, '$1/');

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Portais externos: busca pronta por área (links de saída, conteúdo deles). */
const FONTES = [
  { nome: 'LinkedIn', href: q => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Brasil` },
  { nome: 'Gupy', href: q => `https://portal.gupy.io/job-search/term=${encodeURIComponent(q)}` },
  { nome: 'Indeed', href: q => `https://br.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Brasil` },
];

/* Mesma prioridade do portal: ?lang= > escolha salva > navegador > PT. */
function langAtual() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'pt' || q === 'en') return q;
    const salvo = localStorage.getItem('dbabrabo.lang');
    if (salvo === 'pt' || salvo === 'en') return salvo;
  } catch {}
  try {
    const lista = [];
    if (Array.isArray(navigator.languages) && navigator.languages.length) lista.push(...navigator.languages);
    if (navigator.language) lista.push(navigator.language);
    for (const l of lista) {
      const s = String(l || '').toLowerCase();
      if (s.startsWith('pt')) return 'pt';
      if (s.startsWith('en')) return 'en';
    }
  } catch {}
  return 'pt';
}

let LANG = 'pt';
let DICT = null;
const get = (o, k) => String(k).split('.').reduce((a, p) => (a && a[p] != null ? a[p] : null), o);
/* PT embutido: o cão de guarda pode disparar antes do dicionário chegar. */
const T_FALLBACK = {
  'vagas.stat_vagas': 'Vagas curadas', 'vagas.stat_areas': 'Áreas', 'vagas.stat_remotas': 'Remotas',
  'vagas.todas': 'Todas', 'vagas.buscar_em': 'Buscar vagas desta área em:',
  'vagas.nenhuma': 'Nenhuma vaga curada nesta área ainda.',
  'vagas.nenhuma_sub': 'Use os portais abaixo para buscar agora. A curadoria é atualizada pela equipe DBA BRABO.',
  'vagas.ver_vaga': 'Ver vaga', 'vagas.salario_combinar': 'Salário a combinar',
  'vagas.nota': 'As vagas curadas redirecionam para o anúncio oficial. Portais externos têm conteúdo, prazos e regras próprias.',
  'vagas.lento_h': 'As vagas estão demorando para carregar.',
  'vagas.lento_p': 'Pode ser conexão lenta ou bloqueador de conteúdo: desative o adblocker para este site e recarregue (Ctrl+Shift+R). Se persistir, tente em aba anônima.',
  'vagas.erro_h': 'Não foi possível carregar as vagas.',
  'vagas.erro_p': 'Verifique sua conexão e recarregue. Em teste local, sirva via servidor (python3 -m http.server 8080) — fetch não funciona em file://.',
};
const t = k => get(DICT && DICT[LANG], k) || get(DICT && DICT.pt, k) || T_FALLBACK[k] || k;

let JOBS = { areas: [], jobs: [] };
let filtro = 'todas';
let bootWatchdog = 0;

function fmtSalario(j) {
  if (j.salary_min == null && j.salary_max == null) return esc(t('vagas.salario_combinar'));
  const moeda = j.salary_currency === 'USD' ? 'US$' : 'R$';
  const mil = v => (v >= 1000 && v % 1000 === 0) ? `${v / 1000} mil` : v.toLocaleString(LANG === 'en' ? 'en-US' : 'pt-BR');
  if (j.salary_min != null && j.salary_max != null && j.salary_min !== j.salary_max)
    return `${moeda} ${mil(j.salary_min)}–${mil(j.salary_max)}`;
  return `${moeda} ${mil(j.salary_min ?? j.salary_max)}`;
}

function fmtData(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(LANG === 'en' ? 'en-US' : 'pt-BR');
  } catch { return esc(iso || ''); }
}

function cardVaga(j, accent) {
  const techs = (j.technologies || []).map(x => `<span class="badge">${esc(x)}</span>`).join('');
  const modo = j.modality ? `<span class="badge badge--accent">${esc(j.modality)}</span>` : '';
  return `
  <article class="card vaga" style="--accent:${accent}">
    <h3>${esc(j.title)}</h3>
    <p class="vaga__empresa">${esc(j.company)} · ${esc(j.location || '')}</p>
    <div class="badges">${modo}${techs}</div>
    ${j.description ? `<p style="margin-top:var(--s-3)">${esc(j.description)}</p>` : ''}
    <p class="vaga__salario">${fmtSalario(j)}</p>
    <div class="vaga__foot">
      <span class="vaga__data">${fmtData(j.published)}</span>
      <a class="btn btn--primary btn--sm" href="${esc(j.url)}" target="_blank" rel="noopener">${esc(t('vagas.ver_vaga'))} →</a>
    </div>
  </article>`;
}

function blocoArea(a) {
  const vagas = JOBS.jobs.filter(j => j.area === a.id);
  const desc = LANG === 'en' ? (a.desc_en || a.desc_pt) : (a.desc_pt || a.desc_en);
  const fontes = FONTES.map(f =>
    `<a class="btn btn--outline btn--sm" href="${f.href(a.query)}" target="_blank" rel="noopener">${esc(f.nome)} →</a>`).join('');
  const corpo = vagas.length
    ? `<div class="grid grid--3">${vagas.map(j => cardVaga(j, a.accent)).join('')}</div>`
    : `<div class="vaga__vazio"><b>${esc(t('vagas.nenhuma'))}</b><br>${esc(t('vagas.nenhuma_sub'))}</div>`;
  return `
  <div class="vsec" id="area-${esc(a.id)}">
    <div class="section-head">
      <p class="eyebrow" style="color:${esc(a.accent)}">${esc(a.titulo)}</p>
      <h2>${esc(a.titulo)}</h2>
      <p>${esc(desc || '')}</p>
    </div>
    ${corpo}
    <div class="vaga__fontes hstack">
      <span>${esc(t('vagas.buscar_em'))}</span>${fontes}
    </div>
  </div>`;
}

function render() {
  const areas = JOBS.areas || [];
  const jobs = JOBS.jobs || [];
  const remotas = jobs.filter(j => j.remote || /remoto/i.test(j.modality || '')).length;

  const stats = $('#vagasStats');
  if (stats) stats.innerHTML = [
    [jobs.length, t('vagas.stat_vagas')],
    [areas.length, t('vagas.stat_areas')],
    [remotas, t('vagas.stat_remotas')],
  ].map(([n, l]) => `<div><p class="stat__num">${n}</p><p class="stat__label">${esc(l)}</p></div>`).join('');

  const chips = $('#vagasChips');
  if (chips) {
    const btn = (id, label) =>
      `<button class="vchip${filtro === id ? ' is-on' : ''}" type="button" data-area="${esc(id)}">${esc(label)}</button>`;
    chips.innerHTML = btn('todas', t('vagas.todas')) + areas.map(a => btn(a.id, a.titulo)).join('');
    chips.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => {
      filtro = b.dataset.area;
      try { history.replaceState(null, '', filtro === 'todas' ? location.pathname : `#area-${filtro}`); } catch {}
      render();
      const alvo = filtro === 'todas' ? $('#vagasAreas') : $(`#area-${CSS.escape(filtro)}`);
      if (alvo) alvo.scrollIntoView({ block: 'start' });
    }));
  }

  const box = $('#vagasAreas');
  if (box) {
    const visiveis = filtro === 'todas' ? areas : areas.filter(a => a.id === filtro);
    box.innerHTML = visiveis.map(blocoArea).join('')
      + `<p class="vaga__nota" style="margin-top:var(--s-12)">${esc(t('vagas.nota'))}</p>`;
  }
}

/* Sinal com timeout (quando o navegador suporta): fetch nunca trava eterno. */
function sinal(ms) {  try {
    if (window.AbortSignal && AbortSignal.timeout) return AbortSignal.timeout(ms);
  } catch {}
  return undefined;
}

function marcarPronto() {
  try {
    clearTimeout(bootWatchdog);
    const box = $('#vagasAreas');
    if (box) box.dataset.pronto = '1';
  } catch {}
}

function erroCarregamento(modo) {
  console.error('[DBA BRABO/vagas] falha ao carregar:', modo);
  const box = $('#vagasAreas');
  if (!box || box.dataset.pronto) return;
  const lento = modo === 'lento';
  box.innerHTML = `<div class="vaga__vazio"><b>${esc(lento ? t('vagas.lento_h') : t('vagas.erro_h'))}</b><br>${esc(lento ? t('vagas.lento_p') : t('vagas.erro_p'))}</div>`;
  marcarPronto();
}

async function boot() {
  /* Cão de guarda: se em 12s nada renderizou (rede travada, bloqueador,
     JS interrompido), troca o "Carregando…" por instrução — nunca vazio. */
  bootWatchdog = setTimeout(() => erroCarregamento('lento'), 12000);
  try {
    const m = location.hash.match(/#area-([\w-]+)/);
    if (m) filtro = m[1];
  } catch {}
  try {
    const [jobs, dict] = await Promise.all([
      fetch(url('data/jobs.json'), { cache: 'no-cache', signal: sinal(15000) }).then(r => { if (!r.ok) throw new Error(`jobs.json — HTTP ${r.status}`); return r.json(); }),
      fetch(url('data/i18n.json'), { cache: 'no-cache', signal: sinal(15000) }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    JOBS = jobs;
    DICT = dict;
    if (JOBS.areas && filtro !== 'todas' && !JOBS.areas.some(a => a.id === filtro)) filtro = 'todas';
    LANG = langAtual();
    render();
    marcarPronto();
  } catch (err) {
    erroCarregamento('erro');
  }
  /* Troca de idioma no toggle do portal (script.js) re-renderiza o dinâmico. */
  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'langToggle') setTimeout(() => { LANG = langAtual(); render(); }, 50);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
