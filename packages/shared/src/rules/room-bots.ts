/**
 * Bots da sala de espera: cada um leva o nome do seu personagem. Humanos tem
 * prioridade no nome; se um deles usa o nome do personagem, o bot ganha um
 * numero no fim.
 */
import { CAST } from "../config/cast.js";
import { BotDifficulty } from "../ai/decide.js";

export function botNickname(character: number, humanNicknames: Iterable<string>): string {
  const base = (CAST[character] ?? CAST[0]).toUpperCase();
  const taken = new Set(humanNicknames);
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; ; suffix += 1) {
    const name = `${base}${suffix}`;
    if (!taken.has(name)) {
      return name;
    }
  }
}

export function otherDifficulty(difficulty: BotDifficulty): BotDifficulty {
  return difficulty === BotDifficulty.Normal ? BotDifficulty.Hard : BotDifficulty.Normal;
}
