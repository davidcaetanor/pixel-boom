import { describe, expect, it } from "vitest";
import { playingMatch } from "./helpers.js";
import { BALANCE, TICK_SECONDS } from "../src/config/balance.js";
import { ARENA_COLS, cellIndex } from "../src/config/arena.js";
import { SUDDEN_DEATH_RINGS } from "../src/config/sudden-death-order.js";
import { CellKind } from "../src/domain/cell.js";
import { cellAt, setCell } from "../src/domain/grid.js";
import { MatchPhase, type MatchState } from "../src/domain/match-state.js";
import { POWER_UP_KINDS, PowerUpKind } from "../src/domain/powerup.js";
import type { InputsByPlayer } from "../src/commands/input-command.js";
import { createStaticGrid } from "../src/rules/map-generation.js";
import { applyPowerUp, rollDrops, weightedKind } from "../src/rules/pickup.js";
import { duelSpawns } from "../src/rules/duel-arena.js";
import {
  CLOSABLE_RINGS,
  DUEL_RINGS,
  DUEL_SPIRAL,
  ringClosesAt,
  ringsDue,
  spiralClosesAt,
  spiralDue,
} from "../src/rules/sudden-death.js";
import { ARENA_LAYOUTS } from "../src/config/arena-layouts.js";
import { checkVictory } from "../src/rules/victory.js";
import { seedRng } from "../src/simulation/rng.js";
import { createMatchState, createPlayer, step } from "../src/simulation/step.js";

function arena(positions: Record<string, [number, number]>): MatchState {
  const base = playingMatch(1, Object.keys(positions));
  return {
    ...base,
    grid: createStaticGrid(),
    players: base.players.map((p) => {
      const [x, y] = positions[p.id] as [number, number];
      return { ...p, x: x + 0.5, y: y + 0.5 };
    }),
  };
}

function run(state: MatchState, inputs: InputsByPlayer, ticks: number): MatchState {
  let s = state;
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, inputs, TICK_SECONDS);
  }
  return s;
}

const ticksFor = (seconds: number): number => Math.ceil(seconds / TICK_SECONDS);

describe("pickup", () => {
  it("sorteia perto de 30% das caixas, com os tres tipos", () => {
    const crates = Array.from({ length: 3000 }, (_, i) => i);
    const { powerUps } = rollDrops(crates, seedRng(3));
    const rate = powerUps.length / crates.length;
    expect(rate).toBeGreaterThan(BALANCE.mapGeneration.powerUpChance - 0.03);
    expect(rate).toBeLessThan(BALANCE.mapGeneration.powerUpChance + 0.03);
    expect(new Set(powerUps.map((p) => p.kind)).size).toBe(3);
  });

  it("e deterministico e independe da ordem de entrada", () => {
    const a = rollDrops([30, 10, 20, 40, 50], seedRng(9));
    const b = rollDrops([50, 40, 30, 20, 10], seedRng(9));
    expect(a).toEqual(b);
  });

  it("aplica cada tipo e respeita os tetos", () => {
    let p = createPlayer("a", 0);
    for (let i = 0; i < 20; i += 1) {
      p = applyPowerUp(p, PowerUpKind.Bomb);
      p = applyPowerUp(p, PowerUpKind.Range);
      p = applyPowerUp(p, PowerUpKind.Speed);
    }
    expect(p.maxBombs).toBe(BALANCE.player.bombsMax);
    expect(p.range).toBe(BALANCE.player.rangeMax);
    expect(p.speed).toBe(BALANCE.player.speedInitial + BALANCE.player.speedBoost);
  });

  it("sorteia o tipo pela fatia de cada peso", () => {
    expect(weightedKind(0)).toBe(PowerUpKind.Bomb);
    expect(weightedKind(0.39)).toBe(PowerUpKind.Bomb);
    expect(weightedKind(0.4)).toBe(PowerUpKind.Range);
    expect(weightedKind(0.74)).toBe(PowerUpKind.Range);
    expect(weightedKind(0.75)).toBe(PowerUpKind.Speed);
    expect(weightedKind(0.999)).toBe(PowerUpKind.Speed);
    expect(BALANCE.mapGeneration.powerUpWeights).toHaveLength(POWER_UP_KINDS.length);
  });

  it("impulso de velocidade nao acumula e outro reinicia o tempo", () => {
    let p = applyPowerUp(createPlayer("a", 0), PowerUpKind.Speed);
    p = { ...p, speedBoost: 1 };
    p = applyPowerUp(p, PowerUpKind.Speed);
    expect(p.speed).toBe(BALANCE.player.speedInitial + BALANCE.player.speedBoost);
    expect(p.speedBoost).toBe(BALANCE.player.speedBoostSeconds);
  });

  it("impulso acaba no tempo e a velocidade volta a inicial", () => {
    let s = arena({ a: [3, 1], b: [23, 11] });
    s = { ...s, players: s.players.map((p) => (p.id === "a" ? applyPowerUp(p, PowerUpKind.Speed) : p)) };
    const ticks = Math.round(BALANCE.player.speedBoostSeconds / TICK_SECONDS);
    for (let i = 0; i < ticks - 1; i += 1) {
      s = step(s, {}, TICK_SECONDS);
    }
    expect(s.players[0]?.speed).toBe(BALANCE.player.speedInitial + BALANCE.player.speedBoost);
    // A soma de dt em ponto flutuante pode passar um tick do tempo exato.
    s = step(step(s, {}, TICK_SECONDS), {}, TICK_SECONDS);
    expect(s.players[0]?.speed).toBe(BALANCE.player.speedInitial);
    expect(s.players[0]?.speedBoost).toBe(0);
  });

  it("jogador pisa e coleta", () => {
    let s = arena({ a: [3, 1], b: [23, 11] });
    s = { ...s, powerUps: [{ kind: PowerUpKind.Range, x: 4, y: 1 }] };
    s = run(s, { a: { moveX: 1, moveY: 0 } }, 10);
    expect(s.powerUps).toHaveLength(0);
    expect(s.players[0]?.range).toBe(BALANCE.player.rangeInitial + 1);
  });

  it("chama nova queima power-up no chao", () => {
    let s = arena({ a: [1, 11], b: [23, 11] });
    s = {
      ...s,
      powerUps: [{ kind: PowerUpKind.Speed, x: 6, y: 1 }],
      bombs: [{ id: 1, ownerId: "a", x: 5, y: 1, range: 2, fuseRemaining: TICK_SECONDS / 2 }],
    };
    s = step(s, {}, TICK_SECONDS);
    expect(s.powerUps).toHaveLength(0);
  });

  it("power-up que nasce da caixa sobrevive a chama que a destruiu", () => {
    // Procura uma semente em que a caixa solta item, para nao depender da sorte.
    for (let seed = 0; seed < 50; seed += 1) {
      let s = arena({ a: [1, 11], b: [23, 11] });
      setCell(s.grid, 7, 1, CellKind.Crate);
      s = {
        ...s,
        rng: seedRng(seed),
        bombs: [{ id: 1, ownerId: "a", x: 5, y: 1, range: 2, fuseRemaining: TICK_SECONDS / 2 }],
      };
      s = step(s, {}, TICK_SECONDS);
      if (s.powerUps.length > 0) {
        s = run(s, {}, ticksFor(BALANCE.time.flameOnScreen) + 2);
        expect(s.powerUps).toEqual([expect.objectContaining({ x: 7, y: 1 })]);
        return;
      }
    }
    throw new Error("nenhuma semente soltou item");
  });
});

describe("arena fechando", () => {
  it("nenhum anel antes de 90 s, um por intervalo depois, ate a faixa central", () => {
    const { suddenDeathStart: start, suddenDeathRingInterval: gap } = BALANCE.time;
    expect(ringsDue(start - 0.01)).toBe(0);
    expect(ringsDue(start)).toBe(1);
    expect(ringsDue(start + gap - 0.01)).toBe(1);
    expect(ringsDue(start + gap)).toBe(2);
    expect(ringsDue(10_000)).toBe(SUDDEN_DEATH_RINGS.length - BALANCE.time.suddenDeathOpenRings);
  });

  it("ultimo anel que fecha deixa tempo de briga na faixa central antes do teto", () => {
    const last = ringClosesAt(CLOSABLE_RINGS - 1);
    expect(last).toBeLessThan(BALANCE.time.matchMax);
    expect(ringClosesAt(CLOSABLE_RINGS)).toBe(Infinity);
  });

  it("faixa central fica conectada em todo layout", () => {
    const open = SUDDEN_DEATH_RINGS.slice(CLOSABLE_RINGS).flat();
    ARENA_LAYOUTS.forEach((_, layout) => {
      const grid = createStaticGrid(layout);
      const floor = new Set(open.filter((c) => grid.cells[c] === CellKind.Floor));
      const start = [...floor][0];
      const seen = new Set(start === undefined ? [] : [start]);
      const queue = [...seen];
      while (queue.length > 0) {
        const c = queue.pop() as number;
        for (const n of [c + 1, c - 1, c + ARENA_COLS, c - ARENA_COLS]) {
          if (floor.has(n) && !seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
      expect(floor.size).toBeGreaterThanOrEqual(BALANCE.net.maxClientsPerRoom * 2);
      expect(seen.size).toBe(floor.size);
    });
  });

  it("anel vira parede, mata quem esta nele e muda a fase", () => {
    let s = arena({ a: [1, 1], b: [11, 5] });
    s = { ...s, elapsed: BALANCE.time.suddenDeathStart - TICK_SECONDS / 2 };
    s = step(s, {}, TICK_SECONDS);
    expect(s.phase).toBe(MatchPhase.Finished);
    expect(s.players[0]?.alive).toBe(false);
    expect(s.players[1]?.alive).toBe(true);
    expect(s.winnerId).toBe("b");
    expect(cellAt(s.grid, 1, 1)).toBe(CellKind.Wall);
    expect(cellAt(s.grid, 11, 5)).toBe(CellKind.Floor);
  });

  it("entra em SuddenDeath quando ninguem morre no anel", () => {
    let s = arena({ a: [3, 3], b: [11, 5] });
    s = { ...s, elapsed: BALANCE.time.suddenDeathStart - TICK_SECONDS / 2 };
    s = step(s, {}, TICK_SECONDS);
    expect(s.phase).toBe(MatchPhase.SuddenDeath);
    expect(s.ringsClosed).toBe(1);
  });

  it("bomba esmagada pelo anel devolve a contagem ao dono", () => {
    let s = arena({ a: [3, 3], b: [11, 5] });
    s = {
      ...s,
      elapsed: BALANCE.time.suddenDeathStart - TICK_SECONDS / 2,
      players: s.players.map((p) => (p.id === "a" ? { ...p, bombsPlaced: 1 } : p)),
      bombs: [{ id: 9, ownerId: "a", x: 1, y: 1, range: 2, fuseRemaining: 2 }],
    };
    s = step(s, {}, TICK_SECONDS);
    expect(s.bombs).toHaveLength(0);
    expect(s.players[0]?.bombsPlaced).toBe(0);
  });
});

describe("victory", () => {
  const alive = (id: string, isAlive: boolean) => ({ ...createPlayer(id, 0), alive: isAlive });

  it("ultimo vivo vence", () => {
    expect(checkVictory([alive("a", true), alive("b", false)], 10)).toEqual({
      finished: true,
      winnerId: "a",
    });
  });

  it("todos mortos e empate", () => {
    expect(checkVictory([alive("a", false), alive("b", false)], 10)).toEqual({
      finished: true,
      winnerId: null,
    });
  });

  it("dois vivos seguem jogando ate o teto", () => {
    const both = [alive("a", true), alive("b", true)];
    expect(checkVictory(both, 10).finished).toBe(false);
    expect(checkVictory(both, BALANCE.time.matchMax)).toEqual({ finished: true, winnerId: null });
  });

  it("sozinho, so acaba quando morre", () => {
    expect(checkVictory([alive("a", true)], 10).finished).toBe(false);
    expect(checkVictory([alive("a", false)], 10).finished).toBe(true);
  });
});

describe("fases", () => {
  it("contagem de 3 s em que nada se mexe, depois Playing", () => {
    let s = createMatchState(1, ["a", "b"]);
    expect(s.phase).toBe(MatchPhase.Countdown);
    const x = s.players[0]?.x;
    s = run(s, { a: { moveX: 1, moveY: 0, bomb: true } }, ticksFor(BALANCE.time.countdown) - 1);
    expect(s.phase).toBe(MatchPhase.Countdown);
    expect(s.players[0]?.x).toBe(x);
    expect(s.bombs).toHaveLength(0);
    s = run(s, {}, 2);
    expect(s.phase).toBe(MatchPhase.Playing);
  });

  it("depois do fim ignora entrada, mas as chamas terminam", () => {
    let s = arena({ a: [3, 1], b: [9, 1] });
    s = {
      ...s,
      players: s.players.map((p) => (p.id === "b" ? { ...p, alive: false } : p)),
      explosions: [{ id: 1, ownerId: "x", cells: [cellIndex(9, 1)], remaining: 0.3 }],
    };
    s = step(s, {}, TICK_SECONDS);
    expect(s.phase).toBe(MatchPhase.Finished);
    const x = s.players[0]?.x;
    s = run(s, { a: { moveX: 1, moveY: 0 } }, ticksFor(0.5));
    expect(s.players[0]?.x).toBe(x);
    expect(s.explosions).toHaveLength(0);
  });

  it("rodada inteira sem ninguem jogar termina ate o teto", () => {
    let s = createMatchState(4, ["a", "b"]);
    const limit = ticksFor(BALANCE.time.countdown + BALANCE.time.matchMax) + 1;
    for (let t = 0; t < limit && s.phase !== MatchPhase.Finished; t += 1) {
      s = step(s, {}, TICK_SECONDS);
    }
    expect(s.phase).toBe(MatchPhase.Finished);
    expect(s.elapsed).toBeLessThanOrEqual(BALANCE.time.matchMax + TICK_SECONDS);
  });
});

describe("duelo de desempate", () => {
  const duel = createMatchState(5, ["a", "b", "c"], { duel: true, slots: [2, 5, 7] });
  const open = new Set(SUDDEN_DEATH_RINGS.slice(BALANCE.duel.closedRings).flat());

  it("comeca com os aneis externos fechados e sem caixas no que sobra", () => {
    expect(duel.duel).toBe(true);
    expect(duel.ringsClosed).toBe(BALANCE.duel.closedRings);
    for (const ring of SUDDEN_DEATH_RINGS.slice(0, BALANCE.duel.closedRings)) {
      for (const cell of ring) {
        expect(duel.grid.cells[cell]).toBe(CellKind.Wall);
      }
    }
    for (const cell of open) {
      expect(duel.grid.cells[cell]).not.toBe(CellKind.Crate);
    }
  });

  it("deixa um anel a mais aberto que o fechamento final da rodada", () => {
    expect(BALANCE.duel.closedRings).toBe(CLOSABLE_RINGS - 1);
  });

  it("espalha os jogadores em piso livre e mantem a vaga de cada um", () => {
    const cells = duel.players.map((p) => cellIndex(Math.floor(p.x), Math.floor(p.y)));
    expect(new Set(cells).size).toBe(3);
    for (const cell of cells) {
      expect(open.has(cell)).toBe(true);
      expect(duel.grid.cells[cell]).toBe(CellKind.Floor);
    }
    expect(duel.players.map((p) => p.slot)).toEqual([2, 5, 7]);
  });

  it("no duelo os aneis nao fecham alem dos iniciais; quem fecha e a espiral", () => {
    expect(ringsDue(10_000, DUEL_RINGS)).toBe(BALANCE.duel.closedRings);
    expect(spiralDue(BALANCE.duel.spiralStart - 0.01)).toBe(0);
    expect(spiralDue(BALANCE.duel.spiralStart)).toBe(1);
    expect(spiralDue(BALANCE.duel.spiralStart + BALANCE.duel.spiralCellSeconds)).toBe(2);
    expect(spiralDue(10_000)).toBe(DUEL_SPIRAL.length);
  });

  it("espiral cobre o que sobra do duelo uma vez, de fora para dentro, celula vizinha a celula", () => {
    expect([...DUEL_SPIRAL].sort((a, b) => a - b)).toEqual([...open].sort((a, b) => a - b));
    const outer = new Set(SUDDEN_DEATH_RINGS[BALANCE.duel.closedRings]);
    expect(outer.has(DUEL_SPIRAL[0] as number)).toBe(true);
    const ring = SUDDEN_DEATH_RINGS[BALANCE.duel.closedRings]?.length ?? 0;
    for (let i = 1; i < ring; i += 1) {
      const a = DUEL_SPIRAL[i - 1] as number;
      const b = DUEL_SPIRAL[i] as number;
      expect(Math.abs((a % ARENA_COLS) - (b % ARENA_COLS)) + Math.abs(Math.floor(a / ARENA_COLS) - Math.floor(b / ARENA_COLS))).toBe(1);
    }
  });

  it("duelo sempre termina: a espiral fecha tudo antes do teto da partida", () => {
    expect(spiralClosesAt(DUEL_SPIRAL.length - 1)).toBeLessThan(BALANCE.time.matchMax);
    let s = createMatchState(3, ["a", "b"], { duel: true });
    while (s.phase !== MatchPhase.Finished) {
      s = step(s, {}, TICK_SECONDS);
    }
    expect(s.elapsed).toBeLessThan(spiralClosesAt(DUEL_SPIRAL.length - 1) + 1);
  });

  it("parados em celulas diferentes, a espiral esmaga um antes do outro", () => {
    let s = createMatchState(3, ["a", "b"], { duel: true });
    while (s.phase !== MatchPhase.Finished) {
      s = step(s, {}, TICK_SECONDS);
    }
    expect(s.winnerId).not.toBeNull();
  });

  it("sorteia quem nasce em cada ponto, para o primeiro da sala nao nascer sempre onde a espiral comeca", () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const s = createMatchState(seed, ["a", "b"], { duel: true });
      const p = s.players[0];
      firsts.add(cellIndex(Math.floor(p?.x ?? 0), Math.floor(p?.y ?? 0)) === duelSpawns(s.grid, 2, BALANCE.duel.closedRings + 1).map((c) => cellIndex(c.x, c.y))[0] ? 1 : 0);
    }
    expect(firsts.size).toBe(2);
  });

  it("cabe a sala inteira no duelo em todo layout", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const full = createMatchState(seed, ["a", "b", "c", "d", "e", "f", "g", "h"], { duel: true });
      const cells = full.players.map((p) => cellIndex(Math.floor(p.x), Math.floor(p.y)));
      expect(new Set(cells).size).toBe(8);
    }
  });
});
