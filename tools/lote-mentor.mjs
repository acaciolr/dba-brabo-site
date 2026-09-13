#!/usr/bin/env node
/**
 * DBA BRABO — aplica lotes de conteúdo do mentor.
 *
 * Lê   conteudo-mentor/_lote/*.json   (texto puro, NÃO versionado)
 * e funde em conteudo-mentor/<trilha>.json (texto puro, NÃO versionado).
 *
 * Formato do lote:
 *   { "trilha": "dbre", "topico": "shell",
 *     "modo": "anexar-blocos",            // ou "substituir-topico"
 *     "marcarRevisado": true,             // opcional
 *     "blocos": [ ... ] }                 // ou "topico": {...} no modo substituir
 *
 * Uso:  node tools/lote-mentor.mjs [arquivo-de-lote ...]
 *       sem argumento, aplica todos os *.json de _lote/ em ordem alfabética.
 *
 * Lotes aplicados são movidos para _lote/aplicados/ (idempotência: rodar
 * de novo não duplica). Depois de aplicar, o fluxo normal continua:
 *   MENTOR_SENHA=... node tools/build-mentor.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOTE = path.join(RAIZ, 'conteudo-mentor', '_lote');
const FEITOS = path.join(LOTE, 'aplicados');

const TIPOS = new Set(['texto', 'lista', 'terminal', 'passos', 'aviso', 'diagrama', 'imagem']);

function falhar(msg) { console.error(`ERRO: ${msg}`); process.exitCode = 1; }

const argv = process.argv.slice(2);
if (argv[0] === '--resumo' && argv[1]) {
  const dest = path.join(RAIZ, 'conteudo-mentor', `${argv[1]}.json`);
  const base = JSON.parse(fs.readFileSync(dest, 'utf8'));
  const ids = Object.keys(base.topicos);
  console.log(`trilha ${argv[1]}: ${ids.length} tópico(s)`);
  for (const id of ids) {
    const t = base.topicos[id];
    console.log(`  ${id}: ${(t.blocos || []).length} bloco(s)${t.revisado ? ' [revisado]' : ''}`);
  }
  process.exit(0);
}

if (argv[0] === '--estado' && argv[1] && argv[2] && argv[3]) {
  const dest = path.join(RAIZ, 'data', 'mentor-indice.json');
  const base = JSON.parse(fs.readFileSync(dest, 'utf8'));
  const trilha = base.trilhas.find(t => t.slug === argv[1]);
  if (!trilha) { console.error(`ERRO: trilha ${argv[1]} não encontrada`); process.exit(1); }
  const alvosE = argv[2].split(',').map(s => s.trim()).filter(Boolean);
  let n = 0;
  for (const m of trilha.modulos || []) for (const t of m.topicos || []) {
    if (alvosE.includes(t.id) && t.estado !== argv[3]) { t.estado = argv[3]; n++; }
  }
  fs.writeFileSync(dest, JSON.stringify(base, null, 1) + '\n');
  console.log(`índice: ${n} tópico(s) de ${argv[1]} -> ${argv[3]}`);
  process.exit(0);
}

const alvos = argv.filter(a => a !== '--resumo').map(a => path.resolve(a));
if (!alvos.length && !argv.includes('--resumo')) {
  alvos.push(...(fs.existsSync(LOTE) ? fs.readdirSync(LOTE).filter(f => f.endsWith('.json')).sort().map(f => path.join(LOTE, f)) : []));
}

if (!alvos.length) { console.error('ERRO: nenhum lote em conteudo-mentor/_lote/'); process.exit(1); }
fs.mkdirSync(FEITOS, { recursive: true });

let aplicados = 0;
for (const arq of alvos) {
  const nome = path.basename(arq);
  let lote, bruto = '';
  try { bruto = fs.readFileSync(arq, 'utf8'); lote = JSON.parse(bruto); }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const ctx = m ? ` | trecho: …${JSON.stringify(bruto.slice(Math.max(0, +m[1] - 80), +m[1] + 40))}…` : '';
    falhar(`${nome}: JSON inválido — ${e.message}${ctx}`); continue;
  }

  const { trilha, topico, modo } = lote;
  if (!trilha || !topico || !modo) { falhar(`${nome}: faltam trilha/topico/modo`); continue; }
  const dest = path.join(RAIZ, 'conteudo-mentor', `${trilha}.json`);
  if (!fs.existsSync(dest)) { falhar(`${nome}: trilha inexistente (${trilha}.json)`); continue; }

  let base;
  try { base = JSON.parse(fs.readFileSync(dest, 'utf8')); }
  catch (e) { falhar(`${nome}: base corrompida — ${e.message}`); continue; }
  if (!base.topicos || !base.topicos[topico]) { falhar(`${nome}: tópico inexistente (${trilha}/${topico})`); continue; }

  if (modo === 'anexar-blocos') {
    if (!Array.isArray(lote.blocos) || !lote.blocos.length) { falhar(`${nome}: blocos vazio`); continue; }
    for (const [i, b] of lote.blocos.entries()) {
      if (!b || !TIPOS.has(b.t)) { falhar(`${nome}: bloco ${i} com tipo inválido (${b && b.t})`); continue; }
    }
    base.topicos[topico].blocos.push(...lote.blocos);
  } else if (modo === 'substituir-topico') {
    if (!lote.topico || typeof lote.topico !== 'object') { falhar(`${nome}: campo topico ausente`); continue; }
    base.topicos[topico] = lote.topico;
  } else { falhar(`${nome}: modo desconhecido (${modo})`); continue; }

  if (lote.marcarRevisado) base.topicos[topico].revisado = true;

  fs.writeFileSync(dest, JSON.stringify(base));
  fs.renameSync(arq, path.join(FEITOS, nome));
  aplicados++;
  console.log(`  ${trilha}/${topico}: +${modo === 'anexar-blocos' ? lote.blocos.length : ' substitui'} bloco(s) -> ${nome} aplicado`);
}

console.log(aplicados ? `\n${aplicados} lote(s) aplicado(s). Próximo passo: MENTOR_SENHA=... node tools/build-mentor.mjs` : '\nnada aplicado.');
if (process.exitCode) process.exit(process.exitCode);
