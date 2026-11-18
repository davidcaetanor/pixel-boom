/**
 * Menu de entrada: cria uma sala ou entra por codigo. Com `?sala=CODIGO` na
 * URL entra direto com o apelido salvo, ou pede o apelido antes. Ao conectar, o codigo vai para a URL, que vira o link de
 * convite, e a partida abre.
 */
import Phaser from "phaser";
import { NICKNAME_TAKEN_CODE, parseRoomCode } from "@pixelboom/shared";
import { createRoom, joinRoom } from "../../net/room-client.js";
import { LobbyPanel } from "../../ui/lobby-panel.js";

/** Parametro do convite na URL. */
export const ROOM_PARAM = "sala";

/** Tira o convite da URL, para a volta ao menu nao reentrar na mesma sala. */
export function forgetInvite(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(ROOM_PARAM);
  window.history.replaceState(null, "", url);
}

export class LobbyScene extends Phaser.Scene {
  private panel: LobbyPanel | null = null;

  constructor() {
    super({ key: "lobby" });
  }

  create(): void {
    this.panel = new LobbyPanel({
      onCreate: (nickname) => this.connect(createRoom(nickname)),
      onJoin: (raw, nickname) => {
        const code = parseRoomCode(raw);
        if (code === null) {
          this.panel?.showError("Codigo invalido");
          return;
        }
        this.connect(joinRoom(code, nickname), code);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel?.dispose());

    const fromUrl = parseRoomCode(new URLSearchParams(window.location.search).get(ROOM_PARAM) ?? "");
    if (fromUrl !== null) {
      const nickname = this.panel.nickname();
      if (nickname === null) {
        this.panel.awaitNickname(fromUrl);
      } else {
        this.connect(joinRoom(fromUrl, nickname), fromUrl);
      }
    }
  }

  /** `code` e a sala pedida ao entrar por codigo ou convite; ausente ao criar. */
  private connect(joining: Promise<{ roomId: string }>, code?: string): void {
    this.panel?.setBusy(true);
    joining
      .then((room) => {
        const url = new URL(window.location.href);
        url.searchParams.set(ROOM_PARAM, room.roomId);
        window.history.replaceState(null, "", url);
        this.scene.start("online");
      })
      .catch((error: unknown) => {
        this.panel?.setBusy(false);
        const taken = (error as { code?: unknown } | null)?.code === NICKNAME_TAKEN_CODE;
        if (taken && code !== undefined) {
          // Volta ao apelido ja mirando a mesma sala, para tentar de novo com outro nome.
          this.panel?.awaitNickname(code);
          this.panel?.showError("Apelido ja usado nesta sala, escolha outro");
          return;
        }
        this.panel?.showError("Sala nao encontrada ou cheia");
      });
  }
}
