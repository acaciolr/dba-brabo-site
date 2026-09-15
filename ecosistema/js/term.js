/* ==========================================================================
   CONSOLE — terminal mock por VM (Fase 1)
   --------------------------------------------------------------------------
   // FUTURE BACKEND (v4: SSH via WebSocket)
   // TODO: abrir WebSocket wss://gateway/exec?vm=<nome> com o token da sessão
   // TODO: anexar o PTY remoto ao xterm via `socket.onmessage -> term.write`
   // TODO: nunca enviar nem exibir private key — auth acontece no gateway
   //
   Hoje: xterm.js com shell FAKE local por tecnologia. Sem rede, sem SSH.
   Se o CDN falhar, cai no fallback estático (mesmos comandos).
   ========================================================================== */
'use strict';

// Prefixo da VM -> tecnologia (casa com json/vms.json).
function techOf(vm) {
  const v = (vm || '').toLowerCase();
  if (v.startsWith('ora-')) return 'oracle';
  if (v.startsWith('mysql-')) return 'mysql';
  if (v.startsWith('sql-')) return 'sqlserver';
  if (v.startsWith('pg-') || v === 'patroni') return 'postgresql';
  if (v.startsWith('mongo-')) return 'mongodb';
  return 'bash';
}

const PROMPTS = {
  oracle: 'SQL> ',
  mysql: 'mysql> ',
  sqlserver: '1> ',
  postgresql: 'postgres=# ',
  mongodb: 'test> ',
  bash: 'acaciolr@srv-lnx-01:~$ ',
};

const BANNERS = {
  oracle: 'Oracle Database 19c — mock v1 (sem conexão real)',
  mysql: 'MySQL 8.0.36 — mock v1 (sem conexão real)',
  sqlserver: 'SQL Server 2022 — mock v1 (sem conexão real)',
  postgresql: 'PostgreSQL 16 — mock v1 (sem conexão real)',
  mongodb: 'MongoDB 7.0 — mock v1 (sem conexão real)',
  bash: 'srv-lnx-01 — shell mock v1 (sem SSH real)',
};

// Respostas fake por tecnologia. `__prompt_extra__` troca o prompt (ex: RMAN>).
function fake(tech, line) {
  const cmd = line.trim();
  const low = cmd.toLowerCase();
  if (!cmd) return { out: '' };
  if (low === 'help') {
    return { out: 'comandos mock: help · status · version · clear · exit' + (tech === 'bash' ? ' · ls · whoami' : tech === 'mysql' ? ' · show databases · select version();' : tech === 'oracle' ? ' · show pdbs · rman' : '') };
  }
  if (low === 'status') return { out: 'mock v1: VM responde local. SSH real chega na v4 (WebSocket).' };
  if (low === 'version' || low === 'select version();' || low === 'select @@version') {
    return { out: { oracle: '19.26.0.0.0', mysql: '8.0.36', sqlserver: '16.0 (2022)', postgresql: 'PostgreSQL 16.4', mongodb: '7.0.14', bash: 'srv-lnx-01 · mock v1' }[tech] };
  }
  if (low === 'clear') return { clear: true };
  if (low === 'exit' || low === 'quit' || low === '\\q') return { out: 'bye (mock — a página continua aberta).' };
  if (tech === 'mysql' && low === 'show databases;') return { out: 'information_schema\nlabdb\nmysql\nsys' };
  if (tech === 'oracle' && low === 'show pdbs;') return { out: 'CON_ID  NAME      OPEN MODE\n2       PDB$SEED    READ ONLY\n3       LABDB       READ WRITE' };
  if (tech === 'oracle' && low === 'rman') return { out: 'Recovery Manager: Release 19.0.0.0.0 (mock)', prompt: 'RMAN> ' };
  if (tech === 'oracle' && low === 'dgmgrl') return { out: 'DGMGRL for Linux (mock)', prompt: 'DGMGRL> ' };
  if (tech === 'bash' && low === 'whoami') return { out: 'acaciolr' };
  if (tech === 'bash' && low === 'ls') return { out: 'backup.sh  coleta.py  hosts.txt  relatorio.json' };
  if (tech === 'bash' && low.startsWith('echo ')) return { out: cmd.slice(5) };
  return { out: `${cmd.split(/\s+/)[0]}: comando não reconhecido no mock v1 (digite help).` };
}

function bootFallback(tech, prompt, app) {
  const box = $('#fallback'), out = $('#fakeOut'), inp = $('#fakeIn'), pr = $('#fakePrompt');
  box.hidden = false;
  pr.textContent = prompt.trim();
  out.textContent += BANNERS[tech] + '\n' + (APPS[app] ? APPS[app].join('\n') + '\n' : '') + 'Digite help.\n';
  inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const line = inp.value;
    inp.value = '';
    out.textContent += pr.textContent + ' ' + line + '\n';
    const r = fake(tech, line);
    if (r.clear) { out.textContent = ''; return; }
    if (r.prompt) pr.textContent = r.prompt.trim();
    if (r.out) out.textContent += r.out + '\n';
    out.scrollTop = out.scrollHeight;
  });
  inp.focus();
}

// Telas fake de monitores TUI (?app=innotop|btop|dolphie). Estáticas na Fase 1.
const APPS = {
  innotop: [
    'INNOTOP 1.14 — mysql-node-01 (mock v1)',
    'QPS: 412  Threads: 18 con / 4 run  Slow: 0  Uptime: 12d 03:11',
    'CXN  USER   HOST      DB     TIME  STATE     INFO',
    ' 41  app    10.0.0.8  labdb   0     executing SELECT * FROM t WHERE id = ?',
    ' 42  app    10.0.0.9  labdb   0     statistics SELECT COUNT(*) FROM t',
    'InnoDB: ro 12.4k/s | wr 3.1k/s | bp hit 99.2% | hist 128',
  ],
  btop: [
    'BTOP 1.3 — srv-lnx-01 (mock v1)',
    'CPU [||||||||------] 54%   MEM [||||||----------] 31% (10.2/32G)',
    'PID   USER    CPU%  MEM%  CMD',
    '1024  mysql   38.2   21.4  /usr/sbin/mysqld',
    '2048  oracle  12.1    9.8  ora_pmon_ORCL',
    '4096  postgres 2.0    1.1  postgres: checkpointer',
  ],
  dolphie: [
    'DOLPHIE 2.0 — mysql-node-01 (mock v1)',
    '┌ Threads ────────┐ ┌ InnoDB ─────────┐ ┌ Replication ────┐',
    '│ connected: 18   │ │ bp hit: 99.2%   │ │ IO: Yes         │',
    '│ running:    4   │ │ history: 128    │ │ SQL: Yes        │',
    '│ slow:       0   │ │ redo 12MB/s     │ │ behind: 0s      │',
    '└─────────────────┘ └─────────────────┘ └─────────────────┘',
  ],
};

(function boot() {
  const vm = qs('vm') || 'srv-lnx-01';
  const app = (qs('app') || '').toLowerCase();
  const tech = techOf(vm);
  const prompt = PROMPTS[tech];
  $('#vmName').textContent = '· ' + vm + (app ? ` · ${app}` : '');
  $('#termTitle').textContent = app ? `${app} em ${vm} (mock)` : `${vm} — ${tech} (mock)`;

  // Sem CDN (offline): fallback estático com os mesmos comandos.
  if (typeof Terminal === 'undefined') {
    bootFallback(tech, prompt, app);
    return;
  }
  const term = new Terminal({ cursorBlink: true, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, theme: { background: '#0A0C0E', foreground: '#E6EDF3', green: '#7EE787', yellow: '#D29922', blue: '#58A6FF' } });
  term.open($('#xterm'));
  try {
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    fit.fit();
    addEventListener('resize', () => fit.fit());
  } catch { /* addon opcional */ }
  let cur = prompt;
  term.writeln(BANNERS[tech]);
  if (APPS[app]) APPS[app].forEach(l => term.writeln(l));
  term.writeln('Digite help. (mock v1 — na v4 este mesmo terminal fala WebSocket com o gateway)');
  term.write('\r\n' + cur);
  let buf = '';
  term.onKey(({ key, domEvent }) => {
    if (domEvent.key === 'Enter') {
      term.write('\r\n');
      const r = fake(tech, buf);
      buf = '';
      if (r.clear) { term.clear(); }
      else {
        if (r.prompt) cur = r.prompt;
        if (r.out) term.writeln(r.out);
      }
      term.write(cur);
    } else if (domEvent.key === 'Backspace') {
      if (buf.length) { buf = buf.slice(0, -1); term.write('\b \b'); }
    } else if (key.length === 1) {
      buf += key;
      term.write(key);
    }
  });
})();
