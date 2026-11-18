import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/config/balance.js";
import { canKick, canSetCapacity, isRoomCapacity, isRoomFull } from "../src/rules/room-admin.js";

describe("administracao da sala", () => {
  it("aceita capacidade inteira de 2 a 8", () => {
    for (let n = BALANCE.room.capacityMin; n <= BALANCE.room.capacityMax; n += 1) {
      expect(isRoomCapacity(n)).toBe(true);
    }
    for (const value of [1, 9, 2.5, "4", null, Number.NaN]) {
      expect(isRoomCapacity(value)).toBe(false);
    }
  });

  it("nao reduz a capacidade abaixo de quem ja esta na sala", () => {
    expect(canSetCapacity(3, 4)).toBe(false);
    expect(canSetCapacity(4, 4)).toBe(true);
    expect(canSetCapacity(6, 4)).toBe(true);
  });

  it("sala cheia quando os ocupantes alcancam a capacidade", () => {
    expect(isRoomFull(3, 4)).toBe(false);
    expect(isRoomFull(4, 4)).toBe(true);
  });

  it("so o anfitriao remove, e so membros que nao sejam ele", () => {
    const members = ["h", "a", "b"];
    expect(canKick("h", "h", "a", members)).toBe(true);
    expect(canKick("a", "h", "b", members)).toBe(false);
    expect(canKick("h", "h", "h", members)).toBe(false);
    expect(canKick("h", "h", "x", members)).toBe(false);
  });

  it("o elenco nao depende da capacidade", () => {
    expect(BALANCE.room.castSize).toBe(BALANCE.room.capacityMax);
  });
});
