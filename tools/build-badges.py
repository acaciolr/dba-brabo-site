#!/usr/bin/env python3
"""
DBA BRABO — normalizacao das badges de certificacao.

As badges baixadas da Oracle vem em formatos e fundos diferentes: 552x276 com
tarja preta, 1417x1417 com fundo branco, 2300x1150, 512x512 com alfa. Este
script padroniza todas para o mesmo quadrado transparente, de modo que na
pagina todas ocupem exatamente o mesmo espaco.

Em cada arquivo de badges/:
  1. remove o fundo solido (flood fill a partir das quatro bordas)
  2. recorta no conteudo real, descartando a moldura vazia
  3. escala o medalhao para ALVO px no maior lado — igual para todas
  4. centraliza num canvas SIZE x SIZE transparente
  5. grava assets/badges/<slug>.webp

Os .webp em assets/badges/ ja estao gerados e versionados. Este script so
precisa rodar de novo se voce trocar ou adicionar uma badge — e para isso os
originais precisam estar em badges/ (essa pasta nao vai para o repositorio).

Ao adicionar uma badge: jogue o arquivo em badges/, registre no MAP com um
slug, acrescente a entrada em data/certificacoes.json e rode:

    python3 tools/build-badges.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "badges")
OUT  = os.path.join(ROOT, "assets", "badges")

SIZE = 512      # lado do canvas final
ALVO = 452      # tamanho do medalhao dentro do canvas — igual para todas
TOL  = 40       # tolerancia do flood fill que apaga o fundo

# arquivo original -> slug usado em data/certificacoes.json.
# 1765338861966.jpeg fica de fora de proposito: e a mesma badge MAA de
# New-ORACLE_MAA_BASE-2-1.png, porem em JPEG com fundo branco.
MAP = {
    "badge-ace-associate-2026-sq.png":                                         "ace-associate",
    "New-ORACLE_MAA_BASE-2-1.png":                                             "maa",
    "OPNEXA21CIS.jpg":                                                         "exadata-x9m-specialist",
    "19CRAGOCP.jpg":                                                           "oracle-19c-rac-asm-gi",
    "19CDGOCP.jpg":                                                            "oracle-19c-data-guard",
    "ODB23AIOCPV1.jpg":                                                        "oracle-23ai-professional",
    "Oracle Database Administration 2019 Certified Professional-DB19COCP.jpg": "oracle-db-2019-professional",
    "MYSQLDBA80OCP.jpg":                                                       "mysql-80-dba-professional",
    "DB23aiADMOCA.png":                                                        "oracle-23ai-associate",
    "MYSQLHWIMPOCA (1).jpg":                                                    "mysql-heatwave-associate",
    "MYSQLIMPOCA.jpg":                                                         "mysql-implementation-associate",
    "OCIF2023CA.jpg":                                                          "oci-foundations",
    "OCDMF2023.jpg":                                                           "oracle-cloud-data-management",
    "OCI23AIFCA.jpg":                                                          "oci-ai-foundations",
}

MAGENTA = (255, 0, 255)   # cor sentinela: nao existe nas badges


def remove_fundo(im):
    """Pinta o fundo de magenta a partir das bordas e converte isso em alfa."""
    rgb = im.convert("RGB")
    tmp = rgb.copy()
    for pt in [(0, 0), (rgb.width - 1, 0), (0, rgb.height - 1), (rgb.width - 1, rgb.height - 1)]:
        ImageDraw.floodfill(tmp, pt, MAGENTA, thresh=TOL)
    a = np.asarray(tmp)
    fundo = (a[:, :, 0] == 255) & (a[:, :, 1] == 0) & (a[:, :, 2] == 255)
    arr = np.asarray(im.convert("RGBA")).copy()
    arr[:, :, 3] = np.where(fundo, 0, arr[:, :, 3])
    return Image.fromarray(arr, "RGBA")


def normaliza(caminho):
    im = Image.open(caminho)
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA") else remove_fundo(im)
    if np.asarray(im)[:, :, 3].min() > 250:       # tem canal alfa, porem todo opaco
        im = remove_fundo(im)

    caixa = im.getbbox()
    if caixa:
        im = im.crop(caixa)

    k = ALVO / max(im.size)                       # mesma escala de destino para todas
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    return canvas


def main():
    import json
    os.makedirs(OUT, exist_ok=True)

    if not os.path.isdir(SRC) or not os.listdir(SRC):
        print(f"  badges/ vazia ou ausente — nada a reprocessar.")
        print(f"  Os {len(os.listdir(OUT))} .webp em assets/badges/ continuam validos.")
    else:
        feitas, faltando, total = 0, [], 0
        for arquivo, slug in MAP.items():
            p = os.path.join(SRC, arquivo)
            if not os.path.exists(p):
                faltando.append(arquivo)
                continue
            destino = os.path.join(OUT, f"{slug}.webp")
            normaliza(p).save(destino, "WEBP", quality=90, method=5)
            total += os.path.getsize(destino)
            feitas += 1
        print(f"  {feitas} badges normalizadas — {SIZE}x{SIZE}, medalhao {ALVO}px, {total//1024} KB")
        for f in faltando:
            print(f"  ! ausente em badges/: {f}")

    # confere que todo slug citado no JSON tem arquivo gerado
    j = os.path.join(ROOT, "data", "certificacoes.json")
    if os.path.exists(j):
        d = json.load(open(j, encoding="utf-8"))
        slugs = [c["badge"] for c in d["destaques"]] + [c["badge"] for g in d["grupos"] for c in g["itens"]]
        quebrados = [s for s in slugs if not os.path.exists(os.path.join(OUT, f"{s}.webp"))]
        print(f"  data/certificacoes.json: {len(slugs)} badges — "
              + ("todas resolvem" if not quebrados else "SEM ARQUIVO: " + ", ".join(quebrados)))
        return 1 if quebrados else 0
    return 0


if __name__ == "__main__":
    print("DBA BRABO — badges")
    raise SystemExit(main())
