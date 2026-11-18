import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/config/balance.js";
import {
  NEW_SERIES,
  applySeriesScore,
  isBestOf,
  keepPresentDuelists,
  newSeries,
  recordRound,
  roundsToWin,
  stepBestOf,
  type Series,
} from "../src/rules/series.js";
import { createMatchState } from "../src/simulation/step.js";

const ALL = ["a", "b", "c"];

function play(winners: readonly (string | null)[]): Series {
  return winners.reduce<Series>((series, w) => recordRound(series, w, ALL), NEW_SERIES);
}

describe("serie melhor-de-cinco", () => {
  it("termina quando alguem chega a roundsToWin", () => {
    const series = play(["a", "b", "a", "a"]);
    expect(series.finished).toBe(true);
    expect(series.winnerId).toBe("a");
    expect(series.wins).toEqual({ a: roundsToWin(BALANCE.match.bestOfDefault), b: 1 });
  });

  it("continua enquanto ninguem chegou la e ha rodadas", () => {
    const series = play(["a", "b", "a"]);
    expect(series.finished).toBe(false);
    expect(series.winnerId).toBeNull();
  });

  it("empate de rodada nao pontua ninguem", () => {
    expect(play([null, null]).wins).toEqual({});
  });

  it("esgotadas as rodadas, vence quem tem mais", () => {
    const series = play(["a", "b", null, "a", null]);
    expect(series.roundsPlayed).toBe(BALANCE.match.bestOfDefault);
    expect(series.finished).toBe(true);
    expect(series.winnerId).toBe("a");
  });

  it("esgotadas as rodadas com empate no topo, os lideres vao ao duelo", () => {
    const series = play(["a", "b", null, null, null]);
    expect(series.finished).toBe(false);
    expect(series.duel).toEqual(["a", "b"]);
  });

  it("sem nenhuma vitoria, todos os participantes vao ao duelo", () => {
    expect(play([null, null, null, null, null]).duel).toEqual(ALL);
  });

  it("duelo empatado se repete e o vencedor do duelo leva a serie", () => {
    const tied = play(["a", "b", null, null, null]);
    const again = recordRound(tied, null, ["a", "b"]);
    expect(again.finished).toBe(false);
    expect(again.duel).toEqual(["a", "b"]);
    const done = recordRound(again, "b", ["a", "b"]);
    expect(done.finished).toBe(true);
    expect(done.winnerId).toBe("b");
    expect(done.duel).toEqual([]);
  });

  it("duelista que sai da sala deixa a serie para o outro", () => {
    const tied = play(["a", "b", null, null, null]);
    const left = keepPresentDuelists(tied, ["b", "c"]);
    expect(left.finished).toBe(true);
    expect(left.winnerId).toBe("b");
    expect(keepPresentDuelists(tied, ["c"]).winnerId).toBeNull();
    expect(keepPresentDuelists(tied, ["a", "b"])).toBe(tied);
  });

  it("leva o placar para os jogadores da rodada", () => {
    const state = applySeriesScore(createMatchState(1, ["a", "b", "c"]), play(["a", "a", "b"]));
    expect(state.players.map((p) => p.roundsWon)).toEqual([2, 1, 0]);
  });
});

describe("formato da serie", () => {
  it("vence quem passa da metade das rodadas", () => {
    expect([1, 3, 5, 7].map(roundsToWin)).toEqual([1, 2, 3, 4]);
  });

  it("partida unica termina na primeira vitoria", () => {
    const series = recordRound(newSeries(1), "b", ALL);
    expect(series.finished).toBe(true);
    expect(series.winnerId).toBe("b");
  });

  it("partida unica empatada vai ao duelo de todos", () => {
    expect(recordRound(newSeries(1), null, ALL).duel).toEqual(ALL);
  });

  it("melhor de 3 termina com duas vitorias", () => {
    const series = ["a", "b", "a"].reduce<Series>((s, w) => recordRound(s, w, ALL), newSeries(3));
    expect(series.finished).toBe(true);
    expect(series.winnerId).toBe("a");
  });

  it("so aceita os formatos oferecidos e anda entre eles sem sair das pontas", () => {
    expect(isBestOf(5)).toBe(true);
    expect(isBestOf(4)).toBe(false);
    expect(isBestOf("5")).toBe(false);
    expect(stepBestOf(5, 1)).toBe(7);
    expect(stepBestOf(7, 1)).toBe(7);
    expect(stepBestOf(1, -1)).toBe(1);
  });
});
