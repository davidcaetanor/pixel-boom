"""
Botao de tela cheia do menu (28x28, mesma moldura e paleta da engrenagem) e os
icones dos dois passos para instalar no iPhone: compartilhar e adicionar.
Uso: python icone_tela_cheia.py <pasta_atlas>
"""
import os
import sys
from PIL import Image

CONTORNO = (15, 3, 8, 255)
FUNDO = (29, 24, 44, 255)
CREME = (234, 219, 188, 255)
SOMBRA = (142, 82, 48, 255)
BORDA_CLARA = (191, 166, 141, 255)
FOCO = {BORDA_CLARA: (255, 236, 170, 255), SOMBRA: (240, 198, 114, 255), CREME: (244, 236, 216, 255)}

LADO = 28
# Cada canto: um L de 2 px de espessura e 7 de comprimento, com contorno escuro.
MARGEM_CANTO = 6
BRACO = 7
ESPESSURA = 2


def moldura():
    im = Image.new("RGBA", (LADO, LADO), FUNDO)
    px = im.load()
    for i in range(LADO):
        for j in (0, LADO - 1):
            px[i, j] = CONTORNO
            px[j, i] = CONTORNO
    for i in range(1, LADO - 1):
        px[i, 1] = BORDA_CLARA
        px[1, i] = BORDA_CLARA
        px[LADO - 2, i] = SOMBRA
        px[i, LADO - 2] = SOMBRA
    for x, y in ((0, 0), (LADO - 1, 0), (0, LADO - 1), (LADO - 1, LADO - 1)):
        px[x, y] = (0, 0, 0, 0)
    for x, y in ((1, 1), (LADO - 2, 1), (1, LADO - 2), (LADO - 2, LADO - 2)):
        px[x, y] = CONTORNO
    return im


def pinta_l(px, x0, y0, sx, sy):
    """L com a quina em (x0, y0), bracos indo no sentido (sx, sy)."""
    cheio = set()
    for k in range(BRACO):
        for e in range(ESPESSURA):
            cheio.add((x0 + sx * k, y0 + sy * e))
            cheio.add((x0 + sx * e, y0 + sy * k))
    for x, y in cheio:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (x + dx, y + dy) not in cheio and px[x + dx, y + dy] == FUNDO:
                    px[x + dx, y + dy] = CONTORNO
    for x, y in cheio:
        px[x, y] = CREME


def botao():
    im = moldura()
    px = im.load()
    a, b = MARGEM_CANTO, LADO - 1 - MARGEM_CANTO
    pinta_l(px, a, a, 1, 1)
    pinta_l(px, b, a, -1, 1)
    pinta_l(px, a, b, 1, -1)
    pinta_l(px, b, b, -1, -1)
    return im


def foco(im):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            px[x, y] = FOCO.get(px[x, y], px[x, y])
    return out


def desenho(linhas):
    cores = {"#": CONTORNO, "o": CREME, ".": (0, 0, 0, 0)}
    im = Image.new("RGBA", (len(linhas[0]), len(linhas)))
    for y, linha in enumerate(linhas):
        for x, c in enumerate(linha):
            im.putpixel((x, y), cores[c])
    return im


# Quadrado aberto em cima com seta saindo, como o compartilhar do iOS.
COMPARTILHAR = [
    ".....#.....",
    "....#o#....",
    "...#ooo#...",
    "..#ooooo#..",
    "..###o###..",
    "....#o#....",
    "###.#o#.###",
    "#o#.#o#.#o#",
    "#o#.###.#o#",
    "#o#.....#o#",
    "#o#######o#",
    "#ooooooooo#",
    "###########",
]

# Quadrado com sinal de mais, como o adicionar a Tela de Inicio do iOS.
ADICIONAR = [
    "###########",
    "#ooooooooo#",
    "#o#######o#",
    "#o###o###o#",
    "#o###o###o#",
    "#o#ooooo#o#",
    "#o###o###o#",
    "#o###o###o#",
    "#o#######o#",
    "#ooooooooo#",
    "###########",
]


if __name__ == "__main__":
    destino = sys.argv[1]
    b = botao()
    b.save(os.path.join(destino, "ui-tela-cheia.png"), optimize=True)
    foco(b).save(os.path.join(destino, "ui-tela-cheia-foco.png"), optimize=True)
    desenho(COMPARTILHAR).save(os.path.join(destino, "ui-compartilhar.png"), optimize=True)
    desenho(ADICIONAR).save(os.path.join(destino, "ui-adicionar.png"), optimize=True)
