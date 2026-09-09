#!/usr/bin/env node
/**
 * DBA BRABO — cifragem do material de apoio ao mentor.
 *
 * LE   conteudo-mentor/<trilha>.json   (texto puro, NAO versionado)
 * GERA data/mentor/<trilha>.enc        (cifrado, versionado)
 *
 * A senha NUNCA fica no codigo. Ela vem do ambiente:
 *
 *   PowerShell:  $env:MENTOR_SENHA="..."; node tools/build-mentor.mjs
 *   bash:        MENTOR_SENHA='...' node tools/build-mentor.mjs
 *
 * O arquivo .enc e um envelope JSON com os parametros de derivacao — o
 * navegador precisa deles para decifrar, e expo-los nao enfraquece nada:
 * a seguranca esta na senha e no custo do PBKDF2, nunca no segredo do metodo.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/* fileURLToPath e obrigatorio: caminho com espaco ("DBA BRABO PORTAL") vira
   %20 em import.meta.url e quebra qualquer manipulacao manual de string. */
const RAIZ    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM  = path.join(RAIZ, 'conteudo-mentor');
const DESTINO = path.join(RAIZ, 'data', 'mentor');

const ITER = 600000;          // custo do ataque offline; o .enc e publico
const SAL  = 16;
const IV   = 12;              // AES-GCM

const senha = process.env.MENTOR_SENHA;
if (!senha) {
  console.error('ERRO: defina MENTOR_SENHA no ambiente. A senha nao fica no codigo.');
  process.exit(1);
}
if (senha.length < 12) {
  console.error('ERRO: senha curta demais. O arquivo cifrado fica publico e sofre ataque offline.');
  process.exit(1);
}

function cifrar(textoPuro) {
  const sal = crypto.randomBytes(SAL);
  const iv  = crypto.randomBytes(IV);
  const chave = crypto.pbkdf2Sync(senha, sal, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const ct = Buffer.concat([c.update(textoPuro, 'utf8'), c.final()]);
  return {
    v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, cifra: 'AES-256-GCM',
    sal: sal.toString('base64'),
    iv:  iv.toString('base64'),
    ct:  Buffer.concat([ct, c.getAuthTag()]).toString('base64')
  };
}

if (!fs.existsSync(ORIGEM)) {
  console.error(`ERRO: pasta ${path.relative(RAIZ, ORIGEM)} nao existe.`);
  process.exit(1);
}
fs.mkdirSync(DESTINO, { recursive: true });

const arquivos = fs.readdirSync(ORIGEM).filter(f => f.endsWith('.json'));
if (!arquivos.length) { console.error('ERRO: nenhum .json em conteudo-mentor/'); process.exit(1); }

/* Sentinela de verificacao: e o unico arquivo que a tela de acesso decifra para
   dizer "senha certa". Nao guarda conteudo — so prova que a chave bate. */
fs.writeFileSync(path.join(DESTINO, '_verificacao.enc'),
  JSON.stringify(cifrar(JSON.stringify({ ok: true, em: new Date().toISOString() }))));

let total = 0;
const publicadas = [];
for (const f of arquivos) {
  const bruto = fs.readFileSync(path.join(ORIGEM, f), 'utf8');
  try { JSON.parse(bruto); } catch (e) {
    console.error(`ERRO: ${f} nao e JSON valido — ${e.message}`); process.exit(1);
  }
  const env = cifrar(bruto);
  const saida = path.join(DESTINO, f.replace(/\.json$/, '.enc'));
  fs.writeFileSync(saida, JSON.stringify(env));
  const kb = (fs.statSync(saida).size / 1024).toFixed(1);
  console.log(`  ${path.relative(RAIZ, saida)}  ${kb} KB  (de ${(bruto.length/1024).toFixed(1)} KB)`);
  publicadas.push(f.replace(/\.json$/, ''));
  total++;
}

/* Lista publica de trilhas com material — a area do mentor usa para nao pedir
   um .enc que nao existe. So nomes de trilha; nenhum conteudo. */
fs.writeFileSync(path.join(DESTINO, '_disponiveis.json'),
  JSON.stringify({ gerado: new Date().toISOString().slice(0, 10), trilhas: publicadas }, null, 2));

/* Guarda: texto puro nunca pode ter escapado para o repositorio. */
const gi = fs.existsSync(path.join(RAIZ, '.gitignore'))
  ? fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8') : '';
if (!gi.includes('conteudo-mentor/')) {
  console.error('\nPARE: conteudo-mentor/ nao esta no .gitignore. O texto puro iria para o repositorio publico.');
  process.exit(1);
}

console.log(`\n${total} trilha(s) cifrada(s) — PBKDF2 ${ITER.toLocaleString('pt-BR')} iteracoes, AES-256-GCM.`);
