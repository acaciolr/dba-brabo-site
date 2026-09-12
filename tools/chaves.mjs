/**
 * DBA BRABO — derivação de chaves do mentor (módulo compartilhado).
 *
 * UMA senha mestra (MENTOR_SENHA, só no ambiente) gera UMA chave de dados
 * por trilha. Cada usuário recebe, embrulhadas com a PRÓPRIA senha, apenas
 * as chaves das trilhas que pode ver (tools/build-users.mjs).
 *
 * Parâmetros espelhados no leitor (mentor/mentor.js importa chaves crus via
 * Web Crypto — nunca a senha mestra). Mudar qualquer constante aqui exige
 * re-cifrar TUDO e republicar _users.json.
 */
import crypto from 'node:crypto';

export const ITER = 600000;          // PBKDF2-SHA256, mesmo custo do .enc atual
export const TAG_VERSAO = 'dbabrabo:v1:';

/* Chave de dados de UMA trilha (32 bytes). Determinística por slug para que
   build-mentor e build-users cheguem ao mesmo valor sem trocar segredo. */
export function chaveTrilha(senha, slug) {
  if (!senha || senha.length < 12) throw new Error('senha mestra curta demais');
  return crypto.pbkdf2Sync(senha, TAG_VERSAO + slug, ITER, 32, 'sha256');
}

/* KEK de UM usuário (embrulha/desembrulha chaves de trilha). Sal aleatório
   por usuário, guardado em _users.json junto ao embrulho. */
export function kekUsuario(senhaUser, sal) {
  return crypto.pbkdf2Sync(senhaUser, sal, ITER, 32, 'sha256');
}

export function embrulhar(chaveDados, kek) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const ct = Buffer.concat([c.update(chaveDados), c.final(), c.getAuthTag()]);
  return { iv: iv.toString('base64'), ct: ct.toString('base64') };
}
