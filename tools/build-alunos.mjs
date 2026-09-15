/* ==========================================================================
   DBA BRABO — gera ecosistema/json/alunos.json a partir do registry local
   --------------------------------------------------------------------------
   Fluxo:
     1. Na área do mentor: botão ＋ Aluno → cadastra → Exportar
        (baixa alunos-export-AAAA-MM-DD.json — ARQUIVO LOCAL, com CPF e
        verificadores; NUNCA commitar — está no .gitignore);
     2. Aqui na máquina: node tools/build-alunos.mjs ./alunos-export-....json
        (dry-run: só mostra o resumo);
     3. Confere e roda com --write → grava ecosistema/json/alunos.json
        (SÓ user + nome + hash + labs — sem PII) → commit + push.

   O ACESSO é recalculado aqui a partir de mentoria_slug (fonte canônica),
   não do snapshot do export. Só matrícula status 'ativa' libera lab.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SAIDA = path.join(ROOT, 'ecosistema', 'json', 'alunos.json');

const LABS_POR_MENTORIA = {
  oracle: ['oracle'], mysql: ['mysql'], sqlserver: ['sqlserver'],
  postgresql: ['postgresql'], mongodb: ['mongodb'],
  'sql-master': ['mysql', 'postgresql'],
};

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const entrada = args.find(a => !a.startsWith('--')) || null;

function sair(msg) { console.error(msg); process.exit(1); }
if (!entrada) sair('uso: node tools/build-alunos.mjs <alunos-export-AAAA-MM-DD.json> [--write]');
if (!fs.existsSync(entrada)) sair('arquivo não encontrado: ' + entrada);

let exp;
try { exp = JSON.parse(fs.readFileSync(entrada, 'utf8')); }
catch { sair('JSON inválido: ' + entrada); }
if (exp.app !== 'dba-brabo-alunos' || !Array.isArray(exp.alunos)) sair('não é um export do registry de alunos.');

const porUsuario = new Map();
const avisos = [];
for (const r of exp.alunos) {
  if (!r || r.status !== 'ativa') continue;
  const email = String(r.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { avisos.push(`ignorado (e-mail inválido): ${r.nome || r.id}`); continue; }
  if (!r.senha_hash || r.senha_hash.length < 32) { avisos.push(`ignorado (sem verificador): ${email}`); continue; }
  const labs = LABS_POR_MENTORIA[r.mentoria_slug];
  if (!labs) { avisos.push(`ignorado (mentoria desconhecida '${r.mentoria_slug}'): ${email}`); continue; }
  if (!porUsuario.has(email)) porUsuario.set(email, { user: email, nome: r.nome, hash: r.senha_hash, labs: new Set(), desde: r.atualizado_em });
  const u = porUsuario.get(email);
  labs.forEach(l => u.labs.add(l));
  if (String(r.atualizado_em || '') > String(u.desde || '')) { u.nome = r.nome; u.hash = r.senha_hash; u.desde = r.atualizado_em; }
}
const alunos = [...porUsuario.values()]
  .map(u => ({ user: u.user, nome: u.nome, hash: u.hash, labs: [...u.labs].sort() }))
  .sort((a, b) => a.user.localeCompare(b.user));

console.log(`matrículas ativas no export: ${exp.alunos.filter(r => r && r.status === 'ativa').length}`);
console.log(`usuários gerados: ${alunos.length}`);
for (const a of alunos) console.log(`  - ${a.user} → [${a.labs.join(', ') || 'só hub'}]`);
if (avisos.length) { console.log('avisos:'); avisos.forEach(a => console.log('  ! ' + a)); }

if (!WRITE) { console.log('dry-run: nada foi escrito (use --write para gravar)'); process.exit(0); }
const atual = JSON.parse(fs.readFileSync(SAIDA, 'utf8'));
const comentario = atual._comment || 'Acesso por aluno: login + labs por matrícula, SEM PII.';
fs.writeFileSync(SAIDA, JSON.stringify({ _comment: comentario, alunos }, null, 2) + '\n');
console.log('gravado: ecosistema/json/alunos.json — confira com git diff antes de commitar');
