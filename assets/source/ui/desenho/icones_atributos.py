"""
Icones de atributo do HUD. A bomba e desenhada a mao (borda clara, porque o
corpo preto some no fundo escuro da placa). O fogo e a bota vem do PixelLab
(assets/source/ui/attributes), ajustados aqui:
- fogo: sem a linha de contorno da ponta, que nao aparece no fundo escuro;
- bota: sem a marca de velocidade solta a esquerda, trocada por um rastro de
  tres tracos saindo do calcanhar.
Todos cabem no miolo escuro da placa de 32 px (linhas 8 a 21, 14 px).
Uso: python icones_atributos.py <pasta_processed> <pasta_atlas>
"""
import os
import sys

from PIL import Image

CORES = {
    ".": None,
    "D": (20, 18, 28, 255),
    "E": (150, 150, 165, 255),   # borda clara da bomba
    "K": (52, 50, 62, 255),
    "W": (255, 255, 255, 255),
    "B": (154, 91, 46, 255),
    "R": (244, 96, 32, 255),
    "O": (255, 146, 40, 255),
    "Y": (255, 214, 72, 255),
    "F": (255, 250, 228, 255),
    "C": (64, 200, 230, 255),
    "c": (30, 140, 180, 255),
    "L": (200, 240, 250, 255),
}

BOMBA = [
    "........OY.",
    ".......BYO.",
    "......B....",
    "...EEEEE...",
    "..EWWKKKE..",
    ".EWKKKKKKE.",
    ".EKKKKKKKE.",
    ".EKKKKKKKE.",
    ".EKKKKKKKE.",
    "..EKKKKKE..",
    "...EEEEE...",
]

ORIGEM = os.path.join(os.path.dirname(__file__), "..", "attributes")
CIANO = (64, 200, 230, 255)
CIANO_LUZ = (200, 240, 250, 255)
# Marca de velocidade solta na bota gerada: colunas 1 a 3, linhas 4 a 8.
MARCA_SOLTA = [(x, y) for x in range(1, 4) for y in range(4, 9)]
# Rastro: (linha, primeira coluna, ultima coluna, cor), tracos mais curtos longe da bota.
RASTRO = [(9, 0, 2, CIANO_LUZ), (11, 1, 2, CIANO), (13, 0, 3, CIANO_LUZ)]


def recorta(im):
    return im.crop(im.getbbox())


def alcance():
    im = Image.open(os.path.join(ORIGEM, "chama.png")).convert("RGBA")
    b = im.getbbox()
    return recorta(im.crop((0, b[1] + 1, im.width, im.height)))


def velocidade():
    im = Image.open(os.path.join(ORIGEM, "bota.png")).convert("RGBA")
    px = im.load()
    for x, y in MARCA_SOLTA:
        px[x, y] = (0, 0, 0, 0)
    for y, x0, x1, cor in RASTRO:
        for x in range(x0, x1 + 1):
            if px[x, y][3] == 0:
                px[x, y] = cor
    return recorta(im)


def desenha(linhas):
    img = Image.new("RGBA", (len(linhas[0]), len(linhas)))
    for y, linha in enumerate(linhas):
        for x, ch in enumerate(linha):
            if CORES[ch]:
                img.putpixel((x, y), CORES[ch])
    return img


if __name__ == "__main__":
    icones = {"ui-icone-bomba": desenha(BOMBA), "ui-icone-alcance": alcance(), "ui-icone-velocidade": velocidade()}
    for pasta in sys.argv[1:3]:
        for nome, im in icones.items():
            im.save(os.path.join(pasta, nome + ".png"))
    print("ok:", ", ".join(f"{n} {im.width}x{im.height}" for n, im in icones.items()))
