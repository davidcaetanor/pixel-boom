/**
 * Chamas em cruz continua: centro na origem, bracos no meio e ponta arredondada
 * na ultima celula de cada direcao. As pecas emendam pixel a pixel e animam pelo
 * tempo desde que a explosao apareceu: nasce, queima tremulando e esfria.
 */
import type Phaser from "phaser";
import { BALANCE, TILE_SIZE, cellX, cellY, type Explosion } from "@pixelboom/shared";
import { ANIMADAS, type NomeAnimada } from "../atlas/atlas-registry.js";

/** Acima da bomba e do jogador. */
const FLAME_DEPTH = 15;
const QUADRO_NASCENDO = 0;
const QUADRO_CHEIA = 1;
const QUADRO_TREMULA = 2;
const QUADRO_ESFRIANDO = 3;
const NASCENDO_MS = 60;
const TREMULA_MS = 90;
const ESFRIANDO_MS = 120;
const VIDA_MS = BALANCE.time.flameOnScreen * 1000;

interface Peca {
  readonly imagem: Phaser.GameObjects.Image;
}

interface Grupo {
  readonly pecas: Peca[];
  readonly nasceu: number;
}

function quadro(idadeMs: number): number {
  if (idadeMs < NASCENDO_MS) {
    return QUADRO_NASCENDO;
  }
  if (idadeMs > VIDA_MS - ESFRIANDO_MS) {
    return QUADRO_ESFRIANDO;
  }
  return Math.floor((idadeMs - NASCENDO_MS) / TREMULA_MS) % 2 === 0 ? QUADRO_CHEIA : QUADRO_TREMULA;
}

/** Peca de uma celula do braco: ponta se a proxima celula na mesma direcao nao queima. */
function pecaDaCelula(cell: number, ox: number, oy: number, celulas: ReadonlySet<string>): NomeAnimada {
  const x = cellX(cell);
  const y = cellY(cell);
  const dx = Math.sign(x - ox);
  const dy = Math.sign(y - oy);
  const ponta = !celulas.has(`${x + dx},${y + dy}`);
  if (dy === 0) {
    if (!ponta) {
      return ANIMADAS.chamaBracoH;
    }
    return dx > 0 ? ANIMADAS.chamaPontaLeste : ANIMADAS.chamaPontaOeste;
  }
  if (!ponta) {
    return ANIMADAS.chamaBracoV;
  }
  return dy > 0 ? ANIMADAS.chamaPontaSul : ANIMADAS.chamaPontaNorte;
}

export class ExplosionView {
  private readonly grupos = new Map<number, Grupo>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(explosions: readonly Explosion[]): void {
    const agora = this.scene.time.now;
    const vivas = new Set<number>();
    for (const explosion of explosions) {
      vivas.add(explosion.id);
      let grupo = this.grupos.get(explosion.id);
      if (grupo === undefined) {
        grupo = { pecas: this.desenha(explosion), nasceu: agora };
        this.grupos.set(explosion.id, grupo);
      }
      const q = quadro(agora - grupo.nasceu);
      for (const peca of grupo.pecas) {
        peca.imagem.setFrame(q);
      }
    }
    for (const [id, grupo] of this.grupos) {
      if (!vivas.has(id)) {
        grupo.pecas.forEach((p) => p.imagem.destroy());
        this.grupos.delete(id);
      }
    }
  }

  private desenha(explosion: Explosion): Peca[] {
    const [origem, ...bracos] = explosion.cells;
    if (origem === undefined) {
      return [];
    }
    const ox = cellX(origem);
    const oy = cellY(origem);
    const celulas = new Set(explosion.cells.map((c) => `${cellX(c)},${cellY(c)}`));
    const pecas = [this.coloca(ANIMADAS.chamaCentro, origem)];
    for (const cell of bracos) {
      pecas.push(this.coloca(pecaDaCelula(cell, ox, oy, celulas), cell));
    }
    return pecas;
  }

  private coloca(textura: NomeAnimada, cell: number): Peca {
    const imagem = this.scene.add
      .image(cellX(cell) * TILE_SIZE, cellY(cell) * TILE_SIZE, textura, QUADRO_NASCENDO)
      .setOrigin(0, 0)
      .setDepth(FLAME_DEPTH);
    return { imagem };
  }
}
