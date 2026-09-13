/* ==========================================================================
   VM MANAGER — tabela estilo hypervisor (Fase 1: tudo visual, sem backend)
   ========================================================================== */
'use strict';

const badgeClass = s => ({
  ONLINE: 'badge--online', OFFLINE: 'badge--offline',
  STARTING: 'badge--starting', STOPPING: 'badge--stopping',
}[s] || 'badge--offline');

function setBadge(name, status) {
  $$(`#vmTable tr[data-vm="${CSS.escape(name)}"] [data-badge]`).forEach(b => {
    b.textContent = status;
    b.className = `badge ${badgeClass(status)}`;
  });
}

function ciclo(name, acao) {
  // MOCK v1: simula transição de estado com delay. Na v4, aqui entra
  // a chamada ao backend (SSH gateway) com polling do estado real.
  const meio = acao === 'start' ? 'STARTING' : acao === 'stop' ? 'STOPPING' : 'STARTING';
  const fim = acao === 'stop' ? 'OFFLINE' : 'ONLINE';
  setBadge(name, meio);
  toast(`${name}: ${acao}… (simulação local)`);
  setTimeout(() => {
    setBadge(name, fim);
    toast(`${name}: ${fim} (mock v1).`);
  }, 1800);
}

(async function boot() {
  relogio();
  try {
    const vms = await loadJSON('../json/vms.json');
    const tb = $('#vmTable tbody');
    tb.innerHTML = (vms.groups || []).map(g => (g.vms || []).map(v => `
      <tr data-vm="${esc(v.name)}">
        <td><b>${esc(v.name)}</b></td>
        <td>${esc(g.tech)}</td>
        <td>${esc(v.cpu)} vCPU</td>
        <td>${esc(v.ram)} GB</td>
        <td><span class="badge ${badgeClass(v.status)}" data-badge>${esc(v.status)}</span></td>
        <td style="white-space:nowrap">
          <button type="button" class="ebtn" data-act="start" title="Start (mock)">Start</button>
          <button type="button" class="ebtn" data-act="stop" title="Stop (mock)">Stop</button>
          <button type="button" class="ebtn" data-act="restart" title="Restart (mock)">Restart</button>
          <a class="ebtn ebtn--primary" style="text-decoration:none" href="../terminal/?vm=${encodeURIComponent(v.name)}" title="Abrir console (mock)">Console</a>
        </td>
      </tr>`).join('')).join('');
    $$('#vmTable [data-act]').forEach(b => b.addEventListener('click', () => {
      ciclo(b.closest('tr').dataset.vm, b.dataset.act);
    }));
  } catch (err) {
    toast('Falha ao carregar ../json/vms.json — sirva via http://localhost:8080/ecosistema/.');
  }
})();
