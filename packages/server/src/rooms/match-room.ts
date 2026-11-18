/**
 * Sala autoritativa: roda a simulacao de shared e decide o estado; o cliente
 * envia entradas numeradas, consumidas uma por tick. A sala tem um codigo
 * curto como id e uma espera em que cada jogador escolhe personagem. O
 * anfitriao define a capacidade, remove membros e inicia a serie; ao fim
 * dela todos voltam para a espera. Na sala
 * contra bot, o bot entra logo depois do criador e a sala fecha para outros.
 */
import { Room, ServerError, type Client } from "@colyseus/core";
import {
  BALANCE,
  InputQueue,
  MatchPhase,
  NEW_SERIES,
  TICK_SECONDS,
  advance,
  applySeriesScore,
  canKick,
  canPickCharacter,
  canSetCapacity,
  createBotMemory,
  createFixedLoop,
  createMatchState,
  decideBot,
  NICKNAME_TAKEN_CODE,
  firstFreeCharacter,
  keepPresentDuelists,
  isNicknameTaken,
  isRoomFull,
  KICKED_CODE,
  recordRound,
  step,
  type BotDifficulty,
  type BotMemory,
  type FixedLoopState,
  type InputCommand,
  type MatchState,
  type Series,
} from "@pixelboom/shared";
import { writeLobby, writeMatch, writeWaiting, type LobbyMember } from "../schema/mappers.js";
import { MatchSchema } from "../schema/match-schema.js";
import {
  parseBotDifficulty,
  parseCapacity,
  parseCharacterPick,
  parseInput,
  parseJoinNickname,
  parseKick,
} from "../validation/input-validator.js";
import { generateRoomCode } from "./room-code.js";

const MS_PER_SECOND = 1000;
/** Faixa de sementes de 31 bits, a mesma que o RNG de shared aceita. */
const SEED_RANGE = 2 ** 31;
const BAD_REQUEST = 400;
const BOT_ID = "bot";
const BOT_NICKNAMES = ["BOT", "CPU", "ROBO"];


export class MatchRoom extends Room<{ state: MatchSchema }> {
  override maxClients: number = BALANCE.room.capacityMax;
  override maxMessagesPerSecond = BALANCE.net.maxMessagesPerSecond;
  override state = new MatchSchema();

  private match: MatchState | null = null;
  private series: Series = NEW_SERIES;
  private readonly queues = new Map<string, InputQueue>();
  private readonly members = new Map<string, LobbyMember>();
  private hostId = "";
  private nextOrder = 0;
  private finishedFor = 0;
  private roundRecorded = false;
  private botDifficulty: BotDifficulty | null = null;
  private botMemory: BotMemory = createBotMemory(0);
  /** O timer do sistema nao e preciso o bastante; o acumulador garante a taxa de ticks. */
  private readonly loop: FixedLoopState = createFixedLoop();

  override messages = {
    input: (client: Client, raw: unknown): void => {
      const entry = parseInput(raw);
      if (entry !== null) {
        this.queues.get(client.sessionId)?.push(entry);
      }
    },
    character: (client: Client, raw: unknown): void => {
      const index = parseCharacterPick(raw);
      const member = this.members.get(client.sessionId);
      if (this.match !== null || member === undefined || index === null) {
        return;
      }
      if (canPickCharacter(this.charactersExcept(client.sessionId), index)) {
        this.members.set(client.sessionId, { ...member, character: index });
        this.publishLobby();
      }
    },
    capacity: (client: Client, raw: unknown): void => {
      const value = parseCapacity(raw);
      if (client.sessionId !== this.hostId || this.match !== null || this.botDifficulty !== null) {
        return;
      }
      if (canSetCapacity(value, this.members.size)) {
        this.maxClients = value;
        this.state.capacity = value;
        this.syncLock();
      }
    },
    kick: (client: Client, raw: unknown): void => {
      const target = parseKick(raw);
      if (this.match !== null || target === null) {
        return;
      }
      if (canKick(client.sessionId, this.hostId, target, this.members.keys())) {
        this.clients.getById(target)?.leave(KICKED_CODE);
      }
    },
    start: (client: Client): void => {
      const canStart =
        client.sessionId === this.hostId &&
        this.match === null &&
        this.members.size >= BALANCE.net.minPlayersToStart;
      if (canStart) {
        this.startRound();
      }
    },
  };

  override onCreate(options: unknown): void {
    this.roomId = generateRoomCode();
    this.botDifficulty = parseBotDifficulty(options);
    this.state.botDifficulty = this.botDifficulty ?? "";
    this.state.capacity = this.maxClients;
    this.setPatchRate(MS_PER_SECOND / BALANCE.net.patchesPerSecond);
    this.setSimulationInterval((deltaMs) => {
      const ticks = advance(this.loop, deltaMs / MS_PER_SECOND);
      for (let i = 0; i < ticks; i += 1) {
        this.tick();
      }
    }, MS_PER_SECOND / BALANCE.simulation.tickHz);
    writeWaiting(this.state);
  }

  override onAuth(_client: Client, options: unknown): true {
    const nickname = parseJoinNickname(options);
    if (nickname === null) {
      throw new ServerError(BAD_REQUEST, "apelido obrigatorio");
    }
    if (isNicknameTaken(this.nicknames(), nickname)) {
      throw new ServerError(NICKNAME_TAKEN_CODE, "apelido em uso nesta sala");
    }
    return true;
  }

  override onJoin(client: Client, options: unknown): void {
    const nickname = parseJoinNickname(options) ?? "";
    // Entradas simultaneas passam juntas pelo onAuth.
    if (isNicknameTaken(this.nicknames(), nickname)) {
      throw new ServerError(NICKNAME_TAKEN_CODE, "apelido em uso nesta sala");
    }
    this.queues.set(client.sessionId, new InputQueue());
    const character = firstFreeCharacter(this.charactersExcept(client.sessionId)) ?? 0;
    this.members.set(client.sessionId, { character, order: this.nextOrder, nickname, bot: false });
    this.nextOrder += 1;
    if (this.hostId === "") {
      this.hostId = client.sessionId;
    }
    if (this.botDifficulty !== null && !this.members.has(BOT_ID)) {
      this.addBot();
    }
    this.syncLock();
    this.publishLobby();
  }

  private addBot(): void {
    const taken = this.nicknames();
    const nickname = BOT_NICKNAMES.find((name) => !isNicknameTaken(taken, name)) ?? BOT_NICKNAMES[0] ?? "";
    const character = firstFreeCharacter(this.charactersExcept(BOT_ID)) ?? 0;
    this.members.set(BOT_ID, { character, order: this.nextOrder, nickname, bot: true });
    this.nextOrder += 1;
  }

  override onLeave(client: Client): void {
    this.queues.delete(client.sessionId);
    this.members.delete(client.sessionId);
    if (this.hostId === client.sessionId) {
      this.hostId = this.oldestMember() ?? "";
    }
    this.syncLock();
    this.publishLobby();
    if (this.match !== null) {
      this.match = {
        ...this.match,
        players: this.match.players.map((p) =>
          p.id === client.sessionId ? { ...p, alive: false } : p,
        ),
      };
    }
  }

  /** A sala contra bot fica sempre fechada; as outras, so enquanto cheias. */
  private syncLock(): void {
    if (this.botDifficulty !== null || isRoomFull(this.members.size, this.maxClients)) {
      void this.lock();
    } else {
      void this.unlock();
    }
  }

  private nicknames(): string[] {
    return [...this.members.values()].map((m) => m.nickname);
  }

  private charactersExcept(id: string): number[] {
    return [...this.members].filter(([memberId]) => memberId !== id).map(([, m]) => m.character);
  }

  private oldestMember(): string | null {
    const ordered = [...this.members].filter(([, m]) => !m.bot).sort((a, b) => a[1].order - b[1].order);
    return ordered[0]?.[0] ?? null;
  }

  private startRound(): void {
    const seed = Math.floor(Math.random() * SEED_RANGE);
    const everyone = [...this.members]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id]) => id)
      .slice(0, this.maxClients);
    const duel = this.series.duel.length > 0;
    const ids = duel ? everyone.filter((id) => this.series.duel.includes(id)) : everyone;
    const slots = ids.map((id) => everyone.indexOf(id));
    this.match = applySeriesScore(createMatchState(seed, ids, { duel, slots }), this.series);
    this.botMemory = createBotMemory(seed);
    this.finishedFor = 0;
    this.roundRecorded = false;
    this.publishMatch();
  }

  private tick(): void {
    if (this.match === null) {
      return;
    }

    const frame: Record<string, InputCommand> = {};
    for (const player of this.match.players) {
      const queue = this.queues.get(player.id);
      if (queue !== undefined) {
        frame[player.id] = queue.next();
      }
    }
    if (this.botDifficulty !== null && this.members.has(BOT_ID)) {
      const decision = decideBot(this.match, BOT_ID, this.botDifficulty, this.botMemory, TICK_SECONDS);
      this.botMemory = decision.memory;
      frame[BOT_ID] = decision.input;
    }
    this.match = step(this.match, frame, TICK_SECONDS);

    if (this.match.phase === MatchPhase.Finished) {
      this.finishRound();
    }
    this.publishMatch();
  }

  private finishRound(): void {
    if (this.match === null) {
      return;
    }
    if (!this.roundRecorded) {
      this.series = recordRound(
        this.series,
        this.match.winnerId,
        this.match.players.map((p) => p.id),
      );
      this.match = applySeriesScore(this.match, this.series);
      this.roundRecorded = true;
    }
    this.finishedFor += TICK_SECONDS;
    const delay = this.series.finished
      ? BALANCE.time.seriesRestartDelay
      : BALANCE.time.roundRestartDelay;
    if (this.finishedFor >= delay) {
      this.nextRound();
    }
  }

  private nextRound(): void {
    this.series = keepPresentDuelists(this.series, [...this.members.keys()]);
    const enoughPlayers = this.members.size >= BALANCE.net.minPlayersToStart;
    if (!this.series.finished && enoughPlayers) {
      this.startRound();
      return;
    }
    this.match = null;
    this.series = NEW_SERIES;
    writeWaiting(this.state);
  }

  private publishLobby(): void {
    writeLobby(this.state, this.members, this.hostId);
  }

  private publishMatch(): void {
    if (this.match !== null) {
      writeMatch(this.state, this.match, this.series, (id) => this.queues.get(id)?.acknowledged ?? 0);
    }
  }
}
