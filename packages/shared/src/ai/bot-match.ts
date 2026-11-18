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

/** `bots` e a dificuldade de cada bot, na ordem dos slots. */
export function playBotMatch(seed: number, bots: readonly BotDifficulty[]): BotMatchReport {
  const ids = bots.map((_, i) => `bot${i}`);
  let state = createMatchState(seed, ids);
  const memories = new Map<string, BotMemory>(ids.map((id, i) => [id, createBotMemory(seed + i)]));
  const deaths: Record<string, DeathCause> = {};

  while (state.phase !== MatchPhase.Finished) {
    const inputs: Record<string, ReturnType<typeof decideBot>["input"]> = {};
    ids.forEach((id, i) => {
      const decision = decideBot(state, id, bots[i] ?? "normal", memories.get(id) ?? createBotMemory(seed), TICK_SECONDS);
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
    state = next;
  }
  return { winnerId: state.winnerId, seconds: Math.max(state.elapsed, 0), deaths };
}
