# Migração GitHub Pages → Servidor de Aplicação (com Banco de Dados)

> **Para:** Claude (ou qualquer engenheiro/IA executora) — documento-fonte da migração.
> **Leitura obrigatória antes de qualquer comando.** Não pule a §1 (retrato atual):
> quase todo erro de migração nasce de presumir algo que o projeto não é.
> **Modo de execução:** por fases (§8), com checkpoint e aceite ao fim de cada
> fase. Em dúvida entre duas interpretações, **pare e pergunte ao dono**
> em vez de adivinhar — este documento marca essas decisões com **[DECIDIR]**.

---

## 0. Objetivo e resultado esperado

Tirar o Portal DBA BRABO do GitHub Pages (site 100% estático) e colocar num
**servidor de aplicação com banco de dados**, mantendo **tudo que o usuário vê
idêntico** (mesmo HTML/CSS/URLs), e destravando o que hoje é impossível no
estático:

1. Login de verdade (sessão no servidor) para mentor e aluno;
2. Cadastro de alunos multi-mentor com base única (fim do localStorage-ilha);
3. Gate de acesso aplicado no servidor (não só UX no navegador);
4. Coleta de vagas, expiração e inadimplência rodando em cron confiável;
5. Backups, auditoria e conformidade LGPD de verdade.

**Fora de escopo desta migração:** reescrever o front (frameworks), mudar
identidade visual, player de vídeo próprio, gateway de pagamento, app mobile.

---

## 1. Retrato fiel do sistema atual (NÃO presuma — leia)

### 1.1 Stack e hospedagem
- Front **estático puro**: HTML5 + CSS3 + JS vanilla (ES6, sem build de JS,
  sem React/Vue, sem npm no front). Deploy via **GitHub Actions → GitHub Pages**.
- Repositório: `acaciolr/dba-brabo-site`, branch `main`. Repo **público**.
- Domínio: `dbabrabo.com.br` / `www.dbabrabo.com.br` (ver
  `docs/dominio-proprio.md`; existe arquivo `CNAME` na raiz — **não apagar
  até o cutover**). Origem canônica em `data/site.json`.
- Workflows: `.github/workflows/deploy.yml` (valida → `node tools/build.mjs`
  → publica no Pages) e `.github/workflows/update_jobs.yml` (coleta de vagas;
  **pausado** — página `/vagas/` desativada, arquivos mantidos).

### 1.2 Estrutura (o que é o quê)
```
index.html                → portal (home, ancora #secao)
mentorias/*/              → 19 páginas GERADAS por tools/build.mjs (NÃO editar à mão)
vagas/                    → DESATIVADA (arquivos mantidos p/ o futuro)
mentor/                   → área do mentor (login + trilhas + cadastro de alunos)
mentor.css / style.css    → visual (tokens em :root)
ecosistema/               → área do aluno: aluno/ (login), hub, oracle|mysql|
                            sqlserver|postgresql|mongodb/, terminal, vm-manager… (mocks Fase 1)
data/*.json               → conteúdo do portal (site, mentorias, projetos…)
data/*-en.json            → espelhos em inglês
data/i18n.json            → dicionário PT/EN (chrome da UI)
data/mentor/*.enc         → conteúdo do mentor CIFRADO (AES-256-GCM)
data/mentor/_users.json   → login do mentor: trilhas + wraps (SEM senha)
ecosistema/json/alunos.json → login do aluno: user + hash + labs (SEM CPF)
tools/build.mjs           → gerador das páginas + sitemap + robots + search-index
tools/build-mentor.mjs + build-users.mjs + chaves.mjs → pipeline de cifra
tools/collect-jobs.mjs    → coletor de vagas (Arbeitnow/Remotive/Adzuna/Jooble)
tools/build-alunos.mjs    → registry local → ecosistema/json/alunos.json
```

### 1.3 Modelo de autenticação atual (crítico entender)
| Área | Mecanismo | Onde valida | Nível real |
|---|---|---|---|
| Mentor | usuário + senha → PBKDF2-SHA256 **600.000 iterações** → KEK desembrulha chaves AES-256-GCM por trilha (`data/mentor/_users.json`: `{sal, sonda, wraps}`) | navegador | **Criptográfico de verdade** (senha errada = GCM falha) |
| Aluno (master) | SHA-256 de `"usuario:senha"` comparado no JS | navegador | Trava de UX |
| Aluno (matrícula) | SHA-256 de `"email:senha"` vs `ecosistema/json/alunos.json` → sessão `sessionStorage` `{u, nome, labs, tipo}` | navegador | Trava de UX + filtro de labs |
| Labs | `EcoAuth.exigirLogin(url, lab)` no `<head>`; hub esconde cards; terminal deduz lab pelo prefixo da VM; vm-manager só admin | navegador | Trava de UX |

Detalhes que **devem ser preservados ou migrados com cuidado**:
- Senhas **nunca** estão no repo (só hashes/wraps). `conteudo-mentor/` (texto puro)
  está no `.gitignore` — **nunca commitar**.
- Sessão do aluno morre ao fechar a aba (`sessionStorage`).
- `data/mentor/_users.json` usa `trilhas: [...]` por usuário; `ecosistema/json/users.json`
  é legado (só master).
- Mapa mentoria→labs (duplicado e documentado em `mentor/alunos.js` e
  `tools/build-alunos.mjs`): `oracle|mysql|sqlserver|postgresql|mongodb` →
  próprio lab; `sql-master` → mysql+postgresql; demais → só hub.
- Registry de alunos vive em `localStorage` (`dbabrabo.alunos.v1`), um registro
  **por venda** (mesmo e-mail pode ter N mentorias; login libera a união dos labs).
- i18n PT/EN via `data/i18n.json` + `tools/check-i18n.mjs` (trava o build se
  faltar chave PT). Detecção automática por `navigator.languages` + `?lang=`.

### 1.4 Dados sensíveis — onde estão HOJE
- **No repo (público): NÃO HÁ** CPF, senha ou financeiro. Só hashes SHA-256 e
  blobs AES-GCM. **Manter assim até o cutover.**
- **Fora do repo:** registry de alunos no navegador do dono (`localStorage`) e
  exports `alunos-export*.json` ( `.gitignore`). Na migração, importar via
  canal seguro e **apagar os arquivos locais após confirmação**.

---

## 2. Arquitetura alvo (recomendada — seguir salvo [DECIDIR])

```
                    ┌──────────── Caddy (TLS auto + proxy) ────────────┐
Internet ──HTTPS──▶ │  /              → front estático (mesmo build)    │
                    │  /api/*         → api:3000 (Node 20)              │
                    │  /api/admin/*   → + IP allowlist (opcional fase 1)│
                    └──────────────┬───────────────────┬───────────────┘
                                   │                   │ volume ./data
                        ┌──────────▼─────┐   ┌─────────▼────────┐
                        │  api (Docker)  │──▶│ SQLite (WAL)     │
                        │  Node + Fastify│   │ + Litestream →   │
                        │  + cron interno│   │   B2/R2 (tempo   │
                        └────────────────┘   │   real) + dump   │
                                             │   diário local   │
                                             └──────────────────┘
```

- **VPS:** Hetzner CX22 (2 vCPU/4 GB) ou DigitalOcean equivalente. Uma máquina
  basta para o horizonte de 12 meses (tráfego atual é institucional + áreas
  logadas de baixo volume).
- **Banco: SQLite (WAL) logo de cara.** Motivo: volume baixo, zero operação,
  backup trivial, e o DDL da §4 já nasce compatível. **Migrar para Postgres
  quando:** >5 conexões de escrita concorrente sustentada, ou necessidade de
  replicação de leitura, ou exigência contratual. **[DECIDIR]** se o dono
  prefere já nascer em Postgres (custo: +operacão; benefício: nunca migrar).
- **Front:** continuar servindo o **mesmo build estático** (`tools/build.mjs`
  segue gerando as páginas). O JS troca `fetch('data/*.json')` por
  `fetch('/api/...')` **por endpoint, sem reescrever telas**. Interface
  `EcoAuth { estaLogado, exigirLogin, entrar, sair }` **mantida** —
  reimplementada sobre a API (quase zero mudança nas páginas).
- **Conteúdo cifrado do mentor: NÃO decifrar no servidor.** Manter `.enc`
  estático e entregar os `wraps` por usuário via API autenticada (o navegador
  segue desembrulhando com a senha, como hoje). Troca-se `build-users.mjs`
  pontual por emissão de wraps no cadastro — sem reescrever a cripto.
- Alternativa legítima (se o dono quiser zero VPS): Cloudflare Workers + D1
  (SQLite serverless). Este documento assume VPS por ser o pedido ("servidor
  de aplicação mesmo"); a §4 (DDL) vale para os dois.

---

## 3. Inventário de segredos (criar na implantação — nunca no repo)
`SESSION_SECRET` (≥32 bytes), `MENTOR_SENHA` (a mesma do build atual),
`USERS_JSON` (para reemitir wraps, se optar pela §7.3), credenciais B2/R2
(Litestream), `ADZUNA_*` + `JOOBLE_API_KEY` (se reativar vagas),
SMTP transacional (convites/reset de senha — **[DECIDIR]** provedor:
Resend/SES/SMTP próprio), `ADMIN_IP_ALLOWLIST` (opcional).

---

## 4. Banco de dados — DDL alvo (SQLite; vale p/ Postgres com ajustes mínimos)

```sql
PRAGMA journal_mode = WAL;

CREATE TABLE mentores (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL, -- argon2id (NUNCA sha256 simples no servidor)
  papel TEXT NOT NULL DEFAULT 'mentor' CHECK (papel IN ('admin','mentor')),
  ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
);

CREATE TABLE alunos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL, cpf TEXT NOT NULL UNIQUE, -- só dígitos
  email TEXT NOT NULL, telefone TEXT, data_nascimento TEXT,
  origem TEXT, status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','pausado','concluido','inativo')),
  mentor_id TEXT REFERENCES mentores(id),
  observacoes TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_alunos_email ON alunos(email);

CREATE TABLE mentorias (
  slug TEXT PRIMARY KEY, nome TEXT NOT NULL, ativa INTEGER NOT NULL DEFAULT 1
);
-- seed com os slugs de data/mentor-indice.json + mapa de labs:
CREATE TABLE mentoria_labs (
  mentoria_slug TEXT REFERENCES mentorias(slug), lab TEXT NOT NULL,
  PRIMARY KEY (mentoria_slug, lab)
);

CREATE TABLE matriculas (
  id TEXT PRIMARY KEY, aluno_id TEXT NOT NULL REFERENCES alunos(id),
  mentoria_slug TEXT NOT NULL REFERENCES mentorias(slug),
  data_contrato TEXT NOT NULL, data_inicio TEXT, data_fim_prevista TEXT,
  valor_cheio REAL NOT NULL CHECK (valor_cheio >= 0),
  tem_desconto INTEGER NOT NULL DEFAULT 0 CHECK (tem_desconto IN (0,1)),
  desconto_valor REAL NOT NULL DEFAULT 0 CHECK (desconto_valor >= 0),
  valor_final REAL NOT NULL,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('Pix','Cartão','Boleto','Transferência')),
  parcelas INTEGER NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 36),
  status_pagamento TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente','parcial','quitado','inadimplente')),
  status_curso TEXT NOT NULL DEFAULT 'nao_iniciado',
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
  UNIQUE (aluno_id, mentoria_slug)
);

-- Regra de negócio blindada no banco (era validação JS; agora é lei):
CREATE TRIGGER trg_matricula_valor BEFORE INSERT ON matriculas BEGIN
  SELECT CASE WHEN NEW.tem_desconto = 0 AND NEW.desconto_valor <> 0
    THEN RAISE(ABORT, 'desconto_valor deve ser 0 sem desconto') END;
  SELECT CASE WHEN NEW.desconto_valor > NEW.valor_cheio
    THEN RAISE(ABORT, 'desconto maior que o valor') END;
END;
-- valor_final via trigger complementar ou GENERATED ALWAYS AS
-- (valor_cheio - desconto_valor) STORED (preferir GENERATED no Postgres).

CREATE TABLE pagamentos ( -- fase 2 (parcelas); criar já, usar depois
  id TEXT PRIMARY KEY, matricula_id TEXT NOT NULL REFERENCES matriculas(id),
  n INTEGER NOT NULL, vencimento TEXT NOT NULL, valor REAL NOT NULL,
  pago_em TEXT, meio TEXT, comprovante_ref TEXT,
  UNIQUE (matricula_id, n)
);

CREATE TABLE sessoes (
  id TEXT PRIMARY KEY, usuario_tipo TEXT NOT NULL, usuario_id TEXT NOT NULL,
  expira_em TEXT NOT NULL, criado_em TEXT NOT NULL
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT NOT NULL,
  ator_tipo TEXT, ator_id TEXT, acao TEXT NOT NULL, detalhe TEXT
);

CREATE VIEW vw_receita_mensal AS
  SELECT substr(data_contrato,1,7) AS mes,
         SUM(CASE WHEN status_pagamento='quitado' THEN valor_final ELSE 0 END) AS recebido,
         SUM(CASE WHEN status_pagamento IN ('pendente','parcial','inadimplente') THEN valor_final ELSE 0 END) AS a_receber
  FROM matriculas GROUP BY 1;
CREATE VIEW vw_inadimplencia AS
  SELECT m.id, a.nome, a.email, a.telefone, m.valor_final, m.data_contrato
  FROM matriculas m JOIN alunos a ON a.id = m.aluno_id
  WHERE m.status_pagamento = 'inadimplente';
```

---

## 5. Migração de dados (ordem exata)

1. **Conteúdo público** (`data/*.json`, mentorias, i18n): continua estático no
   primeiro momento — **não migrar para o banco na fase 1** (só adiciona risco).
2. **Mentorias + mapa de labs:** seed de `mentorias`/`mentoria_labs` (§4) a
   partir de `data/mentor-indice.json` + mapa de `tools/build-alunos.mjs`.
3. **Alunos:** importar do export do registry (`alunos-export*.json`, via canal
   seguro). CPF/e-mail/telefone vão para `alunos`; cada registro vira 1
   `matriculas`. **Atenção:** `senha_hash` SHA-256 **não é reutilizável** como
   credencial de servidor (sem salt dedicado e com algoritmo inadequado).
   → **Todo aluno redefine a senha no primeiro acesso** via fluxo de convite:
   API gera token único por e-mail → link `/primeiro-acesso?token=` → define
   senha (argon2id) → token queimado. **Nunca enviar senha por e-mail.**
4. **Mentores:** recriar `dbabrabo` (admin) + demais com senhas novas; trilhas
   por usuário conforme `data/mentor/_users.json` (só a lista `trilhas`, jamais
   chaves).
5. **Apagar** os arquivos locais de export após conferência (e esvaziar lixeira).

---

## 6. Autenticação e autorização (novo modelo)

- Sessão opaca em cookie `HttpOnly; Secure; SameSite=Lax` (tabela `sessoes`,
  expiração deslizante 12h; área do aluno pode ter 30 dias com "lembrar").
  **Não usar JWT stateless** (revogação vira problema sem ganho aqui).
- Argon2id para senhas (servidor). Rate limit no `/api/login` (5 tentativas/
  15 min por IP+e-mail) + log em `audit_log`.
- Matriz de acesso (aplicada **no servidor por endpoint**, o JS só reflete):
  - `admin`: tudo (alunos, matrículas, wraps de todas as trilhas, vm-manager);
  - `mentor`: próprios alunos + matrícula/desconto + wraps das trilhas que ministra;
  - `aluno`: próprios dados + labs das matrículas **ativas** (união).
- `EcoAuth` do front vira fachada sobre `/api/sessao`, `/api/login`,
  `/api/logout` — **assinatura mantida**, páginas quase intactas.
- Senha do mentor continua sendo a chave dos wraps (modelo §7.3) — a senha da
  **sessão** e a senha da **cifra** podem coincidir na UX (um login só), com
  KDFs separadas no servidor.

## 7. O que muda no front (cirúrgico, não reescrever)
1. `ecosistema/js/auth.js`: mesma API, agora com `fetch('/api/...')`.
2. Hub e labs: filtro de cards continua, mas a **verdade vem da sessão**
   (`/api/sessao` → labs); `vm-manager`/terminal passam a validar no servidor
   (terminal real por VM só existe com backend — hoje é mock).
3. Registry de alunos (`mentor/alunos.js`): troca o `localStorage` por
   `fetch('/api/alunos')` **atrás da mesma interface** (foi desenhado para isso).
   CPF passa a ser validado também no servidor (endpoint dedicado, sem expor
   a base).
4. Coletor de vagas vira cron do servidor (mesmo `collect-jobs.mjs`, saída para
   tabela em vez de JSON) — reativar `/vagas/` só depois disso.
5. `tools/build.mjs` continua gerando as páginas públicas; aposentar
   `build-alunos.mjs` (fluxo manual) após a importação §5.

---

## 8. Plano de execução em fases (checkpoints)

- **Fase 0 — Preparação:** VPS + DNS com TTL baixo (300s) + Docker + Caddy com
  front **espelhado** (proxy reverso p/ Pages ainda, ou cópia estática).
  *Aceite:* staging `staging.dbabrabo.com.br` abrindo igual à produção.
- **Fase 1 — API + banco + auth:** §4+§6, seed §5 (sem alunos reais ainda),
  `EcoAuth` sobre API. *Aceite:* login/logout, matriz de acesso, testes.
- **Fase 2 — Alunos:** importação §5, convites, registry via API, gates
  servidor-side. *Aceite:* aluno MySQL não abre Oracle nem por URL direta
  (teste automatizado por endpoint, não só clicando).
- **Fase 3 — Cutover:** virar DNS p/ VPS, desligar Pages (remover `CNAME` do
  repo **só então**), monitorar 72h. *Aceite:* TLS válido, sitemap/canonical
  íntegros, zero 404 em `/mentorias/*`.
- **Fase 4 — Pós:** backups testados (restore ensaiado), cron de vagas,
  reativar `/vagas/`, `audit_log` revisado, runbook de incidentes.

**Rollback:** manter o Pages publicável até 7 dias após a Fase 3 (reverter =
voltar DNS + republicar; banco da Fase 2 exportado em SQL diário).

---

## 9. Operação mínima viável (não pular)
- **Backup:** Litestream (tempo real p/ B2/R2) + `sqlite3 .dump` diário local
  + **restore ensaiado mensalmente** (backup não testado = sem backup).
- **TLS:** Caddy automático; Renovação monitorada; HSTS após 30 dias estáveis.
- **Logs/monitoramento:** logs da API em volume, uptime check externo (ex.:
  Uptime Kuma no próprio VPS ou serviço), alerta de disco >80%.
- **Atualizações:** watchtower ou janela mensal; Node pinado por digest.
- **LGPD (checklist):** base legal e finalidade documentadas; consentimento na
  matrícula; máscara de CPF na UI (`***.456.789-**`); exportação/eliminação
  por titular (endpoint + procedimento); retenção definida (ex.: 5 anos fiscal,
  depois anonimiza); DPA do provedor (Hetzner/DO + B2/R2); suboperadores
  listados; nenhum dado em repo/CI/logs.

## 10. Riscos conhecidos
1. Reutilizar hash SHA-256 como senha → **proibido** (§5.3 prevê reset).
2. Vazar `MENTOR_SENHA`/wraps no log/CI → secrets só em ambiente, nunca em arquivo.
3. Cutover sem TTL baixo → horas de inconsistência DNS.
4. Esquecer `Disallow: /vagas/` temporário ou o `CNAME` → loops/404 (revisar no aceite da Fase 3).
5. Conteúdo `.enc` continua público por URL — acesso real às trilhas passa a ser
   pelos **wraps via API** (§2); documentar que URL direta do `.enc` sem wrap
   continua inútil (é o que garante o modelo atual).

*Fim. Dúvidas de interpretação → perguntar ao dono antes de executar.*
