/* ==========================================================================
   DBA BRABO — Area do mentor (acesso por usuario)
   --------------------------------------------------------------------------
   O repositorio e publico. Nada de senha no codigo e nenhuma chave de dados
   no codigo: cada usuario desembrulha, com a PROPRIA senha, apenas as chaves
   das trilhas que pode ver (data/mentor/_users.json, gerado por
   tools/build-users.mjs). Senha errada nao "nega login" — o GCM falha e nao
   ha texto claro nenhum. Trilha fora da lista = chave ausente = indecifravel.
   ========================================================================== */
'use strict';

const BASE   = '..';
const CHAVE_SESSAO = 'dbabrabo.mentor.k';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------- idioma (chrome PT/EN; conteúdo segue PT na Fase 1) ------------- */
const I18N = { lang: 'pt', dict: null };
function T(chave, fb) {
  const g = (o, k) => String(k).split('.').reduce((a, p) => (a && a[p] != null ? a[p] : null), o);
  return g(I18N.dict && I18N.dict[I18N.lang], chave)
      || g(I18N.dict && I18N.dict.pt, chave)
      || fb || chave;
}
function aplicarIdioma() {
  if (!I18N.dict) return;
  document.documentElement.lang = T('meta.lang', 'pt-BR');
  document.querySelectorAll('[data-i18n]').forEach(n => { n.innerHTML = T(n.dataset.i18n, null) || n.innerHTML; });
  document.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = T(n.dataset.i18nPh, null) || n.placeholder; });
  document.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', T(n.dataset.i18nAria, null) || n.getAttribute('aria-label')); });
  document.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = T(n.dataset.i18nTitle, null) || n.title; });
  const btn = $('#langToggleTop');
  if (btn) btn.textContent = I18N.lang === 'pt' ? 'EN' : 'PT';
}
async function carregarIdioma() {
  try {
    const r = await fetch(`${BASE}/data/i18n.json`, { cache: 'no-store' });
    if (r.ok) I18N.dict = await r.json();
  } catch {}
  try {
    const l = localStorage.getItem('dbabrabo.lang');
    if (l === 'pt' || l === 'en') I18N.lang = l;
  } catch {}
  aplicarIdioma();
  const btn = $('#langToggleTop');
  if (btn && !btn.dataset.i18nOn) {
    btn.dataset.i18nOn = '1';
    btn.addEventListener('click', () => {
      I18N.lang = I18N.lang === 'pt' ? 'en' : 'pt';
      try { localStorage.setItem('dbabrabo.lang', I18N.lang); } catch {}
      aplicarIdioma();
      if (app.indice) abrirArea();   // recarrega índice + conteúdo no idioma (restaura o tópico aberto)
      else if (app.sel) abrirTopico(app.sel.trilha, app.sel.modulo, app.sel.topico);
    });
  }
}
carregarIdioma();

/* ---------- tema: espelha o portal (dark / light / system) ---------------- */
/* Mesma chave do portal (dbabrabo-theme): quem escolheu la, encontra aqui.
   Nada do portal e tocado — so se le a preferencia que ele gravou. */
function setupTemaMentor() {
  const KEY = 'dbabrabo-theme';
  const ordem = ['dark', 'light', 'system'];
  const aplicar = t => {
    try {
      document.documentElement.dataset.theme =
        t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
      document.documentElement.dataset.themePref = t;
    } catch { document.documentElement.dataset.theme = 'dark'; }
    const btn = $('#themeToggle');
    if (btn) btn.setAttribute('aria-label', `Tema: ${t}. Clique para alternar.`);
  };
  let atual = 'dark';
  try { atual = localStorage.getItem(KEY) || 'dark'; } catch {}
  if (!ordem.includes(atual)) atual = 'dark';
  aplicar(atual);
  try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (atual === 'system') aplicar('system'); });
  } catch {}
  const btn = $('#themeToggle');
  if (btn) btn.addEventListener('click', () => {
    atual = ordem[(ordem.indexOf(atual) + 1) % ordem.length];
    try { localStorage.setItem(KEY, atual); } catch {}
    aplicar(atual);
  });
}
setupTemaMentor();

/* ---------- estado ------------------------------------------------------ */
const app = {
  usuario: null,      // login autenticado
  trilhas: [],        // slugs que este usuario pode ver
  senha: null,        // senha digitada (só p/ retomar a sessão na aba)
  indice: null,        // data/mentor-indice[-en].json (publico, so nomes)
  disponiveis: [],     // trilhas que ja tem .enc
  conteudo: {},        // "lang:slug" -> { topicos: {...} } (decifrado)
  chaves: {},          // slug -> CryptoKey da trilha (só as autorizadas)
  sel: null            // { trilha, modulo, topico }
};

/* ---------- cripto ------------------------------------------------------ */
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function kekDe(senha, salB64) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(salB64), iterations: 600000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function desembrulhar(w, kek) {
  const raw = b64(w.ct);
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64(w.iv) }, kek, raw);
  return new Uint8Array(claro);
}

/** Decifra um envelope .enc com a chave de dados JÁ desembrulhada. */
async function decifrarComChave(envelope, chaveDados) {
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64(envelope.iv) }, chaveDados, b64(envelope.ct));
  return JSON.parse(new TextDecoder().decode(claro));
}

async function baixarEnc(caminho) {
  const r = await fetch(caminho, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho}`);
  return r.json();
}

/* ---------- acesso ------------------------------------------------------ */
const elErro = $('#erro');
function erro(msg) { elErro.textContent = msg; elErro.classList.add('is-on'); }
function limpaErro() { elErro.classList.remove('is-on'); }

async function tentarEntrar(usuario, senha) {
  usuario = (usuario || '').trim();
  let mapa;
  try {
    const r = await fetch(`${BASE}/data/mentor/_users.json`, { cache: 'no-store' });
    if (!r.ok) throw 0;
    mapa = await r.json();
  } catch {
    throw new Error(T('mentor.erro_sem_material', 'Material cifrado ainda não publicado. Rode tools/build-mentor.mjs.'));
  }
  const u = mapa.users && mapa.users[usuario];
  if (!u) throw new Error(T('mentor.erro_cred', 'Usuário ou senha incorretos.'));
  let kek;
  try {
    kek = await kekDe(senha, u.sal);
    const sonda = await desembrulhar(u.sonda, kek);
    if (new TextDecoder().decode(sonda) !== 'dbabrabo-ok') throw 0;
  } catch {
    throw new Error(T('mentor.erro_cred', 'Usuário ou senha incorretos.'));
  }
  const chaves = {};
  for (const slug of u.trilhas) {
    const w = u.wraps && u.wraps[slug];
    if (!w) continue;
    const raw = await desembrulhar(w, kek);
    chaves[slug] = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  }
  app.usuario = usuario; app.senha = senha;
  app.trilhas = u.trilhas; app.chaves = chaves;
  app.indice = null; app.conteudo = {};
}

$('#form-acesso').addEventListener('submit', async e => {
  e.preventDefault();
  limpaErro();
  const btn = $('#btn-entrar');
  btn.disabled = true; btn.textContent = T('mentor.decifrando', 'Decifrando…');
  try {
    await tentarEntrar($('#usuario').value, $('#senha').value);
    try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ u: app.usuario, p: app.senha })); } catch {}
    await abrirArea();
  } catch (err) {
    erro(err.message);
    $('#senha').value = ''; $('#senha').focus();
  } finally {
    btn.disabled = false; btn.textContent = T('mentor.entrar', 'Entrar');
  }
});

$('#btn-sair').addEventListener('click', () => {
  try { sessionStorage.removeItem(CHAVE_SESSAO); } catch {}
  location.reload();
});

/* Retoma a sessao sem redigitar (sessionStorage morre ao fechar a aba). */
(async function retomar() {
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null'); } catch {}
  if (!s || !s.u) return;
  try { await tentarEntrar(s.u, s.p); await abrirArea(); }
  catch { try { sessionStorage.removeItem(CHAVE_SESSAO); } catch {} }
})();

/* ---------- carga do indice --------------------------------------------- */
async function abrirArea() {
  if (!app.indice || app.indiceLang !== I18N.lang) {
    app.indice = null; app.conteudo = {};
    const alvo = I18N.lang === 'en' ? `${BASE}/data/mentor-indice-en.json` : `${BASE}/data/mentor-indice.json`;
    try {
      const r = await fetch(alvo, { cache: 'no-store' });
      if (!r.ok) throw 0;
      app.indice = await r.json();
      app.indiceLang = I18N.lang;
    } catch {
      const r = await fetch(`${BASE}/data/mentor-indice.json`, { cache: 'no-store' });
      app.indice = await r.json();
      app.indiceLang = 'pt';
    }
    try {
      const d = await fetch(`${BASE}/data/mentor/_disponiveis.json`, { cache: 'no-store' });
      app.disponiveis = d.ok ? (await d.json()).trilhas || [] : [];
    } catch { app.disponiveis = []; }
  }
  $('#acesso').style.display = 'none';
  $('#mentor').classList.add('is-on');
  montarNav();
  /* Entrar mostra SEMPRE a tela inicial — nunca o ultimo topico.
     (Antes, o hash/sessao restaurava a pagina onde se parou.) */
  irParaInicio();
}

/* ---------- tela inicial -------------------------------------------------- */
/* "Area do mentor - DBA BRABO": cartao de boas-vindas com as trilhas do
   usuario. Entrar, recarregar ou clicar na marca cai sempre aqui. */
function irParaInicio() {
  try { history.replaceState(null, '', location.pathname); } catch {}
  app.sel = null;
  $$('#mnav .mtop').forEach(b => b.classList.remove('is-sel'));
  telaInicial();
}

function telaInicial() {
  const el = $('#mconteudo');
  if (!el || !app.indice) return;
  el.style.setProperty('--accent', 'var(--brand)');
  el.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  const trilhas = app.indice.trilhas.filter(t => app.trilhas.includes(t.slug));
  const nTop = trilhas.reduce((a, t) => a + t.modulos.reduce((x, m) => x + m.topicos.length, 0), 0);
  el.innerHTML = `<div class="minicio">`
    + `<p class="eyebrow">${esc(T('mentor.inicio_olho', 'Ecossistema de formação técnica'))}</p>`
    + `<h1>DBA <span class="accent">BRABO</span></h1>`
    + `<p class="minicio__claim">${esc(T('mentor.inicio_claim', 'Não basta saber usar banco de dados. É preciso saber administrá-lo.'))}</p>`
    + `<p class="minicio__desc">${esc(T('mentor.inicio_p', 'Mentoria individual em Oracle, MySQL, SQL Server, PostgreSQL e MongoDB — da arquitetura interna à alta disponibilidade, com lab prático no seu ambiente e troubleshooting de cenário real.'))}</p>`
    + `<p class="minicio__conta">${esc(T('mentor.inicio_conta', 'Você está em:'))} <b>${esc(app.usuario || '')}</b> · ${trilhas.length} ${esc(T('mentor.inicio_trilhas', 'trilhas'))} · ${nTop} ${esc(T('mentor.inicio_topicos', 'tópicos'))}</p>`
    + `</div>`;
}

/* ---------- navegacao lateral ------------------------------------------- */
function montarNav() {
  const nav = $('#mnav');
  nav.innerHTML = '';
  for (const t of app.indice.trilhas) {
    if (!app.trilhas.includes(t.slug)) continue;   // congela painéis fora do acesso
    const nTop = t.modulos.reduce((a, m) => a + m.topicos.length, 0);
    const sec = document.createElement('section');
    sec.className = 'mtrilha';
    sec.dataset.trilha = t.slug;
    sec.style.setProperty('--accent', t.accent);

    const cab = document.createElement('button');
    cab.type = 'button';
    cab.className = 'mtrilha__cab';
    cab.innerHTML = `<span class="mtrilha__nome"></span><span class="mtrilha__cont">${nTop}</span>`;
    cab.querySelector('.mtrilha__nome').textContent = t.nome;
    cab.addEventListener('click', () => sec.classList.toggle('is-open'));

    const mods = document.createElement('div');
    mods.className = 'mtrilha__mods';

    for (const m of t.modulos) {
      const dm = document.createElement('div');
      dm.className = 'mmod';
      const mc = document.createElement('button');
      mc.type = 'button';
      mc.className = 'mmod__cab';
      mc.innerHTML = `<i>${m.n}</i><span></span>`;
      mc.querySelector('span').textContent = m.nome;
      mc.addEventListener('click', () => dm.classList.toggle('is-open'));

      const tops = document.createElement('div');
      tops.className = 'mmod__tops';
      for (const p of m.topicos) {
        const bt = document.createElement('button');
        bt.type = 'button';
        bt.className = `mtop mtop--${p.estado || 'pendente'}`;
        bt.dataset.id = `${t.slug}/${m.id}/${p.id}`;
        bt.innerHTML = '<span></span>';
        bt.querySelector('span').textContent = p.nome;
        bt.addEventListener('click', () => abrirTopico(t.slug, m.id, p.id));
        tops.appendChild(bt);
      }
      dm.append(mc, tops);
      mods.appendChild(dm);
    }
    sec.append(cab, mods);
    nav.appendChild(sec);
  }
}

/* ---------- busca -------------------------------------------------------- */
$('#mbusca').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    /* limpar a busca precisa desfazer TUDO o que ela escondeu: os topicos,
       os modulos e as trilhas. Zerar so os topicos deixa modulo invisivel. */
    $$('#mnav .mtop, #mnav .mmod, #mnav .mtrilha').forEach(d => d.style.display = '');
    $$('#mnav .mmod, #mnav .mtrilha').forEach(d => d.classList.remove('is-open'));
    return;
  }
  for (const sec of $$('#mnav .mtrilha')) {
    let achouTrilha = false;
    for (const dm of $$('.mmod', sec)) {
      let achouMod = false;
      for (const bt of $$('.mtop', dm)) {
        const bate = bt.textContent.toLowerCase().includes(q);
        bt.style.display = bate ? '' : 'none';
        achouMod = achouMod || bate;
      }
      dm.classList.toggle('is-open', achouMod);
      dm.style.display = achouMod ? '' : 'none';
      achouTrilha = achouTrilha || achouMod;
    }
    sec.classList.toggle('is-open', achouTrilha);
    sec.style.display = achouTrilha ? '' : 'none';
  }
});

/* ---------- carga do conteudo cifrado ----------------------------------- */
async function carregarTrilha(slug) {
  const chave = `${I18N.lang}:${slug}`;
  if (app.conteudo[chave]) return app.conteudo[chave];
  const chaveDados = app.chaves[slug];
  if (!chaveDados) throw new Error(T('mentor.sem_acesso', 'Sua conta não tem acesso a esta trilha.'));
  let dados = null, lang = 'pt';
  if (I18N.lang === 'en') {
    try {
      const env = await baixarEnc(`${BASE}/data/mentor/en/${slug}.enc`);
      dados = await decifrarComChave(env, chaveDados);
      lang = 'en';
    } catch { dados = null; }
  }
  if (!dados) {
    const env = await baixarEnc(`${BASE}/data/mentor/${slug}.enc`);
    dados = await decifrarComChave(env, chaveDados);
  }
  dados._lang = lang;
  app.conteudo[chave] = dados;
  return dados;
}

/* ---------- render do topico -------------------------------------------- */
async function abrirTopico(trilha, modulo, topico) {
  app.sel = { trilha, modulo, topico };
  location.hash = `${trilha}/${modulo}/${topico}`;

  $$('#mnav .mtop').forEach(b => b.classList.toggle('is-sel', b.dataset.id === `${trilha}/${modulo}/${topico}`));

  const t  = app.indice.trilhas.find(x => x.slug === trilha);
  const el = $('#mconteudo');
  if (!t || !app.trilhas.includes(trilha)) {
    return el.innerHTML = `<div class="mrev"><b>Acesso</b><span>${esc(T('mentor.sem_acesso', 'Sua conta não tem acesso a esta trilha.'))}</span></div>`;
  }
  const m  = t.modulos.find(x => x.id === modulo);
  const p  = m.topicos.find(x => x.id === topico);
  el.style.setProperty('--accent', t.accent);
  el.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  /* no celular a lateral fica acima: leve a leitura para o conteudo */
  if (window.innerWidth <= 900) el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!app.disponiveis.includes(trilha)) return el.innerHTML = telaPendente(t, m, p);

  el.innerHTML = `<p style="color:var(--fg-3);font-family:var(--font-mono);font-size:var(--fs-xs)">${esc(T('mentor.decifrando2', 'decifrando…'))}</p>`;
  let dados;
  try { dados = await carregarTrilha(trilha); }
  catch (e) { return el.innerHTML = `<div class="mrev"><b>Erro</b> Não foi possível ler ${trilha}.enc — ${esc(e.message)}</div>`; }

  /* O conteudo e chaveado por topico; trilhas com ids repetidos entre
     modulos (mysql) usam chave namespaced "modulo/topico". Tenta a
     namespaced primeiro, cai para o id plano (oracle e demais trilhas). */
  const c = dados.topicos && (dados.topicos[`${modulo}/${topico}`] || dados.topicos[topico]);
  if (!c) return el.innerHTML = telaPendente(t, m, p);
  el.innerHTML = renderTopico(t, m, c);
  ligarCopiar(el);
  ligarPausa(el);
}

function telaPendente(t, m, p) {
  return `<div class="mpend">
    <span class="mpend__sel">${esc(t.nome)} · ${esc(m.nome)}</span>
    <h1 style="font-size:var(--fs-xl);margin-bottom:var(--s-3)">${esc(p.nome)}</h1>
    <p style="color:var(--fg-1)">${T('mentor.pendente_p1', 'Este tópico ainda não foi escrito. O índice já reserva o lugar dele — o conteúdo entra no próximo build.')}</p>
    <p style="color:var(--fg-3);font-size:var(--fs-sm);margin-top:var(--s-4)">${T('mentor.pendente_p2', 'Nada aqui é preenchido automaticamente: um passo a passo só entra depois de escrito e conferido.')}</p>
  </div>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Marcacao minima e previsivel dentro de textos: `codigo` e **negrito**. */
function rico(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);font-size:.9em;background:var(--bg-2);padding:1px 5px;border-radius:4px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/* Terminal macOS. Linha "$ x" = comando, "# x" = comentario, resto = saida. */
function terminal(bloco) {
  const pr = bloco.pr || '$';
  const linhas = (bloco.linhas || []).map(l => {
    if (l.startsWith('$ ')) return `<span class="pr">${esc(pr)}</span> ${esc(l.slice(2))}`;
    if (l.startsWith('# ')) return `<span class="cm">${esc(l)}</span>`;
    return `<span class="sa">${esc(l)}</span>`;
  }).join('\n');
  return `<div class="term-mac">
    <div class="term-mac__barra">
      <div class="term-mac__luzes"><i></i><i></i><i></i></div>
      <div class="term-mac__titulo">${esc(bloco.titulo || 'bash')}</div>
      <button class="term-mac__copiar" type="button">${esc(T('mentor.copiar', 'copiar'))}</button>
    </div>
    <pre>${linhas}</pre>
  </div>`;
}

function passo(p, i) {
  let h = `<div class="mpasso"><div class="mpasso__n">${String(i + 1).padStart(2, '0')}</div><div>`;
  h += `<div class="mpasso__t">${rico(p.titulo)}</div>`;
  if (p.desc) h += `<div class="mpasso__d">${rico(p.desc)}</div>`;
  for (const b of (p.blocos || [])) h += renderBloco(b);
  if (p.term) h += terminal(p.term);
  if (p.cheque) h += `<div class="mcheque"><b>${esc(T('mentor.validacao', 'Validação'))}</b><span>${rico(p.cheque)}</span></div>`;
  if (p.falha)  h += `<div class="mfalha"><b>${esc(T('mentor.se_falhar', 'Se falhar'))}</b><span>${rico(p.falha)}</span></div>`;
  return h + '</div></div>';
}

function renderBloco(b) {
  switch (b.t) {
    case 'texto':
      return (b.p || []).map(x => `<p>${rico(x)}</p>`).join('');
    case 'lista':
      return `<ul class="mlista">${(b.itens || []).map(x => `<li>${rico(x)}</li>`).join('')}</ul>`;
    case 'terminal':
      return terminal(b);
    case 'diagrama': {
      /* Diagrama animado ganha botao de pausa: aula em projetor as vezes pede
         a figura parada. A classe is-parado desliga a animacao via CSS. */
      const anim = /<(animate|animateMotion|animateTransform)|class="fluxo"|class="pulso"/.test(b.svg || '');
      return `<figure class="mdiag${anim ? ' mdiag--anim' : ''}">`
        + (anim ? `<button class="mdiag__pausa" type="button" aria-pressed="false">${esc(T('mentor.pausar', 'pausar'))}</button>` : '')
        + (b.svg || '')
        + (b.leg ? `<figcaption class="mdiag__leg">${rico(b.leg)}</figcaption>` : '')
        + `</figure>`;
    }
    case 'imagem': {
      const src = String(b.src || '').replace(/^\//, '');
      if (!src) return '';
      return `<figure class="mimg"><img src="${BASE}/${esc(src)}" alt="${esc(b.alt || b.leg || 'Print de referência')}" loading="lazy">${b.leg ? `<figcaption class="mdiag__leg">${rico(b.leg)}</figcaption>` : ''}</figure>`;
    }
    case 'passos':
      return (b.itens || []).map(passo).join('');
    case 'aviso':
      return `<div class="mrev"><b>${esc(b.rotulo || 'Atenção')}</b><span>${rico(b.texto)}</span></div>`;
    default:
      return '';
  }
}

function renderTopico(t, m, c) {
  let h = `<header class="mcab">
    <div class="mcab__trilha">${esc(t.nome)} · ${esc(m.nome)}</div>
    <h1>${esc(c.titulo)}</h1>
    ${c.resumo ? `<p class="mcab__resumo">${rico(c.resumo)}</p>` : ''}
  </header>`;

  if (c.versoes) h += `<p style="font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--fg-3);margin-bottom:var(--s-6)">${esc(T('mentor.testado_em', 'Escrito e testado em: '))}${esc(c.versoes)}</p>`;
  if (c._lang === 'pt' && I18N.lang === 'en') h += `<div class="mrev"><b>EN soon</b><span>${esc(T('mentor.somente_pt', 'Conteúdo ainda em português — tradução a caminho.'))}</span></div>`;

  for (const b of (c.blocos || [])) {
    h += `<section class="mbloco">`;
    if (b.h) h += `<h2>${esc(b.h)}</h2>`;
    h += renderBloco(b);
    h += `</section>`;
  }
  return h;
}

function ligarPausa(raiz) {
  for (const btn of $$('.mdiag__pausa', raiz)) {
    btn.addEventListener('click', () => {
      const fig = btn.closest('.mdiag');
      const parado = fig.classList.toggle('is-parado');
      btn.textContent = parado ? T('mentor.animar', 'animar') : T('mentor.pausar', 'pausar');
      btn.setAttribute('aria-pressed', String(parado));
      const svg = fig.querySelector('svg');
      if (svg && svg.pauseAnimations) parado ? svg.pauseAnimations() : svg.unpauseAnimations();
    });
  }
}

function ligarCopiar(raiz) {
  for (const btn of $$('.term-mac__copiar', raiz)) {
    btn.addEventListener('click', () => {
      const pre = btn.closest('.term-mac').querySelector('pre');
      /* copia so os comandos, sem prompt nem saida — e o que se cola no shell */
      const cmds = Array.from(pre.querySelectorAll('.pr'))
        .map(s => (s.nextSibling?.textContent || '').trim()).filter(Boolean).join('\n');
      navigator.clipboard.writeText(cmds || pre.textContent).then(() => {
        const volta = btn.textContent;
        btn.textContent = T('mentor.copiado', 'copiado');
        setTimeout(() => btn.textContent = T('mentor.copiar', 'copiar'), 1400);
      });
    });
  }
}

/* ---------- deep link ---------------------------------------------------- */
/* Navegacao por fragmento nao recarrega o script: sem este listener, mudar o
   hash na barra de enderecos ou usar o botao voltar deixa a pagina parada. */
window.addEventListener('hashchange', () => {
  if (!app.indice) return;
  const h = location.hash.replace(/^#/, '');
  /* Hash vazio (voltar apos limpar, marca clicada) = tela inicial. */
  if (!h) { irParaInicio(); return; }
  const atual = app.sel ? `${app.sel.trilha}/${app.sel.modulo}/${app.sel.topico}` : '';
  if (h === atual) return;
  restaurarHash();
});

/* Marca DBA BRABO no topo volta sempre para a tela inicial. */
document.addEventListener('DOMContentLoaded', () => {
  const home = $('#btn-inicio');
  if (home && !home.dataset.on) {
    home.dataset.on = '1';
    home.addEventListener('click', () => { if (app.indice) irParaInicio(); });
  }
});

function restaurarHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return;
  const [trilha, modulo, topico] = h.split('/');
  const sec = $(`#mnav .mtrilha[data-trilha="${CSS.escape(trilha || '')}"]`);
  if (!sec) return;
  sec.classList.add('is-open');
  const bt = $$('#mnav .mtop').find(b => b.dataset.id === h);
  if (!bt) return;
  bt.closest('.mmod').classList.add('is-open');
  bt.scrollIntoView({ block: 'nearest' });
  abrirTopico(trilha, modulo, topico);
}
