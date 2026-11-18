/**
 * Registro unico dos nomes de textura. O sufixo "-provisorio" marca recortes
 * diretos da arte crua, a serem substituidos pelo atlas definitivo.
 */
import { CAST } from "@pixelboom/shared";

export const TEXTURA = {
  pisoClaro: "piso-claro",
  pisoEscuro: "piso-escuro",
  pilar: "pilar",
  caixa: "caixa",
  spawn: "spawn-provisorio",
  powerupBomba: "powerup-bomba",
  powerupAlcance: "powerup-alcance",
  powerupVelocidade: "powerup-velocidade",
  uiSeta: "ui-seta",
  uiBadge: "ui-badge",
  uiBanner: "ui-banner",
  uiFonte: "ui-fonte",
  uiVitoria: "ui-vitoria",
  uiVitoriaVazia: "ui-vitoria-vazia",
  uiIconeBomba: "ui-icone-bomba",
  uiIconeAlcance: "ui-icone-alcance",
  uiIconeVelocidade: "ui-icone-velocidade",
  uiBarraMoldura: "ui-barra-moldura",
  uiBarraPreenchimento: "ui-barra-preenchimento",
} as const;

/**
 * Folhas animadas de 32x32, um quadro por coluna. Bomba: parada, respirando e
 * clarao. Chamas: nascendo, cheia, tremulando e esfriando.
 */
export const ANIMADAS = {
  bomba: "bomba",
  chamaCentro: "chama-centro",
  chamaBracoH: "chama-braco-h",
  chamaBracoV: "chama-braco-v",
  chamaPontaLeste: "chama-ponta-leste",
  chamaPontaOeste: "chama-ponta-oeste",
  chamaPontaNorte: "chama-ponta-norte",
  chamaPontaSul: "chama-ponta-sul",
} as const;

/**
 * Cerca-viva da borda: dois tiles que alternam, cada um numa folha de 5 quadros
 * (plano e beira ondulada voltada para a area jogavel).
 */
export const SEBE = {
  folhas: ["sebe-a", "sebe-b"],
  quadro: { plano: 0, baixo: 1, cima: 2, esquerda: 3, direita: 4 },
} as const;

export type NomeAnimada = (typeof ANIMADAS)[keyof typeof ANIMADAS];
export const QUADRO_ANIMADA = 32;

/** Digitos grandes 0-9 da contagem regressiva, um quadro por digito. */
export const DIGITOS = { chave: "ui-digitos", larguraFrame: 19, alturaFrame: 32 } as const;

/** Bordas fixas do banner no 9-slice, em pixels da textura. */
export const BANNER_BORDA = { lateral: 15, vertical: 15 } as const;

export type NomeTextura = (typeof TEXTURA)[keyof typeof TEXTURA];

/** Caminho publico de cada textura. */
export function caminhoDaTextura(nome: NomeTextura): string {
  return `/${nome}.png`;
}

/**
 * Formato das folhas de personagem: uma linha por direcao, na ordem de
 * DIRECOES_FOLHA. A coluna 0 e o quadro parado e as seguintes, a caminhada.
 * Quadros de 48x48 com o personagem na escala do tile de 32.
 */
export const FOLHA_PERSONAGEM = {
  larguraFrame: 48,
  alturaFrame: 48,
  colunas: 8,
  framesCaminhada: 6,
  /** Ultima coluna: o quadro de respiracao, alternado com o parado. */
  colunaRespiracao: 7,
} as const;

export const DIRECOES_FOLHA = ["south", "west", "east", "north"] as const;
export type DirecaoFolha = (typeof DIRECOES_FOLHA)[number];

/** Elenco na ordem dos indices de personagem. */
export const ELENCO = CAST;

export function chaveDoPersonagem(character: number): string {
  return `personagem-${ELENCO[character % ELENCO.length] ?? ELENCO[0]}`;
}

export function caminhoDaFolha(chave: string): string {
  return `/${chave}.png`;
}
