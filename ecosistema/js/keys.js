/* ==========================================================================
   KEY MANAGER — mock visual (Fase 1)
   --------------------------------------------------------------------------
   // FUTURE BACKEND
   // - Store encrypted private keys (v2: SQLite, v3: FastAPI + Vault)
   // - SSH Agent forwarding per sessão
   // - Vault Integration (emissão/rotação automática)
   //
   REGRAS DESTA FASE: nada é transmitido, nada é persistido. O fingerprint
   é calculado 100% local (igual a `ssh-keygen -lf`) e o conteúdo da chave
   NUNCA é exibido nem guardado — só nome + metadados de demonstração.
   ========================================================================== */
'use strict';

// Chaves de demonstração (mock — não abrem nada).
const DEMO = [
  { nome: 'lab-oracle', tipo: 'ED25519', algoritmo: 'ssh-ed25519', criada: '2026-08-01', vms: 'ora-node-01, ora-node-02', fp: 'SHA256:m0ck0r4cl3d3m0...' },
  { nome: 'lab-mysql', tipo: 'ED25519', algoritmo: 'ssh-ed25519', criada: '2026-08-01', vms: 'mysql-node-01, mysql-node-02', fp: 'SHA256:m0ckmy5ql4cc355...' },
];

function linha(k) {
  return `<tr>
    <td><b>${esc(k.nome)}</b></td>
    <td style="font-size:11px;color:var(--eco-dim)">${esc(k.fp)}</td>
    <td>${esc(k.tipo)}</td>
    <td>${esc(k.algoritmo)}</td>
    <td>${esc(k.criada)}</td>
    <td style="font-size:12px">${esc(k.vms)}</td>
    <td style="white-space:nowrap">
      <button type="button" class="ebtn" data-fp="${esc(k.fp)}">Copiar fingerprint</button>
      <button type="button" class="ebtn" data-vm="${esc(k.nome)}">Associar VM</button>
    </td>
  </tr>`;
}

function ligarBotoes() {
  $$('#keyTable [data-fp]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.fp); toast('Fingerprint copiado.'); }
    catch { toast('Clipboard indisponível neste contexto.'); }
  }));
  $$('#keyTable [data-vm]').forEach(b => b.addEventListener('click', () => {
    // FUTURE BACKEND: gravar associação chave↔VM no banco (v2+).
    toast(`Associar VM à chave ${b.dataset.vm} — mock v1 (vira registro no backend).`);
  }));
}

function render() {
  $('#keyTable tbody').innerHTML = DEMO.map(linha).join('');
  ligarBotoes();
}

async function fingerprintLocal(buf) {
  // Igual em espírito a `ssh-keygen -lf`: hash SHA-256 dos bytes, base64,
  // calculado AQUI, sem sair do navegador. O conteúdo NUNCA é exibido.
  const h = await crypto.subtle.digest('SHA-256', buf);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(h)))
    .replace(/=+$/, '');
  return `SHA256:${b64}`;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

(async function boot() {
  relogio();
  render();

  $('#btnImport').addEventListener('click', () => $('#filePem').click());
  $('#filePem').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const fp = await fingerprintLocal(buf);
      DEMO.push({
        nome: f.name.replace(/\.(pem|key|pub)$/i, ''),
        tipo: /\.pub$/i.test(f.name) ? 'PUBLIC' : 'PRIVATE (só metadados)',
        algoritmo: 'detectado no import (mock)',
        criada: hoje(), vms: '—', fp,
      });
      render();
      toast(`PEM lido localmente: fingerprint ${fp.slice(0, 18)}… (conteúdo descartado).`);
    } catch {
      toast('Falha ao ler o arquivo.');
    }
    e.target.value = '';
  });

  $('#btnGen').addEventListener('click', async () => {
    // FUTURE BACKEND: gerar no servidor/HSM e entregar via Vault.
    // Tenta WebCrypto local; se indisponível, registra mock sinalizado.
    let fp = null, tipo = 'ED25519 (mock visual)';
    try {
      if (crypto.subtle.generateKey) {
        const par = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).catch(() => null);
        if (par) {
          const raw = await crypto.subtle.exportKey('raw', par.publicKey);
          fp = await fingerprintLocal(raw);
          tipo = 'ED25519';
        }
      }
    } catch { /* cai no mock abaixo */ }
    DEMO.push({
      nome: `lab-${String(DEMO.length + 1).padStart(2, '0')}`,
      tipo, algoritmo: 'ssh-ed25519', criada: hoje(), vms: '—',
      fp: fp || 'SHA256:mock — reabra num browser com WebCrypto Ed25519',
    });
    render();
    toast(fp ? 'Par ED25519 gerado localmente (privada descartada — mock v1).' : 'WebCrypto Ed25519 indisponível aqui: registrado como mock.');
  });
})();
