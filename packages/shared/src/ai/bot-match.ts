/** Rodada inteira so com bots, sem rede nem render. */
import { cellIndex } from "../config/arena.js";
import { TICK_SECONDS } from "../config/balance.js";
import { MatchPhase, type MatchState } from "../domain/match-state.js";
import { playerCell } from "../rules/bomb-placement.js";
import { createMatchState, step } from "../simulation/step.js";
import { createBotMemory, decideBot, type BotDifficulty, type BotMemory } from "./decide.js";

export const DeathCause = {
  OwnBomb: "ownBomb",
  EnemyBomb: "enemyBomb",
  SuddenDeath: "suddenDeath",
} as const;

export type DeathCause = (typeof DeathCause)[keyof typeof DeathCause];

export interface BotMatchReport {
  readonly winnerId: string | null;
  readonly seconds: number;
  readonly deaths: Readonly<Record<string, DeathCause>>;
  /** Itens coletados por jogador. */
  readonly pickups: Readonly<Record<string, number>>;
}

function causeOf(before: MatchState, after: MatchState, id: string): DeathCause {
  const player = before.players.find((p) => p.id === id);
  if (player === undefined) {
    return DeathCause.SuddenDeath;
  }
  const cell = playerCell(player);
  const index = cellIndex(cell.x, cell.y);
  const killer = after.explosions.find((e) => e.cells.includes(index));
  if (killer === undefined) {
    return DeathCause.SuddenDeath;
  }
  return killer.ownerId === id ? DeathCause.OwnBomb : DeathCause.EnemyBomb;
}

/** Itens que sumiram do chao com um jogador vivo em cima, atribuidos a ele. */
function collected(before: MatchState, after: MatchState): string[] {
  const remaining = new Set(after.powerUps.map((p) => cellIndex(p.x, p.y)));
  const takers: string[] = [];
  for (const item of before.powerUps) {
    const cell = cellIndex(item.x, item.y);
    if (remaining.has(cell)) {
      continue;
    }
    const taker = after.players.find((p) => {
      const c = playerCell(p);
      return p.alive && cellIndex(c.x, c.y) === cell;
    });
    if (taker !== undefined) {
      takers.push(taker.id);
    }
  }
  return takers;
}

/**
 * `bots` e a dificuldade de cada bot, na ordem dos slots. `only` restringe a
 * rodada a alguns deles, como no duelo de desempate.
 */
export function playBotMatch(
  seed: number,
  bots: readonly BotDifficulty[],
  options: { readonly duel?: boolean; readonly only?: readonly string[] } = {},
): BotMatchReport {
  const everyone = bots.map((_, i) => `bot${i}`);
  const ids = options.only === undefined ? everyone : everyone.filter((id) => options.only?.includes(id));
  const slots = ids.map((id) => everyone.indexOf(id));
  let state = createMatchState(seed, ids, { duel: options.duel === true, slots });
  const memories = new Map<string, BotMemory>(ids.map((id, i) => [id, createBotMemory(seed + i)]));
  const deaths: Record<string, DeathCause> = {};
  const pickups: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));

  while (state.phase !== MatchPhase.Finished) {
    const inputs: Record<string, ReturnType<typeof decideBot>["input"]> = {};
    ids.forEach((id, i) => {
      const decision = decideBot(state, id, bots[slots[i] ?? 0] ?? "normal", memories.get(id) ?? createBotMemory(seed), TICK_SECONDS);
      memories.set(id, decision.memory);
      inputs[id] = decision.input;
    });
    const next = step(state, inputs, TICK_SECONDS);
    for (const p of next.players) {
      const was = state.players.find((q) => q.id === p.id);
      if (was?.alive === true && !p.alive) {
        deaths[p.id] = causeOf(state, next, p.id);
      }
    }
    for (const id of collected(state, next)) {
      pickups[id] = (pickups[id] ?? 0) + 1;
    }
    state = next;
  }
  return { winnerId: state.winnerId, seconds: Math.max(state.elapsed, 0), deaths, pickups };
}
