import { describe, expect, it } from "vitest";
import { DeathCause, playBotMatch } from "../src/ai/bot-match.js";
import { BotDifficulty } from "../src/ai/decide.js";
import { BALANCE } from "../src/config/balance.js";
import { SUDDEN_DEATH_RINGS } from "../src/config/sudden-death-order.js";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const LAST_RING = BALANCE.time.suddenDeathStart + (SUDDEN_DEATH_RINGS.length - 1) * BALANCE.time.suddenDeathRingInterval;

describe("partidas so de bots", () => {
  const reports = SEEDS.map((seed) => playBotMatch(seed, [BotDifficulty.Hard, BotDifficulty.Normal]));
  const lives = reports.length * 2;
  const deaths = reports.flatMap((r) => Object.values(r.deaths));

  it("todas terminam antes do tempo maximo", () => {
    for (const report of reports) {
      expect(report.seconds).toBeLessThanOrEqual(BALANCE.time.matchMax);
    }
  });

  it("bot quase nunca morre com a propria bomba", () => {
    const own = deaths.filter((d) => d === DeathCause.OwnBomb).length;
    expect(own / lives).toBeLessThanOrEqual(0.15);
  });

  it("anel fechando so mata quando a arena inteira fecha", () => {
    const early = reports.filter(
      (r) => r.seconds < LAST_RING && Object.values(r.deaths).includes(DeathCause.SuddenDeath),
    ).length;
    expect(early / reports.length).toBeLessThanOrEqual(0.15);
  });

  it("dificil vence o normal na maioria das partidas decididas", () => {
    const decided = reports.filter((r) => r.winnerId !== null);
    const hardWins = decided.filter((r) => r.winnerId === "bot0").length;
    expect(hardWins).toBeGreaterThan(decided.length / 2);
  });

  it("e reproduzivel pela semente", () => {
    expect(playBotMatch(1, [BotDifficulty.Hard, BotDifficulty.Normal])).toEqual(reports[0]);
  });
});
