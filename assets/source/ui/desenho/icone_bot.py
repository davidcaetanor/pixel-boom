"""
Selo de bot na sala de espera, desenhado a mao: placa escura com a cabeca de
robo e a dificuldade em pontos (um para Normal, dois para Dificil). O selo e
clicavel pelo anfitriao; a versao de foco troca o contorno pelo creme do kit.
Uso: python icone_bot.py <pasta_processed> <pasta_atlas>
"""
import os
import sys

from PIL import Image

LARGURA = 24
ALTURA = 12
CONTORNO = (15, 3, 8, 255)
CONTORNO_FOCO = (219, 205, 183, 255)
PLACA = (20, 18, 28, 255)
CABECA = [
    "....AA....",
    "...BAAB...",
    ".BBBBBBBB.",
    "BBBBBBBBBB",
    "BBEEBBEEBB",
    "BBEEBBEEBB",
    "BBBBBBBBBB",
    "BBA####ABB",
    "AAAAAAAAAA",
    ".AAAAAAAA.",
]
CORES_CABECA = {
    "#": CONTORNO,
    "B": (196, 196, 204, 255),
    "E": (64, 200, 230, 255),
    "A": (119, 117, 110, 255),
}
PONTO = (216, 51, 43, 255)
PONTO_LUZ = (255, 146, 40, 255)
PONTO_VAZIO = (61, 58, 53, 255)
PONTO_LADO = 5
PONTOS_X = (13, 18)
PONTOS_Y = 4


def desenha(pontos, contorno):
    im = Image.new("RGBA", (LARGURA, ALTURA), (0, 0, 0, 0))
    px = im.load()
    fim_x, fim_y = LARGURA - 1, ALTURA - 1
    for y in range(ALTURA):
        for x in range(LARGURA):
            if x in (0, fim_x) and y in (0, fim_y):
                continue
            px[x, y] = contorno if x in (0, fim_x) or y in (0, fim_y) else PLACA
    for linha, texto in enumerate(CABECA):
        for coluna, marca in enumerate(texto):
            if marca in CORES_CABECA:
                px[1 + coluna, 1 + linha] = CORES_CABECA[marca]
    for indice, x0 in enumerate(PONTOS_X):
        cheio = indice < pontos
        for dy in range(PONTO_LADO):
            for dx in range(PONTO_LADO):
                if dx in (0, PONTO_LADO - 1) and dy in (0, PONTO_LADO - 1):
                    continue
                borda = dx in (0, PONTO_LADO - 1) or dy in (0, PONTO_LADO - 1)
                if borda:
                    cor = CONTORNO
                elif not cheio:
                    cor = PONTO_VAZIO
                else:
                    cor = PONTO_LUZ if (dx, dy) == (1, 1) else PONTO
                px[x0 + dx, PONTOS_Y - 1 + dy] = cor
    return im


if __name__ == "__main__":
    icones = {
        "ui-bot-normal": desenha(1, CONTORNO),
        "ui-bot-normal-foco": desenha(1, CONTORNO_FOCO),
        "ui-bot-dificil": desenha(2, CONTORNO),
        "ui-bot-dificil-foco": desenha(2, CONTORNO_FOCO),
    }
    for pasta in sys.argv[1:3]:
        for nome, im in icones.items():
            im.save(os.path.join(pasta, nome + ".png"))
    print("ok:", ", ".join(f"{n} {im.width}x{im.height}" for n, im in icones.items()))
