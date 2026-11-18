/**
 * Escala inteira em pixels de tela. Cada pixel de arte ocupa um numero inteiro
 * de pixels fisicos, inclusive com o Windows em 125% ou 150%; escala fracionaria
 * desenha pixels de larguras diferentes e a arte parece borrada.
 *
 * Em aparelho de toque a arena divide a largura com os controles: cada lado
 * reserva a faixa do direcional, e nenhum controle cobre celula jogavel.
 *
 * Duas excecoes, ambas para nao perder o jogo: quando nem 1x cabe a arena
 * encolhe na escala que couber, em vez de ser cortada; e em aparelho de toque
 * que so alcanca 1x a arena ocupa toda a area livre, porque em 1x a celula
 * fica pequena demais para o dedo.
 */
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, RENDER_ZOOM } from "@pixelboom/shared";
import { isTouchDevice } from "../app/touch-screen.js";

/** Maior painel HTML (a sala com os 8 cards), em pixels de arte, empilhado e deitado. */
const UI_EMPILHADA = { largura: 348, altura: 392 };
const UI_DEITADA = { largura: 530, altura: 230 };

/** Lado do direcional em pixels de arte e o tamanho que ele deve ter no dedo, em px CSS. */
const DIRECIONAL_ARTE = 98;
const DIRECIONAL_ALVO_CSS = 112;
/** Folga entre o controle e a borda da tela ou da arena, em px CSS. */
const FOLGA_CONTROLE_CSS = 12;

function dpr(): number {
  return window.devicePixelRatio || 1;
}

function encaixe(largura: number, altura: number, reservaCss = 0): number {
  const d = dpr();
  return Math.min(((window.innerWidth - reservaCss) * d) / largura, (window.innerHeight * d) / altura);
}

/** Maior multiplo inteiro que cabe na janela, limitado ao zoom de projeto. */
function multiploQueCabe(largura: number, altura: number, reservaCss = 0): number {
  const alvo = Math.round(RENDER_ZOOM * dpr());
  if (window.innerWidth === 0 || window.innerHeight === 0) {
    return alvo;
  }
  return Math.max(1, Math.min(Math.floor(encaixe(largura, altura, reservaCss)), alvo));
}

/** Largura CSS que os controles de toque tiram da arena, somando os dois lados. */
function reservaDosControles(): number {
  if (!isTouchDevice()) {
    return 0;
  }
  return 2 * (DIRECIONAL_ARTE * zoomToque() + 2 * FOLGA_CONTROLE_CSS);
}

/** Zoom CSS do canvas: pixels fisicos por pixel de arte, inteiro sempre que der. */
export function zoomCss(): number {
  const reserva = reservaDosControles();
  const inteiro = multiploQueCabe(LOGICAL_WIDTH, LOGICAL_HEIGHT, reserva);
  const livre = encaixe(LOGICAL_WIDTH, LOGICAL_HEIGHT, reserva);
  if (window.innerWidth > 0 && (livre < 1 || (inteiro === 1 && reserva > 0))) {
    return livre / dpr();
  }
  return inteiro / dpr();
}

/**
 * Zoom CSS dos paineis HTML, que cabem em telas onde a arena nao cabe em 2x.
 * Em tela baixa (celular deitado, janela achatada) a sala deitada ganha zoom
 * e liga `.ui-deitada` no documento.
 */
export function zoomUi(): number {
  const empilhada = multiploQueCabe(UI_EMPILHADA.largura, UI_EMPILHADA.altura);
  const deitada = multiploQueCabe(UI_DEITADA.largura, UI_DEITADA.altura);
  const usaDeitada = deitada > empilhada;
  document.documentElement.classList.toggle("ui-deitada", usaDeitada);
  return (usaDeitada ? deitada : empilhada) / dpr();
}

/** Zoom CSS dos controles de toque: multiplo inteiro mais perto do tamanho de dedo. */
function zoomToque(): number {
  const d = dpr();
  return Math.max(1, Math.round((DIRECIONAL_ALVO_CSS * d) / DIRECIONAL_ARTE)) / d;
}

/**
 * Publica `--ui-zoom`, `--touch-zoom` e a largura livre ao lado da arena
 * (`--arena-margem`), e avisa o zoom do canvas a cada mudanca de janela ou de
 * escala do sistema.
 */
export function acompanhaEscala(aoMudar: (zoom: number) => void): void {
  const aplica = (): void => {
    const zoom = zoomCss();
    const raiz = document.documentElement.style;
    raiz.setProperty("--ui-zoom", String(zoomUi()));
    raiz.setProperty("--touch-zoom", String(zoomToque()));
    raiz.setProperty("--arena-margem", `${Math.max(0, (window.innerWidth - LOGICAL_WIDTH * zoom) / 2)}px`);
    aoMudar(zoom);
  };
  window.addEventListener("resize", aplica);
  aplica();
}
