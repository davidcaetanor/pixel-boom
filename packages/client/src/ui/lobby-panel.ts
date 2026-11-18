/** Menu de entrada sobreposto ao canvas. Nao conhece rede nem Phaser. */
import {
  BotDifficulty,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_CODE_LENGTH,
  parseNickname,
} from "@pixelboom/shared";
import { DIFFICULTY_LABEL } from "./labels.js";
import { announceBack, markBack } from "../audio/ui-sounds.js";
import { helpBody } from "./help.js";
import { moveFocus } from "./keyboard-nav.js";

export interface LobbyActions {
  onCreate(nickname: string): void;
  onJoin(code: string, nickname: string): void;
  onCreateBot(nickname: string, difficulty: BotDifficulty): void;
}

type Screen = "inicio" | "bot" | "online" | "ajuda";

const NICKNAME_STORAGE_KEY = "pixelboom.apelido";
const NICKNAME_ERROR = `Apelido: ${NICKNAME_MIN_LENGTH} a ${NICKNAME_MAX_LENGTH} letras ou numeros`;

function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveNickname(value: string): void {
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, value);
  } catch {
    // localStorage indisponivel em janela privada ou com dados bloqueados.
  }
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

function hint(text: string): HTMLParagraphElement {
  const el = document.createElement("p");
  el.className = "lobby-hint";
  el.textContent = text;
  return el;
}

export class LobbyPanel {
  private readonly root: HTMLElement;
  private readonly error: HTMLElement;
  private readonly nicknameInput: HTMLInputElement;
  private readonly codeInput: HTMLInputElement;
  private readonly screens: Record<Screen, HTMLElement>;
  private current: Screen = "inicio";
  private pendingCode: string | null = null;
  private readonly playButton: HTMLButtonElement;
  private readonly botButton: HTMLButtonElement;

  constructor(
    private readonly actions: LobbyActions,
    host: HTMLElement = document.body,
  ) {
    this.root = document.createElement("div");
    this.root.className = "lobby";

    this.nicknameInput = document.createElement("input");
    this.nicknameInput.className = "lobby-apelido";
    this.nicknameInput.placeholder = "Apelido";
    this.nicknameInput.maxLength = NICKNAME_MAX_LENGTH;
    this.nicknameInput.autocomplete = "off";
    this.nicknameInput.spellcheck = false;
    this.nicknameInput.value = loadNickname();
    this.nicknameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.play();
      }
    });

    this.codeInput = document.createElement("input");
    this.codeInput.placeholder = "Codigo";
    this.codeInput.maxLength = ROOM_CODE_LENGTH;
    this.codeInput.autocomplete = "off";
    this.codeInput.spellcheck = false;

    this.error = document.createElement("p");
    this.error.className = "lobby-error";

    this.playButton = button("Jogar online", () => this.play());
    this.botButton = button("Jogar contra bot", () => this.confirmNickname() !== null && this.show("bot"));

    this.screens = {
      inicio: this.buildInicio(),
      bot: this.buildBot(),
      online: this.buildOnline(),
      ajuda: this.buildAjuda(),
    };

    const box = document.createElement("div");
    box.className = "ui-panel";
    box.append(this.screens.inicio, this.screens.bot, this.screens.online, this.screens.ajuda, this.error);
    this.root.append(box);
    this.root.addEventListener("keydown", (event) => this.onKey(event));
    host.append(this.root);
    this.show("inicio");
  }

  nickname(): string | null {
    return parseNickname(this.nicknameInput.value);
  }

  awaitNickname(code: string): void {
    this.pendingCode = code;
    this.playButton.textContent = "Entrar na sala";
    this.botButton.hidden = true;
    this.show("inicio");
    this.error.textContent = `Escolha um apelido para entrar na sala ${code}`;
    this.error.classList.add("is-info");
    this.nicknameInput.focus();
  }

  showError(message: string): void {
    this.error.classList.remove("is-info");
    this.error.textContent = message;
  }

  setBusy(busy: boolean): void {
    for (const el of this.root.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) {
      el.disabled = busy;
    }
    if (busy) {
      this.error.textContent = "";
    }
  }

  dispose(): void {
    this.root.remove();
  }

  private buildInicio(): HTMLElement {
    const screen = document.createElement("div");
    screen.className = "lobby-tela";

    const title = document.createElement("h1");
    const logo = document.createElement("img");
    logo.className = "ui-logo";
    logo.src = "/ui-logo.png";
    logo.alt = "PixelBoom";
    title.append(logo);

    const nickname = document.createElement("label");
    nickname.className = "lobby-campo";
    nickname.append("Apelido", this.nicknameInput);

    screen.append(
      title,
      nickname,
      this.playButton,
      this.botButton,
      button("Como jogar", () => this.show("ajuda")),
    );
    return screen;
  }

  private buildBot(): HTMLElement {
    const screen = document.createElement("div");
    screen.className = "lobby-tela";

    const title = document.createElement("h2");
    title.textContent = "Dificuldade";

    const choices = [BotDifficulty.Normal, BotDifficulty.Hard].map((difficulty) =>
      button(DIFFICULTY_LABEL[difficulty], () => {
        const nickname = this.confirmNickname();
        if (nickname !== null) {
          this.actions.onCreateBot(nickname, difficulty);
        }
      }),
    );
    screen.append(
      title,
      ...choices,
      hint("Dificil reage mais rapido e ataca mais"),
      markBack(button("Voltar", () => this.show("inicio"))),
    );
    return screen;
  }

  private buildOnline(): HTMLElement {
    const screen = document.createElement("div");
    screen.className = "lobby-tela";

    const form = document.createElement("form");
    form.append(this.codeInput, button("Entrar", () => form.requestSubmit()));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const nickname = this.confirmNickname();
      if (nickname !== null) {
        this.actions.onJoin(this.codeInput.value, nickname);
      }
    });

    screen.append(
      button("Criar sala", () => {
        const nickname = this.confirmNickname();
        if (nickname !== null) {
          this.actions.onCreate(nickname);
        }
      }),
      hint("ou entre com um codigo"),
      form,
      markBack(button("Voltar", () => this.show("inicio"))),
    );
    return screen;
  }

  private buildAjuda(): HTMLElement {
    const screen = document.createElement("div");
    screen.className = "lobby-tela";

    const title = document.createElement("h2");
    title.textContent = "Como jogar";

    screen.append(title, ...helpBody(), markBack(button("Voltar", () => this.show("inicio"))));
    return screen;
  }

  private play(): void {
    const nickname = this.confirmNickname();
    if (nickname === null) {
      return;
    }
    if (this.pendingCode !== null) {
      this.actions.onJoin(this.pendingCode, nickname);
      return;
    }
    this.show("online");
  }

  private confirmNickname(): string | null {
    const nickname = this.nickname();
    if (nickname === null) {
      this.show("inicio");
      this.showError(NICKNAME_ERROR);
      this.nicknameInput.focus();
      return null;
    }
    this.nicknameInput.value = nickname;
    saveNickname(nickname);
    return nickname;
  }

  private show(screen: Screen): void {
    this.current = screen;
    this.error.textContent = "";
    for (const [name, el] of Object.entries(this.screens)) {
      el.hidden = name !== screen;
    }
    this.focusables()[screen === "inicio" ? 1 : 0]?.focus();
  }

  private focusables(): HTMLElement[] {
    return [...this.screens[this.current].querySelectorAll<HTMLElement>("button, input")].filter(
      (el) => !(el as HTMLButtonElement).disabled,
    );
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.current !== "inicio") {
      event.preventDefault();
      announceBack();
      this.show("inicio");
      return;
    }
    moveFocus(event, this.focusables());
  }
}
