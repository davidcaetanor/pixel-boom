"""
Engrenagem das configuracoes da sala, gerada no PixelLab com a paleta do kit
forcada (assets/source/ui/gear) e limpa aqui: recorte da sobra, pixels soltos
removidos e contorno escuro fechado por fora e no furo. Depois reduzida de 28
para 22 px pela cor predominante de cada area, sem interpolar, e montada num
botao de 28 px com contorno escuro, aro marrom e luz no topo e na esquerda. No
foco o aro fica dourado e os tons creme sobem um degrau.
Uso: python engrenagem.py <pasta_processed> <pasta_atlas>
"""
import os
import sys
from collections import Counter

from PIL import Image

ORIGEM = os.path.join(os.path.dirname(__file__), "..", "gear", "gear.png")
CONTORNO = (15, 3, 8, 255)
LADO_ICONE = 22
LADO_BOTAO = 28
MIOLO = (29, 24, 44, 255)
ARO = ((142, 82, 48, 255), (191, 166, 141, 255))
ARO_FOCO = ((240, 198, 114, 255), (255, 236, 170, 255))
FOCO = {
    (191, 166, 141, 255): (219, 205, 183, 255),
    (219, 205, 183, 255): (234, 219, 188, 255),
    (234, 219, 188, 255): (244, 236, 216, 255),
}


def vizinhos(x, y):
    return [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]


def limpa():
    im = Image.open(ORIGEM).convert("RGBA")
    im = im.crop(im.getbbox())
    px = im.load()
    w, h = im.size

    def opaco(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] > 0

    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0 and sum(opaco(*v) for v in vizinhos(x, y)) < 2:
                px[x, y] = (0, 0, 0, 0)
    borda = {(x, y) for y in range(h) for x in range(w) if px[x, y][3] > 0 and any(not opaco(*v) for v in vizinhos(x, y))}
    for x, y in borda:
        px[x, y] = CONTORNO
    for y in range(h):
        for x in range(w):
            if px[x, y] == CONTORNO and (x, y) not in borda:
                cores = [px[a, b] for a, b in vizinhos(x, y) if opaco(a, b) and px[a, b] != CONTORNO]
                if len(cores) >= 3:
                    px[x, y] = Counter(cores).most_common(1)[0][0]
    return im


def foco(im):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            px[x, y] = FOCO.get(px[x, y], px[x, y])
    return out


def reduz(im, lado):
    origem = im.load()
    n = im.width
    out = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    px = out.load()
    for y in range(lado):
        for x in range(lado):
            x0, x1, y0, y1 = x * n / lado, (x + 1) * n / lado, y * n / lado, (y + 1) * n / lado
            pesos = Counter()
            for yy in range(int(y0), min(n, int(y1 + 0.999))):
                for xx in range(int(x0), min(n, int(x1 + 0.999))):
                    area = (min(x1, xx + 1) - max(x0, xx)) * (min(y1, yy + 1) - max(y0, yy))
                    if area > 0:
                        pesos[origem[xx, yy]] += area
            opacos = Counter({c: v for c, v in pesos.items() if c[3] > 0})
            if sum(opacos.values()) >= sum(pesos.values()) / 2:
                px[x, y] = opacos.most_common(1)[0][0]

    def opaco(x, y):
        return 0 <= x < lado and 0 <= y < lado and px[x, y][3] > 0

    for x, y in [(x, y) for y in range(lado) for x in range(lado) if opaco(x, y) and any(not opaco(*v) for v in vizinhos(x, y))]:
        px[x, y] = CONTORNO
    return out


def botao(icone, aro):
    cor, luz = aro
    fim = LADO_BOTAO - 1
    im = Image.new("RGBA", (LADO_BOTAO, LADO_BOTAO), (0, 0, 0, 0))
    px = im.load()
    cantos = {(1, 1), (fim - 1, 1), (1, fim - 1), (fim - 1, fim - 1)}
    for y in range(LADO_BOTAO):
        for x in range(LADO_BOTAO):
            if x in (0, fim) and y in (0, fim):
                continue
            if x in (0, fim) or y in (0, fim) or (x, y) in cantos:
                px[x, y] = CONTORNO
            elif x in (1, fim - 1) or y in (1, fim - 1):
                px[x, y] = luz if 1 in (x, y) else cor
            else:
                px[x, y] = MIOLO
    margem = (LADO_BOTAO - icone.width) // 2
    im.alpha_composite(icone, (margem, margem))
    return im


if __name__ == "__main__":
    icone = reduz(limpa(), LADO_ICONE)
    icones = {"ui-engrenagem": botao(icone, ARO), "ui-engrenagem-foco": botao(foco(icone), ARO_FOCO)}
    for pasta in sys.argv[1:3]:
        for nome, im in icones.items():
            im.save(os.path.join(pasta, nome + ".png"))
    print("ok:", ", ".join(f"{n} {im.width}x{im.height}" for n, im in icones.items()))
