/** Previsao de chama por celula: bombas no chao com a cadeia, chamas acesas e aneis da morte subita. */
import { CELL_COUNT, cellIndex } from "../config/arena.js";
import { BALANCE } from "../config/balance.js";
import { SUDDEN_DEATH_RINGS } from "../config/sudden-death-order.js";
import type { Bomb } from "../domain/bomb.js";
import type { MatchState } from "../domain/match-state.js";
import { propagate } from "../rules/explosion-propagation.js";

export interface DangerMap {
  /** Segundos ate a chama chegar; Infinity onde nao chega. */
  readonly start: Float64Array;
  /** Segundos ate a chama apagar. */
  readonly end: Float64Array;
  /** Segundos ate o anel da celula virar parede; Infinity fora da morte subita. */
  readonly closes: Float64Array;
}

export type DangerSource = Pick<MatchState, "grid" | "bombs" | "explosions" | "elapsed" | "ringsClosed">;

function emptyDanger(): DangerMap {
  return {
    start: new Float64Array(CELL_COUNT).fill(Infinity),
    end: new Float64Array(CELL_COUNT),
    closes: new Float64Array(CELL_COUNT).fill(Infinity),
  };
}

function mark(danger: DangerMap, cell: number, from: number, until: number): void {
  danger.start[cell] = Math.min(danger.start[cell] ?? Infinity, from);
  danger.end[cell] = Math.max(danger.end[cell] ?? 0, until);
}

/** Segundo, a partir de agora, em que cada bomba estoura considerando a cadeia. */
function detonationTimes(state: DangerSource, bombs: readonly Bomb[]): Map<number, number> {
  const byCell = new Map(bombs.map((b) => [cellIndex(b.x, b.y), b]));
  const times = new Map(bombs.map((b) => [b.id, Math.max(b.fuseRemaining, 0)]));
  const hasBomb = (x: number, y: number): boolean => byCell.has(cellIndex(x, y));

  let changed = true;
  while (changed) {
    changed = false;
    for (const bomb of bombs) {
      const at = times.get(bomb.id) ?? Infinity;
      for (const cell of propagate(state.grid, bomb, bomb.range, hasBomb).cells) {
        const hit = byCell.get(cell);
        if (hit !== undefined && (times.get(hit.id) ?? Infinity) > at) {
          times.set(hit.id, at);
          changed = true;
        }
      }
    }
  }
  return times;
}

/** `extra` sao bombas hipoteticas, para avaliar uma bomba antes de solta-la. */
export function dangerMap(state: DangerSource, bombs: readonly Bomb[] = state.bombs, extra: readonly Bomb[] = []): DangerMap {
  const danger = emptyDanger();
  const all = [...bombs, ...extra];
  const byCell = new Set(all.map((b) => cellIndex(b.x, b.y)));
  const hasBomb = (x: number, y: number): boolean => byCell.has(cellIndex(x, y));
  const times = detonationTimes(state, all);
  const flame = BALANCE.time.flameOnScreen;

  for (const bomb of all) {
    const at = times.get(bomb.id) ?? Infinity;
    for (const cell of propagate(state.grid, bomb, bomb.range, hasBomb).cells) {
      mark(danger, cell, at, at + flame);
    }
  }
  for (const explosion of state.explosions) {
    for (const cell of explosion.cells) {
      mark(danger, cell, 0, explosion.remaining);
    }
  }

  const { suddenDeathStart, suddenDeathRingInterval } = BALANCE.time;
  for (let ring = state.ringsClosed; ring < SUDDEN_DEATH_RINGS.length; ring += 1) {
    const closesIn = Math.max(suddenDeathStart + ring * suddenDeathRingInterval - state.elapsed, 0);
    for (const cell of SUDDEN_DEATH_RINGS[ring] ?? []) {
      danger.closes[cell] = closesIn;
    }
  }
  return danger;
}

/** Chama ou anel fechado na celula em algum instante de [from, until], com folga. */
export function isLethal(danger: DangerMap, cell: number, from: number, until: number, margin: number): boolean {
  const start = danger.start[cell] ?? Infinity;
  const end = danger.end[cell] ?? 0;
  const closes = danger.closes[cell] ?? Infinity;
  return (start < until + margin && end > from - margin) || closes < until + margin;
}

/** Horizonte alem do qual nenhuma bomba no chao ainda pode estourar. */
export const SAFE_HORIZON = BALANCE.time.bombFuse + BALANCE.time.flameOnScreen;

/** Celula onde se pode parar a partir de `arrival` sem chama ate o horizonte. */
export function isSafeSpot(danger: DangerMap, cell: number, arrival: number, margin: number): boolean {
  return !isLethal(danger, cell, arrival, arrival + SAFE_HORIZON, margin);
}
