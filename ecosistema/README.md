# ECOSSISTEMA SUPER DBA — Ponte para as VMs (v1.2)

Hub estático que é só a ponte para as VMs de treinamento DBA BRABO
(Oracle, MySQL, SQL Server, PostgreSQL, MongoDB): ambientes + status.
Sem operations, sem monitoring, sem labs no hub — cada ambiente leva
às suas VMs e ao console.

## Regra de ouro

NÃO substitui projeto nenhum. Os projetos (`mysql_super_dba`,
`oracle_super_dba`, `sqlserver_super_dba`, `postgresql_super_dba`,
`mongodb_super_dba`) continuam independentes — isto aqui é só o hub
que aponta para eles e, no futuro, abre console nas VMs.

## Rodar localmente

O hub lê os JSON via `fetch`, então não funciona abrindo o arquivo
direto do disco. Suba um servidor na RAIZ do portal:

```bash
python3 -m http.server 8080
# abrir http://localhost:8080/ecosistema/
```

(Publicado, o GitHub Pages já serve tudo sozinho.)

## Estrutura

```text
ecosistema/
├── index.html          hub (ponte: ambientes + status das VMs)
├── css/tui.css         design system terminal (ponte visual com o portal)
├── js/hub.js           status, relógio, atalhos 1–5
├── json/vms.json       VMs por tecnologia (mock Fase 1)
├── json/labs.json      labs disponíveis (mock)
├── json/users.json     usuários (mock, display)
├── json/modules.json   módulos por ecossistema + nº de aulas
├── terminal/           (Fase B) console xterm.js por VM
├── vm-manager/         (Fase B) tabela estilo hypervisor
├── key-manager/        (Fase B) chaves SSH (mock visual)
├── oracle/ mysql/ sqlserver/ postgresql/ mongodb/  (Fase C)
└── README.md           este arquivo
```

## Fase 1 — o que é real e o que é mock

REAL: ponte para os 5 ambientes, atalhos de teclado 1–5, relógio,
status das VMs via `json/vms.json` local.

MOCK: status das VMs, key manager, terminal (responde local,
sem SSH), VM manager. Tudo marcado `MOCK v1` / `FUTURE BACKEND`
no código onde entrará rede de verdade. Runbooks (operacoes),
monitoramento e labs continuam existindo como páginas, fora do hub.

## Acesso (v1.1)

O hub e as 11 subpáginas exigem sessão. Sem sessão, caem no login:

- Login: `ecosistema/aluno/` — usuário master `dbabrabo` + senha, ou login
  por aluno (e-mail + senha inicial definida no cadastro).
- Gate: `js/auth.js` (`EcoAuth.exigirLogin(url, lab?)` no `<head>` de cada página
  protegida; páginas de lab passam o próprio `data-tech`, terminal deduz do
  `?vm=` e vm-manager é só admin; `ecosistema/mentor/` só redireciona p/
  `mentor/`, que tem o próprio acesso cifrado).
- Alunos: cadastro na área do mentor (botão ＋ Aluno, `mentor/alunos.js`,
  só no navegador) → Exportar → `node tools/build-alunos.mjs export.json
  --write` → commita SÓ `json/alunos.json` (user+hash+labs, sem CPF).
  O export local nunca vai ao repo (ver `.gitignore`).
- A senha NUNCA fica no repositório: no código vai só o SHA-256 de
  `"usuario:senha"`. Para trocar a senha, gere o novo hash e troque
  `MASTER_HASH` em `js/auth.js`:
  `node -e "console.log(require('crypto').createHash('sha256').update('dbabrabo:NOVA_SENHA','utf8').digest('hex'))"`
- Sessão em `sessionStorage` (morre ao fechar a aba). Login real com
  backend chega na v2 — este gate é trava de UX, não segurança real.

## Roadmap

| Versão | Entrega |
|---|---|
| v1 | GitHub Pages estático (esta) |
| v2 | Login + SQLite |
| v3 | FastAPI |
| v4 | SSH via WebSocket |
| v5 | Multiusuário |
| v6 | Labs em Kubernetes |
