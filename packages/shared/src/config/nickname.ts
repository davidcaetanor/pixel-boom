/** Apelido do jogador: so os glifos que a fonte pixel do HUD desenha. */
export const NICKNAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 13;
/** Letras exibidas antes do ponto na forma curta. */
export const NICKNAME_SHORT_LENGTH = 6;
export const NICKNAME_TAKEN_CODE = 409;

const NICKNAME_PATTERN = new RegExp(`^[${NICKNAME_ALPHABET}]{${NICKNAME_MIN_LENGTH},${NICKNAME_MAX_LENGTH}}$`);

export function parseNickname(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const nickname = raw.trim().toUpperCase();
  return NICKNAME_PATTERN.test(nickname) ? nickname : null;
}

export function displayName(nickname: string | null, slot: number): string {
  return nickname ?? `J${slot + 1}`;
}

export function isNicknameTaken(taken: Iterable<string>, nickname: string): boolean {
  return new Set(taken).has(nickname);
}

export function shortName(name: string): string {
  return name.length > NICKNAME_SHORT_LENGTH ? `${name.slice(0, NICKNAME_SHORT_LENGTH)}.` : name;
}
