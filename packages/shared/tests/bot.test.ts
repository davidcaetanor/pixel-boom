import { describe, expect, it } from "vitest";
import { dangerMap, isSafeSpot } from "../src/ai/danger.js";
import { BotDifficulty, createBotMemory, decideBot, type BotMemory } from "../src/ai/decide.js";
import { reach } from "../src/ai/reach.js";
import { CELL_CENTER, cellIndex } from "../src/config/arena.js";
import { BALANCE, TICK_SECONDS } from "../src/config/balance.js";
import type { Bomb } from "../src/domain/bomb.js";
import { CellKind } from "../src/domain/cell.js";
import { emptyGrid, setCell } from "../src/domain/grid.js";
import { MatchPhase, type MatchState } from "../src/domain/match-state.js";
import { createPlayer, step } from "../src/simulation/step.js";

const BOT = "bot";
const ENEMY = "enemy";

interface Scene {
  readonly state: MatchState;
  readonly at: (x: number, y: number) => number;
}

/**
 * Cena a partir de um desenho com origem na celula (1, 1): `#` parede, `c`
 * caixa, `B` bot, `E` adversario, `o` bomba recem-solta do adversario, `*`
 * bomba do adversario a meio pavio. Fora do desenho tudo e parede.
 */
function scene(rows: readonly string[]): Scene {
  const grid = emptyGrid();
  grid.cells.fill(CellKind.Wall);
  const players = [];
  const bombs: Bomb[] = [];
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      const x = dx + 1;
      const y = dy + 1;
      setCell(grid, x, y, ch === "#" ? CellKind.Wall : ch === "c" ? CellKind.Crate : CellKind.Floor);
      if (ch === "B" || ch === "E") {
        const p = createPlayer(ch === "B" ? BOT : ENEMY, players.length);
        players.push({ ...p, x: x + CELL_CENTER, y: y + CELL_CENTER });
      }
      if (ch === "o" || ch === "*") {
        const fuse = ch === "o" ? BALANCE.time.bombFuse : BALANCE.time.bombFuse / 2;
        bombs.push({ id: bombs.length + 1, ownerId: ENEMY, x, y, range: 2, fuseRemaining: fuse });
      }
    });
  });
  const state: MatchState = {
    tick: 0,
    elapsed: 10,
    phase: MatchPhase.Playing,
    grid,
    players,
    bombs,
    explosions: [],
    powerUps: [],
    ringsClosed: 0,
    winnerId: null,
    nextEntityId: 100,
    rng: 1,
  };
  return { state, at: (x, y) => cellIndex(x + 1, y + 1) };
}

function decide(state: MatchState, difficulty: BotDifficulty = BotDifficulty.Hard, memory?: BotMemory) {
  return decideBot(state, BOT, difficulty, memory ?? createBotMemory(7), TICK_SECONDS);
}

/** Roda so o bot, com o adversario parado, ate `seconds` ou o fim da rodada. */
function play(state: MatchState, seconds: number, memory: BotMemory = createBotMemory(7)): MatchState {
  let current = state;
  let mem = memory;
  for (let t = 0; t < seconds && current.phase !== MatchPhase.Finished; t += TICK_SECONDS) {
    const decision = decideBot(current, BOT, BotDifficulty.Hard, mem, TICK_SECONDS);
    mem = decision.memory;
    current = step(current, { [BOT]: decision.input }, TICK_SECONDS);
  }
  return current;
}

function bot(state: MatchState) {
  const found = state.players.find((p) => p.id === BOT);
  if (found === undefined) {
    throw new Error("cena sem bot");
  }
  return found;
}

describe("mapa de perigo", () => {
  it("marca a cruz da bomba no instante do pavio", () => {
    const { state, at } = scene(["....*...."]);
    const danger = dangerMap(state);
    expect(danger.start[at(4, 0)]).toBeCloseTo(BALANCE.time.bombFuse / 2);
    expect(danger.start[at(6, 0)]).toBeCloseTo(BALANCE.time.bombFuse / 2);
    expect(danger.start[at(7, 0)]).toBe(Infinity);
  });

  it("separa o fechamento do anel da chama de bomba na mesma celula", () => {
    const { state, at } = scene(["*......"]);
    const danger = dangerMap(state);
    const fuse = BALANCE.time.bombFuse / 2;
    expect(isSafeSpot(danger, at(0, 0), fuse + 1, 0)).toBe(true);
    expect(danger.closes[at(0, 0)]).toBeCloseTo(BALANCE.time.suddenDeathStart - state.elapsed);
  });

  it("antecipa a bomba atingida em cadeia", () => {
    const { state, at } = scene(["*.o......"]);
    const danger = dangerMap(state);
    expect(danger.start[at(4, 0)]).toBeCloseTo(BALANCE.time.bombFuse / 2);
  });
});

describe("alcance", () => {
  it("nao atravessa caixa nem bomba", () => {
    const { state, at } = scene(["B.c.."]);
    const paths = reach({ grid: state.grid, bombs: state.bombs, danger: dangerMap(state), origin: at(0, 0), speed: 4, margin: 0 });
    expect(paths.arrival[at(1, 0)]).toBeCloseTo(0.25);
    expect(paths.arrival[at(3, 0)]).toBe(Infinity);
  });

  it("nao passa por celula que estara em chama na hora da passagem", () => {
    const { state, at } = scene(["#*#", "B.."]);
    const paths = reach({ grid: state.grid, bombs: state.bombs, danger: dangerMap(state), origin: at(0, 1), speed: 1, margin: 0 });
    expect(paths.arrival[at(1, 1)]).toBe(Infinity);
  });
});

describe("decisao do bot", () => {
  it("foge da propria celula quando uma bomba a cobre", () => {
    const { state } = scene(["B.o......", ".########"]);
    const after = play(state, BALANCE.time.bombFuse + 1);
    expect(bot(after).alive).toBe(true);
  });

  it("nao para na primeira celula fora de uma bomba se outra a cobre", () => {
    const { state, at } = scene([".....#", ".o.B.*", ".....#"]);
    const danger = dangerMap(state);
    expect(isSafeSpot(danger, at(4, 1), 0, 0)).toBe(false);
    const after = play(state, BALANCE.time.bombFuse + 1);
    expect(bot(after).alive).toBe(true);
  });

  it("nao solta bomba num corredor sem saida", () => {
    const { state } = scene(["Bc"]);
    const memory = { ...createBotMemory(7), target: cellIndex(1, 1) };
    expect(decide(state, BotDifficulty.Hard, memory).input.bomb).toBeUndefined();
  });

  it("nao solta bomba que encadeia com outra e fecha a fuga", () => {
    const { state } = scene(["#.#", "cB*", "#.#"]);
    const memory = { ...createBotMemory(7), target: cellIndex(2, 2) };
    expect(decide(state, BotDifficulty.Hard, memory).input.bomb).toBeUndefined();
  });

  it("solta bomba ao lado da caixa escolhida e sobrevive a ela", () => {
    const { state } = scene(["Bc", ".#", "..", ".."]);
    const memory = { ...createBotMemory(7), target: cellIndex(1, 1) };
    expect(decide(state, BotDifficulty.Hard, memory).input.bomb).toBe(true);
    const after = play(state, BALANCE.time.bombFuse + 1, memory);
    expect(bot(after).alive).toBe(true);
    expect(after.grid.cells[cellIndex(2, 1)]).toBe(CellKind.Floor);
  });

  it("prende o adversario num beco quando tem fuga", () => {
    const { state } = scene(["E.B..", "####.", "####."]);
    let memory = createBotMemory(3);
    let bombed = false;
    for (let i = 0; i < 30 && !bombed; i += 1) {
      const decision = decide(state, BotDifficulty.Hard, memory);
      bombed = decision.input.bomb === true;
      memory = decision.memory;
    }
    expect(bombed).toBe(true);
  });

  it("decide igual para o mesmo estado e a mesma memoria", () => {
    const { state } = scene(["E.B..", "####.", "####."]);
    expect(decide(state)).toEqual(decide(state));
  });

  it("fica parado fora da rodada", () => {
    const { state } = scene(["B.E"]);
    const countdown = { ...state, phase: MatchPhase.Countdown };
    expect(decide(countdown).input).toEqual({ moveX: 0, moveY: 0 });
  });
});
