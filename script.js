/* ==========================================================================
   DBA BRABO — Portal
   --------------------------------------------------------------------------
   Sem framework, sem build no navegador. O conteudo vem de data/*.json e a
   interface e montada aqui. Para adicionar uma mentoria voce edita o JSON —
   nunca este arquivo.

   Caminho base: cada pagina declara <html data-base="."> ou "../..", para o
   site funcionar tanto em / quanto em /dba-brabo-site/ no GitHub Pages.
   ========================================================================== */
'use strict';

const BASE = (document.documentElement.dataset.base || '.').replace(/\/$/, '');
const url  = p => `${BASE}/${p}`.replace(/([^:])\/{2,}/g, '$1/');

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto vindo do JSON antes de injetar como HTML. */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const slugify = s => String(s).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- icones (traco 1.6, viewBox 24) ------------------------------ */
const ICON_PATHS = {
  admin:        '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  replication:  '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  ha:           '<rect x="2" y="3" width="20" height="6" rx="2"/><rect x="2" y="15" width="20" height="6" rx="2"/><path d="M6 6h.01M6 18h.01"/><path d="M12 9v6"/>',
  backup:       '<path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  performance:  '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l4-5 3 3 5-7"/>',
  security:     '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>',
  database:     '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  cloud:        '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.6A4 4 0 0 0 6.5 19z"/>',
  automation:   '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  server:       '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  code:         '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  select:       '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  function:     '<path d="M4 20c3 0 4-2 4-8s1-8 4-8"/><path d="M6 12h6"/><path d="M14 10l6 6M20 10l-6 6"/>',
  group:        '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M18 20a5 5 0 0 0-2-4"/>',
  join:         '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  subquery:     '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  window:       '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  dml:          '<path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  capture:      '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  conflict:     '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  iac:          '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  containers:   '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  cicd:         '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h6"/>',
  observability:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  chaos:        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  phone:        '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/>',
  chat:         '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 4.1 12a8.4 8.4 0 0 1 8.4-8.5A8.4 8.4 0 0 1 21 11.5z"/>',
  flask:        '<path d="M9 3h6M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
  lab:          '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  book:         '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  doc:          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  growth:       '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
  cap:          '<path d="M22 9 12 5 2 9l10 4 10-4z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  medal:        '<circle cx="12" cy="15" r="6"/><path d="M8.2 10 5 2h14l-3.2 8"/><path d="M12 13l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 15l2-.3z"/>',
  mix:          '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6M4 4l5 5"/>',
  exam:         '<path d="M9 2h6a2 2 0 0 1 2 2v1h2a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a2 2 0 0 1 2-2z"/><path d="m9 14 2 2 4-4"/>',
  search:       '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  linkedin:     '<rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/><path d="M10 21V9h4v2a4 4 0 0 1 7 3v7h-4v-6a2 2 0 0 0-4 0v6z"/>',
  instagram:    '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  github:       '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-1-2.6c3.1-.3 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8a5 5 0 0 0-.1-3.7s-1.2-.3-4 1.5a13.4 13.4 0 0 0-7 0C6.1.8 4.9 1.1 4.9 1.1a5 5 0 0 0-.1 3.7 5.4 5.4 0 0 0-1.5 3.7c0 5.5 3.3 6.7 6.4 7a3.4 3.4 0 0 0-1 2.6V22"/>',
  youtube:      '<path d="M22 8.4a3 3 0 0 0-2.1-2.1C18 5.7 12 5.7 12 5.7s-6 0-7.9.6A3 3 0 0 0 2 8.4 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.6a3 3 0 0 0 2.1 2.1c1.9.6 7.9.6 7.9.6s6 0 7.9-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22.4 12 31 31 0 0 0 22 8.4z"/><path d="m10 15 5-3-5-3z"/>',
  mail:         '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  external:     '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
  chevron:      '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  menu:         '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close:        '<path d="M18 6 6 18M6 6l12 12"/>',
  copy:         '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check:        '<path d="m20 6-11 11-5-5"/>',
  sun:          '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:         '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  system:       '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  level:        '<path d="M4 20V10M10 20V4M16 20v-8M22 20h-20"/>',
  modules:      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  tag:          '<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  clock:        '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:     '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin:          '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  money:        '<circle cx="12" cy="12" r="9"/><path d="M15 9.5A3 3 0 0 0 12 8c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5"/><path d="M12 6v12"/>'
};

/** Devolve um <svg> pronto para injetar. */
function icon(name, cls = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.tag;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${p}</svg>`;
}

/* ---------- estado ------------------------------------------------------ */
const DATA = { site: null, mentorias: null, projetos: null, tecnologias: null, roadmap: null, faq: null, certificacoes: null, eventos: null };

async function loadJSON(name) {
  const r = await fetch(url(`data/${name}.json`), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${name}.json — HTTP ${r.status}`);
  return r.json();
}

/* ==========================================================================
   RENDER
   ========================================================================== */

/* ---------- terminal do hero -------------------------------------------- */
function renderTerminal() {
  const el = $('#terminal'); if (!el) return;
  const s = DATA.site;
  const skills = ['Oracle', 'MySQL', 'SQL Server', 'PostgreSQL', 'MongoDB', 'Exadata', 'Cloud', 'Automation'];

  el.innerHTML = `
    <div class="terminal__bar">
      <span class="terminal__dot"></span><span class="terminal__dot"></span><span class="terminal__dot"></span>
      <span class="terminal__title">dbabrabo@producao:~</span>
    </div>
    <div class="terminal__body">
      <div class="terminal__line"><span class="terminal__prompt">$</span><span class="terminal__cmd" data-type="whoami"></span></div>
      <div class="terminal__line" data-reveal="1" hidden><span class="terminal__prompt">→</span>
        <span class="terminal__out"><strong>${esc(s.site.name)}</strong> — ${esc(s.site.tagline)}</span></div>

      <div class="terminal__line" data-reveal="2" hidden style="margin-top:8px"><span class="terminal__prompt">$</span><span class="terminal__cmd" data-type="skills --list"></span></div>
      <div class="terminal__tags" data-reveal="3" hidden>${skills.map(t => `<span>${esc(t)}</span>`).join('')}</div>

      <div class="terminal__line" data-reveal="4" hidden style="margin-top:8px"><span class="terminal__prompt">$</span><span class="terminal__cmd" data-type="status"></span></div>
      <div class="terminal__line" data-reveal="5" hidden><span class="terminal__prompt">→</span>
        <span class="terminal__out" style="color:var(--ok)">pronto para a próxima mentoria<span class="caret"></span></span></div>
    </div>`;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = $$('[data-type]', el);
  const reveals = $$('[data-reveal]', el);

  if (reduce) {
    steps.forEach(n => n.textContent = n.dataset.type);
    reveals.forEach(n => n.hidden = false);
    return;
  }
  // digita cada comando e revela a saida correspondente
  let i = 0;
  const typeNext = () => {
    if (i >= steps.length) return;
    const node = steps[i], text = node.dataset.type;
    let c = 0;
    const tick = setInterval(() => {
      node.textContent = text.slice(0, ++c);
      if (c >= text.length) {
        clearInterval(tick);
        reveals.filter(r => +r.dataset.reveal === i * 2 + 1 || +r.dataset.reveal === i * 2 + 2)
               .forEach(r => r.hidden = false);
        i++; setTimeout(typeNext, 320);
      }
    }, 55);
  };
  setTimeout(typeNext, 400);
}

/* ---------- hero: numeros reais, contados do proprio catalogo ----------- */
function renderStats() {
  const el = $('#heroStats'); if (!el) return;
  const ms = DATA.mentorias.mentorias;
  const tecs = new Set(ms.flatMap(m => m.tecnologias || []));
  const stats = [
    { n: ms.length,                                              label: 'Mentorias no catálogo' },
    { n: ms.filter(m => m.categoria === 'tecnica').length,       label: 'Trilhas técnicas' },
    { n: DATA.tecnologias.grupos.reduce((s,g)=>s+g.itens.length,0), label: 'Tecnologias no stack' },
    { n: DATA.site.mentor.anosExperiencia || '—',                label: 'Anos em produção' }
  ];
  el.innerHTML = stats.map(s => `
    <div class="stat"><div class="stat__num"><em>${esc(s.n)}</em></div>
    <div class="stat__label">${esc(s.label)}</div></div>`).join('');
}

/* ---------- sobre: pilares do ecossistema ------------------------------- */
function renderSobre() {
  const el = $('#sobreGrid'); if (!el) return;
  const items = [
    { i: 'database',    t: 'Database',            d: 'Oracle, MySQL, SQL Server, PostgreSQL e MongoDB — arquitetura interna antes de qualquer comando.' },
    { i: 'ha',          t: 'Alta Disponibilidade',d: 'RAC, Data Guard, Always On, InnoDB Cluster e Patroni. Quorum, failover e o custo de cada garantia.' },
    { i: 'replication', t: 'Replicação',          d: 'Binlog, GTID, WAL streaming e GoldenGate. Consistência entre nós e resolução de conflito.' },
    { i: 'backup',      t: 'Backup & Recovery',   d: 'RMAN, XtraBackup, pgBackRest, PITR e ZDLRA — com teste de restore, não só agendamento.' },
    { i: 'performance', t: 'Performance',         d: 'AWR, Query Store, Performance Schema e EXPLAIN. Diagnóstico por evidência.' },
    { i: 'cloud',       t: 'Cloud',               d: 'OCI, AWS, Azure e GCP pela ótica de quem responde pelo RPO, não pelo console.' },
    { i: 'security',    t: 'Segurança',           d: 'TDE, TLS, RBAC e auditoria que sobrevive a uma inspeção de compliance.' },
    { i: 'automation',  t: 'Automação & DBRE',    d: 'Infra como código, pipeline de schema, observabilidade e teste de caos.' }
  ];
  el.innerHTML = items.map((x, n) => `
    <article class="card reveal" style="--d:${n * 40}ms">
      <div class="card__icon">${icon(x.i)}</div>
      <h3>${esc(x.t)}</h3><p>${esc(x.d)}</p>
    </article>`).join('');
}

/* ---------- fundadores --------------------------------------------------- */
/* O primeiro com principal:true vira o card grande com avatar; os demais
   entram empilhados ao lado. Campo vazio simplesmente nao renderiza — e o
   botao de LinkedIn fica visivel porem desabilitado ate a URL existir. */
function botaoLinkedin(url, tamanho = '') {
  const cls = `btn ${tamanho} `.trim();
  return url
    ? `<a class="${cls} btn--outline" href="${esc(url)}" target="_blank" rel="noopener">${icon('linkedin')} Ver LinkedIn</a>`
    : `<button class="${cls} btn--outline is-disabled" type="button" disabled
         title="Link ainda não cadastrado">${icon('linkedin')} Ver LinkedIn</button>`;
}

function renderFundadores() {
  const box = $('#fundadores'); if (!box) return;
  const F = (DATA.site.fundadores && DATA.site.fundadores.lista) || [];
  const principal = F.find(f => f.principal);
  const demais = F.filter(f => !f.principal);

  const grande = f => !f ? '' : `
    <article class="founder founder--main reveal">
      ${f.avatar ? `<img class="founder__avatar" src="${url(f.avatar)}" width="128" height="128"
                        alt="Avatar de ${esc(f.nome)} — DBA BRABO" loading="lazy">` : ''}
      <div class="founder__body">
        <p class="eyebrow">Fundador e mentor</p>
        <h3 class="founder__name">${esc(f.nome)}</h3>
        ${f.titulo ? `<p class="founder__role">${esc(f.titulo)}</p>` : ''}
        ${f.headline ? `<p class="founder__headline">${esc(f.headline)}</p>` : ''}
        ${f.trajetoria && f.trajetoria.length
          ? `<ul class="founder__track">${f.trajetoria.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${f.reconhecimentos && f.reconhecimentos.length
          ? `<div class="badges">${f.reconhecimentos.map(r => `<span class="badge badge--accent">${esc(r)}</span>`).join('')}</div>` : ''}
        <div class="hstack mt-6">
          ${botaoLinkedin(f.linkedin)}
          ${f.github ? `<a class="btn btn--ghost" href="${esc(f.github)}" target="_blank" rel="noopener">${icon('github')} GitHub</a>` : ''}
        </div>
      </div>
    </article>`;

  const pequeno = f => `
    <article class="founder founder--sm reveal">
      <p class="eyebrow">Fundador</p>
      <h3 class="founder__name founder__name--sm">${esc(f.nome)}</h3>
      ${f.titulo ? `<p class="founder__role">${esc(f.titulo)}</p>` : ''}
      ${f.headline
        ? `<p class="founder__headline">${esc(f.headline)}</p>`
        : `<p class="founder__headline muted"><em>Apresentação em breve.</em></p>`}
      ${f.trajetoria && f.trajetoria.length
        ? `<ul class="founder__track">${f.trajetoria.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${f.reconhecimentos && f.reconhecimentos.length
        ? `<div class="badges">${f.reconhecimentos.map(r => `<span class="badge badge--accent">${esc(r)}</span>`).join('')}</div>` : ''}
      <div class="hstack mt-4">${botaoLinkedin(f.linkedin, 'btn--sm')}</div>
    </article>`;

  box.innerHTML = `${grande(principal)}
    ${demais.length ? `<div class="founders__col">${demais.map(pequeno).join('')}</div>` : ''}`;
}

/* ---------- metodologia e formato --------------------------------------- */
function renderMetodologia() {
  const el = $('#metodologiaGrid');
  if (el) el.innerHTML = DATA.site.metodologia.etapas.map(e => `
    <div class="method__item reveal">
      <div class="method__n">${esc(e.n)}</div>
      <div class="method__title">${esc(e.titulo)}</div>
      <p class="method__desc">${esc(e.desc)}</p>
    </div>`).join('');

  const f = $('#formato');
  if (f) f.innerHTML = DATA.site.formato.itens.map(i => `
    <div class="format__item reveal">
      <div class="format__icon">${icon(i.icone)}</div>
      <div><h3 style="font-size:var(--fs-base)">${esc(i.titulo)}</h3>
      <p class="muted" style="font-size:var(--fs-sm)">${esc(i.desc)}</p></div>
    </div>`).join('');
}

/* ---------- cards de mentoria ------------------------------------------- */
function precoDe(m) {
  const v = m.investimento && m.investimento.valor;
  if (v) return { txt: v, pending: false };
  return { txt: DATA.site.investimento.fallback, pending: true };
}

function mentoriaCard(m) {
  const p = precoDe(m);
  const nMod = (m.modulos && m.modulos.length) || 0;
  return `
  <article class="mcard reveal${m.flagship ? ' mcard--flagship' : ''}"
           style="--accent:${esc(m.accent)}" data-tags="${esc((m.tags || []).join(' '))}"
           data-search="${esc([m.nome, m.desc, m.subtitulo, (m.tecnologias || []).join(' ')].join(' ').toLowerCase())}">
    <a class="mcard__banner" href="${url(`mentorias/${m.slug}/`)}" tabindex="-1" aria-hidden="true">
      <img src="${url(m.banner.card)}" alt="" loading="lazy" width="800" height="306">
    </a>
    <div class="mcard__body">
      <p class="mcard__eyebrow">${esc(m.chamada || 'Mentoria')}</p>
      <h3 class="mcard__title"><a href="${url(`mentorias/${m.slug}/`)}">${esc(m.nome)}</a></h3>
      <p class="mcard__desc">${esc(m.desc)}</p>
      <div class="mcard__meta">
        <span>${icon('level')}${esc(m.nivel)}</span>
        <span>${icon('modules')}${nMod ? `${nMod} módulos` : `${m.pilares.length} pilares`}</span>
      </div>
      <div class="mcard__foot">
        <span class="mcard__price${p.pending ? ' is-pending' : ''}">${esc(p.txt)}</span>
        <a class="btn btn--outline btn--sm" href="${url(`mentorias/${m.slug}/`)}">Ver conteúdo ${icon('chevronRight')}</a>
      </div>
    </div>
  </article>`;
}

function renderMentorias() {
  const grid = $('#mentoriasGrid'); if (!grid) return;
  const ms = DATA.mentorias.mentorias;
  const ordem = m => (m.flagship ? 0 : m.destaque ? 1 : 2);
  grid.innerHTML = [...ms].sort((a, b) => ordem(a) - ordem(b)).map(mentoriaCard).join('');
  renderFiltros(ms);
}

function renderFiltros(ms) {
  const box = $('#filtros'); if (!box) return;
  const conta = id => id === 'all' ? ms.length : ms.filter(m => (m.tags || []).includes(id)).length;
  box.innerHTML = DATA.mentorias.filtros
    .filter(f => conta(f.id) > 0)
    .map(f => `<button class="filter${f.id === 'all' ? ' is-active' : ''}" data-filter="${esc(f.id)}"
       aria-pressed="${f.id === 'all'}">${esc(f.label)}<span class="filter__count">${conta(f.id)}</span></button>`).join('');
}

/* ---------- projetos ----------------------------------------------------- */
const STATUS_BADGE = { 'Em produção':'badge--ok', 'Em homologação':'badge--warn', 'Em desenvolvimento':'' };

function renderProjetos() {
  const el = $('#projetosGrid'); if (!el) return;
  el.innerHTML = DATA.projetos.projetos.map(p => {
    // repoPublico:false esconde o botao mesmo com URL cadastrada — evita mandar
    // o visitante para um 404 enquanto o repositorio nao esta no ar.
    const disponivel = p.repoPublico !== false;
    const link = disponivel ? ((p.links && (p.links.site || p.links.github)) || '') : '';
    const ehGithub = !!(p.links && !p.links.site && p.links.github);
    return `
    <article class="card pcard reveal" style="--accent:${esc(p.accent)}">
      <div class="pcard__status">
        <span class="badge ${STATUS_BADGE[p.status] || ''}">${esc(p.status)}</span>
        ${p.versao ? `<span class="badge mono">${esc(p.versao)}</span>` : ''}
      </div>
      <div class="pcard__head">
        <div class="pcard__name">${esc(p.nome)}</div>
        <div class="pcard__tagline">${esc(p.tagline)}</div>
      </div>
      ${p.desc ? `<p style="color:var(--fg-1);font-size:var(--fs-sm)">${esc(p.desc)}</p>` : ''}
      ${p.destaques && p.destaques.length
        ? `<ul class="pcard__list">${p.destaques.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${!p.desc && !(p.destaques || []).length
        ? `<p class="pcard__vazio">Detalhes técnicos em breve.</p>` : ''}
      ${p.stack && p.stack.length
        ? `<div class="badges">${p.stack.slice(0, 6).map(s => `<span class="badge">${esc(s)}</span>`).join('')}</div>` : ''}
      <div class="pcard__foot">
        ${link
          ? `<a class="btn btn--outline btn--sm" href="${esc(link)}" target="_blank" rel="noopener">
               ${icon(ehGithub ? 'github' : 'external')} ${ehGithub ? 'Ver no GitHub' : 'Acessar'}</a>`
          : `<span class="pcard__soon">${p.repoPublico === false ? 'Repositório em breve' : 'Link em breve'}</span>`}
      </div>
    </article>`;
  }).join('');
}

/* ---------- stack -------------------------------------------------------- */
function renderStack() {
  const el = $('#stackGrid'); if (!el) return;
  const ms = DATA.mentorias.mentorias;
  const ondeAparece = nome => ms.filter(m =>
    (m.tecnologias || []).some(t => t.toLowerCase().includes(nome.toLowerCase()) ||
                                    nome.toLowerCase().includes(t.toLowerCase())));

  el.innerHTML = DATA.tecnologias.grupos.map(g => `
    <section class="stack__group reveal" style="--accent:${esc(g.accent)}">
      <div class="stack__head">
        <div class="stack__icon">${icon(g.icone)}</div>
        <h3 class="stack__name">${esc(g.nome)}</h3>
      </div>
      <p class="stack__desc">${esc(g.desc)}</p>
      <div class="stack__items">
        ${g.itens.map((it, i) => `<button class="chip" aria-expanded="false"
            data-tip="${esc(g.id)}-${i}">${esc(it.nome)}</button>`).join('')}
      </div>
      ${g.itens.map((it, i) => {
        const onde = ondeAparece(it.nome).slice(0, 5);
        return `<div class="tip" id="tip-${esc(g.id)}-${i}">
          <strong>${esc(it.nome)}</strong> — ${esc(it.desc)}
          ${onde.length ? `<div class="tip__where">${onde.map(m =>
            `<a class="badge badge--accent" href="${url(`mentorias/${m.slug}/`)}">${esc(m.nome)}</a>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}
    </section>`).join('');
}

/* ---------- certificacoes ------------------------------------------------ */
/* Badges ja normalizadas por tools/build-badges.py — mesmo quadrado, fundo
   transparente — entao nao ha ajuste de tamanho aqui. Sem datas: a ordem e por
   peso tecnico e o nivel aparece no cabecalho de cada faixa. */
function renderCertificacoes() {
  const box = $('#certificacoes'); if (!box || !DATA.certificacoes) return;
  const C = DATA.certificacoes;

  const destaque = c => `
    <article class="cred-hero reveal" style="--accent:${esc(c.accent)}">
      <img src="${url(`assets/badges/${c.badge}.webp`)}" width="104" height="104" loading="lazy"
           alt="Badge ${esc(c.nome)}">
      <div>
        <p class="cred-hero__tipo">${esc(c.tipo)}</p>
        <h3 class="cred-hero__nome">${esc(c.nome)}</h3>
        <p class="cred-hero__desc">${esc(c.desc)}</p>
      </div>
    </article>`;

  const nivel = g => `
    <section class="cred-nivel reveal" style="--accent:${esc(g.accent)}">
      <div class="cred-nivel__head">
        <h3 class="cred-nivel__nome">${esc(g.nome)}</h3>
        <p class="cred-nivel__desc">${esc(g.desc)}</p>
      </div>
      <div class="cred-grid">
        ${g.itens.map(i => `
          <article class="cred">
            <img src="${url(`assets/badges/${i.badge}.webp`)}" width="82" height="82" loading="lazy"
                 alt="Badge ${esc(i.nome)}">
            <h4 class="cred__nome">${esc(i.nome)}</h4>
          </article>`).join('')}
      </div>
    </section>`;

  box.innerHTML =
    `<div class="cred-destaques">${C.destaques.map(destaque).join('')}</div>` +
    C.grupos.map(nivel).join('');
}

/* ---------- eventos da comunidade ---------------------------------------
   Um evento nunca guarda "proximo" ou "passado" no JSON: a comparacao e feita
   aqui, contra a data de hoje. Assim a agenda se reorganiza sozinha.

   'dataFim' e opcional. Sem ela o evento e de um dia so; com ela, o evento
   so vira passado depois do ULTIMO dia — e enquanto estiver rolando, ganha
   o selo "Acontecendo agora".
------------------------------------------------------------------------- */
function renderEventos() {
  const box = $('#eventos'); if (!box) return;
  const cfg = DATA.eventos || {};
  const itens = (cfg.itens || []).filter(e => e && e.data && e.confirmado !== false);
  const secao = box.closest('section');

  if (!itens.length) { if (secao) secao.hidden = true; return; }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const asData  = iso => { const [a, m, d] = String(iso).split('-').map(Number); return new Date(a, m - 1, d); };
  const diasAte = iso => Math.round((asData(iso) - hoje) / 86400000);
  const fimDe   = e => e.dataFim || e.data;

  const fmtLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const soMes    = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

  /* "2 a 4 de setembro de 2026" — e nao duas datas soltas. */
  const periodo = e => {
    const a = asData(e.data), b = asData(fimDe(e));
    if (+a === +b) return fmtLongo.format(a);
    const dia = n => String(n.getDate()).padStart(2, '0');
    if (a.getFullYear() !== b.getFullYear()) return `${fmtCurto.format(a)} a ${fmtCurto.format(b)}`;
    if (a.getMonth() === b.getMonth())
      return `${dia(a)} a ${dia(b)} de ${soMes.format(b)} de ${b.getFullYear()}`;
    return `${dia(a)} de ${soMes.format(a)} a ${dia(b)} de ${soMes.format(b)} de ${b.getFullYear()}`;
  };
  const periodoCurto = e => {
    const a = asData(e.data), b = asData(fimDe(e));
    return +a === +b ? fmtCurto.format(a) : `${fmtCurto.format(a)} a ${fmtCurto.format(b)}`;
  };

  const jaPassou = e => diasAte(fimDe(e)) < 0;
  const rolando  = e => diasAte(e.data) <= 0 && diasAte(fimDe(e)) >= 0;

  const proximos = itens.filter(e => !jaPassou(e)).sort((a, b) => asData(a.data) - asData(b.data));
  const passados = itens.filter(e =>  jaPassou(e)).sort((a, b) => asData(fimDe(b)) - asData(fimDe(a)));

  const selo = e => {
    const d = diasAte(e.data);
    if (jaPassou(e)) return { txt: 'Edição encerrada', ic: 'check', cls: '' };
    if (rolando(e))  return { txt: 'Acontecendo agora', ic: 'clock', cls: ' evento__selo--agora' };
    if (d === 1)     return { txt: 'Amanhã', ic: 'clock', cls: '' };
    return { txt: `Faltam ${d} dias`, ic: 'clock', cls: '' };
  };

  const botao = (u, rotulo, cls) => u
    ? `<a class="btn ${cls}" href="${esc(u)}" target="_blank" rel="noopener">${icon('external')} ${esc(rotulo)}</a>` : '';

  const card = e => {
    const s = selo(e), passado = jaPassou(e);
    const L = e.links || {};
    return `
    <article class="evento${passado ? ' evento--passado' : ''} reveal" style="--accent:${esc(e.accent || 'var(--brand)')}">
      <div class="evento__capa${e.capaClara ? ' evento__capa--clara' : ''}">
        <span class="evento__selo${s.cls}">${icon(s.ic)} ${esc(s.txt)}</span>
        ${e.banner ? `<img src="${url(e.banner)}" alt="Arte de divulgação do ${esc(e.nome)}" loading="lazy" width="1200" height="675">` : ''}
      </div>
      <div class="evento__corpo">
        ${e.edicao ? `<p class="evento__edicao">${esc(e.edicao)}</p>` : ''}
        <h3 class="evento__nome">${esc(e.nome)}</h3>
        ${e.desc ? `<p class="evento__desc">${esc(e.desc)}</p>` : ''}
        <div class="evento__meta">
          <div class="evento__linha">${icon('calendar')}
            <div><b>${esc(periodo(e))}</b>
            ${e.horario ? `<span>${esc(e.horario)}</span>` : ''}</div></div>
          <div class="evento__linha">${icon('pin')}
            <div><b>${esc(e.local || '')}</b>
            ${e.cidade ? `<span>${esc(e.cidade)}</span>` : ''}</div></div>
        </div>
        <div class="evento__btns">
          ${botao(L.site, 'Site oficial', passado ? 'btn--outline btn--sm' : 'btn--primary')}
          ${passado ? '' : botao(L.inscricao, 'Inscrição', 'btn--outline btn--sm')}
          ${passado ? '' : botao(L.transmissao, 'Assistir ao vivo', 'btn--outline btn--sm')}
          ${botao(L.comunidade, 'Comunidade', 'btn--ghost btn--sm')}
        </div>
      </div>
    </article>`;
  };

  const mini = e => `
    <div class="evento-mini reveal" style="--accent:${esc(e.accent || 'var(--brand)')}">
      ${e.banner ? `<img src="${url(e.banner)}" alt="" loading="lazy">` : '<span></span>'}
      <div>
        <p class="evento-mini__nome">${esc(e.nome)}</p>
        <p class="evento-mini__meta">${esc(periodoCurto(e))} &middot; ${esc(e.cidade || '')}</p>
      </div>
      ${(e.links || {}).site ? `<a class="btn btn--outline btn--sm" href="${esc(e.links.site)}" target="_blank" rel="noopener">${icon('external')} Site</a>` : ''}
    </div>`;

  const nota = cfg.atualizadoEm
    ? `<p class="eventos-nota">Agenda conferida nos sites oficiais em ${esc(fmtCurto.format(asData(cfg.atualizadoEm)))}.</p>` : '';

  box.innerHTML = nota
    + (proximos.length
        ? `<div class="eventos${proximos.length === 1 ? ' eventos--destaque' : ''}">${proximos.map(card).join('')}</div>`
        : `<p class="muted"><em>Nenhum evento com data confirmada no momento. As edições anteriores ficam abaixo.</em></p>`)
    + (passados.length
        ? `<div class="eventos-passados">
             <p class="eventos-passados__head">Edições anteriores</p>
             ${passados.map(mini).join('')}
           </div>` : '');
}

/* ---------- roadmap ------------------------------------------------------ */
function renderRoadmap() {
  const el = $('#roadmapList'); if (!el) return;
  const byS = Object.fromEntries(DATA.mentorias.mentorias.map(m => [m.slug, m]));
  el.innerHTML = DATA.roadmap.etapas.map(e => {
    const links = (e.mentorias || []).map(s => byS[s]).filter(Boolean);
    return `
    <div class="reveal">
      <button class="step${e.final ? ' step--final' : ''}" aria-expanded="false">
        <span class="step__n">${e.final ? icon('medal') : esc(e.n)}</span>
        <span class="step__main">
          <span class="step__title">${esc(e.titulo)}</span>
          <span class="step__resumo">${esc(e.resumo)}</span>
          <span class="step__detail"><span>
            <p>${esc(e.detalhe)}</p>
            <p class="step__sinal">${esc(e.sinal)}</p>
            ${links.length ? `<span class="step__links">${links.map(m =>
              `<a class="badge badge--accent" style="--accent:${esc(m.accent)}" href="${url(`mentorias/${m.slug}/`)}">${esc(m.nome)}</a>`).join('')}</span>` : ''}
          </span></span>
        </span>
        ${icon('chevron', 'acc__chev')}
      </button>
    </div>`;
  }).join('');
}

/* ---------- comunidade e redes ------------------------------------------ */
/* QR sempre escuro sobre placa clara: invertido nao e lido por boa parte dos
   leitores. A placa recebe um tom da cor do canal (qrPlate/qrInk no site.json),
   entao continua dentro do tema sem virar preto e branco. */
const CANAL_ICON = { whatsapp:'chat', linkedin:'linkedin', linkedinEmpresa:'linkedin',
                     instagram:'instagram', github:'github', blog:'doc', youtube:'youtube', email:'mail' };

async function qrInline(canal) {
  try {
    const r = await fetch(url(`assets/qr/${canal}.svg`), { cache:'force-cache' });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

function placaQR(canal, svg, { pequeno = false, hint = 'Aponte a câmera' } = {}) {
  if (!svg) return '';
  const L = DATA.site.links[canal];
  return `<div class="qr${pequeno ? ' qr--sm' : ''}"
     style="--qr-plate:${esc(L.qrPlate || '#F2F5F8')};--qr-ink:${esc(L.qrInk || '#12181F')}">
     ${svg}<span class="qr__hint">${esc(hint)}</span></div>`;
}

async function renderSocial() {
  const L = DATA.site.links;
  const ativos = k => L[k] && L[k].url;

  // rodape: todos os canais com URL
  const foot = $('#footerSocial');
  if (foot) foot.innerHTML = ['whatsapp','linkedinEmpresa','instagram','linkedin','github','blog','youtube','email']
    .filter(ativos).map(k => `<a href="${esc(L[k].url)}" target="_blank" rel="noopener">${esc(L[k].label)}</a>`).join('');

  // dois CTAs distintos:
  //   [data-community] -> grupo do WhatsApp (entrar na comunidade)
  //   [data-contato]   -> pagina oficial no LinkedIn (falar com o mentor)
  const aponta = (sel, chave, alternativa) => {
    const alvo = (L[chave] && L[chave].url) || (L[alternativa] && L[alternativa].url) || '';
    $$(sel).forEach(a => {
      if (!alvo) { a.hidden = true; return; }
      a.href = alvo; a.target = '_blank'; a.rel = 'noopener';
    });
  };
  aponta('[data-community]', DATA.site.contato?.canalComunidade || 'whatsapp', 'linkedinEmpresa');
  aponta('[data-contato]',   DATA.site.contato?.canalContato   || 'linkedinEmpresa', 'linkedin');

  const box = $('#canais'); if (!box) return;

  const comQR   = ['whatsapp','linkedinEmpresa','instagram'].filter(k => ativos(k) && L[k].qr);
  const semQR   = ['linkedin','github','blog','youtube','email'].filter(k => ativos(k) && !L[k].qr);
  const svgs    = Object.fromEntries(await Promise.all(comQR.map(async k => [k, await qrInline(k)])));

  const destaque = comQR.find(k => L[k].destaque) || comQR[0];
  const outros   = comQR.filter(k => k !== destaque);

  let html = '';

  if (destaque) {
    const d = L[destaque];
    html += `<article class="canal--hero reveal" style="--accent:${esc(d.accent)}">
      <div>
        <p class="canal__eyebrow">Comunidade oficial</p>
        <h3 class="canal__title">${esc(d.label)}</h3>
        <p class="canal__desc">${esc(d.desc)}</p>
        <div class="canal__actions">
          <a class="btn btn--primary" href="${esc(d.url)}" target="_blank" rel="noopener">
            ${icon(CANAL_ICON[destaque])} Entrar no grupo</a>
          <a class="btn btn--ghost" href="#mentorias">Ver as mentorias antes</a>
        </div>
      </div>
      ${placaQR(destaque, svgs[destaque], { hint: 'Aponte a câmera' })}
    </article>`;
  }

  if (outros.length) {
    html += `<div class="canais__cols">${outros.map(k => {
      const c = L[k];
      return `<article class="canal reveal" style="--accent:${esc(c.accent)}">
        ${placaQR(k, svgs[k], { pequeno:true, hint:'Escaneie' })}
        <div class="canal__main">
          <div class="canal__head">
            <span class="canal__icon">${icon(CANAL_ICON[k])}</span>
            <div><div class="canal__label">${esc(c.label)}</div>
            ${c.handle ? `<div class="canal__handle">${esc(c.handle)}</div>` : ''}</div>
          </div>
          <p class="canal__desc--sm">${esc(c.desc || '')}</p>
          <a class="canal__link" href="${esc(c.url)}" target="_blank" rel="noopener">Abrir ${icon('external')}</a>
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  if (semQR.length) {
    html += `<div class="canais__extras">${semQR.map(k => {
      const c = L[k];
      return `<a class="social__card reveal" style="--accent:${esc(c.accent)}" href="${esc(c.url)}" target="_blank" rel="noopener">
        <span class="social__icon">${icon(CANAL_ICON[k])}</span>
        <span><span class="social__label">${esc(c.label)}</span>
        <span class="social__desc">${esc(c.desc || '')}</span></span>
      </a>`;
    }).join('')}</div>`;
  }

  box.innerHTML = html || `<p class="muted">Nenhum canal configurado — preencha <code class="mono">data/site.json → links</code>.</p>`;
}

/* ---------- FAQ ---------------------------------------------------------- */
function renderFAQ() {
  const el = $('#faqList'); if (!el) return;
  el.innerHTML = DATA.faq.perguntas.map((f, i) => `
    <div class="acc reveal">
      <button class="acc__head" aria-expanded="false" aria-controls="faq-p-${i}">
        <span class="acc__num">${String(i + 1).padStart(2, '0')}</span>
        <span class="acc__label">${esc(f.q)}</span>
        ${icon('chevron', 'acc__chev')}
      </button>
      <div class="acc__panel" id="faq-p-${i}"><div class="acc__inner">
        <div class="acc__content"><p>${esc(f.a)}</p></div>
      </div></div>
    </div>`).join('');
}

/* ---------- rodape ------------------------------------------------------- */
function renderFooter() {
  const y = $('#footerYear');
  if (y) {
    const ini = DATA.site.footer.anoInicio, atual = new Date().getFullYear();
    y.textContent = `© ${ini === atual ? ini : `${ini}–${atual}`} ${DATA.site.footer.copyright}`;
  }
  const links = $('#footerMentorias');
  if (links) links.innerHTML = DATA.mentorias.mentorias.filter(m => m.destaque).slice(0, 5)
    .map(m => `<a href="${url(`mentorias/${m.slug}/`)}">${esc(m.nome)}</a>`).join('');
}

/* ==========================================================================
   INTERACAO
   ========================================================================== */

/* ---------- busca global ------------------------------------------------ */
/* O indice vem pronto de data/search-index.json (gerado por tools/build.mjs),
   porque os topicos detalhados vivem em data/modulos/ e nao chegam ao
   navegador. Se o arquivo nao existir, monta-se um indice reduzido na hora. */
async function carregarIndice() {
  try {
    const r = await fetch(url('data/search-index.json'), { cache: 'no-cache' });
    if (r.ok) { const d = await r.json(); if (d.itens && d.itens.length) return d.itens.map(x => ({ ...x, href: /^#/.test(x.href) ? url('') + x.href : url(x.href) })); }
  } catch { /* cai no fallback */ }
  return indiceReduzido();
}

function indiceReduzido() {
  const ix = [];
  for (const m of DATA.mentorias.mentorias) {
    const href = url(`mentorias/${m.slug}/`);
    ix.push({ g:'Mentorias', t:m.nome, s:m.desc, href, k:`${m.nome} ${m.desc} ${(m.tags||[]).join(' ')}`.toLowerCase() });
    for (const p of m.pilares || []) ix.push({ g:'Módulos e pilares', t:p.titulo, s:`${m.nome} — ${p.desc}`, href, k:`${p.titulo} ${p.desc}`.toLowerCase() });
    for (const t of m.tecnologias || []) ix.push({ g:'Tecnologias', t, s:`Aparece em ${m.nome}`, href, k:`${t} ${m.nome}`.toLowerCase() });
  }
  for (const p of DATA.projetos.projetos)
    ix.push({ g:'Projetos', t:p.nome, s:p.tagline, href:url('#projetos'), k:`${p.nome} ${p.desc}`.toLowerCase() });
  return ix;
}

async function setupSearch() {
  const input = $('#search'); if (!input) return;
  const box = $('#searchResults');
  const index = await carregarIndice();
  let cursor = -1, atuais = [];

  const marca = (txt, q) => {
    const i = txt.toLowerCase().indexOf(q);
    return i < 0 ? esc(txt)
      : `${esc(txt.slice(0, i))}<em>${esc(txt.slice(i, i + q.length))}</em>${esc(txt.slice(i + q.length))}`;
  };

  const fechar = () => { box.classList.remove('is-open'); cursor = -1; input.setAttribute('aria-expanded', 'false'); };

  const buscar = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return fechar();
    atuais = index.filter(r => r.k.includes(q)).slice(0, 24);
    if (!atuais.length) {
      box.innerHTML = `<p class="search__empty">Nada encontrado para <strong>${esc(input.value)}</strong>.</p>`;
    } else {
      let html = '', grupoAtual = '';
      atuais.forEach((r, i) => {
        if (r.g !== grupoAtual) { grupoAtual = r.g; html += `<div class="search__group">${esc(r.g)}</div>`; }
        html += `<a class="search__item" href="${r.href}" data-i="${i}">
                   <strong>${marca(r.t, q)}</strong><small>${esc(r.s || '')}</small></a>`;
      });
      box.innerHTML = html;
    }
    box.classList.add('is-open'); input.setAttribute('aria-expanded', 'true');
  };

  let deb; input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(buscar, 110); });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) buscar(); });

  input.addEventListener('keydown', e => {
    const itens = $$('.search__item', box);
    if (e.key === 'Escape') { fechar(); input.blur(); return; }
    if (!itens.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
      itens.forEach(n => n.classList.remove('is-cursor'));
      itens[cursor].classList.add('is-cursor');
      itens[cursor].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); itens[cursor].click(); }
  });

  document.addEventListener('click', e => { if (!e.target.closest('.search')) fechar(); });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });
}

/* ---------- filtros ------------------------------------------------------ */
function setupFiltros() {
  const box = $('#filtros'); if (!box) return;
  const nota = $('#resultsNote');
  box.addEventListener('click', e => {
    const btn = e.target.closest('.filter'); if (!btn) return;
    $$('.filter', box).forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('is-active'); btn.setAttribute('aria-pressed', 'true');

    const f = btn.dataset.filter;
    let n = 0;
    $$('.mcard').forEach(c => {
      const ok = f === 'all' || (c.dataset.tags || '').split(' ').includes(f);
      c.classList.toggle('is-hidden', !ok);
      if (ok) n++;
    });
    if (nota) nota.textContent = f === 'all'
      ? `${n} mentorias no catálogo`
      : `${n} ${n === 1 ? 'mentoria' : 'mentorias'} em ${btn.textContent.replace(/\d+$/, '').trim()}`;
  });
}

/* ---------- accordion (delegado, funciona em conteudo dinamico) ---------- */
function setupAccordions() {
  document.addEventListener('click', e => {
    const head = e.target.closest('.acc__head');
    if (head) {
      const acc = head.closest('.acc');
      const open = acc.classList.toggle('is-open');
      head.setAttribute('aria-expanded', String(open));
      return;
    }
    const step = e.target.closest('.step');
    if (step) {
      const open = step.classList.toggle('is-open');
      step.setAttribute('aria-expanded', String(open));
    }
  });
}

/* ---------- tooltips da stack ------------------------------------------- */
function setupTips() {
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    const tip = document.getElementById('tip-' + chip.dataset.tip); if (!tip) return;
    const abrir = !tip.classList.contains('is-open');
    const grupo = chip.closest('.stack__group');
    $$('.tip', grupo).forEach(t => t.classList.remove('is-open'));
    $$('.chip', grupo).forEach(c => c.setAttribute('aria-expanded', 'false'));
    if (abrir) { tip.classList.add('is-open'); chip.setAttribute('aria-expanded', 'true'); }
  });
}

/* ---------- copiar bloco de codigo -------------------------------------- */
function setupCopy() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.code__copy'); if (!btn) return;
    const code = btn.closest('.code').querySelector('code');
    try {
      await navigator.clipboard.writeText(code.textContent);
      const antes = btn.innerHTML;
      btn.innerHTML = `${icon('check')} copiado`;
      btn.classList.add('is-done');
      setTimeout(() => { btn.innerHTML = antes; btn.classList.remove('is-done'); }, 1800);
    } catch { /* clipboard indisponivel (http, permissao) — silencioso */ }
  });
}

/* ---------- tema: dark / light / system --------------------------------- */
function setupTema() {
  const KEY = 'dbabrabo-theme';
  const ordem = ['dark', 'light', 'system'];
  const aplicar = t => {
    document.documentElement.dataset.theme =
      t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
    document.documentElement.dataset.themePref = t;
    const btn = $('#themeToggle');
    if (btn) btn.setAttribute('aria-label', `Tema: ${t}. Clique para alternar.`);
  };
  let atual = localStorage.getItem(KEY) || 'dark';   // dark premium por padrao (secao 39 do briefing)
  aplicar(atual);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (atual === 'system') aplicar('system'); });

  const btn = $('#themeToggle');
  if (btn) btn.addEventListener('click', () => {
    atual = ordem[(ordem.indexOf(atual) + 1) % ordem.length];
    localStorage.setItem(KEY, atual);
    aplicar(atual);
  });
}

/* ---------- navegacao ---------------------------------------------------- */
function setupNav() {
  const header = $('.header'), nav = $('#nav'), toggle = $('#menuToggle');
  if (toggle) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = icon(open ? 'close' : 'menu');
  });
  if (nav) nav.addEventListener('click', e => {
    if (e.target.closest('a') && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = icon('menu');
    }
  });

  const onScroll = () => header && header.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

}

/* ---------- revelacao no scroll ----------------------------------------- */
function setupReveal() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('.reveal').forEach(n => n.classList.add('is-in')); return;
  }
  const io = new IntersectionObserver((es, obs) => {
    es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  $$('.reveal').forEach(n => io.observe(n));
}

/* ---------- observador da secao ativa (separado, correto) --------------- */
function setupScrollSpy() {
  const secoes = $$('main section[id]');
  const links = $$('.nav__link[href^="#"]');
  if (!secoes.length || !links.length) return;
  const io = new IntersectionObserver(es => {
    es.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secoes.forEach(s => io.observe(s));
}

/* ==========================================================================
   BOOT
   ========================================================================== */
async function boot() {
  setupTema();                       // antes de tudo, evita flash de tema errado
  try {
    const [site, mentorias, projetos, tecnologias, roadmap, faq, certificacoes, eventos] = await Promise.all(
      ['site', 'mentorias', 'projetos', 'tecnologias', 'roadmap', 'faq', 'certificacoes', 'eventos'].map(loadJSON));
    Object.assign(DATA, { site, mentorias, projetos, tecnologias, roadmap, faq, certificacoes, eventos });
  } catch (err) {
    console.error('[DBA BRABO] falha ao carregar os dados:', err);
    const alvo = $('#mentoriasGrid') || $('main');
    if (alvo) alvo.innerHTML = `<div class="card" style="--accent:var(--err)">
      <h3>Não foi possível carregar o conteúdo</h3>
      <p>Os arquivos de <code class="mono">data/</code> não foram encontrados. Se você abriu o
      <code class="mono">index.html</code> direto do disco, o navegador bloqueia a leitura por CORS —
      rode um servidor local: <code class="mono">python3 -m http.server 8080</code>.</p></div>`;
    return;
  }

  renderTerminal(); renderStats(); renderSobre(); renderFundadores(); renderMetodologia();
  renderMentorias(); renderProjetos(); renderStack(); renderCertificacoes(); renderEventos(); renderRoadmap();
  renderFAQ(); renderFooter();
  await renderSocial();          // busca os SVG dos QR antes de revelar
  await setupSearch();           // indice de busca gerado no build

  setupFiltros(); setupAccordions(); setupTips(); setupCopy();
  setupNav(); setupScrollSpy(); setupReveal();

  document.dispatchEvent(new CustomEvent('dbabrabo:ready', { detail: DATA }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
