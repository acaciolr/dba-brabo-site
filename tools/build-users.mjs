#!/usr/bin/env node
/**
 * DBA BRABO — emite data/mentor/_users.json (PUBLICO, sem segredo reversível).
 *
 * Entrada (NUNCA em arquivo — só ambiente):
 *   USERS_JSON='{"dbabrabo":{"password":"...","trilhas":["*"]}, ...}'
 *   MENTOR_SENHA='...'   (a mesma do build-mentor)
 *
 * Para cada usuário: KEK = PBKDF2(senha, sal) embrulha, via AES-GCM, a chave
 * de dados de CADA trilha autorizada + uma sonda ("dbabrabo-ok"). O navegador
 * desembrulha com a senha digitada: senha errada = GCM falha, sem texto claro.
 * Trilha NÃO listada = chave ausente = conteúdo indecifrável, mesmo com devtools.
 *
 * No fim o script SE AUTOVERIFICA: desembrulha tudo, decifra cada .enc
 * autorizado por inteiro e testa negativas (senha errada, trilha proibida).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chaveTrilha, kekUsuario, embrulhar, ITER } from './chaves.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const senhaMestra = process.env.MENTOR_SENHA;
let USERS;
try { USERS = JSON.parse(process.env.USERS_JSON || 'null'); } catch { USERS = null; }
if (!senhaMestra || senhaMestra.length < 12) { console.error('ERRO: MENTOR_SENHA ausente/curta.'); process.exit(1); }
if (!USERS || !Object.keys(USERS).length) { console.error('ERRO: USERS_JSON ausente/vazio.'); process.exit(1); }

/* Trilhas válidas = o que existe cifrado em data/mentor (+ en/). */
const validas = new Set([
  ...fs.readdirSync(path.join(RAIZ, 'data', 'mentor')).filter(f => f.endsWith('.enc') && !f.startsWith('_')).map(f => f.slice(0, -4)),
]);
const out = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, users: {} };
for (const [nome, u] of Object.entries(USERS)) {
  if (!u.password || u.password.length < 8) { console.error(`ERRO: senha fraca/ausente p/ ${nome}.`); process.exit(1); }
  const trilhas = u.trilhas.includes('*')
    ? [...validas]
    : u.trilhas.filter(t => { if (!validas.has(t)) { console.error(`ERRO: trilha inexistente "${t}" p/ ${nome}.`); process.exit(1); } return true; });
  const sal = crypto.randomBytes(16);
  const kek = kekUsuario(u.password, sal);
  const wraps = {};
  for (const slug of trilhas) {
    const w = embrulhar(chaveTrilha(senhaMestra, slug), kek);
    wraps[slug] = w;
  }
  const sonda = embrulhar(Buffer.from('dbabrabo-ok', 'utf8'), kek);
  out.users[nome] = { trilhas, sal: sal.toString('base64'), sonda, wraps };
}

fs.writeFileSync(path.join(RAIZ, 'data', 'mentor', '_users.json'), JSON.stringify(out));

/* ---------- autoverificação ---------- */
function desembrulhar(w, kek) {
  const raw = Buffer.from(w.ct, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(w.iv, 'base64'));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]);
}
function decifrarEnc(slug, chave) {
  const env = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'mentor', slug + '.enc'), 'utf8'));
  return desembrulhar({ iv: env.iv, ct: env.ct }, chave).toString('utf8');
}
let ok = 0;
for (const [nome, u] of Object.entries(USERS)) {
  const pub = out.users[nome];
  const kek = kekUsuario(u.password, Buffer.from(pub.sal, 'base64'));
  if (desembrulhar(pub.sonda, kek).toString() !== 'dbabrabo-ok') { console.error(`FALHA sonda ${nome}`); process.exit(1); }
  for (const slug of pub.trilhas) {
    const chave = desembrulhar(pub.wraps[slug], kek);
    const bruto = decifrarEnc(slug, chave);
    const tops = Object.keys(JSON.parse(bruto).topicos).length;
    if (!tops) { console.error(`FALHA vazio ${nome}/${slug}`); process.exit(1); }
    ok++;
  }
  // negativa 1: senha errada não abre a sonda
  try {
    desembrulhar(pub.sonda, kekUsuario(u.password + 'x', Buffer.from(pub.sal, 'base64')));
    console.error(`FALHA negativa-senha ${nome}`); process.exit(1);
  } catch {}
  // negativa 2: trilha proibida não tem embrulho
  const proibida = [...validas].find(s => !pub.trilhas.includes(s));
  if (proibida && pub.wraps[proibida]) { console.error(`FALHA negativa-trilha ${nome}`); process.exit(1); }
}
console.log(`_users.json OK — ${Object.keys(USERS).length} usuário(s), ${ok} decifragem(ns) verificada(s), negativas OK.`);
