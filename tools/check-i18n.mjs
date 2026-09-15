/* DBA BRABO — cobertura i18n: toda chave t()/T()/data-i18n/EcoT precisa
   existir em data/i18n.json → pt. Roda sozinho ou via tools/build.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function verificarI18n(rootDir) {
  const R = f => fs.readFileSync(path.join(rootDir, f), 'utf8');
  const dict = JSON.parse(R('data/i18n.json'));
  const get = (o, k) => String(k).split('.').reduce((a, p) => (a && a[p] != null ? a[p] : null), o);
  const has = k => get(dict.pt, k) !== null && get(dict.pt, k) !== undefined;
  const faltando = [];
  const scan = (src, fname, re, prefix) => {
    for (const m of src.matchAll(re)) { if (!has(prefix + m[1])) faltando.push(fname + ' :: ' + prefix + m[1]); }
  };
  scan(R('script.js'), 'script.js', /[^A-Za-z0-9_.]t\('([^']+)'\)/g, '');
  scan(R('mentor/mentor.js'), 'mentor.js', /\bT\('([^']+)'/g, '');
  for (const f of ['index.html', 'mentor/index.html', 'ecosistema/aluno/index.html']) {
    const h = R(f);
    scan(h, f, /data-i18n="([^"]+)"/g, '');
    scan(h, f, /data-i18n-ph="([^"]+)"/g, '');
    scan(h, f, /data-i18n-aria="([^"]+)"/g, '');
    scan(h, f, /data-i18n-title="([^"]+)"/g, '');
    scan(h, f, /data-i18n-meta="([^"]+)"/g, '');
  }
  scan(R('tools/build.mjs'), 'build.mjs', /data-i18n(?:-ph|-aria|-title|-meta)?="([^"]+)"/g, '');
  for (const f of ['ecosistema/aluno/index.html', 'ecosistema/js/auth.js']) {
    for (const m of R(f).matchAll(/EcoT\('([^']+)'\)/g)) { if (!has('aluno.' + m[1])) faltando.push(f + ' :: aluno.' + m[1]); }
  }
  return [...new Set(faltando)];
}

const aqui = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const faltas = verificarI18n(path.dirname(aqui));
  if (faltas.length) { console.error('I18N FALHOU:'); faltas.forEach(f => console.error('  ! ' + f)); process.exit(1); }
  console.log('i18n OK — todas as chaves existem em pt');
}
