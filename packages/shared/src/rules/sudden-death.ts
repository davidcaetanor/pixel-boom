/**
 * Arena fechando: a cada intervalo um anel vira parede, de fora para dentro,
 * eliminando jogadores, bombas e itens nas celulas fechadas. Os aneis mais
 * internos nunca fecham na rodada. No duelo, depois dos aneis iniciais, a
 * parede avanca uma celula por vez em espiral ate fechar tudo.
 */
import { cellIndex, cellX, cellY } from "../config/arena.js";
import { BALANCE } from "../config/balance.js";
import { SUDDEN_DEATH_RINGS, spiralFrom } from "../config/sudden-death-order.js";
import type { Bomb } from "../domain/bomb.js";
import { CellKind } from "../domain/cell.js";
import { cloneGrid, setCell, type Grid } from "../domain/grid.js";
import type { Player } from "../domain/player.js";
import type { PowerUp } from "../domain/powerup.js";
import { playerCell } from "./bomb-placement.js";

export const CLOSABLE_RINGS = SUDDEN_DEATH_RINGS.length - BALANCE.time.suddenDeathOpenRings;

/** Aneis fechados desde o inicio e instante em que o proximo fecha. */
export interface RingSchedule {
  readonly base: number;
  readonly start: number;
}

export const ROUND_RINGS: RingSchedule = { base: 0, start: BALANCE.time.suddenDeathStart };
export const DUEL_RINGS: RingSchedule = { base: BALANCE.duel.closedRings, start: Infinity };

export const DUEL_SPIRAL = spiralFrom(BALANCE.duel.closedRings);

/** Celulas da espiral do duelo que devem estar fechadas no instante `elapsed`. */
export function spiralDue(elapsed: number): number {
  const { spiralStart, spiralCellSeconds } = BALANCE.duel;
  if (elapsed < spiralStart) {
    return 0;
  }
  return Math.min(Math.floor((elapsed - spiralStart) / spiralCellSeconds) + 1, DUEL_SPIRAL.length);
}

export function spiralClosesAt(index: number): number {
  return BALANCE.duel.spiralStart + index * BALANCE.duel.spiralCellSeconds;
}

export function ringScheduleOf(state: { readonly duel: boolean }): RingSchedule {
  return state.duel ? DUEL_RINGS : ROUND_RINGS;
}

/** Aneis que devem estar fechados no instante `elapsed`. */
export function ringsDue(elapsed: number, schedule: RingSchedule = ROUND_RINGS): number {
  const extra =
    elapsed < schedule.start ? 0 : Math.floor((elapsed - schedule.start) / BALANCE.time.suddenDeathRingInterval) + 1;
  return Math.min(schedule.base + extra, CLOSABLE_RINGS);
}

/** Instante em que o anel fecha; Infinity para os que nunca fecham. */
export function ringClosesAt(ring: number, schedule: RingSchedule = ROUND_RINGS): number {
  if (ring >= CLOSABLE_RINGS) {
    return Infinity;
  }
  return ring < schedule.base ? 0 : schedule.start + (ring - schedule.base) * BALANCE.time.suddenDeathRingInterval;
}

export interface SuddenDeathInput {
  readonly grid: Grid;
  readonly players: readonly Player[];
  readonly bombs: readonly Bomb[];
  readonly powerUps: readonly PowerUp[];
  readonly ringsClosed: number;
  readonly cellsClosed: number;
}

export interface SuddenDeathResult {
  readonly grid: Grid;
  readonly players: Player[];
  readonly bombs: Bomb[];
  readonly powerUps: PowerUp[];
  readonly ringsClosed: number;
  readonly cellsClosed: number;
}

/** Vira parede, esmaga quem esta em cima e devolve as bombas esmagadas aos donos. */
function closeCells(input: SuddenDeathInput, closing: ReadonlySet<number>): Omit<SuddenDeathResult, "ringsClosed" | "cellsClosed"> {
  const grid = cloneGrid(input.grid);
  for (const cell of closing) {
    setCell(grid, cellX(cell), cellY(cell), CellKind.Wall);
  }
  const crushed = input.bombs.filter((b) => closing.has(cellIndex(b.x, b.y)));
  const players = input.players.map((p) => {
    const cell = playerCell(p);
    const dies = p.alive && closing.has(cellIndex(cell.x, cell.y));
    const lost = crushed.filter((b) => b.ownerId === p.id).length;
    if (!dies && lost === 0) {
      return p;
    }
    return { ...p, alive: p.alive && !dies, bombsPlaced: p.bombsPlaced - lost };
  });
  return {
    grid,
    players,
    bombs: input.bombs.filter((b) => !crushed.includes(b)),
    powerUps: input.powerUps.filter((p) => !closing.has(cellIndex(p.x, p.y))),
  };
}

function unchanged(input: SuddenDeathInput): SuddenDeathResult {
  return { ...input, players: [...input.players], bombs: [...input.bombs], powerUps: [...input.powerUps] };
}

export function closeSpiral(input: SuddenDeathInput, elapsed: number): SuddenDeathResult {
  const target = spiralDue(elapsed);
  if (target <= input.cellsClosed) {
    return unchanged(input);
  }
  const closing = new Set(DUEL_SPIRAL.slice(input.cellsClosed, target));
  return { ...closeCells(input, closing), ringsClosed: input.ringsClosed, cellsClosed: target };
}

export function closeRings(
  input: SuddenDeathInput,
  elapsed: number,
  schedule: RingSchedule = ROUND_RINGS,
): SuddenDeathResult {
  const target = ringsDue(elapsed, schedule);
  if (target <= input.ringsClosed) {
    return unchanged(input);
  }
  const closing = new Set<number>();
  for (let ring = input.ringsClosed; ring < target; ring += 1) {
    for (const cell of SUDDEN_DEATH_RINGS[ring] ?? []) {
      closing.add(cell);
    }
  }
  return { ...closeCells(input, closing), ringsClosed: target, cellsClosed: input.cellsClosed };
}
