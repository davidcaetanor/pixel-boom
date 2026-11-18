/** Arena do duelo de desempate: aneis externos ja fechados, sem caixas, spawns espalhados. */
import { CELL_COUNT, cellX, cellY } from "../config/arena.js";
import { SUDDEN_DEATH_RINGS } from "../config/sudden-death-order.js";
import { CellKind } from "../domain/cell.js";
import { cloneGrid, setCell, type Grid } from "../domain/grid.js";

export function duelGrid(grid: Grid, closedRings: number): Grid {
  const duel = cloneGrid(grid);
  SUDDEN_DEATH_RINGS.forEach((ring, index) => {
    for (const cell of ring) {
      const x = cellX(cell);
      const y = cellY(cell);
      if (index < closedRings) {
        setCell(duel, x, y, CellKind.Wall);
      } else if (duel.cells[cell] === CellKind.Crate) {
        setCell(duel, x, y, CellKind.Floor);
      }
    }
  });
  return duel;
}

function distance(a: number, b: number): number {
  return Math.abs(cellX(a) - cellX(b)) + Math.abs(cellY(a) - cellY(b));
}

/** Cada spawn novo e o piso mais distante dos ja escolhidos; o primeiro e o mais acima a esquerda. */
export function duelSpawns(grid: Grid, count: number): { x: number; y: number }[] {
  const floor: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (grid.cells[cell] === CellKind.Floor) {
      floor.push(cell);
    }
  }
  const chosen: number[] = [];
  for (let i = 0; i < count && chosen.length < floor.length; i += 1) {
    let best = floor[0] ?? 0;
    let bestScore = -1;
    for (const cell of floor) {
      if (chosen.includes(cell)) {
        continue;
      }
      const score = chosen.length === 0 ? CELL_COUNT - cell : Math.min(...chosen.map((c) => distance(c, cell)));
      if (score > bestScore) {
        best = cell;
        bestScore = score;
      }
    }
    chosen.push(best);
  }
  return chosen.map((cell) => ({ x: cellX(cell), y: cellY(cell) }));
}
