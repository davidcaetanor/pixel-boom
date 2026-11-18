/**
 * Entrada na sala: cria uma nova ou entra por codigo. Com `?sala=CODIGO` na URL
 * entra direto com o apelido salvo. Ao conectar, o codigo vai para a URL.
 */
import Phaser from "phaser";
import { NICKNAME_TAKEN_CODE, parseRoomCode } from "@pixelboom/shared";
import { createRoom, joinRoom } from "../../net/room-client.js";
import { LobbyPanel } from "../../ui/lobby-panel.js";

export const ROOM_PARAM = "sala";

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

  create(data?: { readonly notice?: string }): void {
    this.panel = new LobbyPanel({
      onCreate: (nickname) => this.connect(createRoom(nickname)),
      onCreateBot: (nickname, difficulty) => this.connect(createRoom(nickname, difficulty)),
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
    if (data?.notice !== undefined) {
      this.panel.showError(data.notice);
      return;
    }

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
          this.panel?.awaitNickname(code);
          this.panel?.showError("Apelido ja usado nesta sala, escolha outro");
          return;
        }
        this.panel?.showError("Sala nao encontrada ou cheia");
      });
  }
}
