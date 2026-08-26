# DBA BRABO — Portal

Portal oficial do ecossistema **DBA BRABO** — mentoria técnica para administradores de banco de dados.
Site estático, sem framework em runtime, publicado no GitHub Pages.

<https://acaciolr.github.io/dba-brabo-site/>

---

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Marcação e estilo | HTML5 + CSS puro | Sem dependência em runtime; Lighthouse alto por construção |
| Interação | JavaScript ES2022, sem bibliotecas | Busca, filtros, accordions, tema e QR cabem em um arquivo |
| Conteúdo | JSON em `data/` | Adicionar mentoria não encosta em HTML |
| Páginas de mentoria | Geradas por `tools/build.mjs` (Node) | URLs amigáveis com `<title>`, Open Graph e schema.org próprios — impossível numa SPA estática |
| Imagens | WebP gerado de `Banners/` | 10,9 MB → 1,4 MB, 87% menor |
| Publicação | GitHub Actions → GitHub Pages | `git push` publica |

Node é necessário **apenas para gerar** as páginas. O site publicado não carrega nada além de HTML, CSS, JS e imagens.

---

## Estrutura

```
DBA BRABO PORTAL/
├── index.html              home
├── style.css               design system completo (tokens, componentes, temas)
├── script.js               render dos JSON + busca, filtros, accordions, tema, QR
│
├── data/                   ← toda a edição de conteúdo acontece aqui
│   ├── site.json           marca, mentor, links, metodologia, investimento
│   ├── mentorias.json      as 19 mentorias, com pilares e cores
│   ├── projetos.json       ORA BRABO, MySQL Super DBA, SQL BRABO, PG BRABO…
│   ├── tecnologias.json    stack por grupo
│   ├── roadmap.json        a jornada do DBA
│   ├── faq.json            perguntas frequentes
│   └── modulos/
│       └── mysql.json      módulos e tópicos detalhados da mentoria MySQL
│
├── mentorias/              GERADO — não editar à mão
│   ├── index.html          catálogo
│   └── <slug>/index.html   uma pasta por mentoria
│
├── assets/
│   ├── logo/               avatar em 4 tamanhos + favicon.ico
│   ├── banners/            <slug>.webp e <slug>-card.webp
│   └── qr/                 QR dos canais, SVG com currentColor
│
├── Banners/                originais, alta resolução — fonte da verdade, nunca alterados
│
├── tools/
│   ├── build.mjs           gera mentorias/, sitemap.xml e robots.txt
│   ├── build-assets.py     recorta o logo e converte os banners para WebP
│   └── build-qr.py         gera os QR a partir das URLs de data/site.json
│
├── docs/
│   └── dominio-proprio.md  como apontar www.dbabrabo.com.br
│
├── .github/workflows/deploy.yml
├── sitemap.xml             GERADO
└── robots.txt              GERADO
```

---

## Rodar localmente

O site lê os JSON por `fetch`, então **não funciona abrindo o `index.html` direto do disco** — o navegador bloqueia por CORS. Suba um servidor:

```bash
python3 -m http.server 8080
# ou
npx serve .
```

Depois abra <http://localhost:8080>.

---

## Como fazer as coisas

### Adicionar uma mentoria

1. Coloque o banner em `Banners/` (formato retrato, mesma diagramação dos existentes).
2. Registre o arquivo em `tools/build-assets.py`, no dicionário `MAP`, associando ao *slug*.
3. Rode `python3 tools/build-assets.py` para gerar os WebP.
4. Adicione o objeto da mentoria em `data/mentorias.json`. Campos obrigatórios:
   `slug`, `nome`, `categoria` (`tecnica` ou `programa`), `desc`, `accent`, `nivel`, `tags`, `tecnologias`, `pilares`.
   O bloco `banner` é derivado do slug automaticamente pelo build.
5. Rode `node tools/build.mjs`.
6. `git add . && git commit && git push`.

O card na home, o filtro, a busca, o sitemap e a página individual aparecem sozinhos.

### Preencher os preços

Hoje o site mostra **“Sob consulta”** em todo lugar — nenhum valor foi inventado.
Para publicar valores, em `data/mentorias.json`, na mentoria desejada:

```json
"investimento": { "valor": "R$ 1.200", "condicao": "à vista ou em 3x" }
```

E em `data/site.json`, ligue a exibição:

```json
"investimento": { "exibirPrecos": true, "fallback": "Sob consulta" }
```

Mentorias que continuarem com `"valor": null` seguem mostrando o texto de fallback.

### Trocar ou adicionar um link / rede social

Só `data/site.json`, bloco `links`. Campo com `url` vazia simplesmente não renderiza card.
Depois de mexer em qualquer URL que tenha `"qr": true`, rode:

```bash
python3 tools/build-qr.py
```

### Adicionar conteúdo detalhado a uma mentoria

Crie `data/modulos/<slug>.json` seguindo o formato de `data/modulos/mysql.json`.
Cada tópico aceita: `conceito`, `comoFunciona[]`, `naPratica[]`, `troubleshooting[{sintoma,causa,acao}]`, `tecnologias[]`, `comandos[{desc,lang,code}]`, `nivel`.
Tópicos sem esses campos aparecem como lista simples — sem quebrar nada.

### Adicionar um projeto

`data/projetos.json`. Se `links.github` estiver vazio, o botão não aparece.

---

## Publicar

```bash
node tools/build.mjs      # regenera as páginas
git add .
git commit -m "Atualiza portal"
git push
```

O GitHub Actions valida, regenera e publica. Acompanhe em **Actions** no repositório.

**Uma configuração única:** em *Settings → Pages*, mude **Source** para **GitHub Actions**.
Enquanto isso não for feito, o Pages continua servindo os arquivos da branch — que também estão corretos, já que o build roda antes do commit.

---

## Domínio próprio

Veja [`docs/dominio-proprio.md`](docs/dominio-proprio.md).

---

## Aviso sobre iCloud

Este repositório está dentro de `iCloudDrive`. **Isso já corrompeu o git uma vez**: o iCloud renomeou `.git/index` para `.git/index 2`, e o git passou a enxergar todos os banners como deletados — um `git add . && git push` teria apagado a pasta `Banners/` do GitHub.

Recomendação: mover o repositório para fora do iCloud.

```bash
git clone https://github.com/acaciolr/dba-brabo-site.git C:\Users\acaci\dev\dba-brabo-site
```

Se for manter no iCloud, antes de cada `commit` confira que a árvore está sã:

```bash
git status --short     # nenhuma deleção inesperada deve aparecer
ls .git/index          # tem que existir; se só houver "index 2", rode: git reset
```

---

## Créditos

Conteúdo e identidade visual por **Acácio Lima Rocha** ([@acaciolr](https://github.com/acaciolr)) — DBA BRABO.
