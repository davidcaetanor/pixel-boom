"""
Engrenagem das configuracoes da sala, gerada no PixelLab com a paleta do kit
forcada (assets/source/ui/gear) e limpa aqui: recorte da sobra, pixels soltos
removidos e contorno escuro fechado por fora e no furo. A versao de foco sobe
os tons creme um degrau, ainda dentro da paleta da interface.
Uso: python engrenagem.py <pasta_processed> <pasta_atlas>
"""
import os
import sys
from collections import Counter

from PIL import Image

ORIGEM = os.path.join(os.path.dirname(__file__), "..", "gear", "gear.png")
CONTORNO = (15, 3, 8, 255)
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


if __name__ == "__main__":
    base = limpa()
    icones = {"ui-engrenagem": base, "ui-engrenagem-foco": foco(base)}
    for pasta in sys.argv[1:3]:
        for nome, im in icones.items():
            im.save(os.path.join(pasta, nome + ".png"))
    print("ok:", ", ".join(f"{n} {im.width}x{im.height}" for n, im in icones.items()))
