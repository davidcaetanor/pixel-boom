"""
Recorta os controles de toque do template gerado em controles/controles.png,
com a mesma limpeza do kit de UI.
Uso: python processa_controles.py <assets/source/ui> <pasta_atlas>
"""
import os
import sys
from PIL import Image
from processa_kit import binariza_alfa, limpa

# Pecas do template da esquerda para a direita, separadas por regiao opaca conectada.
PECAS = ("ui-toque-direcional", "ui-toque-bomba", "ui-toque-pausa")


# Miolo do botao de bomba: o azul do kit apaga a bomba preta; o tom quente
# destaca a bomba e marca o botao de acao.
MIOLO_BOMBA_SEMENTE = (20, 48)
MIOLO_BOMBA_COR = (214, 88, 44, 255)
TOLERANCIA_MIOLO = 6


def pinta_miolo(im, semente, cor):
    px = im.load()
    base = px[semente]
    pilha, vistos = [semente], set()
    while pilha:
        x, y = pilha.pop()
        if (x, y) in vistos or not (0 <= x < im.width and 0 <= y < im.height):
            continue
        vistos.add((x, y))
        c = px[x, y]
        if c[3] == 0 or max(abs(c[i] - base[i]) for i in range(3)) > TOLERANCIA_MIOLO:
            continue
        px[x, y] = cor
        pilha.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


# Seta acesa do direcional e miolo da bomba pressionada.
COR_ACESA = (255, 146, 40, 255)
MIOLO_PRESSIONADO = (170, 64, 32, 255)
# Uma seta e uma regiao clara pequena; a borda clara do direcional e uma so, enorme.
MAX_PIXELS_SETA = 120
LIMIAR_CLARO = 150
# Setas ficam no meio de cada braco; regioes claras alem disso sao a borda da ponta.
MAX_DISTANCIA_SETA = 0.4


def setas(im):
    """Overlay de cada seta (cima, direita, baixo, esquerda) recolorida, no tamanho da peca."""
    px = im.load()
    cx, cy = im.width / 2, im.height / 2
    vistos, saida = set(), {}
    for y0 in range(im.height):
        for x0 in range(im.width):
            c = px[x0, y0]
            if c[3] == 0 or min(c[:3]) < LIMIAR_CLARO or (x0, y0) in vistos:
                continue
            pilha, regiao = [(x0, y0)], []
            vistos.add((x0, y0))
            while pilha:
                x, y = pilha.pop()
                regiao.append((x, y))
                for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= n[0] < im.width and 0 <= n[1] < im.height and n not in vistos:
                        v = px[n]
                        if v[3] and min(v[:3]) >= LIMIAR_CLARO:
                            vistos.add(n)
                            pilha.append(n)
            if len(regiao) > MAX_PIXELS_SETA:
                continue
            mx = sum(x for x, _ in regiao) / len(regiao) - cx
            my = sum(y for _, y in regiao) / len(regiao) - cy
            if max(abs(mx) / im.width, abs(my) / im.height) > MAX_DISTANCIA_SETA:
                continue
            lado = ("direita" if mx > 0 else "esquerda") if abs(mx) > abs(my) else ("baixo" if my > 0 else "cima")
            camada = saida.setdefault(lado, Image.new("RGBA", im.size, (0, 0, 0, 0)))
            for x, y in regiao:
                camada.putpixel((x, y), COR_ACESA)
    return saida


def caixas(im):
    """Caixa de cada regiao opaca conectada (8 vizinhos), da esquerda para a direita."""
    px = im.load()
    vistos, resultado = set(), []
    for y0 in range(im.height):
        for x0 in range(im.width):
            if px[x0, y0][3] == 0 or (x0, y0) in vistos:
                continue
            pilha, xs, ys = [(x0, y0)], [], []
            vistos.add((x0, y0))
            while pilha:
                x, y = pilha.pop()
                xs.append(x)
                ys.append(y)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (x + dx, y + dy)
                        if 0 <= n[0] < im.width and 0 <= n[1] < im.height and n not in vistos and px[n][3]:
                            vistos.add(n)
                            pilha.append(n)
            resultado.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, len(xs)))
    grandes = sorted(resultado, key=lambda c: c[4], reverse=True)[: len(PECAS)]
    return [c[:4] for c in sorted(grandes)]


if __name__ == "__main__":
    origem, destino = sys.argv[1:3]
    template = binariza_alfa(Image.open(os.path.join(origem, "controles/controles.png")).convert("RGBA"))
    for nome, caixa in zip(PECAS, caixas(template)):
        im, trocas = limpa(template.crop(caixa))
        if nome == "ui-toque-bomba":
            im = pinta_miolo(im, MIOLO_BOMBA_SEMENTE, MIOLO_BOMBA_COR)
        im.save(os.path.join(destino, nome + ".png"), optimize=True)
        print(f"{nome:22} {im.size} ruido limpo={trocas}")
        if nome == "ui-toque-direcional":
            for lado, camada in setas(im).items():
                camada.save(os.path.join(destino, f"ui-toque-seta-{lado}.png"), optimize=True)
                print(f"  seta {lado}")
        if nome == "ui-toque-bomba":
            pressionada = pinta_miolo(im.copy(), MIOLO_BOMBA_SEMENTE, MIOLO_PRESSIONADO)
            pressionada.save(os.path.join(destino, "ui-toque-bomba-pressionada.png"), optimize=True)
