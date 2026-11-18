/**
 * Uma imagem por bomba, sincronizada pelo id. A bomba pulsa durante o pavio e
 * pisca em clarao no fim, pelo tempo desde que apareceu: o cliente nao recebe o
 * pavio restante, mas a duracao vem de balance.ts.
 */
import type Phaser from "phaser";
import { BALANCE, CELL_CENTER, TILE_SIZE, type Bomb } from "@pixelboom/shared";
import { ANIMADAS } from "../atlas/atlas-registry.js";

/** Acima da arena, abaixo do jogador. */
const BOMB_DEPTH = 5;
const QUADRO_PARADA = 0;
const QUADRO_RESPIRA = 1;
const QUADRO_CLARAO = 2;
const PULSO_MS = 350;
const CLARAO_JANELA_MS = 600;
const CLARAO_PISCA_MS = 100;
const PAVIO_MS = BALANCE.time.bombFuse * 1000;

interface Visual {
  readonly imagem: Phaser.GameObjects.Image;
  readonly nasceu: number;
}

function quadro(idadeMs: number): number {
  if (idadeMs > PAVIO_MS - CLARAO_JANELA_MS) {
    return Math.floor(idadeMs / CLARAO_PISCA_MS) % 2 === 0 ? QUADRO_CLARAO : QUADRO_PARADA;
  }
  return Math.floor(idadeMs / PULSO_MS) % 2 === 0 ? QUADRO_PARADA : QUADRO_RESPIRA;
}

export class BombView {
  private readonly visuais = new Map<number, Visual>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(bombs: readonly Bomb[]): void {
    const agora = this.scene.time.now;
    const vivos = new Set<number>();
    for (const bomb of bombs) {
      vivos.add(bomb.id);
      let visual = this.visuais.get(bomb.id);
      if (visual === undefined) {
        const imagem = this.scene.add
          .image((bomb.x + CELL_CENTER) * TILE_SIZE, (bomb.y + CELL_CENTER) * TILE_SIZE, ANIMADAS.bomba, QUADRO_PARADA)
          .setDepth(BOMB_DEPTH);
        visual = { imagem, nasceu: agora };
        this.visuais.set(bomb.id, visual);
      }
      visual.imagem.setFrame(quadro(agora - visual.nasceu));
    }
    for (const [id, visual] of this.visuais) {
      if (!vivos.has(id)) {
        visual.imagem.destroy();
        this.visuais.delete(id);
      }
    }
  }
}
