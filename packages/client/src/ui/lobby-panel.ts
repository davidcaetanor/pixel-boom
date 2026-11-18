/**
 * Menu de entrada sobreposto ao canvas: tela inicial com apelido, jogo online
 * (criar ou entrar por codigo) e como jogar. Navega por teclado: setas movem o
 * foco, Enter confirma e Esc volta para a tela inicial. Nao conhece rede nem
 * Phaser.
 */
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, ROOM_CODE_LENGTH, parseNickname } from "@pixelboom/shared";

export interface LobbyActions {
  onCreate(nickname: string | null): void;
  onJoin(code: string, nickname: string | null): void;
}

type Screen = "inicio" | "online" | "ajuda";

/** Conveniencia do proprio jogador; sem armazenamento disponivel o campo so comeca vazio. */
const NICKNAME_STORAGE_KEY = "pixelboom.apelido";
const NICKNAME_ERROR = `Apelido: ${NICKNAME_MIN_LENGTH} a ${NICKNAME_MAX_LENGTH} letras ou numeros`;

const CONTROLES: readonly (readonly [string, string])[] = [
  ["Setas ou WASD", "andar"],
  ["Espaco", "soltar bomba"],
];

const MELHORIAS: readonly (readonly [string, string])[] = [
  ["/powerup-bomba.png", "mais uma bomba"],
  ["/powerup-alcance.png", "explosao mais longa"],
  ["/powerup-velocidade.png", "mais velocidade"],
];

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
    // Sem armazenamento o apelido vale so para esta visita.
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

    this.codeInput = document.createElement("input");
    this.codeInput.placeholder = "Codigo";
    this.codeInput.maxLength = ROOM_CODE_LENGTH;
    this.codeInput.autocomplete = "off";
    this.codeInput.spellcheck = false;

    this.error = document.createElement("p");
    this.error.className = "lobby-error";

    this.screens = {
      inicio: this.buildInicio(),
      online: this.buildOnline(),
      ajuda: this.buildAjuda(),
    };

    const box = document.createElement("div");
    box.className = "ui-panel";
    box.append(this.screens.inicio, this.screens.online, this.screens.ajuda, this.error);
    this.root.append(box);
    this.root.addEventListener("keydown", (event) => this.onKey(event));
    host.append(this.root);
    this.show("inicio");
  }

  /** Apelido valido digitado, ou null se o campo estiver vazio ou invalido. */
  nickname(): string | null {
    return parseNickname(this.nicknameInput.value);
  }

  showError(message: string): void {
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
      button("Jogar online", () => this.confirmNickname() && this.show("online")),
      button("Como jogar", () => this.show("ajuda")),
      hint("setas escolhem  |  Enter confirma"),
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
      this.actions.onJoin(this.codeInput.value, this.nickname());
    });

    screen.append(
      button("Criar sala", () => this.actions.onCreate(this.nickname())),
      hint("ou entre com um codigo"),
      form,
      hint("Esc volta"),
    );
    return screen;
  }

  private buildAjuda(): HTMLElement {
    const screen = document.createElement("div");
    screen.className = "lobby-tela";

    const title = document.createElement("h2");
    title.textContent = "Como jogar";

    const goal = document.createElement("p");
    goal.textContent = "Exploda caixas, pegue melhorias e seja o ultimo de pe.";

    const list = document.createElement("dl");
    list.className = "lobby-ajuda";
    for (const [keys, action] of CONTROLES) {
      const term = document.createElement("dt");
      term.textContent = keys;
      const desc = document.createElement("dd");
      desc.textContent = action;
      list.append(term, desc);
    }
    for (const [src, effect] of MELHORIAS) {
      const term = document.createElement("dt");
      const icon = document.createElement("img");
      icon.src = src;
      icon.alt = "";
      term.append(icon);
      const desc = document.createElement("dd");
      desc.textContent = effect;
      list.append(term, desc);
    }

    screen.append(title, goal, list, button("Voltar", () => this.show("inicio")));
    return screen;
  }

  /** Campo vazio entra sem apelido; texto fora do formato bloqueia com aviso. */
  private confirmNickname(): boolean {
    const raw = this.nicknameInput.value.trim();
    const parsed = parseNickname(raw);
    if (raw !== "" && parsed === null) {
      this.showError(NICKNAME_ERROR);
      this.nicknameInput.focus();
      return false;
    }
    this.nicknameInput.value = parsed ?? "";
    saveNickname(this.nicknameInput.value);
    return true;
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
      this.show("inicio");
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) {
      return;
    }
    const items = this.focusables();
    if (items.length === 0) {
      return;
    }
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = index === -1 ? 0 : (index + step + items.length) % items.length;
    items[next]?.focus();
  }
}
