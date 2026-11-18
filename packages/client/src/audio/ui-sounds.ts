/**
 * Sons dos menus em DOM. Escuta o documento inteiro, entao qualquer botao novo
 * ja nasce com som; botoes de retorno se marcam com data-sfx="back".
 *
 * O som de passar so responde a gesto do jogador (mouse entrando no botao ou
 * seta do teclado). Foco movido pelo proprio painel ao trocar de tela fica
 * mudo, senao soaria junto com a confirmacao que causou a troca.
 */
import type Phaser from "phaser";
import { SFX, playSfx } from "./sfx.js";

const BACK = "back";
const BACK_EVENT = "pixelboom:ui-back";
const MOVE_EVENT = "pixelboom:ui-move";

function buttonOf(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest("button") : null;
}

export function markBack(button: HTMLButtonElement): HTMLButtonElement {
  button.dataset.sfx = BACK;
  return button;
}

export function attachUiSounds(sound: Phaser.Sound.BaseSoundManager): void {
  document.addEventListener("mouseover", (event) => {
    const button = buttonOf(event.target);
    // Mover o mouse entre filhos do mesmo botao nao conta como entrar de novo.
    const from = buttonOf(event.relatedTarget);
    if (button !== null && !button.disabled && from !== button) {
      playSfx(sound, SFX.uiHover);
    }
  });
  document.addEventListener("click", (event) => {
    const button = buttonOf(event.target);
    if (button !== null && !button.disabled) {
      playSfx(sound, button.dataset.sfx === BACK ? SFX.uiBack : SFX.uiConfirm);
    }
  });
  document.addEventListener(MOVE_EVENT, () => playSfx(sound, SFX.uiHover));
  document.addEventListener(BACK_EVENT, () => playSfx(sound, SFX.uiBack));
}

/** Para retornos sem clique, como o Esc, avisados pelo proprio painel. */
export function announceBack(): void {
  document.dispatchEvent(new Event(BACK_EVENT));
}

/** Foco movido pelas setas. */
export function announceMove(): void {
  document.dispatchEvent(new Event(MOVE_EVENT));
}
