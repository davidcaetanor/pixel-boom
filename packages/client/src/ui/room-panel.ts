/** Sala de espera sobreposta ao canvas. Nao conhece rede nem Phaser. */
import {
  BALANCE,
  BotDifficulty,
  CHARACTER_COUNT,
  displayName,
  shortName,
} from "@pixelboom/shared";
import { FOLHA_PERSONAGEM, caminhoDaFolha, chaveDoPersonagem, ELENCO } from "../render/atlas/atlas-registry.js";
import { corCss, corDoSlot } from "../render/palette.js";
import { announceBack, markBack } from "../audio/ui-sounds.js";
import { moveFocus } from "./keyboard-nav.js";
import { DIFFICULTY_LABEL } from "./labels.js";

export interface RoomPanelActions {
  onPick(character: number): void;
  onStart(): void;
  onLeave(): void;
  onKick(memberId: string): void;
  onSettings(): void;
  onBotDifficulty(botId: string): void;
  onBotCharacter(botId: string, character: number): void;
}

export interface RoomPanelView {
  readonly code: string;
  readonly localId: string;
  readonly hostId: string;
  readonly capacity: number;
  readonly bestOf: number;
  /** Sala contra bot: sem codigo para convidar. */
  readonly closed: boolean;
  /** Em ordem de entrada; a posicao define a cor do slot. */
  readonly members: readonly {
    readonly id: string;
    readonly character: number;
    readonly nickname: string | null;
    readonly bot: boolean;
    readonly difficulty: BotDifficulty | null;
  }[];
}

/** Miniatura em escala de arte; o zoom do painel amplia junto com o resto. */
const PREVIEW_SCALE = 1;
const COPIED_FEEDBACK_MS = 1500;
/** Igual ao grid-template-columns de .roster. */
const ROSTER_COLUMNS = 4;
/** Espessura do contorno na cor do slot que marca o dono do personagem. */
const OWNER_OUTLINE = 1;
const OWNER_OUTLINE_MINE = 2;

export class RoomPanel {
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private readonly start: HTMLButtonElement;
  private readonly copy: HTMLButtonElement;
  private readonly title: HTMLElement;
  private readonly gear: HTMLButtonElement;
  private readonly summary: HTMLElement;
  private readonly cards: HTMLButtonElement[] = [];
  private readonly kicks: HTMLButtonElement[] = [];
  private readonly badges: HTMLButtonElement[] = [];
  /** Dono de cada personagem no ultimo desenho; a tecla Delete remove o do cartao focado. */
  private ownerOf: (character: number) => string | null = () => null;
  private isBotOf: (character: number) => boolean = () => false;
  /** Bot escolhido pelo anfitriao; o proximo clique num personagem livre o troca. */
  private editingBot: string | null = null;
  private lastView: RoomPanelView | null = null;
  private code = "";
  private focused = false;

  constructor(actions: RoomPanelActions, host: HTMLElement = document.body) {
    this.root = document.createElement("div");
    this.root.className = "lobby room";

    this.title = document.createElement("h1");
    this.title.textContent = "Sala";
    this.gear = document.createElement("button");
    this.gear.type = "button";
    this.gear.className = "room-gear";
    this.gear.title = "Configuracoes da sala";
    this.gear.setAttribute("aria-label", this.gear.title);
    this.gear.addEventListener("click", () => actions.onSettings());
    const header = document.createElement("div");
    header.className = "room-header";
    header.append(document.createElement("span"), this.title, this.gear);
    this.summary = document.createElement("p");
    this.summary.className = "room-summary";

    this.copy = document.createElement("button");
    this.copy.type = "button";
    this.copy.addEventListener("click", () => this.copyCode());

    const grid = document.createElement("div");
    grid.className = "roster";
    for (let character = 0; character < CHARACTER_COUNT; character += 1) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "roster-card";
      card.title = ELENCO[character] ?? "";
      const preview = document.createElement("span");
      preview.className = "roster-preview";
      preview.style.backgroundImage = `url(${caminhoDaFolha(chaveDoPersonagem(character))})`;
      preview.style.width = `${FOLHA_PERSONAGEM.larguraFrame * PREVIEW_SCALE}px`;
      preview.style.height = `${FOLHA_PERSONAGEM.alturaFrame * PREVIEW_SCALE}px`;
      preview.style.backgroundSize = `${FOLHA_PERSONAGEM.larguraFrame * FOLHA_PERSONAGEM.colunas * PREVIEW_SCALE}px auto`;
      const label = document.createElement("span");
      label.className = "roster-label";
      const crown = document.createElement("img");
      crown.className = "roster-host";
      crown.src = "/ui-coroa.png";
      crown.alt = "anfitriao";
      crown.title = "anfitriao";
      crown.hidden = true;
      card.append(crown, preview, label);
      card.addEventListener("click", () => this.clickCard(character, actions));
      const kick = document.createElement("button");
      kick.type = "button";
      kick.className = "roster-kick";
      kick.tabIndex = -1;
      kick.hidden = true;
      kick.addEventListener("click", () => {
        const owner = this.ownerOf(character);
        if (owner !== null) {
          actions.onKick(owner);
        }
      });
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "roster-bot";
      badge.tabIndex = -1;
      badge.hidden = true;
      badge.addEventListener("click", () => {
        const owner = this.ownerOf(character);
        if (owner !== null) {
          actions.onBotDifficulty(owner);
        }
      });
      const cell = document.createElement("div");
      cell.className = "roster-cell";
      cell.append(card, badge, kick);
      this.cards.push(card);
      this.kicks.push(kick);
      this.badges.push(badge);
      grid.append(cell);
    }

    this.status = document.createElement("p");
    this.status.className = "room-status";

    this.start = document.createElement("button");
    this.start.type = "button";
    this.start.textContent = "Iniciar";
    this.start.className = "room-main";
    this.start.addEventListener("click", () => actions.onStart());

    const leave = document.createElement("button");
    leave.type = "button";
    leave.textContent = "Voltar ao menu";
    leave.className = "room-main";
    leave.addEventListener("click", () => actions.onLeave());
    markBack(leave);

    const box = document.createElement("div");
    box.className = "ui-panel";
    box.append(header, this.copy, grid, this.summary, this.status, this.start, leave);
    this.root.append(box);
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        announceBack();
        if (this.editingBot !== null) {
          this.editingBot = null;
          this.redraw();
        } else {
          actions.onLeave();
        }
        return;
      }
      const focusedCard = this.cards.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Delete" && focusedCard >= 0 && this.kicks[focusedCard]?.hidden === false) {
        event.preventDefault();
        this.kicks[focusedCard]?.click();
        return;
      }
      moveFocus(event, [this.gear, this.copy, ...this.cards, this.start, leave], {
        items: this.cards,
        columns: ROSTER_COLUMNS,
      });
    });
    host.append(this.root);
  }

  render(view: RoomPanelView): void {
    this.lastView = view;
    this.code = view.code;
    if (!this.copy.dataset["copied"]) {
      this.copy.textContent = `Codigo ${view.code}  |  copiar codigo`;
    }

    const owners = new Map(
      view.members.map((m, slot) => [m.character, { ...m, slot }]),
    );
    const isHost = view.localId === view.hostId;
    if (!isHost || !view.members.some((m) => m.id === this.editingBot)) {
      this.editingBot = null;
    }
    const editing = this.editingBot;
    this.ownerOf = (character) => owners.get(character)?.id ?? null;
    this.isBotOf = (character) => owners.get(character)?.bot === true;
    this.title.textContent = view.closed ? "Contra bot" : "Sala";
    this.copy.hidden = view.closed;
    this.cards.forEach((card, character) => {
      const owner = owners.get(character);
      const mine = owner?.id === view.localId;
      const hostsBot = isHost && owner?.bot === true;
      card.disabled = owner !== undefined && !mine && !hostsBot;
      card.classList.toggle("is-mine", mine);
      card.classList.toggle("is-taken", owner !== undefined && !mine);
      card.classList.toggle("is-editing", owner !== undefined && owner.id === editing);
      card.classList.toggle("is-target", editing !== null && owner === undefined);
      card.style.outline =
        owner === undefined
          ? ""
          : `${mine || owner.id === editing ? OWNER_OUTLINE_MINE : OWNER_OUTLINE}px solid ${corCss(corDoSlot(owner.slot))}`;
      const badge = this.badges[character];
      if (badge !== undefined) {
        const difficulty = owner?.difficulty ?? null;
        badge.hidden = difficulty === null;
        badge.disabled = !isHost;
        badge.classList.toggle("is-hard", difficulty === BotDifficulty.Hard);
        badge.title = difficulty === null ? "" : `Bot ${DIFFICULTY_LABEL[difficulty]}${isHost ? ", clique para trocar" : ""}`;
        badge.setAttribute("aria-label", badge.title);
      }
      const kick = this.kicks[character];
      if (kick !== undefined) {
        kick.hidden = !isHost || owner === undefined || owner.id === view.hostId;
        kick.title = owner === undefined ? "" : `Remover ${displayName(owner.nickname, owner.slot)} da sala`;
        kick.setAttribute("aria-label", kick.title);
      }
      const crown = card.querySelector<HTMLElement>(".roster-host");
      if (crown !== null) {
        crown.hidden = owner?.id !== view.hostId;
      }
      const label = card.querySelector(".roster-label");
      if (label !== null) {
        const name = owner === undefined ? (ELENCO[character] ?? "").toUpperCase() : displayName(owner.nickname, owner.slot);
        label.textContent = shortName(name);
        card.title = name;
      }
    });

    if (!this.focused) {
      this.focused = true;
      this.cards.find((card) => card.classList.contains("is-mine"))?.focus();
    }

    const count = view.members.length;
    this.gear.hidden = !isHost;
    this.summary.textContent = `Melhor de ${view.bestOf}`;
    const needed = BALANCE.net.minPlayersToStart;
    this.start.hidden = !isHost;
    this.start.disabled = count < needed;
    const players = `${count}/${view.capacity} jogadores`;
    const editingName = view.members.find((m) => m.id === editing)?.nickname;
    if (editingName !== undefined) {
      this.status.textContent = `${editingName ?? "Bot"} selecionado: clique num personagem livre`;
    } else if (view.closed) {
      this.status.textContent = "Escolha seu personagem e inicie";
    } else if (isHost) {
      this.status.textContent = count < needed ? `${players}, minimo ${needed} para iniciar` : players;
    } else {
      this.status.textContent = `${players}, aguardando o anfitriao iniciar`;
    }
  }

  private clickCard(character: number, actions: RoomPanelActions): void {
    const owner = this.ownerOf(character);
    if (this.isBotOf(character) && owner !== null) {
      this.editingBot = this.editingBot === owner ? null : owner;
      this.redraw();
      return;
    }
    if (this.editingBot !== null && owner === null) {
      actions.onBotCharacter(this.editingBot, character);
      this.editingBot = null;
      return;
    }
    actions.onPick(character);
  }

  private redraw(): void {
    if (this.lastView !== null) {
      this.render(this.lastView);
    }
  }

  dispose(): void {
    this.root.remove();
  }

  private copyCode(): void {
    void navigator.clipboard?.writeText(this.code).then(() => {
      this.copy.dataset["copied"] = "1";
      this.copy.textContent = "Codigo copiado";
      window.setTimeout(() => delete this.copy.dataset["copied"], COPIED_FEEDBACK_MS);
    });
  }
}
