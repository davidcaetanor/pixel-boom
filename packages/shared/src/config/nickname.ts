/**
 * Apelido do jogador: maiusculas sem acento e digitos, os glifos que a fonte
 * pixel do HUD desenha. O tamanho maximo cabe no quadro de cada jogador do
 * placar ao lado das estrelas.
 */
export const NICKNAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 6;

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
