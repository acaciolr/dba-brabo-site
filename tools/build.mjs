#!/usr/bin/env node
/**
 * DBA BRABO — gerador estatico do portal.
 *
 * Le data/*.json e escreve:
 *   mentorias/index.html          catalogo
 *   mentorias/<slug>/index.html   uma pagina por mentoria, com <title>, description,
 *                                 Open Graph, canonical e schema.org proprios
 *   sitemap.xml, robots.txt
 *
 * Uso:  node tools/build.mjs            gera tudo
 *       node tools/build.mjs --check    so valida, nao escreve nada
 *
 * Para adicionar uma mentoria voce edita data/mentorias.json e roda isto.
 * Nenhum HTML precisa ser tocado a mao.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHECK_ONLY = process.argv.includes('--check');
const p = (...a) => path.join(ROOT, ...a);
const read = f => JSON.parse(fs.readFileSync(p('data', f), 'utf8'));

const site        = read('site.json');
const catalogo    = read('mentorias.json');
const projetos    = read('projetos.json');
const tecnologias = read('tecnologias.json');
const roadmap     = read('roadmap.json');

const ORIGIN = (site.site.usarDominioProprio ? site.site.domainFuturo : site.site.domain).replace(/\/$/, '');

/* anexa os modulos detalhados de data/modulos/<slug>.json */
for (const m of catalogo.mentorias) {
  const f = p('data', 'modulos', `${m.slug}.json`);
  if (fs.existsSync(f)) m.modulos = JSON.parse(fs.readFileSync(f, 'utf8')).modulos || [];
}

/* ---------- helpers ----------------------------------------------------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => String(s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ICON = {
  level:   '<path d="M4 20V10M10 20V4M16 20v-8M22 20h-20"/>',
  modules: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  tag:     '<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  money:   '<circle cx="12" cy="12" r="9"/><path d="M15 9.5A3 3 0 0 0 12 8c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5"/><path d="M12 6v12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  copy:    '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  admin:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  replication:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  ha:'<rect x="2" y="3" width="20" height="6" rx="2"/><rect x="2" y="15" width="20" height="6" rx="2"/><path d="M6 6h.01M6 18h.01"/><path d="M12 9v6"/>',
  backup:'<path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  performance:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l4-5 3 3 5-7"/>',
  security:'<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>',
  code:'<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  select:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  function:'<path d="M4 20c3 0 4-2 4-8s1-8 4-8"/><path d="M6 12h6"/><path d="M14 10l6 6M20 10l-6 6"/>',
  group:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M18 20a5 5 0 0 0-2-4"/>',
  join:'<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  subquery:'<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  window:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  dml:'<path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  capture:'<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  conflict:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  iac:'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  automation:'<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  containers:'<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  cicd:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h6"/>',
  observability:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  chaos:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/>',
  chat:'<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 4.1 12a8.4 8.4 0 0 1 8.4-8.5A8.4 8.4 0 0 1 21 11.5z"/>',
  lab:'<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  growth:'<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
  cap:'<path d="M22 9 12 5 2 9l10 4 10-4z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  medal:'<circle cx="12" cy="15" r="6"/><path d="M8.2 10 5 2h14l-3.2 8"/>',
  mix:'<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6M4 4l5 5"/>',
  exam:'<path d="M9 2h6a2 2 0 0 1 2 2v1h2a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a2 2 0 0 1 2-2z"/><path d="m9 14 2 2 4-4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  linkedin:'<rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/><path d="M10 21V9h4v2a4 4 0 0 1 7 3v7h-4v-6a2 2 0 0 0-4 0v6z"/>'
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICON[n] || ICON.tag}</svg>`;

/* ---------- <head> compartilhado ---------------------------------------- */
function head({ title, desc, canonical, ogImage, base, ld }) {
  return `<!DOCTYPE html>
<html lang="pt-BR" data-base="${base}" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#07090D">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${base}/assets/logo/favicon.ico" sizes="any">
<link rel="icon" href="${base}/assets/logo/avatar-96.png" type="image/png">
<link rel="apple-touch-icon" href="${base}/assets/logo/avatar-180.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DBA BRABO">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${base}/style.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head>
<body>
<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
<div class="backdrop" aria-hidden="true"></div>
<div class="aurora" aria-hidden="true"></div>`;
}

function header(base) {
  return `
<header class="header">
  <a class="brand" href="${base}/" aria-label="DBA BRABO — início">
    <img class="brand__mark" src="${base}/assets/logo/avatar-96.png" width="38" height="38" alt="">
    <span class="brand__name">DBA <span>BRABO</span><small class="brand__tag">Mentoria Técnica para DBAs</small></span>
  </a>
  <nav class="nav" id="nav" aria-label="Navegação principal">
    <a class="nav__link" href="${base}/#sobre">Sobre</a>
    <a class="nav__link" href="${base}/mentorias/">Mentorias</a>
    <a class="nav__link" href="${base}/#metodologia">Metodologia</a>
    <a class="nav__link" href="${base}/#projetos">Projetos</a>
    <a class="nav__link" href="${base}/#tecnologias">Stack</a>
    <a class="nav__link" href="${base}/#roadmap">Roadmap</a>
    <a class="nav__link" href="${base}/#faq">FAQ</a>
    <span class="nav__actions">
      <a class="btn btn--primary btn--sm" href="${base}/#comunidade" data-community>Entrar na comunidade</a>
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Alternar tema">
        <svg data-icon="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <svg data-icon="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg data-icon="system" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      </button>
    </span>
  </nav>
  <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
  </button>
</header>`;
}

function footer(base) {
  const destaques = catalogo.mentorias.filter(m => m.destaque).slice(0, 5);
  return `
<footer class="footer">
  <div class="container">
    <div class="footer__grid">
      <div class="footer__brand">
        <a class="brand" href="${base}/">
          <img class="brand__mark" src="${base}/assets/logo/avatar-96.png" width="38" height="38" alt="">
          <span class="brand__name">DBA <span>BRABO</span></span>
        </a>
        <p>Conhecimento real de banco de dados, infraestrutura, performance, alta disponibilidade, cloud e automação.</p>
      </div>
      <div class="footer__col"><h4>Mentorias</h4>
        ${destaques.map(m => `<a href="${base}/mentorias/${m.slug}/">${esc(m.nome)}</a>`).join('')}
        <a href="${base}/mentorias/">Ver todas →</a></div>
      <div class="footer__col"><h4>Portal</h4>
        <a href="${base}/#sobre">Sobre</a><a href="${base}/#metodologia">Metodologia</a>
        <a href="${base}/#projetos">Projetos</a><a href="${base}/#tecnologias">Stack</a>
        <a href="${base}/#roadmap">Roadmap</a><a href="${base}/#faq">FAQ</a></div>
      <div class="footer__col"><h4>Redes</h4><div id="footerSocial"></div></div>
    </div>
    <div class="footer__bottom">
      <span id="footerYear">© ${site.footer.anoInicio}–${new Date().getFullYear()} ${esc(site.footer.copyright)}</span>
      <span class="mono">Feito para quem administra banco de dados de verdade.</span>
    </div>
  </div>
</footer>
<script src="${base}/script.js" defer></script>
</body>
</html>`;
}

/* ---------- blocos de um topico (CONCEITO / COMO FUNCIONA / ...) --------- */
function bloco(label, conteudo) {
  if (!conteudo || (Array.isArray(conteudo) && !conteudo.length)) return '';
  const corpo = Array.isArray(conteudo)
    ? `<ul>${conteudo.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
    : `<p>${esc(conteudo)}</p>`;
  return `<div class="tblock"><p class="tblock__label">${esc(label)}</p>${corpo}</div>`;
}

function blocoTshoot(itens) {
  if (!itens || !itens.length) return '';
  return `<div class="tblock"><p class="tblock__label">Troubleshooting</p>
    <div class="tshoot">${itens.map(t => `
      <div class="tshoot__item">
        <div class="tshoot__row"><span class="tshoot__k">Sintoma</span><span class="tshoot__v">${esc(t.sintoma)}</span></div>
        <div class="tshoot__row"><span class="tshoot__k">Causa</span><span class="tshoot__v">${esc(t.causa)}</span></div>
        <div class="tshoot__row"><span class="tshoot__k">Ação</span><span class="tshoot__v">${esc(t.acao)}</span></div>
      </div>`).join('')}</div></div>`;
}

function blocoCodigo(cmds) {
  if (!cmds || !cmds.length) return '';
  return `<div class="tblock"><p class="tblock__label">Comandos</p>
    ${cmds.map(c => `<div class="code">
      <div class="code__head">
        <span class="code__desc">${esc(c.desc)}</span>
        <span class="hstack" style="gap:var(--s-3)">
          <span class="code__lang">${esc(c.lang || 'text')}</span>
          <button class="code__copy" type="button">${icon('copy')} copiar</button>
        </span>
      </div>
      <pre><code>${esc(c.code)}</code></pre>
    </div>`).join('')}</div>`;
}

function topicoHTML(t, idx) {
  const id = `t-${t.slug || slugify(t.titulo)}`;
  const detalhado = t.conceito || t.comoFunciona || t.naPratica;
  if (!detalhado) {
    return `<li class="tblock" style="margin-top:var(--s-2)"><span class="mono muted" style="font-size:var(--fs-xs)">${String(idx + 1).padStart(2, '0')}</span>
      &nbsp;${esc(t.titulo)}</li>`;
  }
  return `
  <div class="acc acc--sub" id="${id}">
    <button class="acc__head" type="button" aria-expanded="false">
      <span class="acc__num">${String(idx + 1).padStart(2, '0')}</span>
      <span class="acc__label">${esc(t.titulo)}
        ${t.resumo ? `<span class="acc__hint" style="display:block;margin-top:2px">${esc(t.resumo)}</span>` : ''}</span>
      ${t.nivel ? `<span class="badge">${esc(t.nivel)}</span>` : ''}
      ${icon('chevron', 'acc__chev')}
    </button>
    <div class="acc__panel"><div class="acc__inner"><div class="acc__content">
      ${bloco('Conceito', t.conceito)}
      ${bloco('Como funciona', t.comoFunciona)}
      ${bloco('Na prática', t.naPratica)}
      ${blocoTshoot(t.troubleshooting)}
      ${blocoCodigo(t.comandos)}
      ${t.tecnologias && t.tecnologias.length
        ? `<div class="tblock"><p class="tblock__label">Tecnologias</p>
           <div class="badges">${t.tecnologias.map(x => `<span class="badge badge--accent">${esc(x)}</span>`).join('')}</div></div>` : ''}
    </div></div></div>
  </div>`;
}

function moduloHTML(m, i) {
  const topicos = m.topicos || [];
  const temDetalhe = topicos.some(t => t.conceito);
  return `
  <div class="acc" id="mod-${esc(m.id || i + 1)}">
    <button class="acc__head" type="button" aria-expanded="false">
      <span class="acc__num">${esc(m.id || String(i + 1).padStart(2, '0'))}</span>
      <span class="acc__label">${esc(m.titulo)}
        ${m.resumo ? `<span class="acc__hint" style="display:block;margin-top:2px">${esc(m.resumo)}</span>` : ''}</span>
      <span class="badge">${topicos.length} ${topicos.length === 1 ? 'tópico' : 'tópicos'}</span>
      ${temDetalhe ? '<span class="badge badge--accent">detalhado</span>' : ''}
      ${icon('chevron', 'acc__chev')}
    </button>
    <div class="acc__panel"><div class="acc__inner"><div class="acc__content">
      ${temDetalhe
        ? topicos.map(topicoHTML).join('')
        : `<ul class="tblock" style="display:grid;gap:var(--s-2)">${topicos.map((t, n) =>
            `<li style="position:relative;padding-left:var(--s-6)">
               <span class="mono" style="position:absolute;left:0;color:var(--accent);font-size:var(--fs-xs)">${String(n + 1).padStart(2, '0')}</span>
               ${esc(t.titulo)}</li>`).join('')}</ul>`}
    </div></div></div>
  </div>`;
}

/* ---------- pagina de uma mentoria -------------------------------------- */
function paginaMentoria(m) {
  const base = '../..';
  const canonical = `${ORIGIN}/mentorias/${m.slug}/`;
  const nomeCompleto = m.nomeCompleto || m.nome;
  const title = `${nomeCompleto} — Mentoria Técnica DBA BRABO`;
  const desc  = m.desc.length > 155 ? m.desc.slice(0, 152) + '…' : m.desc;
  const nTop  = (m.modulos || []).reduce((a, x) => a + (x.topicos || []).length, 0);
  const preco = m.investimento && m.investimento.valor;

  const ld = {
    '@context': 'https://schema.org', '@type': 'Course',
    name: `${nomeCompleto} — DBA BRABO`, description: desc, url: canonical,
    inLanguage: 'pt-BR', image: `${ORIGIN}/${m.banner.full}`,
    educationalLevel: m.nivel,
    teaches: (m.pilares || []).map(x => x.titulo),
    about: (m.tecnologias || []).slice(0, 12),
    provider: { '@type': 'EducationalOrganization', name: 'DBA BRABO', url: `${ORIGIN}/` },
    instructor: { '@type': 'Person', name: site.mentor.nome, jobTitle: site.mentor.titulo },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online',
      courseWorkload: m.cargaHoraria || undefined }
  };

  return head({ title, desc, canonical, ogImage: `${ORIGIN}/${m.banner.full}`, base, ld })
+ header(base) + `
<main id="conteudo" style="--accent:${esc(m.accent)}">

<section class="mhero">
  <div class="container">
    <nav class="breadcrumb" aria-label="Você está em">
      <a href="${base}/">Início</a>${icon('chevronRight')}
      <a href="${base}/mentorias/">Mentorias</a>${icon('chevronRight')}
      <span aria-current="page">${esc(m.nome)}</span>
    </nav>
    <div class="mhero__grid mt-6">
      <div>
        <p class="eyebrow">${esc(m.chamada || 'Mentoria')}</p>
        <h1>${esc(nomeCompleto)}</h1>
        <p class="mhero__sub">${esc(m.subtitulo || '')}</p>
        <p class="lead mt-4">${esc(m.desc)}</p>
        <div class="mhero__meta">
          <span class="badge badge--accent">${icon('level')} ${esc(m.nivel)}</span>
          <span class="badge">${icon('modules')} ${(m.modulos || []).length || m.pilares.length} ${(m.modulos || []).length ? 'módulos' : 'pilares'}</span>
          ${nTop ? `<span class="badge">${nTop} tópicos</span>` : ''}
          ${m.duracao ? `<span class="badge">${icon('clock')} ${esc(m.duracao)}</span>` : ''}
          <span class="badge${preco ? ' badge--ok' : ''}">${icon('money')} ${esc(preco || site.investimento.fallback)}</span>
        </div>
        <div class="hstack">
          <a class="btn btn--primary" href="${base}/#comunidade" data-contato>${esc(site.investimento.ctaSemPreco)}</a>
          <a class="btn btn--outline" href="${base}/mentorias/">Ver outras mentorias</a>
        </div>
      </div>
      <div class="mhero__banner">
        <img src="${base}/${m.banner.full}" alt="${esc(m.banner.alt)}" width="1080" height="1350" loading="eager" fetchpriority="high">
      </div>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">O que essa mentoria cobre</p>
      <h2>Pilares</h2>
      <p>Os eixos de trabalho desta formação — cada um vira teoria, lab e troubleshooting.</p>
    </div>
    <div class="pillars">
      ${m.pilares.map(pl => `
        <div class="pillar reveal">
          <span class="pillar__icon">${icon(pl.icone)}</span>
          <div><div class="pillar__title">${esc(pl.titulo)}</div>
          <p class="pillar__desc">${esc(pl.desc)}</p></div>
        </div>`).join('')}
    </div>
  </div>
</section>

${(m.modulos || []).length ? `
<section>
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Conteúdo programático</p>
      <h2>Módulos e tópicos</h2>
      <p>Clique para abrir. Os módulos marcados como <strong>detalhado</strong> trazem, por tópico, conceito, funcionamento, o que é implementado no lab, troubleshooting e comandos.</p>
    </div>
    ${m.modulos.map(moduloHTML).join('')}
  </div>
</section>` : ''}

<section>
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Stack</p>
      <h2>Tecnologias abordadas</h2>
    </div>
    <div class="badges">${(m.tecnologias || []).map(t => `<span class="badge badge--accent">${esc(t)}</span>`).join('')}</div>

    <div class="invest mt-12">
      <p class="eyebrow">Investimento</p>
      <p class="invest__value${preco ? '' : ' is-pending'}">${esc(preco || site.investimento.fallback)}</p>
      <p class="invest__note">${preco
        ? esc(m.investimento.condicao || '')
        : 'Os valores são apresentados na conversa inicial, conforme a mentoria escolhida e o formato acordado.'}</p>
      <div class="hstack mt-6" style="justify-content:center">
        <a class="btn btn--primary" href="${base}/#comunidade" data-contato>${esc(site.investimento.ctaSemPreco)}</a>
      </div>
    </div>
  </div>
</section>

<section class="cta">
  <div class="container">
    <h2>Começa por uma call de diagnóstico.</h2>
    <p>Mapear onde você está e onde quer chegar antes de montar o plano. Sem compromisso.</p>
    <div class="cta__btns">
      <a class="btn btn--primary" href="${base}/#comunidade" data-contato>Falar com o mentor</a>
      <a class="btn btn--outline" href="${base}/mentorias/">Ver todas as mentorias</a>
    </div>
  </div>
</section>

</main>` + footer(base);
}

/* ---------- catalogo /mentorias/ ---------------------------------------- */
function paginaCatalogo() {
  const base = '..';
  const canonical = `${ORIGIN}/mentorias/`;
  const ordem = m => (m.flagship ? 0 : m.destaque ? 1 : 2);
  const lista = [...catalogo.mentorias].sort((a, b) => ordem(a) - ordem(b));

  const card = m => {
    const preco = m.investimento && m.investimento.valor;
    return `
    <article class="mcard reveal${m.flagship ? ' mcard--flagship' : ''}" style="--accent:${esc(m.accent)}">
      <a class="mcard__banner" href="${base}/mentorias/${m.slug}/" tabindex="-1" aria-hidden="true">
        <img src="${base}/${m.banner.card}" alt="" loading="lazy" width="800" height="306"></a>
      <div class="mcard__body">
        <p class="mcard__eyebrow">${esc(m.chamada || 'Mentoria')}</p>
        <h3 class="mcard__title"><a href="${base}/mentorias/${m.slug}/">${esc(m.nome)}</a></h3>
        <p class="mcard__desc">${esc(m.desc)}</p>
        <div class="mcard__meta">
          <span>${icon('level')}${esc(m.nivel)}</span>
          <span>${icon('modules')}${(m.modulos || []).length ? `${m.modulos.length} módulos` : `${m.pilares.length} pilares`}</span>
        </div>
        <div class="mcard__foot">
          <span class="mcard__price${preco ? '' : ' is-pending'}">${esc(preco || site.investimento.fallback)}</span>
          <a class="btn btn--outline btn--sm" href="${base}/mentorias/${m.slug}/">Ver conteúdo ${icon('chevronRight')}</a>
        </div>
      </div>
    </article>`;
  };

  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Mentorias DBA BRABO',
    itemListElement: lista.map((m, i) => ({ '@type': 'ListItem', position: i + 1,
      url: `${ORIGIN}/mentorias/${m.slug}/`, name: m.nome })) };

  const porCategoria = cat => lista.filter(m => m.categoria === cat);

  return head({
    title: 'Mentorias — DBA BRABO | Oracle, MySQL, SQL Server, PostgreSQL, Cloud e DBRE',
    desc: `${lista.length} mentorias técnicas para DBAs: bancos de dados, engineered systems, replicação, alta disponibilidade, cloud, DBRE, carreira e certificação.`,
    canonical, ogImage: `${ORIGIN}/${site.site.ogImage}`, base, ld
  }) + header(base) + `
<main id="conteudo">
<section class="mhero">
  <div class="container">
    <nav class="breadcrumb"><a href="${base}/">Início</a>${icon('chevronRight')}<span aria-current="page">Mentorias</span></nav>
    <div class="section-head mt-6">
      <p class="eyebrow">Catálogo completo</p>
      <h1 style="font-size:clamp(2rem,5vw,3.25rem)">Mentorias DBA BRABO</h1>
      <p class="lead">${lista.length} formações — ${porCategoria('tecnica').length} trilhas técnicas por tecnologia e ${porCategoria('programa').length} programas de acompanhamento.</p>
    </div>
  </div>
</section>

${catalogo.categorias.map(c => {
  const ms = porCategoria(c.id);
  if (!ms.length) return '';
  return `
<section>
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${esc(c.nome)}</p>
      <h2>${esc(c.nome)}</h2>
      <p>${esc(c.desc)}</p>
    </div>
    <div class="mentorias-grid">${ms.map(card).join('')}</div>
  </div>
</section>`;
}).join('')}

<section class="cta">
  <div class="container">
    <h2>Não sabe por onde começar?</h2>
    <p>A call de diagnóstico define a trilha. Se preferir se situar sozinho antes, o roadmap mostra a ordem que costuma funcionar.</p>
    <div class="cta__btns">
      <a class="btn btn--primary" href="${base}/#comunidade" data-contato>Falar com o mentor</a>
      <a class="btn btn--outline" href="${base}/#roadmap">Ver o roadmap</a>
    </div>
  </div>
</section>
</main>` + footer(base);
}


/* ---------- indice de busca -------------------------------------------- */
/* O navegador carrega apenas data/mentorias.json, que nao contem os modulos
   detalhados (eles vivem em data/modulos/<slug>.json e so sao anexados aqui,
   no build). Sem este indice, buscar "GTID" nao acharia o topico de GTID.    */
function indiceBusca() {
  const ix = [];
  const push = (g, t, s, href, k) => ix.push({ g, t, s, href, k: String(k).toLowerCase() });

  for (const m of catalogo.mentorias) {
    const href = `mentorias/${m.slug}/`;
    push('Mentorias', m.nome, m.desc, href,
         `${m.nome} ${m.nomeCompleto || ''} ${m.desc} ${m.subtitulo || ''} ${(m.tags || []).join(' ')}`);
    for (const pl of m.pilares || [])
      push('Módulos e pilares', pl.titulo, `${m.nome} — ${pl.desc}`, href, `${pl.titulo} ${pl.desc} ${m.nome}`);
    for (const t of m.tecnologias || [])
      push('Tecnologias', t, `Aparece em ${m.nome}`, href, `${t} ${m.nome}`);
    for (const mod of m.modulos || []) {
      push('Módulos e pilares', mod.titulo, `${m.nome} — ${mod.resumo || ''}`,
           `${href}#mod-${mod.id}`, `${mod.titulo} ${mod.resumo || ''}`);
      for (const tp of mod.topicos || []) {
        const anc = `${href}#t-${tp.slug || slugify(tp.titulo)}`;
        push('Tópicos', tp.titulo, `${m.nome} · ${mod.titulo}`, anc,
             [tp.titulo, tp.resumo || '', tp.conceito || '',
              (tp.comoFunciona || []).join(' '), (tp.naPratica || []).join(' '),
              (tp.troubleshooting || []).map(x => `${x.sintoma} ${x.causa} ${x.acao}`).join(' '),
              (tp.tecnologias || []).join(' '),
              (tp.comandos || []).map(c => `${c.desc} ${c.code}`).join(' ')].join(' '));
      }
    }
  }
  for (const pj of projetos.projetos)
    push('Projetos', pj.nome, pj.tagline, '#projetos', `${pj.nome} ${pj.desc} ${pj.stack.join(' ')} ${pj.destaques.join(' ')}`);
  for (const g of tecnologias.grupos) for (const it of g.itens)
    push('Tecnologias', it.nome, it.desc, '#tecnologias', `${it.nome} ${it.desc} ${g.nome}`);
  for (const e of roadmap.etapas)
    push('Roadmap', e.titulo, e.resumo, '#roadmap', `${e.titulo} ${e.resumo} ${e.detalhe}`);

  const visto = new Set();
  return ix.filter(r => { const c = r.g + '|' + r.t + '|' + r.href; if (visto.has(c)) return false; visto.add(c); return true; });
}

/* ---------- sitemap e robots -------------------------------------------- */
function sitemap() {
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${ORIGIN}/`, pri: '1.0', freq: 'weekly' },
    { loc: `${ORIGIN}/mentorias/`, pri: '0.9', freq: 'weekly' },
    ...catalogo.mentorias.map(m => ({ loc: `${ORIGIN}/mentorias/${m.slug}/`, pri: m.destaque ? '0.8' : '0.7', freq: 'monthly' }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${hoje}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
}

const robots = () => `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;

/* ---------- validacoes --------------------------------------------------- */
function validar() {
  const erros = [];
  const slugs = new Set();
  for (const m of catalogo.mentorias) {
    if (slugs.has(m.slug)) erros.push(`slug repetido: ${m.slug}`);
    slugs.add(m.slug);
    for (const k of ['full', 'card'])
      if (!fs.existsSync(p(m.banner[k]))) erros.push(`${m.slug}: banner ausente — ${m.banner[k]}`);
    if (!m.pilares || !m.pilares.length) erros.push(`${m.slug}: sem pilares`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(m.accent || '')) erros.push(`${m.slug}: accent invalido`);
  }
  for (const e of roadmap.etapas)
    for (const s of e.mentorias || [])
      if (!slugs.has(s)) erros.push(`roadmap etapa ${e.n}: slug inexistente — ${s}`);
  for (const f of ['style.css', 'script.js', 'index.html'])
    if (!fs.existsSync(p(f))) erros.push(`arquivo ausente na raiz: ${f}`);
  return erros;
}

/* ---------- main --------------------------------------------------------- */
const erros = validar();
if (erros.length) {
  console.error('VALIDACAO FALHOU:');
  erros.forEach(e => console.error('  ! ' + e));
  process.exit(1);
}
console.log(`validacao OK — ${catalogo.mentorias.length} mentorias, banners e slugs conferidos`);

if (CHECK_ONLY) { console.log('--check: nada foi escrito'); process.exit(0); }

const write = (rel, txt) => {
  const abs = p(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, txt);
  return `${rel} (${(Buffer.byteLength(txt) / 1024).toFixed(1)} KB)`;
};

const saidas = [];
saidas.push(write('mentorias/index.html', paginaCatalogo()));
for (const m of catalogo.mentorias) saidas.push(write(`mentorias/${m.slug}/index.html`, paginaMentoria(m)));
const IX = indiceBusca();
saidas.push(write('data/search-index.json', JSON.stringify({ _gerado: 'por tools/build.mjs — nao editar a mao', total: IX.length, itens: IX })));
saidas.push(write('sitemap.xml', sitemap()));
saidas.push(write('robots.txt', robots()));

console.log(`\ngerados ${saidas.length} arquivos:`);
saidas.forEach(s => console.log('  ' + s));
console.log(`\norigem publica: ${ORIGIN}`);
