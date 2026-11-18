import { describe, expect, it } from "vitest";
import { DeathCause, playBotMatch } from "../src/ai/bot-match.js";
import { BotDifficulty } from "../src/ai/decide.js";
import { BALANCE, TICK_SECONDS } from "../src/config/balance.js";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe("partidas so de bots", () => {
  const reports = SEEDS.map((seed) => playBotMatch(seed, [BotDifficulty.Hard, BotDifficulty.Normal]));
  const lives = reports.length * 2;
  const deaths = reports.flatMap((r) => Object.values(r.deaths));

  it("todas terminam ate o tempo maximo", () => {
    for (const report of reports) {
      expect(report.seconds).toBeLessThanOrEqual(BALANCE.time.matchMax + TICK_SECONDS);
    }
  });

  it("bot quase nunca morre com a propria bomba", () => {
    const own = deaths.filter((d) => d === DeathCause.OwnBomb).length;
    expect(own / lives).toBeLessThanOrEqual(0.15);
  });

  it("anel fechando raramente mata", () => {
    const crushed = reports.filter((r) => Object.values(r.deaths).includes(DeathCause.SuddenDeath)).length;
    expect(crushed / reports.length).toBeLessThanOrEqual(0.15);
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
