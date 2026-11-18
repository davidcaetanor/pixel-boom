"""
Icones de atributo do HUD, gerados no PixelLab (assets/source/ui/attributes) e
ajustados aqui:
- bomba: o miolo do corpo, que tinha a cor do fundo da placa e lia como anel,
  ganha o tom escuro do corpo; o pavio e a faisca descem duas linhas para caber;
- fogo: sem a linha de contorno da ponta, que nao aparece no fundo escuro;
- bota: sem a marca de velocidade solta a esquerda, trocada por um rastro de
  tres tracos saindo do calcanhar.
Os tres tem 13 px de altura e cabem no miolo escuro da placa de 32 px (linhas 8 a 20).
Uso: python icones_atributos.py <pasta_processed> <pasta_atlas>
"""
import os
import sys

from PIL import Image

CORPO_BOMBA = (52, 50, 62, 255)
ESCURO = (20, 18, 28, 255)
# Pavio e faisca compactos, nas linhas 3 e 4 do quadro gerado (a = laranja,
# c = amarelo, b = contorno); as linhas 0 a 4 originais sao descartadas.
PAVIO = {(9, 3): "c", (10, 3): "a", (7, 4): "a", (8, 4): "b", (10, 4): "a"}
COR_PAVIO = {"a": (255, 146, 40, 255), "c": (255, 214, 72, 255), "b": ESCURO}
LINHA_CORPO = 5

ORIGEM = os.path.join(os.path.dirname(__file__), "..", "attributes")
CIANO = (64, 200, 230, 255)
CIANO_LUZ = (200, 240, 250, 255)
# Marca de velocidade solta na bota gerada: colunas 1 a 3, linhas 4 a 8.
MARCA_SOLTA = [(x, y) for x in range(1, 4) for y in range(4, 9)]
# Rastro: (linha, primeira coluna, ultima coluna, cor), tracos mais curtos longe da bota.
RASTRO = [(9, 0, 2, CIANO_LUZ), (11, 1, 2, CIANO), (13, 0, 3, CIANO_LUZ)]


def recorta(im):
    return im.crop(im.getbbox())


def bomba():
    im = Image.open(os.path.join(ORIGEM, "bomba.png")).convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(LINHA_CORPO):
        for x in range(w):
            px[x, y] = (0, 0, 0, 0)
    for (x, y), k in PAVIO.items():
        px[x, y] = COR_PAVIO[k]
    # fora = transparente alcancavel pela borda; o resto escuro ou vazio la dentro e corpo
    fora, pilha = set(), [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while pilha:
        x, y = pilha.pop()
        if (x, y) in fora or not (0 <= x < w and 0 <= y < h) or px[x, y][3]:
            continue
        fora.add((x, y))
        pilha += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for y in range(LINHA_CORPO + 1, h):
        for x in range(w):
            c = px[x, y]
            if (x, y) in fora or (c[3] and c != ESCURO):
                continue
            vizinhos = ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if c[3] and any(v in fora for v in vizinhos):
                continue
            px[x, y] = CORPO_BOMBA
    return recorta(im)


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


if __name__ == "__main__":
    icones = {"ui-icone-bomba": bomba(), "ui-icone-alcance": alcance(), "ui-icone-velocidade": velocidade()}
    for pasta in sys.argv[1:3]:
        for nome, im in icones.items():
            im.save(os.path.join(pasta, nome + ".png"))
    print("ok:", ", ".join(f"{n} {im.width}x{im.height}" for n, im in icones.items()))
