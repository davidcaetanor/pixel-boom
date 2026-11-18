/**
 * Direcional e bomba na tela como InputCommand, com a mesma forma do teclado.
 *
 * Cada controle tem uma zona de toque bem maior que o desenho: a metade
 * esquerda da tela anda, a direita solta bomba. O dedo que comeca no
 * direcional fica preso a ele mesmo saindo da zona, e a direcao e lida pelo
 * angulo em relacao ao centro do desenho. Perto da diagonal os dois eixos
 * ficam ativos e a virada antecipada da simulacao faz a curva sozinha.
 */
import type { AxisIntent, InputCommand } from "@pixelboom/shared";
import { IDLE_INPUT } from "@pixelboom/shared";

/** Raio sem direcao, em fracao do raio do direcional. */
const ZONA_MORTA = 0.2;
/** Meia largura, em graus, da faixa da diagonal em que os dois eixos ficam ativos. */
const MEIA_FAIXA_DIAGONAL = 12;
const GRAUS_DIAGONAL = 45;
const VIBRACAO_BOMBA_MS = 12;

type Axis = "x" | "y";

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export class TouchSource {
  private readonly root: HTMLElement;
  private readonly pad: HTMLElement;
  private readonly bomb: HTMLElement;
  private padPointer: number | null = null;
  private moveX: AxisIntent = 0;
  private moveY: AxisIntent = 0;
  private prefer: Axis = "x";
  private bombPending = false;

  constructor(onPause: (() => void) | null, host: HTMLElement = document.body) {
    this.root = el("div", "touch");
    this.root.hidden = true;
    const walkZone = el("div", "touch-zona is-andar");
    this.pad = el("div", "touch-pad");
    for (const dir of ["up", "right", "down", "left"]) {
      this.pad.append(el("span", `touch-seta is-${dir}`));
    }
    walkZone.append(this.pad);
    const bombZone = el("div", "touch-zona is-bomba");
    this.bomb = el("div", "touch-bomba");
    bombZone.append(this.bomb);
    this.root.append(walkZone, bombZone);
    if (onPause !== null) {
      const pause = document.createElement("button");
      pause.type = "button";
      pause.className = "touch-pausa";
      pause.setAttribute("aria-label", "Pausa");
      pause.addEventListener("click", onPause);
      this.root.append(pause);
    }

    walkZone.addEventListener("pointerdown", this.onPadDown);
    walkZone.addEventListener("pointermove", this.onPadMove);
    walkZone.addEventListener("pointerup", this.onPadUp);
    walkZone.addEventListener("pointercancel", this.onPadUp);
    bombZone.addEventListener("pointerdown", this.onBombDown);
    bombZone.addEventListener("pointerup", this.onBombUp);
    bombZone.addEventListener("pointercancel", this.onBombUp);
    this.root.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("blur", this.release);
    document.addEventListener("visibilitychange", this.onVisibility);
    host.append(this.root);
  }

  read(): InputCommand {
    const bomb = this.bombPending;
    this.bombPending = false;
    if (this.moveX === 0 && this.moveY === 0) {
      return bomb ? { ...IDLE_INPUT, bomb } : IDLE_INPUT;
    }
    return { moveX: this.moveX, moveY: this.moveY, prefer: this.prefer, bomb };
  }

  setActive(active: boolean): void {
    if (this.root.hidden === !active) {
      return;
    }
    this.root.hidden = !active;
    if (!active) {
      this.release();
    }
  }

  dispose(): void {
    window.removeEventListener("blur", this.release);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.root.remove();
  }

  private readonly onPadDown = (event: PointerEvent): void => {
    if (this.padPointer !== null) {
      return;
    }
    event.preventDefault();
    this.padPointer = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.aim(event);
  };

  private readonly onPadMove = (event: PointerEvent): void => {
    if (event.pointerId === this.padPointer) {
      this.aim(event);
    }
  };

  private readonly onPadUp = (event: PointerEvent): void => {
    if (event.pointerId === this.padPointer) {
      this.padPointer = null;
      this.setDirection(0, 0);
    }
  };

  private readonly onBombDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.bombPending = true;
    this.bomb.classList.add("is-ativo");
    navigator.vibrate?.(VIBRACAO_BOMBA_MS);
  };

  private readonly onBombUp = (): void => {
    this.bomb.classList.remove("is-ativo");
  };

  private readonly release = (): void => {
    this.padPointer = null;
    this.bombPending = false;
    this.setDirection(0, 0);
    this.bomb.classList.remove("is-ativo");
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.release();
    }
  };

  private aim(event: PointerEvent): void {
    const rect = this.pad.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < (rect.width / 2) * ZONA_MORTA) {
      this.setDirection(0, 0);
      return;
    }
    const sx: AxisIntent = dx < 0 ? -1 : 1;
    const sy: AxisIntent = dy < 0 ? -1 : 1;
    const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
    if (Math.abs(angle - GRAUS_DIAGONAL) <= MEIA_FAIXA_DIAGONAL) {
      // Na diagonal o eixo preferido continua o que ja vinha sendo usado.
      this.setDirection(sx, sy);
      return;
    }
    if (angle < GRAUS_DIAGONAL) {
      this.prefer = "x";
      this.setDirection(sx, 0);
    } else {
      this.prefer = "y";
      this.setDirection(0, sy);
    }
  }

  private setDirection(x: AxisIntent, y: AxisIntent): void {
    this.moveX = x;
    this.moveY = y;
    this.pad.dataset.x = String(x);
    this.pad.dataset.y = String(y);
  }
}
