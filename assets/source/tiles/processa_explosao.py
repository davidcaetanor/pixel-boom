"""
Processa a bomba e a explosao para o atlas, em folhas de animacao.

Explosao: braco, ponta e centro, cada um em 4 quadros (nascendo, cheia,
tremulando, esfriando). O braco emenda consigo mesmo (coluna 31 = coluna 0), a
ponta comeca com as colunas do braco e o centro fora do miolo e a propria cruz
de bracos, entao toda emenda e exata; o script falha se alguma nao bater. O
miolo do centro veio de um inpaint feito sobre essa cruz.

Bomba: parada, respirando (1 px abaixo) e o clarao antes de explodir. O corpo
escuro e reduzido a poucos tons; brilho, faisca e pavio ficam presos a cores
fixas para nao perderem a forca.
Uso: python processa_explosao.py <assets/source> <pasta_processed> <pasta_atlas>
"""
import os
import sys

from PIL import Image, ImageOps

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ui", "desenho"))
from processa_kit import binariza_alfa, limpa  # noqa: E402
from processa_arena import centraliza, reduz_paleta  # noqa: E402

T = 32
C = (T - 1) / 2
RAIO_MIOLO = 11.5        # mascara usada no inpaint do centro
COLUNAS_EMENDA_PONTA = 14
CORES_CHAMA = 8
LUZ_NASCENDO = 170       # no primeiro quadro so aparece o que e mais claro que isso
TONS_CORPO_BOMBA = 5
CORES_FIXAS_BOMBA = [(255, 255, 255, 255), (200, 200, 210, 255), (255, 146, 40, 255),
                     (255, 214, 72, 255), (154, 91, 46, 255)]
BRANCO = (255, 255, 255, 255)


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] if c[3] else -1


def mapa(im, f):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y][3]:
                px[x, y] = f(px[x, y])
    return out


def chama(caminho):
    im = binariza_alfa(Image.open(caminho).convert("RGBA"))
    im = reduz_paleta(im, CORES_CHAMA)
    return limpa(im)[0]


def braco(origem):
    h = chama(os.path.join(origem, "braco.png"))
    px = h.load()
    for y in range(T):
        px[T - 1, y] = px[0, y]
    return h


def ponta(origem, h):
    p = chama(os.path.join(origem, "ponta.png"))
    px, hp = p.load(), h.load()
    for x in range(COLUNAS_EMENDA_PONTA):
        for y in range(T):
            px[x, y] = hp[x, y]
    return p


def cruz(h):
    v = h.transpose(Image.Transpose.ROTATE_90)
    out = Image.new("RGBA", (T, T))
    px = out.load()
    for y in range(T):
        for x in range(T):
            a, b = h.getpixel((x, y)), v.getpixel((x, y))
            px[x, y] = a if lum(a) >= lum(b) else b
    return out


def centro(origem, h):
    c = chama(os.path.join(origem, "centro.png"))
    base = cruz(h)
    px = c.load()
    for y in range(T):
        for x in range(T):
            if (x - C) ** 2 + (y - C) ** 2 > RAIO_MIOLO ** 2:
                px[x, y] = base.getpixel((x, y))
    return c


def quadros(peca, tremula):
    nascendo = mapa(peca, lambda p: p if lum(p) >= LUZ_NASCENDO else (0, 0, 0, 0))
    esfriando = mapa(peca, lambda p: (max(0, p[0] - 30), int(p[1] * 0.7), int(p[2] * 0.5), 255) if lum(p) > 60 else p)
    return [nascendo, peca, tremula(peca), esfriando]


def folha(qs):
    out = Image.new("RGBA", (T * len(qs), T))
    for i, q in enumerate(qs):
        out.alpha_composite(q, (i * T, 0))
    return out


def confere_emenda(a, b, nome):
    """Borda direita de `a` igual a borda esquerda de `b`, em todos os quadros."""
    for q in range(4):
        for y in range(T):
            if a.getpixel((q * T + T - 1, y)) != b.getpixel((q * T, y)):
                raise SystemExit(f"emenda quebrada em {nome}, quadro {q}, linha {y}")


def bomba(origem):
    im = binariza_alfa(Image.open(os.path.join(origem, "bomba.png")).convert("RGBA"))
    px = im.load()
    escuros = []
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if not c[3]:
                continue
            if lum(c) > 150 or max(c[:3]) - min(c[:3]) > 60:
                px[x, y] = min(CORES_FIXAS_BOMBA, key=lambda f: sum((a - b) ** 2 for a, b in zip(c[:3], f[:3])))
            else:
                escuros.append((x, y))
    corpo = Image.new("RGB", (len(escuros), 1))
    for i, (x, y) in enumerate(escuros):
        corpo.putpixel((i, 0), px[x, y][:3])
    tons = corpo.quantize(colors=TONS_CORPO_BOMBA, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    for i, (x, y) in enumerate(escuros):
        px[x, y] = tons.getpixel((i, 0)) + (255,)
    im = centraliza(limpa(im)[0])
    respira = Image.new("RGBA", (T, T))
    respira.alpha_composite(im, (0, 1))
    clarao = mapa(im, lambda p: BRANCO if 40 < lum(p) < 150 else p)
    return folha([im, respira, clarao])


def salva(im, nome, destinos):
    for d in destinos:
        im.save(os.path.join(d, nome + ".png"), optimize=True)


if __name__ == "__main__":
    fonte, *destinos = sys.argv[1:4]
    explosao = os.path.join(fonte, "tiles", "explosion_v2")
    h = braco(explosao)
    p = ponta(explosao, h)
    c = centro(explosao, h)
    gira = lambda im: im.rotate(180)  # noqa: E731
    pecas = {
        "chama-centro": folha(quadros(c, gira)),
        "chama-braco-h": folha(quadros(h, gira)),
        "chama-braco-v": folha(quadros(h.transpose(Image.Transpose.ROTATE_90), gira)),
        "chama-ponta-leste": folha(quadros(p, ImageOps.flip)),
        "chama-ponta-oeste": folha(quadros(ImageOps.mirror(p), ImageOps.flip)),
        "chama-ponta-norte": folha(quadros(p.transpose(Image.Transpose.ROTATE_90), ImageOps.mirror)),
        "chama-ponta-sul": folha(quadros(p.transpose(Image.Transpose.ROTATE_270), ImageOps.mirror)),
    }
    confere_emenda(pecas["chama-centro"], pecas["chama-braco-h"], "centro|braco")
    confere_emenda(pecas["chama-braco-h"], pecas["chama-braco-h"], "braco|braco")
    confere_emenda(pecas["chama-braco-h"], pecas["chama-ponta-leste"], "braco|ponta")
    for nome, im in pecas.items():
        salva(im, nome, destinos)
    salva(bomba(os.path.join(fonte, "objects", "bomb_v2")), "bomba", destinos)
    print("ok:", ", ".join(sorted(pecas)), "+ bomba")
