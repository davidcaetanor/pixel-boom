/** Impulso de velocidade: desconta o tempo e devolve a velocidade inicial quando acaba. */
import { BALANCE } from "../config/balance.js";
import type { Player } from "../domain/player.js";

export function tickSpeedBoost<P extends Pick<Player, "speed" | "speedBoost">>(player: P, dt: number): P {
  if (player.speedBoost <= 0) {
    return player;
  }
  const speedBoost = Math.max(player.speedBoost - dt, 0);
  return speedBoost > 0 ? { ...player, speedBoost } : { ...player, speedBoost, speed: BALANCE.player.speedInitial };
}
