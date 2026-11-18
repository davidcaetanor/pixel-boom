"""
Processa a cerca-viva da borda da arena.

Os dois tiles gerados alternam na borda; o segundo e levado a paleta do primeiro
para nao aparecer costura. Ambos sao escurecidos e tem os destaques comprimidos,
porque a borda e o fundo do HUD e precisa ficar calma.

Cada tile vira uma folha de 5 quadros de 32x32: plano e beira ondulada voltada
para baixo, cima, esquerda e direita (o lado que encosta na area jogavel). A
beira tem dois arcos por celula, do tamanho de uma moita, contornados no verde
mais escuro da propria sebe.
Uso: python processa_borda.py <assets/source> <pasta_processed> <pasta_atlas>
"""
import os
import sys

from PIL import Image

T = 32
FATOR = 0.72
TETO_LUZ = 150
LARGURAS_ARCO = (16, 16)
FUNDO_ARCO = 3
LADOS = ("baixo", "cima", "esquerda", "direita")
# giro que leva cada lado para baixo, em quartos de volta anti-horarios
GIRO = {"baixo": 0, "esquerda": 1, "cima": 2, "direita": 3}


def arcos():
    out = []
    for w in LARGURAS_ARCO:
        for i in range(w):
            t = (2 * i / (w - 1)) - 1
            out.append(round(FUNDO_ARCO * t * t))
    return out


RECUO = arcos()


def calma(tile):
    out = tile.copy()
    px = out.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            f = FATOR * (TETO_LUZ / lum if lum * FATOR > TETO_LUZ else 1)
            px[x, y] = (int(r * f), int(g * f), int(b * f), a)
    return out


def na_paleta(tile, ref):
    paleta = sorted(set(ref.get_flattened_data()))
    out = tile.copy()
    px = out.load()
    for y in range(T):
        for x in range(T):
            c = px[x, y]
            px[x, y] = min(paleta, key=lambda p: sum((a - b) ** 2 for a, b in zip(c[:3], p[:3])))
    return out


def beira(tile, lado, contorno):
    giro = GIRO[lado]
    c = tile.rotate(90 * giro) if giro else tile.copy()
    px = c.load()
    for x in range(T):
        r = RECUO[x]
        for k in range(r):
            px[x, T - 1 - k] = (0, 0, 0, 0)
        px[x, T - 1 - r] = contorno
    for x in range(T):
        for viz in (x - 1, x + 1):
            if 0 <= viz < T and RECUO[viz] > RECUO[x]:
                for k in range(RECUO[x], RECUO[viz]):
                    if px[viz, T - 1 - k][3] == 0 and px[x, T - 1 - k][3]:
                        px[x, T - 1 - k] = contorno
    return c.rotate(-90 * giro) if giro else c


def folha(tile, contorno):
    out = Image.new("RGBA", (T * (1 + len(LADOS)), T))
    out.alpha_composite(tile, (0, 0))
    for i, lado in enumerate(LADOS, start=1):
        out.alpha_composite(beira(tile, lado, contorno), (i * T, 0))
    return out


if __name__ == "__main__":
    fonte, *destinos = sys.argv[1:4]
    pasta = os.path.join(fonte, "tiles", "hedge")
    a = calma(Image.open(os.path.join(pasta, "sebe_a.png")).convert("RGBA"))
    b = na_paleta(calma(Image.open(os.path.join(pasta, "sebe_b.png")).convert("RGBA")), a)
    contorno = min(set(a.get_flattened_data()), key=lambda c: c[0] + c[1] + c[2])
    for nome, tile in (("sebe-a", a), ("sebe-b", b)):
        f = folha(tile, contorno)
        for d in destinos:
            f.save(os.path.join(d, nome + ".png"), optimize=True)
    print("ok: sebe-a, sebe-b")
