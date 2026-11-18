/** Sala de espera sobreposta ao canvas. Nao conhece rede nem Phaser. */
import { BALANCE, CHARACTER_COUNT, canSetCapacity, displayName, shortName, type BotDifficulty } from "@pixelboom/shared";
import { FOLHA_PERSONAGEM, caminhoDaFolha, chaveDoPersonagem, ELENCO } from "../render/atlas/atlas-registry.js";
import { corCss, corDoSlot } from "../render/palette.js";
import { announceBack, markBack } from "../audio/ui-sounds.js";
import { moveFocus } from "./keyboard-nav.js";
import { DIFFICULTY_LABEL } from "./labels.js";

export interface RoomPanelActions {
  onPick(character: number): void;
  onStart(): void;
  onLeave(): void;
  onCapacity(value: number): void;
  onKick(memberId: string): void;
}

export interface RoomPanelView {
  readonly code: string;
  readonly localId: string;
  readonly hostId: string;
  readonly capacity: number;
  readonly botDifficulty: BotDifficulty | null;
  /** Em ordem de entrada; a posicao define a cor do slot. */
  readonly members: readonly {
    readonly id: string;
    readonly character: number;
    readonly nickname: string | null;
    readonly bot: boolean;
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
  private readonly cards: HTMLButtonElement[] = [];
  /** Botao de remover o dono de cada personagem, so para o anfitriao. */
  private readonly kicks: HTMLButtonElement[] = [];
  private readonly capacityRow: HTMLElement;
  private readonly capacityLess: HTMLButtonElement;
  private readonly capacityMore: HTMLButtonElement;
  private readonly capacityLabel: HTMLElement;
  /** Dono de cada personagem no ultimo desenho; a tecla Delete remove o do cartao focado. */
  private ownerOf: (character: number) => string | null = () => null;
  /** Capacidade exibida; adiantada no clique para cliques seguidos somarem antes da resposta. */
  private capacity = 0;
  private occupants = 0;
  /** Pedido ainda nao confirmado pelo servidor; respostas intermediarias nao o desfazem. */
  private pendingCapacity: number | null = null;
  private code = "";
  private focused = false;

  constructor(actions: RoomPanelActions, host: HTMLElement = document.body) {
    this.root = document.createElement("div");
    this.root.className = "lobby room";

    this.title = document.createElement("h1");
    this.title.textContent = "Sala";

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
      card.addEventListener("click", () => actions.onPick(character));
      const kick = document.createElement("button");
      kick.type = "button";
      kick.className = "roster-kick";
      kick.textContent = "x";
      kick.tabIndex = -1;
      kick.hidden = true;
      kick.addEventListener("click", () => {
        const owner = this.ownerOf(character);
        if (owner !== null) {
          actions.onKick(owner);
        }
      });
      const cell = document.createElement("div");
      cell.className = "roster-cell";
      cell.append(card, kick);
      this.cards.push(card);
      this.kicks.push(kick);
      grid.append(cell);
    }

    this.capacityLess = document.createElement("button");
    this.capacityLess.type = "button";
    this.capacityLess.textContent = "-";
    this.capacityLess.title = "Menos vagas";
    this.capacityLess.addEventListener("click", () => this.requestCapacity(this.capacity - 1, actions));
    this.capacityMore = document.createElement("button");
    this.capacityMore.type = "button";
    this.capacityMore.textContent = "+";
    this.capacityMore.title = "Mais vagas";
    this.capacityMore.addEventListener("click", () => this.requestCapacity(this.capacity + 1, actions));
    this.capacityLabel = document.createElement("span");
    this.capacityLabel.className = "room-capacity-label";
    this.capacityRow = document.createElement("div");
    this.capacityRow.className = "room-capacity";
    this.capacityRow.append(this.capacityLess, this.capacityLabel, this.capacityMore);

    this.status = document.createElement("p");
    this.status.className = "room-status";

    this.start = document.createElement("button");
    this.start.type = "button";
    this.start.textContent = "Iniciar";
    this.start.className = "room-start";
    this.start.addEventListener("click", () => actions.onStart());

    const leave = document.createElement("button");
    leave.type = "button";
    leave.textContent = "Voltar ao menu";
    leave.addEventListener("click", () => actions.onLeave());
    markBack(leave);

    const box = document.createElement("div");
    box.className = "ui-panel";
    box.append(this.title, this.copy, grid, this.capacityRow, this.status, this.start, leave);
    this.root.append(box);
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        announceBack();
        actions.onLeave();
        return;
      }
      const focusedCard = this.cards.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Delete" && focusedCard >= 0 && this.kicks[focusedCard]?.hidden === false) {
        event.preventDefault();
        this.kicks[focusedCard]?.click();
        return;
      }
      moveFocus(event, [this.copy, ...this.cards, this.capacityLess, this.capacityMore, this.start, leave], {
        items: this.cards,
        columns: ROSTER_COLUMNS,
      });
    });
    host.append(this.root);
  }

  render(view: RoomPanelView): void {
    this.code = view.code;
    if (!this.copy.dataset["copied"]) {
      this.copy.textContent = `Codigo ${view.code}  |  copiar codigo`;
    }

    const owners = new Map(
      view.members.map((m, slot) => [m.character, { id: m.id, slot, nickname: m.nickname, bot: m.bot }]),
    );
    const isHost = view.localId === view.hostId;
    const canKick = (id: string | undefined, bot: boolean | undefined): boolean =>
      isHost && view.botDifficulty === null && id !== undefined && id !== view.hostId && bot !== true;
    this.ownerOf = (character) => owners.get(character)?.id ?? null;
    this.title.textContent = view.botDifficulty === null ? "Sala" : `Contra bot: ${DIFFICULTY_LABEL[view.botDifficulty]}`;
    this.copy.hidden = view.botDifficulty !== null;
    this.cards.forEach((card, character) => {
      const owner = owners.get(character);
      const mine = owner?.id === view.localId;
      card.disabled = owner !== undefined && !mine;
      card.classList.toggle("is-mine", mine);
      card.classList.toggle("is-bot", owner?.bot === true);
      card.style.outline =
        owner === undefined ? "" : `${mine ? OWNER_OUTLINE_MINE : OWNER_OUTLINE}px solid ${corCss(corDoSlot(owner.slot))}`;
      const kick = this.kicks[character];
      if (kick !== undefined) {
        kick.hidden = !canKick(owner?.id, owner?.bot);
        kick.title = owner === undefined ? "" : `Remover ${displayName(owner.nickname, owner.slot)} da sala`;
      }
      const crown = card.querySelector<HTMLElement>(".roster-host");
      if (crown !== null) {
        crown.hidden = owner?.id !== view.hostId;
      }
      const label = card.querySelector(".roster-label");
      if (label !== null) {
        const name = owner === undefined ? "livre" : displayName(owner.nickname, owner.slot);
        label.textContent = shortName(name);
        card.title = owner === undefined ? (ELENCO[character] ?? "") : name;
      }
    });

    if (!this.focused) {
      this.focused = true;
      this.cards.find((card) => card.classList.contains("is-mine"))?.focus();
    }

    const count = view.members.length;
    this.occupants = count;
    this.capacityRow.hidden = !isHost || view.botDifficulty !== null;
    const pending = this.pendingCapacity;
    if (pending === null || pending === view.capacity || !canSetCapacity(pending, count)) {
      this.pendingCapacity = null;
      this.showCapacity(view.capacity);
    } else {
      this.showCapacity(pending);
    }
    const needed = BALANCE.net.minPlayersToStart;
    this.start.hidden = !isHost;
    this.start.disabled = count < needed;
    const players = `${count}/${view.capacity} jogadores`;
    if (view.botDifficulty !== null) {
      this.status.textContent = "Escolha seu personagem e inicie";
    } else if (isHost) {
      this.status.textContent = count < needed ? `${players}, minimo ${needed} para iniciar` : players;
    } else {
      this.status.textContent = `${players}, aguardando o anfitriao iniciar`;
    }
  }

  private requestCapacity(value: number, actions: RoomPanelActions): void {
    if (canSetCapacity(value, this.occupants)) {
      this.pendingCapacity = value;
      this.showCapacity(value);
      actions.onCapacity(value);
    }
  }

  private showCapacity(value: number): void {
    this.capacity = value;
    this.capacityLabel.textContent = `${value} vagas`;
    this.capacityLess.disabled = !canSetCapacity(value - 1, this.occupants);
    this.capacityMore.disabled = !canSetCapacity(value + 1, this.occupants);
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
