#!/usr/bin/env python3
"""
DBA BRABO — capa de compartilhamento (Open Graph).

Gera assets/og/dba-brabo-og.png em 1200x630, o formato que WhatsApp, LinkedIn,
Telegram e X esperam. Usa o avatar de assets/logo/ e a mesma linguagem visual
do site: fundo quase preto, malha tecnica, brilho ambar da marca.

As paginas individuais de mentoria NAO usam esta capa — cada uma usa o proprio
banner, o que e proposital.

    python3 tools/build-og.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "assets", "og")
LOGO = os.path.join(ROOT, "assets", "logo", "avatar-512.png")

W, H  = 1200, 630
BG    = (7, 9, 13)
FG    = (237, 242, 247)
MUT   = (150, 167, 185)
BRAND = (255, 138, 76)
SOFT  = (255, 190, 140)
CYAN  = (46, 216, 195)

# Poppins e a fonte de titulo do site. Se nao existir, cai no DejaVu.
CANDIDATOS = ["/usr/share/fonts/truetype/google-fonts/", "/usr/share/fonts/truetype/dejavu/"]
def fonte(nome, tam, fallback="DejaVuSans-Bold.ttf"):
    for base in CANDIDATOS:
        p = os.path.join(base, nome)
        if os.path.exists(p):
            return ImageFont.truetype(p, tam)
    for base in CANDIDATOS:
        p = os.path.join(base, fallback)
        if os.path.exists(p):
            return ImageFont.truetype(p, tam)
    return ImageFont.load_default()


def gerar():
    im = Image.new("RGB", (W, H), BG)

    # brilho da marca: quente a esquerda, ciano a direita
    glow = Image.new("RGB", (W, H), BG)
    g = ImageDraw.Draw(glow)
    g.ellipse((-280, -320, 640, 470), fill=(74, 34, 17))
    g.ellipse((860, -240, 1520, 360), fill=(10, 50, 48))
    im = Image.blend(im, glow.filter(ImageFilter.GaussianBlur(150)), 0.85)

    # malha tecnica, a mesma textura dos banners
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gg = ImageDraw.Draw(grid)
    for x in range(0, W, 48): gg.line([(x, 0), (x, H)], fill=(255, 255, 255, 10))
    for y in range(0, H, 48): gg.line([(0, y), (W, y)], fill=(255, 255, 255, 10))
    im = Image.alpha_composite(im.convert("RGBA"), grid).convert("RGB")

    # avatar com halo e anel
    AV = 268
    ax, ay = 104, (H - AV) // 2
    av = Image.open(LOGO).convert("RGBA").resize((AV, AV), Image.LANCZOS)
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((ax-30, ay-30, ax+AV+30, ay+AV+30), fill=BRAND + (72,))
    im = Image.alpha_composite(im.convert("RGBA"), halo.filter(ImageFilter.GaussianBlur(38))).convert("RGB")
    d = ImageDraw.Draw(im)
    d.ellipse((ax-7, ay-7, ax+AV+7, ay+AV+7), outline=BRAND, width=7)
    im.paste(av, (ax, ay), av)
    d = ImageDraw.Draw(im)

    tx, top = ax + AV + 66, 178
    d.text((tx, top), "ECOSSISTEMA DE FORMAÇÃO TÉCNICA", font=fonte("Poppins-Medium.ttf", 20), fill=BRAND)

    fb = fonte("Poppins-Bold.ttf", 96)
    ybig = top + 38
    d.text((tx, ybig), "DBA", font=fb, fill=FG)

    # "BRABO" em degrade ambar
    wdba = d.textlength("DBA ", font=fb)
    palavra = "BRABO"
    wb = int(d.textlength(palavra, font=fb))
    mask = Image.new("L", (wb + 12, 136), 0)
    ImageDraw.Draw(mask).text((0, 0), palavra, font=fb, fill=255)
    grad = Image.new("RGB", (wb + 12, 136))
    for i in range(wb + 12):
        t = i / (wb + 11)
        cor = tuple(int(BRAND[c] + (SOFT[c] - BRAND[c]) * t) for c in range(3))
        for y in range(136):
            grad.putpixel((i, y), cor)
    im.paste(grad, (int(tx + wdba), ybig), mask)
    d = ImageDraw.Draw(im)

    d.text((tx, ybig + 128), "Mentoria Técnica para DBAs", font=fonte("Poppins-Medium.ttf", 36), fill=MUT)
    d.line([(tx, ybig + 196), (tx + 128, ybig + 196)], fill=BRAND, width=3)
    d.text((tx, ybig + 220), "Oracle · MySQL · SQL Server · PostgreSQL · MongoDB · Cloud",
           font=fonte("Poppins-Regular.ttf", 23), fill=(128, 145, 163))

    # faixa inferior nas cores da marca
    d.rectangle((0, H-7, W, H), fill=(14, 18, 25))
    d.rectangle((0, H-7, int(W*0.36), H), fill=BRAND)
    d.rectangle((int(W*0.36), H-7, int(W*0.54), H), fill=CYAN)

    os.makedirs(OUT, exist_ok=True)
    destino = os.path.join(OUT, "dba-brabo-og.png")
    im.save(destino, optimize=True)
    print(f"  assets/og/dba-brabo-og.png  {os.path.getsize(destino)//1024} KB  ({W}x{H})")


if __name__ == "__main__":
    print("DBA BRABO — capa de compartilhamento")
    gerar()
