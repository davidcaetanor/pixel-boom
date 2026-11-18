import { BotDifficulty } from "@pixelboom/shared";

export const DIFFICULTY_LABEL: Readonly<Record<BotDifficulty, string>> = {
  [BotDifficulty.Normal]: "Normal",
  [BotDifficulty.Hard]: "Dificil",
};

/** Aviso na tela inicial para quem o anfitriao removeu da sala. */
export const KICKED_NOTICE = "Voce foi removido da sala pelo anfitriao";
