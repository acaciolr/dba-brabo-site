/* ==========================================================================
   ECOSSISTEMA SUPER DBA — gate de acesso (Fase Alunos, estático)
   --------------------------------------------------------------------------
   O GitHub Pages é estático: não há backend para validar senha de verdade.
   Este gate é uma trava de UX — pede usuário + senha antes de mostrar o hub
   e redireciona para o login quando não há sessão. A senha NUNCA fica no
   código: aqui vai só o SHA-256 de "usuario:senha" do master, e
   json/alunos.json traz só {user, nome, hash, labs} por matrícula — SEM
   CPF, e-mail extra ou financeiro (esses vivem SÓ no registry local do
   mentor e NUNCA são commitados; ver tools/build-alunos.mjs).

   Sessão (sessionStorage, morre ao fechar a aba): {u, nome, labs, tipo, t}.
   - admin (master): labs '*' — vê tudo;
   - aluno: labs ['mysql', ...] — só as mentorias contratadas.
   Páginas de lab chamam exigirLogin(url, 'tech'); sem o lab, volta ao hub.

   Limite honesto: conteúdo estático não é cifrado por aluno (o modelo
   cifrado por usuário existe na área do mentor). Este gate organiza o
   acesso; a trava criptográfica real chega com o backend v2.

   Login real (v2, com SQLite) substitui este arquivo sem tocar nas páginas:
   basta manter a API EcoAuth { estaLogado, exigirLogin, entrar, sair }.
   ========================================================================== */
'use strict';

(function () {
  var MASTER_USER = 'dbabrabo';
  /* SHA-256 de "usuario:senha" do master — só o hash, sem a senha. */
  var MASTER_HASH = '072fc0980287318c12a56b67cdb3a0e3837ad75f10aa400384d5038f97980d04';
  var CHAVE_SESSAO = 'dbabrabo.eco.auth.v1';
  var CHAVE_NEXT = 'dbabrabo.eco.next';

  /* Base dos JSONs resolvida pelo <script src> — vale em qualquer pasta. */
  var BASE_JSON = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      if (src) return new URL('../json/', src).href.replace(/\/$/, '');
    } catch (_) {}
    return 'json';
  })();

  function getSessao() {
    try {
      var s = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null');
      if (s && typeof s.u === 'string' && typeof s.t === 'number') return s;
    } catch (_) { /* sem sessão */ }
    return null;
  }

  function estaLogado() { return !!getSessao(); }

  function ehAdmin() {
    var s = getSessao();
    return !!(s && (s.tipo === 'admin' || s.labs === '*' || (s.u === 'dbabrabo' && !s.labs)));
  }

  /* labs: '*' (admin) ou ['mysql', ...]. Sessão antiga do master sem o
     campo labs continua valendo como admin (compatibilidade). */
  function pode(lab) {
    if (!lab) return estaLogado();
    var s = getSessao();
    if (!s) return false;
    if (s.labs === '*' || (s.u === 'dbabrabo' && !s.labs)) return true;
    return Array.isArray(s.labs) && s.labs.indexOf(lab) !== -1;
  }

  function labs() {
    var s = getSessao();
    if (!s) return [];
    if (s.labs === '*') return ['*'];
    return Array.isArray(s.labs) ? s.labs.slice() : [];
  }

  function hex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function sha256Hex(texto) {
    if (!crypto.subtle) {
      throw new Error((window.EcoT && window.EcoT('webcrypto')) ||
        'WebCrypto indisponível — sirva via http://localhost:8080/ecosistema/aluno/ (não funciona em file://).');
    }
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return hex(buf);
  }

  function salvarSessao(s) {
    try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (_) {}
  }

  /** Tenta entrar. Devolve true/false — nunca diz se errou usuário ou senha. */
  async function entrar(usuario, senha) {
    var u = String(usuario || '').trim().toLowerCase();
    var h = await sha256Hex(u + ':' + String(senha || ''));
    if (u === MASTER_USER && h === MASTER_HASH) {
      salvarSessao({ u: MASTER_USER, nome: 'Master', labs: '*', tipo: 'admin', t: Date.now() });
      return true;
    }
    var lista = null;
    try {
      var r = await fetch(BASE_JSON + '/alunos.json', { cache: 'no-store' });
      if (r.ok) lista = await r.json();
    } catch (_) { lista = null; }
    var ach = lista && lista.alunos
      ? lista.alunos.filter(function (a) { return String(a.user || '').toLowerCase() === u; })[0]
      : null;
    if (ach && ach.hash === h && Array.isArray(ach.labs) && ach.labs.length) {
      salvarSessao({ u: String(ach.user).toLowerCase(), nome: ach.nome || u, labs: ach.labs.slice(), tipo: 'aluno', t: Date.now() });
      return true;
    }
    return false;
  }

  /** Páginas protegidas chamam isso no <head>: sem sessão, vai ao login.
      Com lab (ex.: exigirLogin('../aluno/', 'mysql')), sem o lab volta ao hub. */
  function exigirLogin(urlLogin, lab) {
    if (!estaLogado()) {
      try { sessionStorage.setItem(CHAVE_NEXT, location.pathname + location.search + location.hash); } catch (_) {}
      location.replace(urlLogin);
      return false;
    }
    if (lab && !pode(lab)) {
      var hub = String(urlLogin || '').replace(/aluno\/?(\?.*)?$/, '');
      location.replace(hub || './');
      return false;
    }
    return true;
  }

  function proximoOu(padrao) {
    var n = null;
    try { n = sessionStorage.getItem(CHAVE_NEXT) || null; sessionStorage.removeItem(CHAVE_NEXT); } catch (_) {}
    /* n vem de location.pathname: sempre mesmo site, sem esquema. Aceita
       qualquer caminho do ecossistema, com ou sem subpasta de projeto
       ("/dba-brabo-site/ecosistema/..." também vale). */
    if (n && /(^|\/)ecosistema\//.test(n)) return n;
    if (n && /^\.\.?(\/|$)/.test(n)) return n;
    return padrao;
  }

  function sair(destino) {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (_) {}
    location.href = destino || '../aluno/';
  }

  /* Preenche [data-eco-user] e arma [data-eco-sair] em toda página do eco. */
  document.addEventListener('DOMContentLoaded', function () {
    var s = getSessao();
    document.querySelectorAll('[data-eco-user]').forEach(function (el) {
      if (!s) { el.hidden = true; return; }
      el.hidden = false;
      el.textContent = s.nome || s.u;
      el.title = ((window.EcoT && window.EcoT('sessao_ativa')) || 'Sessão ativa: ') + (s.nome || s.u);
    });
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-eco-sair]') : null;
    if (!b) return;
    e.preventDefault();
    sair(b.getAttribute('href') || b.dataset.ecoSair || '../aluno/');
  });

  var api = {
    estaLogado: estaLogado, exigirLogin: exigirLogin, entrar: entrar,
    sair: sair, proximoOu: proximoOu, pode: pode, labs: labs, ehAdmin: ehAdmin,
    usuario: MASTER_USER
  };
  try {
    Object.defineProperty(api, 'usuario', { get: function () { var s = getSessao(); return s ? (s.nome || s.u) : MASTER_USER; } });
  } catch (_) {}
  window.EcoAuth = api;
})();
