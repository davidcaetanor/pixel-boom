/**
 * Serie de rodadas em melhor de N: vence quem chega a mais da metade de N.
 * Esgotadas as N rodadas, vence quem tiver mais vitorias; empate no topo leva
 * os lideres a um duelo de morte subita, repetido ate um deles vencer.
 */
import { BALANCE } from "../config/balance.js";
import type { MatchState } from "../domain/match-state.js";

export interface Series {
  readonly bestOf: number;
  /** Rodadas jogadas ate agora. */
  readonly roundsPlayed: number;
  readonly wins: Readonly<Record<string, number>>;
  readonly finished: boolean;
  readonly winnerId: string | null;
  /** Lideres empatados disputando o duelo; vazio fora dele. */
  readonly duel: readonly string[];
}

const BEST_OF: readonly number[] = BALANCE.match.bestOfOptions;

export function isBestOf(value: unknown): value is number {
  return typeof value === "number" && BEST_OF.includes(value);
}

export function roundsToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

/** Proximo formato na direcao pedida, parando nas pontas. */
export function stepBestOf(current: number, direction: 1 | -1): number {
  const index = BEST_OF.indexOf(current) + direction;
  return BEST_OF[Math.max(0, Math.min(index, BEST_OF.length - 1))] ?? current;
}

export function newSeries(bestOf: number = BALANCE.match.bestOfDefault): Series {
  return { bestOf, roundsPlayed: 0, wins: {}, finished: false, winnerId: null, duel: [] };
}

export const NEW_SERIES: Series = newSeries();

/** Quem tem mais vitorias; sem nenhuma vitoria, todos os participantes. */
function leaders(wins: Readonly<Record<string, number>>, participants: readonly string[]): string[] {
  const top = Math.max(0, ...Object.values(wins));
  return top === 0 ? [...participants] : Object.keys(wins).filter((id) => wins[id] === top);
}

function finish(series: Series, winnerId: string | null): Series {
  return { ...series, finished: true, winnerId, duel: [] };
}

/** `participants` sao os jogadores da rodada, usados quando ninguem venceu nenhuma. */
export function recordRound(series: Series, roundWinnerId: string | null, participants: readonly string[] = []): Series {
  const wins = { ...series.wins };
  if (roundWinnerId !== null) {
    wins[roundWinnerId] = (wins[roundWinnerId] ?? 0) + 1;
  }
  const next: Series = { ...series, roundsPlayed: series.roundsPlayed + 1, wins };

  if (series.duel.length > 0) {
    return roundWinnerId !== null && series.duel.includes(roundWinnerId) ? finish(next, roundWinnerId) : next;
  }

  const target = roundsToWin(series.bestOf);
  const champion = Object.entries(wins).find(([, n]) => n >= target)?.[0] ?? null;
  if (champion !== null) {
    return finish(next, champion);
  }
  if (next.roundsPlayed < series.bestOf) {
    return next;
  }
  const tied = leaders(wins, participants);
  if (tied.length <= 1) {
    return finish(next, tied[0] ?? null);
  }
  return { ...next, duel: tied };
}

/** Duelista que saiu da sala perde a vaga; sobrando um, ele leva a serie. */
export function keepPresentDuelists(series: Series, present: readonly string[]): Series {
  if (series.duel.length === 0) {
    return series;
  }
  const duel = series.duel.filter((id) => present.includes(id));
  if (duel.length === series.duel.length) {
    return series;
  }
  return duel.length <= 1 ? finish(series, duel[0] ?? null) : { ...series, duel };
}

/** Copia o placar da serie para os jogadores da rodada. */
export function applySeriesScore(state: MatchState, series: Series): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, roundsWon: series.wins[p.id] ?? 0 })),
  };
}
