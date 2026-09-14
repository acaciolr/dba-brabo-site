# ECOSSISTEMA SUPER DBA — Hub Central (v1.0)

Hub estático que dá acesso aos ambientes de treinamento DBA BRABO
(Oracle, MySQL, SQL Server, PostgreSQL, MongoDB).

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
├── index.html          hub (banner ASCII + menu TUI + status)
├── css/tui.css         design system terminal (paleta própria)
├── js/hub.js           menu, status, relógio, simulação local
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

REAL: navegação, menu por teclado, relógio, JSONs locais,
`START ALL` / `STOP ALL` (simulação visual, reseta no reload).

MOCK: status das VMs, key manager, terminal (responde local,
sem SSH), VM manager. Tudo marcado `MOCK v1` / `FUTURE BACKEND`
no código onde entrará rede de verdade.

## Acesso (v1.1)

O hub e as 11 subpáginas exigem sessão. Sem sessão, caem no login:

- Login: `ecosistema/aluno/` — usuário master `dbabrabo` + senha.
- Gate: `js/auth.js` (`EcoAuth.exigirLogin()` no `<head>` de cada página
  protegida; `ecosistema/mentor/` só redireciona p/ `mentor/`, que tem o
  próprio acesso cifrado).
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
