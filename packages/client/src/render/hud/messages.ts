/** Textos do HUD derivados do estado, sem acesso a render. */
import { BALANCE, MatchPhase, displayName, type MatchState, type Player } from "@pixelboom/shared";

/** Apelido por id de jogador; quem nao tem apelido fica de fora. */
export type Nicknames = ReadonlyMap<string, string>;

const NO_NICKNAMES: Nicknames = new Map();

export interface SeriesInfo {
  readonly round: number;
  readonly finished: boolean;
  readonly winnerId: string | null;
}

export function playerName(player: Pick<Player, "id" | "slot">, names: Nicknames = NO_NICKNAMES): string {
  return displayName(names.get(player.id) ?? null, player.slot);
}

function nameOf(state: MatchState, id: string, names: Nicknames): string {
  const player = state.players.find((p) => p.id === id);
  return player === undefined ? "?" : playerName(player, names);
}

export function roundLabel(series: SeriesInfo): string {
  return `RODADA ${series.round}/${BALANCE.match.maxRounds}`;
}

export function roundResult(state: MatchState, localId: string, names: Nicknames = NO_NICKNAMES): string {
  if (state.winnerId === null) {
    return state.players.length > 1 ? "Empate" : "Fim de rodada";
  }
  return state.winnerId === localId ? "Voce venceu a rodada" : `${nameOf(state, state.winnerId, names)} venceu a rodada`;
}

export function seriesResult(state: MatchState, series: SeriesInfo, localId: string, names: Nicknames): string {
  if (series.winnerId === null) {
    return "Serie empatada";
  }
  return series.winnerId === localId ? "Voce venceu a serie!" : `${nameOf(state, series.winnerId, names)} venceu a serie`;
}

/** Aviso central da partida online; null quando nada deve aparecer. */
export function onlineBanner(
  state: MatchState,
  series: SeriesInfo,
  localId: string,
  names: Nicknames,
): string | null {
  if (state.phase === MatchPhase.Finished) {
    return series.finished ? seriesResult(state, series, localId, names) : roundResult(state, localId, names);
  }
  const self = state.players.find((p) => p.id === localId);
  if (self === undefined) {
    return "Assistindo\nvoce entra na proxima rodada";
  }
  return self.alive ? null : "Eliminado\nassistindo";
}

/** O jogador venceu a rodada que acabou de terminar e deve comemorar. */
export function comemora(state: MatchState, playerId: string): boolean {
  return state.phase === MatchPhase.Finished && state.winnerId === playerId;
}
