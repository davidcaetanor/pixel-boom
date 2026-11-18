/** Configuracoes da sala, abertas pela engrenagem do anfitriao. Nao conhece rede nem Phaser. */
import { BALANCE, canSetCapacity, stepBestOf } from "@pixelboom/shared";
import { announceBack, markBack } from "../audio/ui-sounds.js";
import { moveFocus } from "./keyboard-nav.js";

export interface RoomSettingsActions {
  onCapacity(value: number): void;
  onBots(value: number): void;
  onBestOf(value: number): void;
}

export interface RoomSettingsView {
  readonly capacity: number;
  readonly humans: number;
  readonly bots: number;
  readonly bestOf: number;
}

/**
 * Linha com valor adiantado no clique: cliques seguidos somam antes da
 * resposta do servidor, e respostas intermediarias nao desfazem o pedido.
 */
class Stepper {
  readonly row: HTMLElement;
  readonly less: HTMLButtonElement;
  readonly more: HTMLButtonElement;
  private readonly value: HTMLElement;
  private shown = 0;
  private pending: number | null = null;

  constructor(
    label: string,
    signs: readonly [string, string],
    private readonly format: (value: number) => string,
    private readonly step: (value: number, direction: 1 | -1) => number,
    private readonly valid: (value: number) => boolean,
    send: (value: number) => void,
  ) {
    const name = document.createElement("span");
    name.className = "config-label";
    name.textContent = label;
    this.less = document.createElement("button");
    this.less.type = "button";
    this.less.textContent = signs[0];
    this.more = document.createElement("button");
    this.more.type = "button";
    this.more.textContent = signs[1];
    this.value = document.createElement("span");
    this.value.className = "config-value";
    const control = document.createElement("span");
    control.className = "config-step";
    control.append(this.less, this.value, this.more);
    this.row = document.createElement("div");
    this.row.className = "config-row";
    this.row.append(name, control);
    const request = (direction: 1 | -1): void => {
      const next = this.step(this.shown, direction);
      if (next !== this.shown && this.valid(next)) {
        this.pending = next;
        this.show(next);
        send(next);
      }
    };
    this.less.addEventListener("click", () => request(-1));
    this.more.addEventListener("click", () => request(1));
  }

  render(confirmed: number): void {
    if (this.pending === null || this.pending === confirmed || !this.valid(this.pending)) {
      this.pending = null;
      this.show(confirmed);
    } else {
      this.show(this.pending);
    }
  }

  private show(value: number): void {
    this.shown = value;
    this.value.textContent = this.format(value);
    const lower = this.step(value, -1);
    const upper = this.step(value, 1);
    this.less.disabled = lower === value || !this.valid(lower);
    this.more.disabled = upper === value || !this.valid(upper);
  }
}

const byOne = (value: number, direction: 1 | -1): number => value + direction;

export class RoomSettings {
  private readonly root: HTMLElement;
  private readonly capacity: Stepper;
  private readonly bots: Stepper;
  private readonly bestOf: Stepper;
  private readonly done: HTMLButtonElement;
  private view: RoomSettingsView = { capacity: 0, humans: 0, bots: 0, bestOf: BALANCE.match.bestOfDefault };

  constructor(actions: RoomSettingsActions, host: HTMLElement = document.body) {
    this.capacity = new Stepper(
      "Vagas",
      ["-", "+"],
      String,
      byOne,
      (value) => canSetCapacity(value, this.view.humans + this.view.bots),
      (value) => actions.onCapacity(value),
    );
    this.bots = new Stepper(
      "Bots",
      ["-", "+"],
      String,
      byOne,
      (value) => value >= 0 && value <= this.view.capacity - this.view.humans,
      (value) => actions.onBots(value),
    );
    this.bestOf = new Stepper(
      "Serie",
      ["<", ">"],
      (value) => `Melhor de ${value}`,
      stepBestOf,
      () => true,
      (value) => actions.onBestOf(value),
    );

    const title = document.createElement("h2");
    title.textContent = "Configuracoes";
    const rows = document.createElement("div");
    rows.className = "config";
    rows.append(this.capacity.row, this.bots.row, this.bestOf.row);
    this.done = markBack(document.createElement("button"));
    this.done.type = "button";
    this.done.className = "room-main";
    this.done.textContent = "Pronto";
    this.done.addEventListener("click", () => this.close());

    const box = document.createElement("div");
    box.className = "ui-panel";
    box.append(title, rows, this.done);
    this.root = document.createElement("div");
    this.root.className = "lobby room room-settings";
    this.root.hidden = true;
    this.root.append(box);
    const focusable = [
      this.capacity.less,
      this.capacity.more,
      this.bots.less,
      this.bots.more,
      this.bestOf.less,
      this.bestOf.more,
      this.done,
    ];
    this.root.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        announceBack();
        this.close();
        return;
      }
      moveFocus(event, focusable);
    });
    host.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.root.hidden = false;
    this.done.focus();
  }

  close(): void {
    this.root.hidden = true;
  }

  render(view: RoomSettingsView): void {
    this.view = view;
    this.capacity.render(view.capacity);
    this.bots.render(view.bots);
    this.bestOf.render(view.bestOf);
  }

  dispose(): void {
    this.root.remove();
  }
}
