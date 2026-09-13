/* ==========================================================================
   Página de ecossistema (Fase 1) — dirigida por data-tech no <body>.
   Módulos vêm de json/modules.json; VMs filtradas de json/vms.json.
   ========================================================================== */
'use strict';

const ACCENT = { oracle: '#F0805A', mysql: '#34D3C4', sqlserver: '#F08A6E', postgresql: '#4FD1B0', mongodb: '#47C98E' };
const TITULO = { oracle: 'Oracle Super DBA', mysql: 'MySQL Super DBA', sqlserver: 'SQL Server Super DBA', postgresql: 'PostgreSQL Super DBA', mongodb: 'MongoDB Super DBA' };
const TECHJSON = { oracle: 'ORACLE', mysql: 'MYSQL', sqlserver: 'SQL SERVER', postgresql: 'POSTGRESQL', mongodb: 'MONGODB' };

const badgeClass = s => ({
  ONLINE: 'badge--online', OFFLINE: 'badge--offline',
  STARTING: 'badge--starting', STOPPING: 'badge--stopping',
}[s] || 'badge--offline');

(async function boot() {
  relogio();
  const tech = document.body.dataset.tech;
  const accent = ACCENT[tech] || 'var(--eco-green)';
  document.title = `${TITULO[tech] || tech} — ECOSSISTEMA SUPER DBA`;
  const h1 = $('#techName');
  if (h1) { h1.innerHTML = `${esc((TITULO[tech] || tech).split(' ')[0])} <span class="accent">${esc((TITULO[tech] || tech).split(' ').slice(1).join(' '))}</span>`; }
  document.querySelectorAll('[data-accent]').forEach(n => n.style.setProperty('--accent', accent));
  try {
    const [modules, vms] = await Promise.all([loadJSON('../json/modules.json'), loadJSON('../json/vms.json')]);
    const mods = modules[tech] || [];
    $('#modGrid').innerHTML = mods.map(m => `<div class="estat"><div class="estat__num" style="font-size:16px">${esc(m)}</div><div class="estat__label">módulo · mock</div></div>`).join('');
    const g = (vms.groups || []).find(x => x.tech === TECHJSON[tech]);
    $('#vmList').innerHTML = g ? g.vms.map(v => `
      <a class="evm" href="../terminal/?vm=${encodeURIComponent(v.name)}">
        <span class="evm__name">${esc(v.name)} · ${esc(v.cpu)}vCPU/${esc(v.ram)}GB</span>
        <span class="badge ${badgeClass(v.status)}">${esc(v.status)}</span>
      </a>`).join('') : '<p style="color:var(--eco-faint);font-size:12px">sem VMs neste grupo.</p>';
  } catch (err) {
    toast('Falha ao carregar JSONs — sirva via http://localhost:8080/ecosistema/.');
  }
})();
