/**
 * Menu do Esc durante a partida online. A partida nao pausa: enquanto o menu
 * esta aberto a cena envia a entrada parada. Nao conhece rede nem Phaser.
 */
import { announceBack, markBack } from "../audio/ui-sounds.js";
import { helpBody } from "./help.js";
import { moveFocus } from "./keyboard-nav.js";

export interface PauseMenuView {
  readonly spectating: boolean;
  readonly summary: string;
  /** Quem assume a sala se o anfitriao sair; null para os outros jogadores. */
  readonly heir: string | null;
}

type Screen = "main" | "help" | "confirm";

function button(text: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "room-main";
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

export class PauseMenu {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly warning: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly resume: HTMLButtonElement;
  private readonly leave: HTMLButtonElement;
  private readonly heir: HTMLElement;
  private readonly stay: HTMLButtonElement;
  private readonly screens: Record<Screen, HTMLElement>;
  private screen: Screen = "main";
  private view: PauseMenuView = { spectating: false, summary: "", heir: null };

  constructor(onLeave: () => void, host: HTMLElement = document.body) {
    this.title = document.createElement("h2");
    this.warning = document.createElement("p");
    this.warning.className = "pause-warning";
    this.warning.textContent = "A partida continua rodando";
    this.summary = document.createElement("p");
    this.summary.className = "pause-summary";
    this.resume = markBack(button("Continuar", () => this.close()));
    const help = button("Como jogar", () => this.show("help"));
    this.leave = button("Sair da partida", () => (this.view.spectating ? onLeave() : this.show("confirm")));
    this.leave.classList.add("is-danger");
    const main = document.createElement("div");
    main.className = "pause-screen";
    main.append(this.title, this.warning, this.resume, help, this.leave, this.summary);

    const helpTitle = document.createElement("h2");
    helpTitle.textContent = "Como jogar";
    const helpScreen = document.createElement("div");
    helpScreen.className = "pause-screen";
    helpScreen.append(helpTitle, ...helpBody(), markBack(button("Voltar", () => this.show("main"))));

    const confirmTitle = document.createElement("h2");
    confirmTitle.textContent = "Sair da partida?";
    const cost = document.createElement("p");
    cost.className = "pause-summary";
    cost.textContent = "Sair agora conta como eliminacao nesta rodada.";
    this.heir = document.createElement("p");
    this.heir.className = "pause-summary";
    this.stay = markBack(button("Ficar", () => this.show("main")));
    const exit = button("Sair", onLeave);
    exit.classList.add("is-danger");
    const confirm = document.createElement("div");
    confirm.className = "pause-screen";
    confirm.append(confirmTitle, cost, this.heir, this.stay, exit);

    this.screens = { main, help: helpScreen, confirm };
    const box = document.createElement("div");
    box.className = "ui-panel";
    box.append(main, helpScreen, confirm);
    this.root = document.createElement("div");
    this.root.className = "lobby pause";
    this.root.hidden = true;
    this.root.append(box);
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        announceBack();
        if (this.screen === "main") {
          this.close();
        } else {
          this.show("main");
        }
        return;
      }
      moveFocus(event, [...this.screens[this.screen].querySelectorAll<HTMLElement>("button")]);
    });
    host.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(view: PauseMenuView): void {
    this.render(view);
    this.root.hidden = false;
    this.show("main");
  }

  close(): void {
    this.root.hidden = true;
  }

  render(view: PauseMenuView): void {
    this.view = view;
    this.title.textContent = view.spectating ? "Espectando" : "Pausa";
    this.warning.hidden = view.spectating;
    this.leave.textContent = view.spectating ? "Sair da sala" : "Sair da partida";
    this.summary.textContent = view.summary;
    this.heir.hidden = view.heir === null;
    this.heir.textContent = view.heir === null ? "" : `O anfitriao passa para ${view.heir}.`;
  }

  dispose(): void {
    this.root.remove();
  }

  private show(screen: Screen): void {
    this.screen = screen;
    for (const [name, el] of Object.entries(this.screens)) {
      el.hidden = name !== screen;
    }
    const first = screen === "confirm" ? this.stay : this.screens[screen].querySelector("button");
    first?.focus();
  }
}
