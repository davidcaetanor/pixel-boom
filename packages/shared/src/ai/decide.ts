/** Decisao do bot por tick: sair do perigo, soltar bomba com fuga garantida, ir ao melhor alvo seguro. */
import { IDLE_INPUT, type AxisIntent, type InputCommand } from "../commands/input-command.js";
import { CELL_CENTER, cellIndex, cellX, cellY } from "../config/arena.js";
import { BALANCE } from "../config/balance.js";
import type { Bomb } from "../domain/bomb.js";
import { MatchPhase, type MatchState } from "../domain/match-state.js";
import type { Player } from "../domain/player.js";
import { bombAt, canPlaceBomb, createBomb, playerCell } from "../rules/bomb-placement.js";
import { propagate } from "../rules/explosion-propagation.js";
import { nextFloat, seedRng, type RngState } from "../simulation/rng.js";
import { SAFE_HORIZON, dangerMap, isSafeSpot, type DangerMap } from "./danger.js";
import { firstStep, reach, type Reach } from "./reach.js";

export const BotDifficulty = {
  Normal: "normal",
  Hard: "hard",
} as const;

export type BotDifficulty = (typeof BotDifficulty)[keyof typeof BotDifficulty];

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return value === BotDifficulty.Normal || value === BotDifficulty.Hard;
}

export interface BotMemory {
  /** Celula escolhida como destino; null sem plano. */
  readonly target: number | null;
  /** Segundos restantes de compromisso com o alvo. */
  readonly hold: number;
  /** Segundos ate a proxima decisao de alvo e de bomba. */
  readonly think: number;
  readonly rng: RngState;
}

export function createBotMemory(seed: number): BotMemory {
  return { target: null, hold: 0, think: 0, rng: seedRng(seed) };
}

export interface BotDecision {
  readonly input: InputCommand;
  readonly memory: BotMemory;
}

interface View {
  readonly state: MatchState;
  readonly me: Player;
  readonly cell: number;
  readonly bombs: readonly Bomb[];
  readonly danger: DangerMap;
  readonly paths: Reach;
  readonly enemies: readonly Player[];
}

const MARGIN = BALANCE.ai.flameMargin;

function cellOf(player: Pick<Player, "x" | "y">): number {
  const c = playerCell(player);
  return cellIndex(c.x, c.y);
}

/** Bombas inimigas recem-soltas ainda nao foram notadas. */
function noticedBombs(state: MatchState, me: Player, reactionTime: number): Bomb[] {
  return state.bombs.filter(
    (b) => b.ownerId === me.id || BALANCE.time.bombFuse - b.fuseRemaining >= reactionTime,
  );
}

/** Impulso que acaba antes do horizonte nao entra na conta da fuga. */
function planningSpeed(player: Player): number {
  return player.speedBoost > SAFE_HORIZON ? player.speed : BALANCE.player.speedInitial;
}

function pathsFrom(state: MatchState, bombs: readonly Bomb[], danger: DangerMap, player: Player): Reach {
  return reach({ grid: state.grid, bombs, danger, origin: cellOf(player), speed: planningSpeed(player), margin: MARGIN });
}

/** Celula segura mais proxima; sem nenhuma, a que demora mais a pegar fogo. */
function refuge(paths: Reach, danger: DangerMap): number | null {
  let fallback: number | null = null;
  for (const cell of paths.order) {
    if (isSafeSpot(danger, cell, paths.arrival[cell] ?? Infinity, MARGIN)) {
      return cell;
    }
    if (fallback === null || (danger.start[cell] ?? 0) > (danger.start[fallback] ?? 0)) {
      fallback = cell;
    }
  }
  return fallback;
}

function hasRefuge(paths: Reach, danger: DangerMap): boolean {
  return paths.order.some((cell) => isSafeSpot(danger, cell, paths.arrival[cell] ?? Infinity, MARGIN));
}

function blastFrom(state: MatchState, cell: number, range: number): ReturnType<typeof propagate> {
  return propagate(state.grid, { x: cellX(cell), y: cellY(cell) }, range, (x, y) => bombAt(state.bombs, x, y) !== undefined);
}

function roll(rng: RngState, chancePerSecond: number, dt: number): readonly [boolean, RngState] {
  const [value, next] = nextFloat(rng);
  return [value < 1 - (1 - chancePerSecond) ** dt, next];
}

interface BombPlan {
  readonly escape: number;
  readonly trapsEnemy: boolean;
  readonly hitsEnemy: boolean;
  readonly crates: number;
}

/** Bomba so vale se ainda houver refugio com ela e com a cadeia que ela provoca. */
function planBomb(view: View): BombPlan | null {
  const { state, me, cell, bombs } = view;
  if (!canPlaceBomb(state.grid, state.bombs, me)) {
    return null;
  }
  const bomb = createBomb(-1, me);
  const withBomb = [...bombs, bomb];
  const danger = dangerMap(state, bombs, [bomb]);
  const escapePaths = pathsFrom(state, withBomb, danger, me);
  const escape = refuge(escapePaths, danger);
  if (escape === null || !isSafeSpot(danger, escape, escapePaths.arrival[escape] ?? Infinity, MARGIN)) {
    return null;
  }

  const blast = blastFrom(state, cell, me.range);
  const flames = new Set(blast.cells);
  const hitsEnemy = view.enemies.some((e) => flames.has(cellOf(e)));
  const trapsEnemy = view.enemies.some((e) => !hasRefuge(pathsFrom(state, withBomb, danger, e), danger));
  return { escape, trapsEnemy, hitsEnemy, crates: blast.crates.length };
}

function targetScore(view: View, cell: number, enemyPull: number): number {
  const { state, me } = view;
  const arrival = view.paths.arrival[cell] ?? Infinity;
  const ai = BALANCE.ai;
  let score = -ai.travelCost * arrival;
  if (state.powerUps.some((p) => cellIndex(p.x, p.y) === cell)) {
    score += ai.powerUpValue;
  }
  if (me.bombsPlaced < me.maxBombs) {
    score += ai.crateValue * blastFrom(state, cell, me.range).crates.length;
  }
  const nearest = Math.min(
    ...view.enemies.map((e) => Math.abs(cellX(cellOf(e)) - cellX(cell)) + Math.abs(cellY(cellOf(e)) - cellY(cell))),
  );
  if (Number.isFinite(nearest)) {
    score -= enemyPull * Math.max(nearest, ai.enemyComfortCells);
  }
  return score;
}

function stillSafe(view: View, cell: number | null): cell is number {
  if (cell === null) {
    return false;
  }
  const arrival = view.paths.arrival[cell] ?? Infinity;
  return arrival !== Infinity && isSafeSpot(view.danger, cell, arrival, MARGIN);
}

function chooseTarget(view: View, current: number | null, enemyPull: number): number {
  let best = view.cell;
  let bestScore = -Infinity;
  for (const cell of view.paths.order) {
    if (!isSafeSpot(view.danger, cell, view.paths.arrival[cell] ?? Infinity, MARGIN)) {
      continue;
    }
    const score = targetScore(view, cell, enemyPull);
    if (score > bestScore) {
      best = cell;
      bestScore = score;
    }
  }
  const keep = stillSafe(view, current) && targetScore(view, current, enemyPull) + BALANCE.ai.targetHysteresis >= bestScore;
  return keep ? current : best;
}

function axisToward(delta: number, tolerance: number): AxisIntent {
  if (Math.abs(delta) <= tolerance) {
    return 0;
  }
  return delta > 0 ? 1 : -1;
}

/** Anda ate o centro da proxima celula do caminho; na ultima, centraliza. */
function steer(view: View, target: number, dt: number): InputCommand {
  const { me } = view;
  const next = firstStep(view.paths, target);
  // Tolerancia de um passo inteiro: menos que isso passa do centro e volta.
  const tolerance = me.speed * dt;
  const dx = cellX(next) + CELL_CENTER - me.x;
  const dy = cellY(next) + CELL_CENTER - me.y;
  if (next === view.cell) {
    const moveX = axisToward(dx, tolerance);
    const moveY = axisToward(dy, tolerance);
    return { moveX, moveY, prefer: Math.abs(dx) >= Math.abs(dy) ? "x" : "y" };
  }
  return cellX(next) !== cellX(view.cell)
    ? { moveX: axisToward(dx, 0), moveY: 0 }
    : { moveX: 0, moveY: axisToward(dy, 0) };
}

/** Alvo novo renova o compromisso; o mesmo alvo so gasta o tempo restante. */
function hold(memory: BotMemory, target: number, dt: number): number {
  return target === memory.target ? Math.max(memory.hold - dt, 0) : BALANCE.ai.targetHoldTime;
}

interface DifficultyParams {
  readonly reactionTime: number;
  readonly attackChance: number;
  readonly pokeChance: number;
  readonly enemyPull: number;
  readonly pressure: number;
  readonly thinkSeconds: number;
}

/** Arena fechando ou duelo: esperar nao adianta, o bot parte para cima. */
function pressured(params: DifficultyParams, closing: boolean): DifficultyParams {
  if (!closing) {
    return params;
  }
  const k = params.pressure;
  return {
    ...params,
    attackChance: Math.min(params.attackChance * k, 1),
    pokeChance: Math.min(params.pokeChance * k, 1),
    enemyPull: params.enemyPull * k,
  };
}

export function decideBot(
  state: MatchState,
  botId: string,
  difficulty: BotDifficulty,
  memory: BotMemory,
  dt: number,
): BotDecision {
  const me = state.players.find((p) => p.id === botId);
  const active = state.phase === MatchPhase.Playing || state.phase === MatchPhase.SuddenDeath;
  if (me === undefined || !me.alive || !active) {
    return { input: IDLE_INPUT, memory: { ...memory, target: null, hold: 0 } };
  }

  const params = pressured(BALANCE.ai.difficulty[difficulty], state.phase === MatchPhase.SuddenDeath);
  const bombs = noticedBombs(state, me, params.reactionTime);
  const danger = dangerMap(state, bombs);
  const view: View = {
    state,
    me,
    cell: cellOf(me),
    bombs,
    danger,
    paths: pathsFrom(state, bombs, danger, me),
    enemies: state.players.filter((p) => p.alive && p.id !== me.id),
  };

  if (!isSafeSpot(danger, view.cell, 0, MARGIN)) {
    const kept = memory.hold > 0 && stillSafe(view, memory.target) ? memory.target : null;
    const target = kept ?? refuge(view.paths, danger) ?? view.cell;
    return { input: steer(view, target, dt), memory: { ...memory, target, hold: hold(memory, target, dt) } };
  }

  // Entre uma decisao e outra o bot so segue o plano: chega atrasado nas oportunidades.
  if (memory.think > 0) {
    const target = stillSafe(view, memory.target) ? memory.target : chooseTarget(view, memory.target, params.enemyPull);
    return {
      input: steer(view, target, dt),
      memory: { ...memory, target, hold: hold(memory, target, dt), think: Math.max(memory.think - dt, 0) },
    };
  }
  const window = Math.max(dt, params.thinkSeconds);

  let rng = memory.rng;
  const plan = planBomb(view);
  if (plan !== null) {
    const [trap, afterTrap] = roll(rng, params.attackChance, window);
    const [poke, afterPoke] = roll(afterTrap, params.pokeChance, window);
    rng = afterPoke;
    const crateSpot = plan.crates > 0 && memory.target === view.cell;
    if (crateSpot || (plan.trapsEnemy && trap) || (plan.hitsEnemy && poke)) {
      // O step move antes de soltar a bomba; parado, ela cai na celula avaliada.
      return {
        input: { ...IDLE_INPUT, bomb: true },
        memory: { target: plan.escape, hold: BALANCE.ai.targetHoldTime, think: params.thinkSeconds, rng },
      };
    }
  }

  const target = memory.hold > 0 && stillSafe(view, memory.target) ? memory.target : chooseTarget(view, memory.target, params.enemyPull);
  return {
    input: steer(view, target, dt),
    memory: { target, hold: hold(memory, target, dt), think: params.thinkSeconds, rng },
  };
}
