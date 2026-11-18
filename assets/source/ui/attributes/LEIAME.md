# HUD de atributos

Assets prontos no atlas para a placa de atributos do proprio jogador. A ligacao
com o estado do jogo fica no codigo do HUD.

## Pecas

| Arquivo | Tamanho | Uso |
|---|---|---|
| `ui-icone-bomba.png` | 11x13 | bombas simultaneas (PixelLab, ajustado) |
| `ui-icone-alcance.png` | 12x13 | alcance da explosao (PixelLab, ajustado) |
| `ui-icone-velocidade.png` | 15x13 | impulso de velocidade (PixelLab, com rastro) |
| `ui-barra-moldura.png` | 24x5 | moldura da barra do impulso |
| `ui-barra-preenchimento.png` | 22x3 | preenchimento; cortar da direita conforme o tempo restante |
| `ui-banner.png` | 9-slice 15 px | placa, igual a do relogio |

Os icones saem de `assets/source/ui/desenho/icones_atributos.py`, a partir dos
PNGs gerados nesta pasta: corpo da bomba preenchido e pavio compacto, ponta do
fogo sem contorno e bota com rastro no lugar da marca solta.
A barra sai de `glifos.py`.

## Layout

- Placa com 32 px de altura e 20 px de margem interna lateral, como a do relogio.
  O miolo escuro vai da linha 8 a 20; icones e texto centralizados na linha 14:
  icone em `14 - floor(altura / 2)`, texto (9 px) na linha 10.
- Ordem: bomba, numero, alcance, numero, bota, barra.
- 4 px entre icone e numero ou barra; 12 px entre grupos.
- Barra com o topo na linha 12; o preenchimento fica 1 px para dentro da moldura.
- Posicao: `placaDireitaX(timer.bordaDireitaTopo, largura)` em
  `client/src/render/hud/top-layout.ts`, recalculada quando a placa do relogio
  muda de largura.

## Texto de coleta

Fonte do HUD (`textoHud`), que agora tem o glifo `+`. Tint por item em
`COR_COLETA` (`client/src/render/palette.ts`): bomba creme, alcance laranja,
velocidade ciano.
