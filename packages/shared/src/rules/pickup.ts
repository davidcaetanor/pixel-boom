/** Itens: sorteio nas caixas destruidas, queima pela chama, coleta e efeito com teto. */
import { cellIndex, cellX, cellY } from "../config/arena.js";
import { BALANCE } from "../config/balance.js";
import type { Player } from "../domain/player.js";
import { POWER_UP_KINDS, PowerUpKind, type PowerUp } from "../domain/powerup.js";
import { nextChance, nextFloat, type RngState } from "../simulation/rng.js";
import { playerCell } from "./bomb-placement.js";

export interface Drops {
  readonly powerUps: PowerUp[];
  readonly rng: RngState;
}

const WEIGHTS = BALANCE.mapGeneration.powerUpWeights;
const TOTAL_WEIGHT = WEIGHTS.reduce((soma, w) => soma + w, 0);

/** `roll` em [0, 1) escolhe o tipo pela fatia acumulada de cada peso. */
export function weightedKind(roll: number): PowerUpKind {
  let limit = 0;
  for (let i = 0; i < POWER_UP_KINDS.length; i += 1) {
    limit += (WEIGHTS[i] ?? 0) / TOTAL_WEIGHT;
    if (roll < limit) {
      return POWER_UP_KINDS[i] ?? PowerUpKind.Bomb;
    }
  }
  return POWER_UP_KINDS[POWER_UP_KINDS.length - 1] ?? PowerUpKind.Bomb;
}

/** Sorteio em ordem crescente de indice, para o consumo do RNG ser deterministico. */
export function rollDrops(crates: Iterable<number>, rng: RngState): Drops {
  const ordered = [...crates].sort((a, b) => a - b);
  const powerUps: PowerUp[] = [];
  let state = rng;
  for (const index of ordered) {
    const [drops, afterChance] = nextChance(state, BALANCE.mapGeneration.powerUpChance);
    state = afterChance;
    if (!drops) {
      continue;
    }
    const [roll, afterKind] = nextFloat(state);
    state = afterKind;
    const kind = weightedKind(roll);
    powerUps.push({ kind, x: cellX(index), y: cellY(index) });
  }
  return { powerUps, rng: state };
}

export function burnPowerUps(powerUps: readonly PowerUp[], flames: ReadonlySet<number>): PowerUp[] {
  return powerUps.filter((p) => !flames.has(cellIndex(p.x, p.y)));
}

export function applyPowerUp(player: Player, kind: PowerUpKind): Player {
  const p = BALANCE.player;
  switch (kind) {
    case PowerUpKind.Bomb:
      return { ...player, maxBombs: Math.min(player.maxBombs + p.bombsStep, p.bombsMax) };
    case PowerUpKind.Range:
      return { ...player, range: Math.min(player.range + p.rangeStep, p.rangeMax) };
    case PowerUpKind.Speed:
      return { ...player, speed: p.speedInitial + p.speedBoost, speedBoost: p.speedBoostSeconds };
  }
}

export interface Collection {
  readonly players: Player[];
  readonly powerUps: PowerUp[];
}

/** Coleta pela celula do centro do jogador. */
export function collectPowerUps(players: readonly Player[], powerUps: readonly PowerUp[]): Collection {
  let remaining = [...powerUps];
  const updated = players.map((player) => {
    if (!player.alive) {
      return player;
    }
    const cell = playerCell(player);
    const taken = remaining.filter((p) => p.x === cell.x && p.y === cell.y);
    if (taken.length === 0) {
      return player;
    }
    remaining = remaining.filter((p) => !taken.includes(p));
    return taken.reduce((acc, p) => applyPowerUp(acc, p.kind), player);
  });
  return { players: updated, powerUps: remaining };
}
