import { describe, expect, it } from "vitest";
import { BotDifficulty } from "../src/ai/decide.js";
import { botNickname, otherDifficulty } from "../src/rules/room-bots.js";

describe("bots da sala", () => {
  it("o bot leva o nome do personagem", () => {
    expect(botNickname(4, [])).toBe("KARASUNO");
    expect(botNickname(3, ["CAIO"])).toBe("GOLEM");
  });

  it("humano com o nome do personagem empurra o bot para um numero", () => {
    expect(botNickname(3, ["GOLEM"])).toBe("GOLEM2");
    expect(botNickname(3, ["GOLEM", "GOLEM2"])).toBe("GOLEM3");
  });

  it("alterna entre as duas dificuldades", () => {
    expect(otherDifficulty(BotDifficulty.Normal)).toBe(BotDifficulty.Hard);
    expect(otherDifficulty(BotDifficulty.Hard)).toBe(BotDifficulty.Normal);
  });
});
