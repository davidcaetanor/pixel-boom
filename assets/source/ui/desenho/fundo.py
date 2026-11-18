"""
Fundo do lobby e da sala: uma arena montada com os tiles do proprio jogo, com
o centro livre para o painel. Sem geracao: muda junto quando os tiles mudam.
Uso: python fundo.py <pasta_atlas> <pasta_processed>
"""
import os
import random
import sys

from PIL import Image

T, COLUNAS, LINHAS = 32, 30, 17
CENTRO_LIVRE = (11, 19, 5, 12)  # x0, x1, y0, y1 em celulas
CHANCE_CAIXA, CHANCE_BOMBA = 0.38, 0.43
SEMENTE = 7
# Mesma alternancia e mesmos quadros de beira da arena (arena-view.ts).
SEBES = ("sebe-a", "sebe-b")
PASSO_X, PASSO_Y = 7, 3
PLANO, BAIXO, CIMA, ESQUERDA, DIREITA = range(5)


def quadro_sebe(x, y):
    meio_x, meio_y = 0 < x < COLUNAS - 1, 0 < y < LINHAS - 1
    if y == 0 and meio_x:
        return BAIXO
    if y == LINHAS - 1 and meio_x:
        return CIMA
    if x == 0 and meio_y:
        return DIREITA
    if x == COLUNAS - 1 and meio_y:
        return ESQUERDA
    return PLANO


if __name__ == "__main__":
    atlas, processed = sys.argv[1:3]
    carrega = lambda n: Image.open(os.path.join(atlas, n + ".png")).convert("RGBA")  # noqa: E731
    claro, escuro, caixa, pilar = (carrega(n) for n in ("piso-claro", "piso-escuro", "caixa", "pilar"))
    bomba = carrega("bomba").crop((0, 0, T, T))
    sebes = [carrega(n) for n in SEBES]
    rng = random.Random(SEMENTE)
    img = Image.new("RGBA", (COLUNAS * T, LINHAS * T))
    x0, x1, y0, y1 = CENTRO_LIVRE
    for y in range(LINHAS):
        for x in range(COLUNAS):
            img.alpha_composite(claro if (x + y) % 2 == 0 else escuro, (x * T, y * T))
            borda = x in (0, COLUNAS - 1) or y in (0, LINHAS - 1)
            if borda:
                folha = sebes[(x * PASSO_X + y * PASSO_Y) % len(sebes)]
                q = quadro_sebe(x, y)
                img.alpha_composite(folha.crop((q * T, 0, q * T + T, T)), (x * T, y * T))
            elif x0 <= x < x1 and y0 <= y < y1:
                continue
            elif x % 2 == 0 and y % 2 == 0:
                img.alpha_composite(pilar, (x * T, y * T))
            else:
                r = rng.random()
                if r < CHANCE_CAIXA:
                    img.alpha_composite(caixa, (x * T, y * T))
                elif r < CHANCE_BOMBA:
                    img.alpha_composite(bomba, (x * T, y * T))
    for pasta in (atlas, processed):
        img.save(os.path.join(pasta, "ui-fundo.png"), optimize=True)
    print("fundo", img.size)
