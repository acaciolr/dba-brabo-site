/* ==========================================================================
   ECOSSISTEMA SUPER DBA — gate de acesso (Fase 1, estático)
   --------------------------------------------------------------------------
   O GitHub Pages é estático: não há backend para validar senha de verdade.
   Este gate é uma trava de UX — pede usuário + senha antes de mostrar o hub
   e redireciona para o login quando não há sessão. A senha NUNCA fica no
   código: aqui vai só o SHA-256 de "usuario:senha" do master. Sessão morre
   ao fechar a aba (sessionStorage), igual à área do mentor.

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

  function getSessao() {
    try {
      var s = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null');
      if (s && s.u === MASTER_USER && typeof s.t === 'number') return s;
    } catch (_) { /* sem sessão */ }
    return null;
  }

  function estaLogado() { return !!getSessao(); }

  function hex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function sha256Hex(texto) {
    if (!crypto.subtle) {
      throw new Error('WebCrypto indisponível — sirva via http://localhost:8080/ecosistema/aluno/ (não funciona em file://).');
    }
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return hex(buf);
  }

  /** Tenta entrar. Devolve true/false — nunca diz se errou usuário ou senha. */
  async function entrar(usuario, senha) {
    var u = String(usuario || '').trim().toLowerCase();
    var h = await sha256Hex(u + ':' + String(senha || ''));
    if (u === MASTER_USER && h === MASTER_HASH) {
      try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ u: MASTER_USER, t: Date.now() })); } catch (_) {}
      return true;
    }
    return false;
  }

  /** Páginas protegidas chamam isso no <head>: sem sessão, vai ao login. */
  function exigirLogin(urlLogin) {
    if (estaLogado()) return true;
    try { sessionStorage.setItem(CHAVE_NEXT, location.pathname + location.search + location.hash); } catch (_) {}
    location.replace(urlLogin);
    return false;
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
      el.textContent = s.u;
      el.title = 'Sessão ativa: ' + s.u;
    });
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-eco-sair]') : null;
    if (!b) return;
    e.preventDefault();
    sair(b.getAttribute('href') || b.dataset.ecoSair || '../aluno/');
  });

  window.EcoAuth = { estaLogado: estaLogado, exigirLogin: exigirLogin, entrar: entrar, sair: sair, proximoOu: proximoOu, usuario: MASTER_USER };
})();
