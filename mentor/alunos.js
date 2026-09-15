/* ==========================================================================
   DBA BRABO — Registry de alunos (área do mentor, 100% local)
   --------------------------------------------------------------------------
   Cada REGISTRO = uma venda/matrícula (1 aluno pode ter N, ex.: MySQL e
   depois Oracle — o login libera a UNIÃO dos labs das matrículas ativas).

   Registro: { id, nome, cpf (só dígitos), email (login), telefone,
     mentoria_slug, labs (snapshot), data_contrato, valor_cheio,
     tem_desconto (0|1), desconto_valor, valor_final (calculado),
     forma_pagamento, parcelas, status (ativa|pausada|concluida|cancelada),
     senha_hash (SHA-256 "email:senha" p/ o login do aluno),
     observacoes, criado_em, atualizado_em }

   Onde mora: localStorage (chave dbabrabo.alunos.v1) — SÓ nesta máquina,
   NUNCA vai ao git. Publicar acesso = exportar JSON → rodar
   tools/build-alunos.mjs → commitar SÓ ecosistema/json/alunos.json
   (user+hash+labs, sem CPF/financeiro). O export local está no .gitignore.

   i18n: usa T() de mentor.js com literal PT de fallback (mesmo padrão).
   ========================================================================== */
'use strict';

(function () {
  var CHAVE = 'dbabrabo.alunos.v1';

  /* Mentoria (slug da trilha) → labs do ecossistema. Fonte canônica do
     ACESSO é tools/build-alunos.mjs (recalcula na geração); aqui é preview. */
  var LABS_POR_MENTORIA = {
    oracle: ['oracle'], mysql: ['mysql'], sqlserver: ['sqlserver'],
    postgresql: ['postgresql'], mongodb: ['mongodb'],
    'sql-master': ['mysql', 'postgresql']
  };
  var LABS_NOME = { oracle: 'Oracle', mysql: 'MySQL', sqlserver: 'SQL Server', postgresql: 'PostgreSQL', mongodb: 'MongoDB' };

  /* ---------- utils ------------------------------------------------------ */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.from((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function T_(k, fb) {
    try { if (typeof T === 'function') return T(k, fb); } catch (_) {}
    return fb;
  }
  function uid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {}
    return 'id-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
  }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }
  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
  function maskCPF(d) {
    d = soDigitos(d).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }
  function maskCPFParcial(d) {
    d = soDigitos(d);
    return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : maskCPF(d);
  }
  function validarCPF(cpf) {
    var d = soDigitos(cpf);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    var s, i, r;
    s = 0;
    for (i = 0; i < 9; i++) s += parseInt(d[i], 10) * (10 - i);
    r = (s * 10) % 11;
    if (r === 10) r = 0;
    if (r !== parseInt(d[9], 10)) return false;
    s = 0;
    for (i = 0; i < 10; i++) s += parseInt(d[i], 10) * (11 - i);
    r = (s * 10) % 11;
    if (r === 10) r = 0;
    return r === parseInt(d[10], 10);
  }
  function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  function numBR(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    s = s.replace(/^R\$\s*/, '');
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }
  function fmtBRL(n) {
    if (n == null) return '—';
    try { return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    catch (_) { return 'R$ ' + n; }
  }
  async function sha256Hex(texto) {
    if (!window.crypto || !crypto.subtle) throw new Error('webcrypto');
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function download(nome, texto) {
    var blob = new Blob([texto], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- repo -------------------------------------------------------- */
  function carregar() {
    try {
      var db = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (db && Array.isArray(db.alunos)) return db;
    } catch (_) {}
    return { v: 1, alunos: [] };
  }
  function salvar(db) {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  }
  function labsPara(slug) { return (LABS_POR_MENTORIA[slug] || []).slice(); }
  function nomeMentoria(slug) {
    try {
      if (typeof app !== 'undefined' && app && app.indice && app.indice.trilhas) {
        var t = app.indice.trilhas.filter(function (x) { return x.slug === slug; })[0];
        if (t) return t.nome;
      }
    } catch (_) {}
    return slug;
  }
  function opcoesMentoria() {
    var slugs = [];
    try {
      if (typeof app !== 'undefined' && app && app.indice && app.indice.trilhas) {
        slugs = app.indice.trilhas.map(function (t) { return t.slug; });
      }
    } catch (_) {}
    Object.keys(LABS_POR_MENTORIA).forEach(function (s) { if (slugs.indexOf(s) === -1) slugs.push(s); });
    return slugs;
  }

  /* ---------- modal -------------------------------------------------------- */
  var modal = null, editId = null;

  function statusMsg(txt, erro) {
    var m = $('#alStatus');
    if (!m) return;
    m.textContent = txt || '';
    m.classList.toggle('is-erro', !!erro);
  }

  function construirModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'malunos-modal';
    modal.id = 'alunosModal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="malunos-caixa" role="dialog" aria-modal="true" aria-labelledby="alTitulo">' +
        '<div class="malunos-topo"><h3 id="alTitulo"></h3>' +
        '<button class="btn btn--ghost btn--sm" id="alFechar" type="button">✕</button></div>' +
        '<div class="malunos-status" id="alStatus" role="status"></div>' +
        '<div id="alCred" class="malunos-cred" hidden></div>' +
        '<form id="alForm" autocomplete="off">' +
          '<div class="malunos-grade">' +
            '<div class="campo"><label for="alNome">' + esc(T_('mentor.alunos_nome', 'nome')) + ' *</label><input id="alNome" required maxlength="120"></div>' +
            '<div class="campo"><label for="alCpf">CPF *</label><input id="alCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div>' +
            '<div class="campo"><label for="alEmail">e-mail (login) *</label><input id="alEmail" type="email" required maxlength="120" autocapitalize="off"></div>' +
            '<div class="campo"><label for="alFone">' + esc(T_('mentor.alunos_fone', 'telefone/whatsapp')) + '</label><input id="alFone" maxlength="20"></div>' +
            '<div class="campo"><label for="alMentoria">' + esc(T_('mentor.alunos_mentoria', 'mentoria contratada')) + ' *</label><select id="alMentoria"></select></div>' +
            '<div class="campo"><label>' + esc(T_('mentor.alunos_labs', 'labs liberados')) + '</label><div class="malunos-labs" id="alLabs"></div></div>' +
            '<div class="campo"><label for="alSenha">' + esc(T_('mentor.alunos_senha', 'senha inicial do aluno')) + ' *</label><input id="alSenha" type="text" minlength="6" maxlength="64"><small class="malunos-dica" id="alSenhaDica"></small></div>' +
            '<div class="campo"><label for="alData">' + esc(T_('mentor.alunos_data', 'data do contrato')) + '</label><input id="alData" type="date"></div>' +
            '<div class="campo"><label for="alValor">' + esc(T_('mentor.alunos_valor', 'valor cheio (R$)')) + ' *</label><input id="alValor" inputmode="decimal" placeholder="0,00"></div>' +
            '<div class="campo malunos-check"><label><input id="alDesc" type="checkbox"> ' + esc(T_('mentor.alunos_desc', 'teve desconto?')) + '</label>' +
            '<input id="alDescValor" inputmode="decimal" placeholder="R$ 0,00"></div>' +
            '<div class="campo"><label>' + esc(T_('mentor.alunos_final', 'valor final')) + '</label><div class="malunos-final" id="alFinal">—</div></div>' +
            '<div class="campo"><label for="alPgto">' + esc(T_('mentor.alunos_pgto', 'forma de pagamento')) + '</label><select id="alPgto"></select></div>' +
            '<div class="campo"><label for="alParc">' + esc(T_('mentor.alunos_parc', 'parcelas')) + '</label><input id="alParc" type="number" min="1" max="36" value="1"></div>' +
            '<div class="campo"><label for="alStatusM">' + esc(T_('mentor.alunos_status', 'status')) + '</label><select id="alStatusM"></select></div>' +
            '<div class="campo malunos-full"><label for="alObs">' + esc(T_('mentor.alunos_obs', 'observações')) + '</label><input id="alObs" maxlength="240"></div>' +
          '</div>' +
          '<div class="malunos-acoes">' +
            '<button class="btn btn--primary" id="alSalvar" type="submit"></button>' +
            '<button class="btn btn--ghost" id="alCancelar" type="button"></button>' +
          '</div>' +
        '</form>' +
        '<hr class="divider">' +
        '<div class="malunos-lista-topo"><h4 id="alListaT"></h4>' +
          '<div class="hstack"><input id="alBusca" type="search"><div class="hstack">' +
          '<button class="btn btn--outline btn--sm" id="alExport" type="button"></button>' +
          '<button class="btn btn--ghost btn--sm" id="alImport" type="button"></button>' +
          '<input id="alImportFile" type="file" accept="application/json" hidden></div></div></div>' +
        '<div id="alLista"></div>' +
      '</div>';
    document.body.appendChild(modal);

    $('#alFechar', modal).addEventListener('click', fechar);
    modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) fechar(); });
    $('#alCancelar', modal).addEventListener('click', fechar);
    $('#alCpf', modal).addEventListener('input', function (e) { e.target.value = maskCPF(e.target.value); });
    ['alValor', 'alDescValor'].forEach(function (id) {
      $('#' + id, modal).addEventListener('input', atualizarFinal);
    });
    $('#alDesc', modal).addEventListener('change', function () {
      $('#alDescValor', modal).disabled = !this.checked;
      if (!this.checked) $('#alDescValor', modal).value = '';
      atualizarFinal();
    });
    $('#alMentoria', modal).addEventListener('change', atualizarLabs);
    $('#alForm', modal).addEventListener('submit', onSalvar);
    $('#alBusca', modal).addEventListener('input', renderLista);
    $('#alExport', modal).addEventListener('click', onExport);
    $('#alImport', modal).addEventListener('click', function () { $('#alImportFile', modal).click(); });
    $('#alImportFile', modal).addEventListener('change', onImport);
    return modal;
  }

  function preencherSelects() {
    var msel = $('#alMentoria', modal);
    var atual = msel.value;
    msel.innerHTML = opcoesMentoria().map(function (s) {
      return '<option value="' + esc(s) + '">' + esc(nomeMentoria(s)) + '</option>';
    }).join('');
    if (atual) msel.value = atual;
    var pgtos = ['Pix', 'Cartão', 'Boleto', 'Transferência'];
    $('#alPgto', modal).innerHTML = pgtos.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('');
    var sts = [['ativa', T_('mentor.alunos_st_ativa', 'ativa')], ['pausada', T_('mentor.alunos_st_pausada', 'pausada')], ['concluida', T_('mentor.alunos_st_concluida', 'concluída')], ['cancelada', T_('mentor.alunos_st_cancelada', 'cancelada')]];
    $('#alStatusM', modal).innerHTML = sts.map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1]) + '</option>'; }).join('');
  }

  function atualizarLabs() {
    var slug = $('#alMentoria', modal).value;
    var labs = labsPara(slug);
    $('#alLabs', modal).innerHTML = labs.length
      ? labs.map(function (l) { return '<span class="badge badge--accent">' + esc(LABS_NOME[l] || l) + '</span>'; }).join('')
      : '<span class="malunos-dica">' + esc(T_('mentor.alunos_sem_lab', 'só hub, sem lab dedicado')) + '</span>';
  }

  function atualizarFinal() {
    var cheio = numBR($('#alValor', modal).value);
    var desc = $('#alDesc', modal).checked ? (numBR($('#alDescValor', modal).value) || 0) : 0;
    $('#alFinal', modal).textContent = cheio == null ? '—' : fmtBRL(cheio - desc);
  }

  function abrir(novo, reg) {
    construirModal();
    preencherSelects();
    editId = (reg && reg.id) || null;
    statusMsg('');
    $('#alCred', modal).hidden = true;
    $('#alTitulo', modal).textContent = novo
      ? T_('mentor.alunos_novo', 'Cadastrar aluno')
      : T_('mentor.alunos_editar', 'Editar matrícula');
    $('#alSalvar', modal).textContent = T_('mentor.alunos_salvar', 'Salvar');
    $('#alCancelar', modal).textContent = T_('mentor.alunos_cancelar', 'Cancelar');
    $('#alListaT', modal).textContent = T_('mentor.alunos_lista', 'Matrículas neste navegador');
    $('#alBusca', modal).placeholder = T_('mentor.alunos_busca', 'buscar nome, e-mail ou CPF…');
    $('#alExport', modal).textContent = '⭳ ' + T_('mentor.alunos_export', 'Exportar');
    $('#alImport', modal).textContent = '⭱ ' + T_('mentor.alunos_import', 'Importar');
    var f = reg || {};
    $('#alNome', modal).value = f.nome || '';
    $('#alCpf', modal).value = f.cpf ? maskCPF(f.cpf) : '';
    $('#alEmail', modal).value = f.email || '';
    $('#alFone', modal).value = f.telefone || '';
    if (f.mentoria_slug) $('#alMentoria', modal).value = f.mentoria_slug;
    $('#alSenha', modal).value = '';
    $('#alSenha', modal).required = !reg;
    $('#alSenha', modal).placeholder = reg
      ? T_('mentor.alunos_senha_manter', 'em branco = mantém a atual')
      : T_('mentor.alunos_senha_min', 'mín. 6 caracteres');
    $('#alSenhaDica', modal).textContent = T_('mentor.alunos_senha_dica', 'mostrada 1 vez após salvar — anote e envie ao aluno');
    $('#alData', modal).value = f.data_contrato || hojeISO();
    $('#alValor', modal).value = f.valor_cheio != null ? String(f.valor_cheio).replace('.', ',') : '';
    $('#alDesc', modal).checked = !!f.tem_desconto;
    $('#alDescValor', modal).value = f.desconto_valor ? String(f.desconto_valor).replace('.', ',') : '';
    $('#alDescValor', modal).disabled = !f.tem_desconto;
    if (f.forma_pagamento) $('#alPgto', modal).value = f.forma_pagamento;
    $('#alParc', modal).value = f.parcelas || 1;
    if (f.status) $('#alStatusM', modal).value = f.status;
    $('#alObs', modal).value = f.observacoes || '';
    atualizarLabs();
    atualizarFinal();
    renderLista();
    modal.hidden = false;
  }

  function fechar() {
    if (!modal) return;
    modal.hidden = true;
    /* Destroi para reconstruir no próximo abrir com o idioma atual. */
    try { modal.remove(); } catch (_) {}
    modal = null;
  }

  function coletar() {
    var nome = $('#alNome', modal).value.trim();
    var cpf = soDigitos($('#alCpf', modal).value);
    var email = $('#alEmail', modal).value.trim().toLowerCase();
    var slug = $('#alMentoria', modal).value;
    var senha = $('#alSenha', modal).value;
    var cheio = numBR($('#alValor', modal).value);
    var temDesc = $('#alDesc', modal).checked;
    var descValor = temDesc ? (numBR($('#alDescValor', modal).value) || 0) : 0;
    var parc = parseInt($('#alParc', modal).value, 10);
    return {
      nome: nome, cpf: cpf, email: email, telefone: $('#alFone', modal).value.trim(),
      mentoria_slug: slug, senha: senha, data_contrato: $('#alData', modal).value || hojeISO(),
      valor_cheio: cheio, tem_desconto: temDesc ? 1 : 0, desconto_valor: descValor,
      forma_pagamento: $('#alPgto', modal).value, parcelas: parc,
      status: $('#alStatusM', modal).value, observacoes: $('#alObs', modal).value.trim()
    };
  }

  function validar(f, db) {
    if (f.nome.length < 3) return T_('mentor.alunos_e_nome', 'Informe o nome completo.');
    if (!validarCPF(f.cpf)) return T_('mentor.alunos_e_cpf', 'CPF inválido.');
    if (!emailOk(f.email)) return T_('mentor.alunos_e_email', 'E-mail inválido.');
    if (!f.senha && !editId) return T_('mentor.alunos_e_senha', 'Defina a senha inicial (mín. 6).');
    if (f.senha && f.senha.length < 6) return T_('mentor.alunos_e_senha', 'Defina a senha inicial (mín. 6).');
    if (f.valor_cheio == null) return T_('mentor.alunos_e_valor', 'Informe o valor cheio.');
    if (f.desconto_valor > f.valor_cheio) return T_('mentor.alunos_e_desc', 'Desconto maior que o valor.');
    if (!(f.parcelas >= 1 && f.parcelas <= 36)) return T_('mentor.alunos_e_parc', 'Parcelas: 1 a 36.');
    var dup = db.alunos.filter(function (a) {
      return a.id !== editId && (a.cpf === f.cpf || (a.email === f.email && a.mentoria_slug === f.mentoria_slug));
    })[0];
    if (dup) return T_('mentor.alunos_e_dup', 'CPF ou (e-mail + mentoria) já cadastrado.');
    return null;
  }

  async function onSalvar(e) {
    e.preventDefault();
    statusMsg('');
    var db, f;
    try { db = carregar(); } catch (err) {
      statusMsg(T_('mentor.alunos_e_store', 'Armazenamento indisponível neste navegador.'), true);
      return;
    }
    f = coletar();
    var erro = validar(f, db);
    if (erro) { statusMsg(erro, true); return; }
    var agora = new Date().toISOString();
    var reg = editId ? db.alunos.filter(function (a) { return a.id === editId; })[0] : null;
    var hash = reg ? reg.senha_hash : null;
    if (f.senha) {
      try { hash = await sha256Hex(f.email + ':' + f.senha); }
      catch (_) {
        statusMsg(T_('mentor.alunos_e_crypto', 'WebCrypto indisponível — sirva via http://localhost:8080/mentor/.'), true);
        return;
      }
    }
    var labs = labsPara(f.mentoria_slug);
    var valorFinal = Math.round((f.valor_cheio - f.desconto_valor) * 100) / 100;
    var novo = {
      id: reg ? reg.id : uid(), nome: f.nome, cpf: f.cpf, email: f.email,
      telefone: f.telefone, mentoria_slug: f.mentoria_slug, labs: labs,
      data_contrato: f.data_contrato, valor_cheio: f.valor_cheio,
      tem_desconto: f.tem_desconto, desconto_valor: f.desconto_valor, valor_final: valorFinal,
      forma_pagamento: f.forma_pagamento, parcelas: f.parcelas, status: f.status,
      senha_hash: hash, observacoes: f.observacoes,
      criado_em: reg ? reg.criado_em : agora, atualizado_em: agora
    };
    if (reg) {
      for (var i = 0; i < db.alunos.length; i++) {
        if (db.alunos[i].id === editId) db.alunos[i] = novo;
      }
    } else db.alunos.push(novo);
    try { salvar(db); } catch (err) {
      statusMsg(T_('mentor.alunos_e_store', 'Armazenamento indisponível neste navegador.'), true);
      return;
    }
    if (f.senha) mostrarCredenciais(novo.email, f.senha);
    statusMsg(T_('mentor.alunos_ok', 'Salvo. Exporte o JSON e gere o acesso com tools/build-alunos.mjs.'), false);
    editId = novo.id;
    renderLista();
  }

  function mostrarCredenciais(email, senha) {
    var box = $('#alCred', modal);
    box.hidden = false;
    box.innerHTML =
      '<b>' + esc(T_('mentor.alunos_cred', 'Acesso do aluno — mostre 1 vez e anote:')) + '</b><br>' +
      '<code>' + esc(email) + '</code> · <code>' + esc(senha) + '</code> ' +
      '<button class="btn btn--outline btn--sm" id="alCopiar" type="button">' + esc(T_('mentor.copiar', 'copiar')) + '</button>';
    $('#alCopiar', box).addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(email + ' / ' + senha);
        this.textContent = T_('mentor.copiado', 'copiado');
      } catch (_) {}
    });
  }

  function renderLista() {
    var box = $('#alLista', modal);
    if (!box) return;
    var db;
    try { db = carregar(); } catch (_) { db = { alunos: [] }; }
    var q = ($('#alBusca', modal).value || '').toLowerCase();
    var itens = db.alunos.filter(function (a) {
      return !q || (a.nome + ' ' + a.email + ' ' + a.cpf).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return String(b.atualizado_em).localeCompare(String(a.atualizado_em)); });
    if (!itens.length) {
      box.innerHTML = '<p class="malunos-dica">' + esc(T_('mentor.alunos_vazio', 'Nenhuma matrícula por aqui ainda.')) + '</p>';
      return;
    }
    box.innerHTML = itens.map(function (a) {
      var labs = (a.labs || []).map(function (l) { return '<span class="badge">' + esc(LABS_NOME[l] || l) + '</span>'; }).join(' ');
      return '<div class="maluno" data-id="' + esc(a.id) + '">' +
        '<div class="maluno__main"><b>' + esc(a.nome) + '</b>' +
        '<span class="maluno__sub">' + esc(a.email) + ' · ' + esc(maskCPFParcial(a.cpf)) + ' · ' + esc(nomeMentoria(a.mentoria_slug)) + '</span>' +
        '<span class="maluno__meta">' + labs + ' <span class="badge ' + (a.status === 'ativa' ? 'badge--accent' : '') + '">' + esc(a.status) + '</span>' +
        ' <span class="maluno__valor">' + esc(fmtBRL(a.valor_final)) + '</span></span></div>' +
        '<div class="maluno__acoes"><button class="btn btn--ghost btn--sm" data-editar type="button">' + esc(T_('mentor.alunos_editar_btn', 'editar')) + '</button>' +
        '<button class="btn btn--ghost btn--sm" data-excluir type="button">✕</button></div></div>';
    }).join('');
    $all('[data-editar]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.closest('.maluno').dataset.id;
        var reg = carregar().alunos.filter(function (a) { return a.id === id; })[0];
        if (reg) abrir(false, reg);
      });
    });
    $all('[data-excluir]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.closest('.maluno').dataset.id;
        if (!window.confirm(T_('mentor.alunos_confirma', 'Excluir esta matrícula? (só afeta este navegador)'))) return;
        var db2 = carregar();
        db2.alunos = db2.alunos.filter(function (a) { return a.id !== id; });
        try { salvar(db2); } catch (_) {}
        if (editId === id) editId = null;
        renderLista();
      });
    });
  }

  function onExport() {
    var db;
    try { db = carregar(); } catch (_) { db = { alunos: [] }; }
    download('alunos-export-' + hojeISO() + '.json', JSON.stringify({
      app: 'dba-brabo-alunos', v: 1,
      exportado_em: new Date().toISOString(),
      aviso: 'ARQUIVO LOCAL — contém CPF e verificadores. NUNCA commitar. Só tools/build-alunos.mjs lê este arquivo.',
      alunos: db.alunos
    }, null, 2));
  }

  function onImport(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      var db;
      try { db = carregar(); } catch (_) { db = { alunos: [] }; }
      try {
        var imp = JSON.parse(rd.result);
        var lista = Array.isArray(imp) ? imp : imp.alunos;
        if (!Array.isArray(lista)) throw new Error('formato');
        var ids = {};
        db.alunos.forEach(function (a) { ids[a.id] = 1; });
        var novos = 0;
        lista.forEach(function (a) {
          if (!a || !a.id || !a.email || !a.senha_hash) return;
          if (ids[a.id]) return;
          ids[a.id] = 1;
          db.alunos.push(a);
          novos++;
        });
        salvar(db);
        statusMsg(T_('mentor.alunos_imp_ok', 'Importados: ') + novos, false);
        renderLista();
      } catch (_) {
        statusMsg(T_('mentor.alunos_imp_erro', 'Arquivo inválido.'), true);
      }
    };
    rd.readAsText(file);
  }

  /* ---------- init --------------------------------------------------------- */
  function init() {
    var btn = document.getElementById('btnAlunoNovo');
    if (!btn) return;
    btn.addEventListener('click', function () { abrir(true, null); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AlunosDBA = { labsPara: labsPara, validarCPF: validarCPF };
})();
