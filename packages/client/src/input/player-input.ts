/**
 * Entrada do jogador local: teclado sempre, controles na tela em aparelho de
 * toque. O toque vence no movimento enquanto houver dedo no direcional.
 */
import type { InputCommand } from "@pixelboom/shared";
import { isTouchDevice } from "../app/touch-screen.js";
import { KeyboardSource } from "./keyboard-source.js";
import { TouchSource } from "./touch-source.js";

export class PlayerInput {
  private readonly keyboard = new KeyboardSource();
  private readonly touch: TouchSource | null;

  constructor(onPause: (() => void) | null = null) {
    this.touch = isTouchDevice() ? new TouchSource(onPause) : null;
  }

  read(): InputCommand {
    const keys = this.keyboard.read();
    const touch = this.touch?.read();
    if (touch === undefined) {
      return keys;
    }
    const moving = touch.moveX !== 0 || touch.moveY !== 0;
    return { ...(moving ? touch : keys), bomb: keys.bomb || touch.bomb };
  }

  /** Esconde os controles na tela fora da partida, para nao cobrir os paineis. */
  setActive(active: boolean): void {
    this.touch?.setActive(active);
  }

  dispose(): void {
    this.keyboard.dispose();
    this.touch?.dispose();
  }
}
