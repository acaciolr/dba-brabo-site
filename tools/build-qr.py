#!/usr/bin/env python3
"""
DBA BRABO — gera os QR codes dos canais oficiais como SVG.

Le as URLs de data/site.json e escreve assets/qr/<canal>.svg.

O SVG usa fill="currentColor" e nao tem fundo proprio: quem define a cor e o
CSS do card onde ele aparece, entao o QR herda o accent do tema (claro ou
escuro) em vez de ser preto e branco. Os modulos sao desenhados como circulos
com raio levemente maior que meio modulo, o que mantem a leitura confiavel e
deixa o codigo com a cara do resto do site.

Rodar depois de mudar qualquer link em data/site.json:
    python3 tools/build-qr.py
"""
import json, os, sys
import qrcode
from qrcode.constants import ERROR_CORRECT_Q

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "assets", "qr")

# canais que ganham QR (os que fazem sentido apontar o celular)
CANAIS = ["whatsapp", "linkedin", "linkedinEmpresa", "instagram", "github", "blog", "youtube"]

QUIET = 2          # margem em modulos — reduzida, o card ja da respiro visual
DOT   = 0.56       # raio do ponto, em fracao do modulo (0.5 = encostando)


def svg_para(url: str, label: str) -> str:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_Q, border=QUIET, box_size=1)
    qr.add_data(url)
    qr.make(fit=True)
    m = qr.get_matrix()
    n = len(m)

    pontos = []
    for y, linha in enumerate(m):
        for x, on in enumerate(linha):
            if on:
                pontos.append(f'<circle cx="{x + .5:.1f}" cy="{y + .5:.1f}" r="{DOT}"/>')

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
        f'role="img" aria-label="QR code para {label}" fill="currentColor" shape-rendering="geometricPrecision">'
        f'<title>{label}</title>{"".join(pontos)}</svg>'
    )


def main():
    cfg = json.load(open(os.path.join(ROOT, "data", "site.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    feitos, pulados = [], []

    for canal in CANAIS:
        info = cfg["links"].get(canal) or {}
        url = (info.get("url") or "").strip()
        if not url:
            pulados.append(canal)
            continue
        svg = svg_para(url, info.get("label", canal))
        with open(os.path.join(OUT, f"{canal}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        feitos.append((canal, len(svg)))

    for c, tam in feitos:
        print(f"  assets/qr/{c}.svg  ({tam/1024:.1f} KB)")
    if pulados:
        print(f"  sem URL em data/site.json, nenhum QR gerado: {', '.join(pulados)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
