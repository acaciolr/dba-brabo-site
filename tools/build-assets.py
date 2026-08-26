#!/usr/bin/env python3
"""
DBA BRABO — geracao de assets do portal.

Le os banners originais de Banners/ (nunca os modifica) e produz:
  assets/logo/     avatar circular do DBA BRABO + favicon, recortado do banner de maior resolucao
  assets/banners/  <slug>.webp        banner completo, max 1080px de largura
                   <slug>-card.webp   faixa superior (logo + titulo), usada nos cards

Rodar apos adicionar ou trocar qualquer banner:
    python3 tools/build-assets.py
"""
import json, os, sys
from PIL import Image, ImageDraw

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC    = os.path.join(ROOT, "Banners")
LOGO   = os.path.join(ROOT, "assets", "logo")
BANNER = os.path.join(ROOT, "assets", "banners")

# arquivo original  ->  slug usado em data/mentorias.json e na URL
MAP = {
    "Mentoria - Oracle Database.jpeg":                  "oracle-database",
    "Mentoria - MySQL.jpeg":                            "mysql",
    "Mentoria - SQL Server.jpeg":                       "sql-server",
    "Mentoria - PostgreSQL.jpeg":                       "postgresql",
    "Mentoria - MongoDB.jpeg":                          "mongodb",
    "Mentoria - Linguagem SQL_.PNG":                    "linguagem-sql",
    "Banner_Exadata.png":                               "exadata",
    "Banner_GoldenGate.png":                            "goldengate",
    "Banner_ODA.png":                                   "oda",
    "Banner_ZDLRA.png":                                 "zdlra",
    "Mentoria - Oracle Cloud Infrastructure (OCI).jpeg":"oci",
    "Mentoria - AWS.jpeg":                              "aws",
    "Mentoria - Microsoft Azure.jpeg":                  "azure",
    "Mentoria - Google Cloud Platform (GCP).jpeg":      "gcp",
    "Mentoria - DBRE.jpeg":                             "dbre",
    "Mentoria - Técnica.jpeg":                          "tecnica",
    "Mentoria - Carreira.jpeg":                         "carreira",
    "Mentoria - Certificação e Skills.jpeg":            "certificacao-skills",
    "Mentoria - Completa.jpeg":                         "completa",
}

# banner de maior resolucao, usado como fonte do logo
LOGO_SRC   = "Banner_Exadata.png"
LOGO_CIRC  = (221.5, 217.5, 112.0)   # centro x, centro y, raio — por dentro do anel colorido
CARD_RATIO = 0.38                    # fracao superior do banner que vira o card
WEBP_Q     = 80
MAX_W      = 1080
CARD_W     = 800


def circular(img, size, ss=8):
    """Redimensiona e aplica mascara circular com borda suave (supersampling)."""
    big  = img.resize((size * ss, size * ss), Image.LANCZOS)
    mask = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * ss - 1, size * ss - 1), fill=255)
    out = big.resize((size, size), Image.LANCZOS).convert("RGBA")
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def build_logo():
    src = os.path.join(SRC, LOGO_SRC)
    if not os.path.exists(src):
        print(f"  ! {LOGO_SRC} nao encontrado — logo nao regenerado")
        return
    os.makedirs(LOGO, exist_ok=True)
    cx, cy, r = LOGO_CIRC
    av = Image.open(src).convert("RGB").crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))
    for s in (512, 256, 180, 96):
        circular(av, s).save(os.path.join(LOGO, f"avatar-{s}.png"), optimize=True)
    circular(av, 512).save(os.path.join(LOGO, "dba-brabo-avatar.png"), optimize=True)
    circular(av, 256).save(os.path.join(LOGO, "favicon.ico"),
                           sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"  logo: 4 tamanhos + favicon.ico  <- {LOGO_SRC}")


def build_banners():
    os.makedirs(BANNER, exist_ok=True)
    tin = tout = 0
    faltando = []
    for fname, slug in MAP.items():
        p = os.path.join(SRC, fname)
        if not os.path.exists(p):
            faltando.append(fname)
            continue
        tin += os.path.getsize(p)
        im = Image.open(p).convert("RGB")
        w, h = im.size

        full = im if w <= MAX_W else im.resize((MAX_W, round(h * MAX_W / w)), Image.LANCZOS)
        full.save(os.path.join(BANNER, f"{slug}.webp"), "WEBP", quality=WEBP_Q, method=5)

        card = im.crop((0, 0, w, int(h * CARD_RATIO)))
        card = card.resize((CARD_W, round(card.size[1] * CARD_W / w)), Image.LANCZOS)
        card.save(os.path.join(BANNER, f"{slug}-card.webp"), "WEBP", quality=WEBP_Q, method=5)

        tout += (os.path.getsize(os.path.join(BANNER, f"{slug}.webp"))
                 + os.path.getsize(os.path.join(BANNER, f"{slug}-card.webp")))
    print(f"  banners: {len(MAP) - len(faltando)} convertidos  "
          f"{tin/1048576:.1f} MB -> {tout/1048576:.2f} MB "
          f"({100 - 100*tout/tin:.0f}% menor)" if tin else "  banners: nenhum")
    for f in faltando:
        print(f"  ! ausente em Banners/: {f}")
    return faltando


def check_data():
    """Confere que todo slug de data/mentorias.json tem banner gerado."""
    p = os.path.join(ROOT, "data", "mentorias.json")
    if not os.path.exists(p):
        return 0
    d = json.load(open(p, encoding="utf-8"))
    erros = 0
    for m in d.get("mentorias", []):
        for k in ("full", "card"):
            rel = m.get("banner", {}).get(k)
            if rel and not os.path.exists(os.path.join(ROOT, rel)):
                print(f"  ! {m['slug']}: falta {rel}")
                erros += 1
    print("  data/mentorias.json: todos os banners resolvem" if not erros
          else f"  data/mentorias.json: {erros} referencia(s) quebrada(s)")
    return erros


if __name__ == "__main__":
    print("DBA BRABO — build de assets")
    build_logo()
    build_banners()
    erros = check_data()
    sys.exit(1 if erros else 0)
