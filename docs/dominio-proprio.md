# Apontar www.dbabrabo.com.br para o portal

O site já está preparado: nenhuma URL está escrita no código, todas saem de `data/site.json`.

## 1 · No provedor do domínio (registro.br, Cloudflare, GoDaddy…)

**Subdomínio `www` — o recomendado.** Crie um registro CNAME:

| Tipo | Nome | Valor |
|---|---|---|
| CNAME | `www` | `acaciolr.github.io` |

**Domínio raiz `dbabrabo.com.br`** — CNAME não é permitido na raiz. Crie quatro registros A apontando para os IPs do GitHub Pages:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

> Confirme esses IPs na documentação do GitHub antes de aplicar — eles mudam raramente, mas mudam.
> <https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site>

Se usar Cloudflare, deixe o registro em **DNS only** (nuvem cinza) até o certificado do GitHub ser emitido.

## 2 · No repositório

Em **Settings → Pages → Custom domain**, informe `www.dbabrabo.com.br` e salve.
O GitHub cria um arquivo `CNAME` na raiz do repositório com esse conteúdo. Não apague nem edite esse arquivo à mão.

Espere o certificado ser emitido (alguns minutos, às vezes algumas horas) e então marque **Enforce HTTPS**.

## 3 · No portal

Em `data/site.json`:

```json
"site": {
  "domainFuturo": "https://www.dbabrabo.com.br",
  "usarDominioProprio": true
}
```

Rode o build e publique:

```bash
node tools/build.mjs
git add . && git commit -m "Aponta o portal para o domínio próprio" && git push
```

O build reescreve `canonical`, Open Graph, `sitemap.xml` e `robots.txt` com o novo domínio. Nada mais precisa ser tocado.

## 4 · Conferir

```bash
curl -sI https://www.dbabrabo.com.br | head -1          # espera HTTP/2 200
curl -s  https://www.dbabrabo.com.br/sitemap.xml | head -4
```

E no navegador: cadeado válido, e uma página de mentoria abrindo direto — por exemplo
`https://www.dbabrabo.com.br/mentorias/mysql/`.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| 404 no domínio próprio | DNS ainda propagando, ou `CNAME` ausente no repositório | Aguardar; conferir Settings → Pages |
| Cadeado inválido | Certificado ainda não emitido | Esperar; se usa Cloudflare, deixar em DNS only |
| CSS e imagens não carregam | Caminho absoluto em algum arquivo | Todo caminho deve ser relativo ao `data-base` da página |
| Redireciona para `acaciolr.github.io` | `Enforce HTTPS` marcado antes do certificado | Desmarcar, esperar, marcar de novo |
