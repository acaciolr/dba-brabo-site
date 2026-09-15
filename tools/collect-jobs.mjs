/* ==========================================================================
   DBA BRABO — coletor automático de vagas (roda no GitHub Actions)
   --------------------------------------------------------------------------
   Fontes (APIs públicas, SEM LinkedIn — sem API pública e scraping viola
   os termos de uso):
     1. Arbeitnow ........ grátis, sem chave  (api/job-board-api)
     2. Remotive ......... grátis, sem chave  (api/remote-jobs)
     3. Adzuna (BR) ...... OPCIONAL — exige ADZUNA_APP_ID + ADZUNA_APP_KEY
        (cadastro grátis em developer.adzuna.com; exige atribuição — os
        links salvos já são os redirect oficiais, que creditam a fonte)
     4. Jooble (BR) ....... OPCIONAL — exige JOOBLE_API_KEY
        (chave grátis em jooble.org; POST oficial, sem scraping)

   O que faz:
     1. Busca vagas com keywords de banco de dados em cada fonte;
     2. Classifica por área (oracle/sqlserver/postgresql/mysql/nosql/dbre/dados)
        com pontuação título+descrição (reduz falso positivo);
     3. Normaliza para o schema de data/jobs.json — SEMPRE com a URL oficial,
        descrição vira RESUMO de até 280 caracteres (nunca cópia integral);
     4. Mescla: mantém curadoria manual (itens sem "origem"), insere/atualiza
        as automáticas e aposenta as automáticas com +TTL_DIAS dias.

   Uso:
     node tools/collect-jobs.mjs                 coleta tudo e grava
     node tools/collect-jobs.mjs --dry-run       só mostra o resumo
     node tools/collect-jobs.mjs --only=remotive  só uma fonte
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JOBS_JSON = path.join(ROOT, 'data', 'jobs.json');
const TTL_DIAS = 45;
const SNIPPET_MAX = 280;
const UA = { 'User-Agent': 'DBA-Brabo-JobsBot/1.0 (+https://dbabrabo.com.br/vagas/)' };

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [];
}));
const DRY = args['dry-run'] === true || args['dry-run'] === 'true';
const ONLY = args.only ? String(args.only).split(',').map(s => s.trim().toLowerCase()) : null;

/* ---------------- classificação por área -------------------------------- */
const REGRAS_AREA = [
  ['oracle',     [/oracle/i, /exadata/i, /\brac\b/i, /data guard/i, /goldengate/i, /\boci\b/i, /pl[\/-]?sql/i]],
  ['sqlserver',  [/sql server/i, /\bt-?sql\b/i, /\bmssql\b/i, /always on/i, /\bssis\b|\bssrs\b|\bssas\b/i]],
  ['postgresql', [/postgres/i, /patroni/i, /timescale/i, /pgbackrest/i]],
  ['mysql',      [/mysql/i, /mariadb/i, /percona/i, /\baurora\b/i, /innodb/i, /group replication/i]],
  ['nosql',      [/mongodb/i, /\bredis\b/i, /cassandra/i, /dynamodb/i, /nosql/i, /couchbase/i, /elasticsearch/i, /opensearch/i, /cosmos db/i]],
  ['dbre',       [/dbre/i, /database reliability/i, /reliability engineer/i, /\bsre\b/i, /platform engineer/i]],
  ['dados',      [/analista de dados/i, /data analyst/i, /\banalytics?\b/i, /power ?bi/i, /tableau/i, /cientista de dados/i, /data scientist/i, /engenheir[oa] de dados/i, /data engineer/i, /\betl\b/i]],
];

/* Cargos que nunca são do público DBA/dados (só valem se o TÍTULO tiver
   hit de área). Ex.: "Assistant" contém "ssis" — o \b acima já resolve,
   mas React/QA/Sales nunca passam sem hit forte no título. */
const TITULO_NEGADO = /front-?end|react|angular|vue|svelte|mobile|\bios\b|android|flutter|designer|\bux\b|marketing|\bseo\b|sales|vendas|assistant|secretar|\bsupport\b|helpdesk|office\b|chef de produit|product manager|project manager|account manager|recrut|back-?end (developer|engineer)|\bqa\b|quality assurance/i;

/* título pesa 2, descrição/tags pesam 1. "DBA" no título dá +1 p/ toda área
   (ex.: "DBA Pleno" + Oracle na descrição = oracle). Aceita com >= 2;
   sem hit no título exige >= 3 (tira "menciona de passagem"). */
function classificar(titulo, texto) {
  const T = String(titulo || ''), D = String(texto || '');
  const bonusDBA = /\bdba\b/i.test(T) ? 1 : 0;
  let melhor = null;
  for (const [area, res] of REGRAS_AREA) {
    const ht = res.filter(r => r.test(T)).length;
    const hd = res.filter(r => r.test(D)).length;
    const score = ht * 2 + hd + (ht + hd > 0 ? bonusDBA : 0);
    if (score < 2) continue;
    if (ht === 0 && (score < 3 || TITULO_NEGADO.test(T))) continue;
    if (!melhor || score > melhor.score) melhor = { area, score };
  }
  return melhor ? melhor.area : null;
}

function senioridade(titulo) {
  const T = String(titulo || '');
  if (/est[aá]gi[oa]|intern/i.test(T)) return 'Estágio';
  if (/j[uú]nior|\bjunior\b|\bjr\b/i.test(T)) return 'Júnior';
  if (/\bpleno\b|\bmid\b/i.test(T)) return 'Pleno';
  if (/s[eê]nior|\bsenior\b|\bsr\b/i.test(T)) return 'Sênior';
  if (/especialista|specialist|\bstaff\b|principal|\blead\b/i.test(T)) return 'Especialista';
  return null;
}

function resumo(texto) {
  const limpo = String(texto || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo.length > SNIPPET_MAX ? limpo.slice(0, SNIPPET_MAX).trimEnd() + '…' : limpo;
}

function idEstavel(fonte, chave) {
  const h = crypto.createHash('sha1').update(String(chave).split('?')[0].toLowerCase()).digest('hex').slice(0, 10);
  return `auto-${fonte}-${h}`;
}

function isoData(v) {
  try {
    if (v == null) return new Date().toISOString().slice(0, 10);
    if (typeof v === 'number') return new Date(v * 1000).toISOString().slice(0, 10);
    return new Date(v).toISOString().slice(0, 10);
  } catch { return new Date().toISOString().slice(0, 10); }
}

async function getJSON(u) {
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${u} — HTTP ${r.status}`);
  return r.json();
}

async function postJSON(u, corpo) {
  const r = await fetch(u, {
    method: 'POST', headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`${u} — HTTP ${r.status}`);
  return r.json();
}

/* ---------------- fonte 1: Arbeitnow ------------------------------------ */
async function coletarArbeitnow() {
  const termos = ['Oracle DBA', 'MySQL DBA', 'PostgreSQL DBA', 'SQL Server DBA', 'DBRE', 'Database Engineer', 'Exadata', 'MongoDB DBA'];
  const out = [];
  let pagina = await getJSON('https://www.arbeitnow.com/api/job-board-api').catch(() => null);
  const itens = (pagina && pagina.data) || [];
  for (const v of itens) {
    const titulo = v.title || '', desc = `${v.description || ''} ${(v.tags || []).join(' ')}`;
    const area = classificar(titulo, desc);
    if (!area) continue;
    const remoto = !!v.remote || /remote/i.test(v.location || '') || (v.job_types || []).some(j => /remote/i.test(j));
    out.push({
      id: idEstavel('arbeitnow', v.url || v.slug),
      area, title: titulo, company: v.company_name || 'Empresa não informada',
      location: v.location || (remoto ? 'Remoto' : 'A combinar'),
      modality: remoto ? 'Remoto' : (/h[ií]brid/i.test(v.location || '') ? 'Híbrido' : 'Presencial'),
      remote: remoto, salary_min: null, salary_max: null, salary_currency: null,
      seniority: senioridade(titulo), technologies: (v.tags || []).slice(0, 6),
      published: isoData(v.created_at), description: resumo(v.description),
      url: v.url, origem: 'arbeitnow',
    });
  }
  return { fonte: 'arbeitnow', termos, vagas: out };
}

/* ---------------- fonte 2: Remotive (só remoto) -------------------------- */
async function coletarRemotive() {
  const termos = ['oracle dba', 'postgres dba', 'mysql dba', 'sql server dba', 'dbre', 'database engineer', 'mongodb'];
  const out = [], vistos = new Set();
  for (const q of termos) {
    const dados = await getJSON(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`)
      .catch(err => (console.error(`  ! remotive[${q}]: ${err.message}`), null));
    for (const v of (dados && dados.jobs) || []) {
      const titulo = v.title || '', desc = `${v.description || ''} ${(v.tags || []).join(' ')}`;
      const area = classificar(titulo, desc);
      if (!area) continue;
      const id = idEstavel('remotive', v.url || String(v.id));
      if (vistos.has(id)) continue;
      vistos.add(id);
      out.push({
        id, area, title: titulo, company: v.company_name || 'Empresa não informada',
        location: v.candidate_required_location || 'Remoto', modality: 'Remoto', remote: true,
        salary_min: null, salary_max: null, salary_currency: null,
        seniority: senioridade(titulo), technologies: (v.tags || []).slice(0, 6),
        published: isoData(v.publication_date), description: resumo(v.description),
        url: v.url, origem: 'remotive',
      });
    }
  }
  return { fonte: 'remotive', termos, vagas: out };
}

/* ---------------- fonte 3: Adzuna BR (opcional, com chave) --------------- */
async function coletarAdzuna() {
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return { fonte: 'adzuna', pulada: true, vagas: [] };
  const termos = ['Oracle DBA', 'MySQL DBA', 'PostgreSQL DBA', 'SQL Server DBA', 'DBRE', 'Database Engineer', 'Exadata', 'Analista de Dados'];
  const out = [], vistos = new Set();
  for (const q of termos) {
    const u = `https://api.adzuna.com/v1/api/jobs/br/search/1?app_id=${id}&app_key=${key}&results_per_page=50&sort_by=date&what=${encodeURIComponent(q)}`;
    const dados = await getJSON(u).catch(err => (console.error(`  ! adzuna[${q}]: ${err.message}`), null));
    for (const v of (dados && dados.results) || []) {
      const titulo = v.title || '', desc = v.description || '';
      const area = classificar(titulo, desc);
      if (!area) continue;
      const idv = idEstavel('adzuna', v.redirect_url || String(v.id));
      if (vistos.has(idv)) continue;
      vistos.add(idv);
      const remoto = /remot[oa]|home office/i.test(`${titulo} ${desc} ${v.location && v.location.display_name}`);
      out.push({
        id: idv, area, title: titulo, company: (v.company && v.company.display_name) || 'Empresa não informada',
        location: (v.location && v.location.display_name) || 'Brasil',
        modality: remoto ? 'Remoto' : 'A combinar', remote: remoto,
        salary_min: v.salary_min ?? null, salary_max: v.salary_max ?? null,
        salary_currency: (v.salary_min ?? v.salary_max) != null ? 'BRL' : null,
        seniority: senioridade(titulo), technologies: [],
        published: isoData(v.created), description: resumo(desc),
        url: v.redirect_url, origem: 'adzuna',
      });
    }
  }
  return { fonte: 'adzuna', termos, vagas: out };
}

/* ---------------- fonte 4: Jooble BR (opcional, com chave) --------------- */
/* API oficial (POST jooble.org/api/{key}). Salário vem em texto livre
   ("R$ 5.000 - R$ 7.000") — extrai números quando dá, senão null. */
function salarioJooble(txt) {
  const nums = [...String(txt || '').matchAll(/R\$\s*([\d.]+)/g)]
    .map(m => parseInt(m[1].replace(/\./g, ''), 10)).filter(n => n > 0);
  if (!nums.length) return { min: null, max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

async function coletarJooble() {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return { fonte: 'jooble', pulada: true, vagas: [] };
  const termos = ['Oracle DBA', 'DBA Oracle', 'MySQL DBA', 'PostgreSQL DBA', 'DBA PostgreSQL',
    'SQL Server DBA', 'DBA SQL Server', 'MongoDB DBA', 'DBRE', 'Database Engineer',
    'Exadata', 'Administrador de Banco de Dados', 'Analista de Dados SQL'];
  const out = [], vistos = new Set();
  for (const q of termos) {
    const dados = await postJSON(`https://jooble.org/api/${key}`, { keywords: q, location: 'Brazil' })
      .catch(err => (console.error(`  ! jooble[${q}]: ${err.message}`), null));
    for (const v of (dados && dados.jobs) || []) {
      const titulo = (v.title || '').replace(/<[^>]*>/g, ' ').trim();
      const desc = `${v.snippet || ''} ${v.company || ''}`;
      const area = classificar(titulo, desc);
      if (!area) continue;
      const id = idEstavel('jooble', v.link || `${v.company}-${titulo}`);
      if (vistos.has(id)) continue;
      vistos.add(id);
      const sal = salarioJooble(v.salary);
      const remoto = /remot[oa]|home office/i.test(`${titulo} ${v.snippet || ''} ${v.location || ''}`);
      out.push({
        id, area, title: titulo, company: (v.company || '').trim() || 'Empresa não informada',
        location: (v.location || '').trim() || 'Brasil',
        modality: remoto ? 'Remoto' : 'A combinar', remote: remoto,
        salary_min: sal.min, salary_max: sal.max,
        salary_currency: (sal.min ?? sal.max) != null ? 'BRL' : null,
        seniority: senioridade(titulo), technologies: [],
        published: isoData(v.updated), description: resumo(v.snippet),
        url: v.link, origem: 'jooble',
      });
    }
  }
  return { fonte: 'jooble', termos, vagas: out };
}

/* ---------------- mescla + gravação -------------------------------------- */
function mesclar(base, novas) {
  const mapa = new Map(novas.map(j => [j.id, j]));
  const manuais = (base.jobs || []).filter(j => !j.origem);
  const idsManuais = new Set();
  for (const m of manuais) {
    // Curadoria manual tem prioridade: remove automática duplicada (mesma URL).
    for (const [id, a] of mapa) {
      if (a.url && m.url && a.url.split('?')[0].toLowerCase() === m.url.split('?')[0].toLowerCase()) {
        mapa.delete(id);
      }
    }
    idsManuais.add(m.id);
  }
  const corte = Date.now() - TTL_DIAS * 864e5;
  const antigas = (base.jobs || []).filter(j =>
    j.origem && !mapa.has(j.id) && !idsManuais.has(j.id) && new Date(`${j.published}T12:00:00`).getTime() >= corte);
  const jobs = [...manuais, ...mapa.values(), ...antigas]
    .sort((a, b) => String(b.published).localeCompare(String(a.published)));
  return { ...base, jobs };
}

async function main() {
  const coletores = { arbeitnow: coletarArbeitnow, remotive: coletarRemotive, adzuna: coletarAdzuna, jooble: coletarJooble };
  const quais = ONLY ? Object.keys(coletores).filter(k => ONLY.includes(k)) : Object.keys(coletores);
  console.log(`coletando: ${quais.join(', ')}${DRY ? ' (dry-run)' : ''}`);
  let todas = [];
  for (const nome of quais) {
    try {
      const r = await coletores[nome]();
      if (r.pulada) { console.log(`  - ${nome}: pulada (sem chave)`); continue; }
      console.log(`  - ${nome}: ${r.vagas.length} vagas (termos: ${r.termos.length})`);
      todas.push(...r.vagas);
    } catch (err) { console.error(`  ! ${nome}: ${err.message}`); }
  }
  // Deduplica entre fontes pela URL canônica.
  const seen = new Set();
  todas = todas.filter(j => {
    const k = String(j.url || '').split('?')[0].toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const porArea = {};
  for (const j of todas) porArea[j.area] = (porArea[j.area] || 0) + 1;
  console.log(`total após filtro+dedupe: ${todas.length} ${JSON.stringify(porArea)}`);
  if (args.show) {
    for (const j of todas) console.log(`  [${j.area}] ${j.title} — ${j.company} (${j.origem})`);
  }

  const base = JSON.parse(fs.readFileSync(JOBS_JSON, 'utf8'));
  const antes = (base.jobs || []).length;
  const final = mesclar(base, todas);
  console.log(`jobs.json: ${antes} → ${final.jobs.length} (manuais: ${final.jobs.filter(j => !j.origem).length})`);
  if (DRY) { console.log('dry-run: nada foi escrito'); return; }
  fs.writeFileSync(JOBS_JSON, JSON.stringify(final, null, 2) + '\n');
  console.log('jobs.json atualizado');
}

main().catch(err => { console.error('FALHA:', err.message); process.exit(1); });
