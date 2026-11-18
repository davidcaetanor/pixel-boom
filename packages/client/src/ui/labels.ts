import { BotDifficulty } from "@pixelboom/shared";

export const DIFFICULTY_LABEL: Readonly<Record<BotDifficulty, string>> = {
  [BotDifficulty.Normal]: "Normal",
  [BotDifficulty.Hard]: "Dificil",
};
