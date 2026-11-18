/** Tempo de chegada a cada celula alcancavel, sem atravessar chama. */
import { CELL_COUNT, cellIndex, cellX, cellY } from "../config/arena.js";
import type { Bomb } from "../domain/bomb.js";
import { CellKind } from "../domain/cell.js";
import { cellAt, type Grid } from "../domain/grid.js";
import { isLethal, type DangerMap } from "./danger.js";

export interface Reach {
  readonly origin: number;
  /** Segundos ate o centro de cada celula; Infinity onde nao alcanca. */
  readonly arrival: Float64Array;
  /** Celula anterior no caminho; -1 na origem e onde nao alcanca. */
  readonly previous: Int32Array;
  /** Celulas alcancadas, em ordem de chegada. */
  readonly order: readonly number[];
}

const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface ReachInput {
  readonly grid: Grid;
  readonly bombs: readonly Bomb[];
  readonly danger: DangerMap;
  readonly origin: number;
  /** Celulas por segundo. */
  readonly speed: number;
  readonly margin: number;
}

export function reach(input: ReachInput): Reach {
  const { grid, danger, origin, speed, margin } = input;
  const stepTime = 1 / speed;
  const blocked = new Set(input.bombs.map((b) => cellIndex(b.x, b.y)));
  const arrival = new Float64Array(CELL_COUNT).fill(Infinity);
  const previous = new Int32Array(CELL_COUNT).fill(-1);
  const order = [origin];
  arrival[origin] = 0;

  for (let head = 0; head < order.length; head += 1) {
    const cell = order[head] as number;
    const at = arrival[cell] as number;
    for (const [dx, dy] of NEIGHBORS) {
      const x = cellX(cell) + dx;
      const y = cellY(cell) + dy;
      if (cellAt(grid, x, y) !== CellKind.Floor) {
        continue;
      }
      const next = cellIndex(x, y);
      const enter = at + stepTime;
      if (arrival[next] !== Infinity || blocked.has(next)) {
        continue;
      }
      if (isLethal(danger, next, at, enter + stepTime, margin)) {
        continue;
      }
      arrival[next] = enter;
      previous[next] = cell;
      order.push(next);
    }
  }
  return { origin, arrival, previous, order };
}

/** Primeira celula a pisar a caminho de `target`; a propria origem se ja chegou. */
export function firstStep(found: Reach, target: number): number {
  let cell = target;
  while ((found.previous[cell] ?? -1) !== found.origin && cell !== found.origin) {
    const before = found.previous[cell] ?? -1;
    if (before === -1) {
      return found.origin;
    }
    cell = before;
  }
  return cell;
}
