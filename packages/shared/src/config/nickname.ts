/**
 * Apelido do jogador: maiusculas sem acento e digitos, os glifos que a fonte
 * pixel do HUD desenha. Unico dentro da sala. Onde o espaco e curto, como o
 * placar, aparece abreviado.
 */
export const NICKNAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 13;
/** Letras exibidas antes do ponto na forma curta. */
export const NICKNAME_SHORT_LENGTH = 6;
/** Codigo de recusa da sala quando o apelido ja esta em uso, igual nos dois lados. */
export const NICKNAME_TAKEN_CODE = 409;

const NICKNAME_PATTERN = new RegExp(`^[${NICKNAME_ALPHABET}]{${NICKNAME_MIN_LENGTH},${NICKNAME_MAX_LENGTH}}$`);

/** Normaliza para maiusculas e valida; qualquer valor fora do formato vira null. */
export function parseNickname(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const nickname = raw.trim().toUpperCase();
  return NICKNAME_PATTERN.test(nickname) ? nickname : null;
}

/** Nome exibido: o apelido, ou o numero da vaga para quem nao escolheu um. */
export function displayName(nickname: string | null, slot: number): string {
  return nickname ?? `J${slot + 1}`;
}

/** `taken` sao os apelidos de quem ja esta na sala. */
export function isNicknameTaken(taken: Iterable<string>, nickname: string): boolean {
  return new Set(taken).has(nickname);
}

/** Forma curta para espacos apertados: as primeiras letras e um ponto. */
export function shortName(name: string): string {
  return name.length > NICKNAME_SHORT_LENGTH ? `${name.slice(0, NICKNAME_SHORT_LENGTH)}.` : name;
}
