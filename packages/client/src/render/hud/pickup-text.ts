/**
 * Texto que sobe do proprio personagem ao pegar um item. O ganho e deduzido
 * comparando os atributos entre dois estados confirmados.
 */
import type Phaser from "phaser";
import type { Player } from "@pixelboom/shared";
import { COR_COLETA } from "../palette.js";
import { textoHud } from "./pixel-text.js";
import { HUD_DEPTH } from "./timer.js";

const SUBIDA = 14;
const DURACAO_MS = 900;
/** Distancia do centro do personagem ate o texto. */
const ACIMA = 22;

type Atributos = Pick<Player, "maxBombs" | "range" | "speedBoost">;

export function ganhos(antes: Atributos, depois: Atributos): { texto: string; cor: number }[] {
  const lista: { texto: string; cor: number }[] = [];
  if (depois.maxBombs > antes.maxBombs) {
    lista.push({ texto: "+1 BOMBA", cor: COR_COLETA.bomba });
  }
  if (depois.range > antes.range) {
    lista.push({ texto: "+1 ALCANCE", cor: COR_COLETA.alcance });
  }
  if (depois.speedBoost > antes.speedBoost) {
    lista.push({ texto: "+VELOCIDADE", cor: COR_COLETA.velocidade });
  }
  return lista;
}

export class PickupText {
  private anterior: Atributos | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  render(self: Player | undefined, x: number, y: number): void {
    if (self === undefined || !self.alive) {
      this.anterior = null;
      return;
    }
    const atual = { maxBombs: self.maxBombs, range: self.range, speedBoost: self.speedBoost };
    if (this.anterior !== null) {
      ganhos(this.anterior, atual).forEach((ganho, i) => this.mostra(ganho.texto, ganho.cor, x, y - i * 10));
    }
    this.anterior = atual;
  }

  private mostra(texto: string, cor: number, x: number, y: number): void {
    const label = textoHud(this.scene, 0, 0, texto).setTint(cor).setDepth(HUD_DEPTH);
    label.setPosition(Math.round(x - label.width / 2), Math.round(y - ACIMA));
    this.scene.tweens.add({
      targets: label,
      y: label.y - SUBIDA,
      alpha: 0,
      duration: DURACAO_MS,
      ease: "Quad.easeOut",
      onUpdate: () => label.setY(Math.round(label.y)),
      onComplete: () => label.destroy(),
    });
  }
}
