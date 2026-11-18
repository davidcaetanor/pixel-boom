/**
 * Administracao da sala de espera pelo anfitriao: capacidade e remocao de
 * membros. A capacidade conta humanos e bots e nunca fica abaixo de quem ja
 * esta na sala.
 */
import { BALANCE } from "../config/balance.js";

/** Codigo de fechamento da conexao de quem o anfitriao removeu. */
export const KICKED_CODE = 4001;

export function isRoomCapacity(value: unknown): value is number {
  const { capacityMin, capacityMax } = BALANCE.room;
  return typeof value === "number" && Number.isInteger(value) && value >= capacityMin && value <= capacityMax;
}

export function canSetCapacity(value: unknown, occupants: number): value is number {
  return isRoomCapacity(value) && value >= occupants;
}

export function isRoomFull(occupants: number, capacity: number): boolean {
  return occupants >= capacity;
}

export function canKick(requesterId: string, hostId: string, targetId: string, memberIds: Iterable<string>): boolean {
  return requesterId === hostId && targetId !== hostId && new Set(memberIds).has(targetId);
}
