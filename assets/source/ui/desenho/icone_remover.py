"""
Icone de remover membro da sala de espera, desenhado a mao com as cores do
kit de interface: contorno escuro dos slots, vermelho da coroa e X creme com
sombra de um pixel. 14x14, com o canto no vertice do cartao.
Uso: python icone_remover.py <pasta_processed> <pasta_atlas>
"""
import os
import sys

from PIL import Image

LADO = 14
CONTORNO = (15, 3, 8, 255)
CREME = (234, 219, 188, 255)
SOMBRA = (97, 39, 48, 255)
X = [
    "##....##",
    "###..###",
    ".######.",
    "..####..",
    "..####..",
    ".######.",
    "###..###",
    "##....##",
]
X_ORIGEM = 3
# (miolo, luz da linha de cima, sombra da linha de baixo)
NORMAL = ((183, 42, 37, 255), (216, 51, 43, 255), (119, 40, 45, 255))
HOVER = ((216, 51, 43, 255), (218, 89, 47, 255), (183, 42, 37, 255))


def desenha(cores):
    miolo, luz, base = cores
    fim = LADO - 1
    im = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
    px = im.load()
    cantos_internos = {(1, 1), (fim - 1, 1), (1, fim - 1), (fim - 1, fim - 1)}
    for y in range(LADO):
        for x in range(LADO):
            if x in (0, fim) and y in (0, fim):
                continue
            if x in (0, fim) or y in (0, fim) or (x, y) in cantos_internos:
                px[x, y] = CONTORNO
            elif y == 1:
                px[x, y] = luz
            elif y == fim - 1:
                px[x, y] = base
            else:
                px[x, y] = miolo
    for deslocamento, cor in ((1, SOMBRA), (0, CREME)):
        for linha, texto in enumerate(X):
            for coluna, marca in enumerate(texto):
                y = X_ORIGEM + linha + deslocamento
                if marca == "#" and y < fim:
                    px[X_ORIGEM + coluna, y] = cor
    return im


if __name__ == "__main__":
    icones = {"ui-remover": desenha(NORMAL), "ui-remover-hover": desenha(HOVER)}
    for pasta in sys.argv[1:3]:
        for nome, im in icones.items():
            im.save(os.path.join(pasta, nome + ".png"))
    print("ok:", ", ".join(f"{n} {im.width}x{im.height}" for n, im in icones.items()))
