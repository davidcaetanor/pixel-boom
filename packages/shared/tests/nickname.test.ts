import { describe, expect, it } from "vitest";
import { NICKNAME_MAX_LENGTH, displayName, parseNickname } from "../src/config/nickname.js";

describe("apelido", () => {
  it("normaliza para maiusculas e remove espacos das pontas", () => {
    expect(parseNickname("  david ")).toBe("DAVID");
    expect(parseNickname("ana2")).toBe("ANA2");
  });

  it("recusa tamanho fora da faixa", () => {
    expect(parseNickname("A")).toBeNull();
    expect(parseNickname("A".repeat(NICKNAME_MAX_LENGTH))).not.toBeNull();
    expect(parseNickname("A".repeat(NICKNAME_MAX_LENGTH + 1))).toBeNull();
  });

  it("recusa caracteres que a fonte do HUD nao desenha", () => {
    expect(parseNickname("JOÃO")).toBeNull();
    expect(parseNickname("ANA B")).toBeNull();
    expect(parseNickname("<B>")).toBeNull();
  });

  it("recusa o que nao e texto", () => {
    expect(parseNickname(undefined)).toBeNull();
    expect(parseNickname(42)).toBeNull();
    expect(parseNickname({ nickname: "ANA" })).toBeNull();
  });

  it("sem apelido, o nome exibido e o numero da vaga", () => {
    expect(displayName(null, 0)).toBe("J1");
    expect(displayName("ANA", 3)).toBe("ANA");
  });
});
