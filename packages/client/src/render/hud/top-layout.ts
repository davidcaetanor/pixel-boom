/**
 * Posicao de uma placa no canto direito do topo, equidistante da placa do
 * relogio e da borda da tela. Recalcular quando a placa do relogio mudar de
 * largura (por exemplo, quando a arena comeca a fechar).
 */
import { LOGICAL_WIDTH } from "@pixelboom/shared";

export function placaDireitaX(bordaDireitaRelogio: number, largura: number): number {
  const livre = LOGICAL_WIDTH - bordaDireitaRelogio - largura;
  return bordaDireitaRelogio + Math.floor(livre / 2);
}
