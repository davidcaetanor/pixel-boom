/**
 * Sala autoritativa: roda a simulacao de shared e decide o estado; o cliente
 * envia entradas numeradas, consumidas uma por tick. A sala tem um codigo
 * curto como id e uma espera em que cada jogador escolhe personagem. O
 * anfitriao define a capacidade, remove membros e inicia a serie; ao fim
 * dela todos voltam para a espera. Bots ocupam vagas como humanos, mas nao
 * sao conexoes: a lotacao e controlada aqui, nao pelo maxClients. A sala
 * contra bot nasce fechada, com duas vagas e o bot da dificuldade pedida.
 */
import { Room, ServerError, type Client } from "@colyseus/core";
import {
  BALANCE,
  InputQueue,
  MatchPhase,
  TICK_SECONDS,
  advance,
  applySeriesScore,
  BotDifficulty,
  botNickname,
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
  otherDifficulty,
  isBestOf,
  isNicknameTaken,
  newSeries,
  isRoomFull,
  KICKED_CODE,
  recordRound,
  step,
  type BotMemory,
  type FixedLoopState,
  type InputCommand,
  type MatchState,
  type Series,
} from "@pixelboom/shared";
import { writeLobby, writeMatch, writeWaiting, type LobbyMember } from "../schema/mappers.js";
import { MatchSchema } from "../schema/match-schema.js";
import {
  parseBotCharacter,
  parseBotCount,
  parseBotDifficulty,
  parseValue,
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
const BOT_ID_PREFIX = "bot-";
const SOLO_CAPACITY = 2;
const ROOM_FULL_CODE = 4002;


export class MatchRoom extends Room<{ state: MatchSchema }> {
  override maxClients: number = BALANCE.room.capacityMax;
  override maxMessagesPerSecond = BALANCE.net.maxMessagesPerSecond;
  override state = new MatchSchema();

  private match: MatchState | null = null;
  private bestOf: number = BALANCE.match.bestOfDefault;
  private series: Series = newSeries();
  private readonly queues = new Map<string, InputQueue>();
  private readonly members = new Map<string, LobbyMember>();
  private hostId = "";
  private nextOrder = 0;
  private finishedFor = 0;
  private roundRecorded = false;
  private capacity: number = BALANCE.room.capacityMax;
  /** Sala contra bot: so o criador entra. */
  private closed = false;
  /** Bot da sala contra bot, criado logo depois do anfitriao para ele ficar com o primeiro slot. */
  private soloBot: BotDifficulty | null = null;
  private nextBot = 1;
  private readonly botMemories = new Map<string, BotMemory>();
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
    bestOf: (client: Client, raw: unknown): void => {
      const value = parseValue(raw);
      if (this.isHostInLobby(client) && isBestOf(value)) {
        this.bestOf = value;
        this.series = newSeries(value);
        this.state.bestOf = value;
      }
    },
    bots: (client: Client, raw: unknown): void => {
      const target = parseBotCount(raw);
      if (!this.isHostInLobby(client) || target === null) {
        return;
      }
      const bots = [...this.members].filter(([, m]) => m.bot).sort((a, b) => b[1].order - a[1].order);
      const humans = this.members.size - bots.length;
      if (target > this.capacity - humans) {
        return;
      }
      for (const [id] of bots.slice(0, Math.max(0, bots.length - target))) {
        this.members.delete(id);
      }
      for (let n = bots.length; n < target; n += 1) {
        this.addBot(BotDifficulty.Normal);
      }
      this.syncLock();
      this.publishLobby();
    },
    botDifficulty: (client: Client, raw: unknown): void => {
      const id = parseKick(raw);
      const bot = id === null ? undefined : this.members.get(id);
      if (this.isHostInLobby(client) && id !== null && bot?.difficulty !== undefined) {
        this.members.set(id, { ...bot, difficulty: otherDifficulty(bot.difficulty) });
        this.publishLobby();
      }
    },
    botCharacter: (client: Client, raw: unknown): void => {
      const pick = parseBotCharacter(raw);
      const bot = pick === null ? undefined : this.members.get(pick.id);
      if (!this.isHostInLobby(client) || pick === null || bot?.difficulty === undefined) {
        return;
      }
      if (canPickCharacter(this.charactersExcept(pick.id), pick.index)) {
        const nickname = botNickname(pick.index, this.humanNicknames());
        this.members.set(pick.id, { ...bot, character: pick.index, nickname });
        this.publishLobby();
      }
    },
    capacity: (client: Client, raw: unknown): void => {
      const value = parseValue(raw);
      if (!this.isHostInLobby(client)) {
        return;
      }
      if (canSetCapacity(value, this.members.size)) {
        this.capacity = value;
        this.state.capacity = value;
        this.syncLock();
      }
    },
    kick: (client: Client, raw: unknown): void => {
      const target = parseKick(raw);
      if (this.match !== null || target === null) {
        return;
      }
      if (!canKick(client.sessionId, this.hostId, target, this.members.keys())) {
        return;
      }
      if (this.members.get(target)?.bot === true) {
        this.members.delete(target);
        this.syncLock();
        this.publishLobby();
      } else {
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
    const solo = parseBotDifficulty(options);
    if (solo !== null) {
      this.closed = true;
      this.capacity = SOLO_CAPACITY;
      this.soloBot = solo;
    }
    this.state.closed = this.closed;
    this.state.bestOf = this.bestOf;
    this.state.capacity = this.capacity;
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
    if (isNicknameTaken(this.humanNicknames(), nickname)) {
      throw new ServerError(NICKNAME_TAKEN_CODE, "apelido em uso nesta sala");
    }
    if (this.isFullForHumans()) {
      throw new ServerError(ROOM_FULL_CODE, "sala cheia");
    }
    return true;
  }

  override onJoin(client: Client, options: unknown): void {
    const nickname = parseJoinNickname(options) ?? "";
    // Entradas simultaneas passam juntas pelo onAuth.
    if (isNicknameTaken(this.humanNicknames(), nickname)) {
      throw new ServerError(NICKNAME_TAKEN_CODE, "apelido em uso nesta sala");
    }
    if (this.isFullForHumans()) {
      throw new ServerError(ROOM_FULL_CODE, "sala cheia");
    }
    this.queues.set(client.sessionId, new InputQueue());
    const character = firstFreeCharacter(this.charactersExcept(client.sessionId)) ?? 0;
    this.members.set(client.sessionId, { character, order: this.nextOrder, nickname, bot: false });
    this.nextOrder += 1;
    if (this.hostId === "") {
      this.hostId = client.sessionId;
    }
    if (this.soloBot !== null) {
      this.addBot(this.soloBot);
      this.soloBot = null;
    }
    this.renameBots();
    this.syncLock();
    this.publishLobby();
  }

  private addBot(difficulty: BotDifficulty): void {
    const id = `${BOT_ID_PREFIX}${this.nextBot}`;
    this.nextBot += 1;
    const character = firstFreeCharacter(this.charactersExcept(id)) ?? 0;
    const nickname = botNickname(character, this.humanNicknames());
    this.members.set(id, { character, order: this.nextOrder, nickname, bot: true, difficulty });
    this.nextOrder += 1;
  }

  private renameBots(): void {
    const humans = this.humanNicknames();
    for (const [id, member] of this.members) {
      if (member.bot) {
        this.members.set(id, { ...member, nickname: botNickname(member.character, humans) });
      }
    }
  }

  private isHostInLobby(client: Client): boolean {
    return client.sessionId === this.hostId && this.match === null;
  }

  /** Na sala contra bot, o criador e o unico humano. */
  private isFullForHumans(): boolean {
    return this.closed ? this.hostId !== "" : isRoomFull(this.members.size, this.capacity);
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

  private syncLock(): void {
    if (this.isFullForHumans()) {
      void this.lock();
    } else {
      void this.unlock();
    }
  }

  private humanNicknames(): string[] {
    return [...this.members.values()].filter((m) => !m.bot).map((m) => m.nickname);
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
      .slice(0, this.capacity);
    const duel = this.series.duel.length > 0;
    const ids = duel ? everyone.filter((id) => this.series.duel.includes(id)) : everyone;
    const slots = ids.map((id) => everyone.indexOf(id));
    this.match = applySeriesScore(createMatchState(seed, ids, { duel, slots }), this.series);
    this.botMemories.clear();
    ids.forEach((id, i) => {
      if (this.members.get(id)?.bot === true) {
        this.botMemories.set(id, createBotMemory(seed + i));
      }
    });
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
    for (const [id, memory] of this.botMemories) {
      const difficulty = this.members.get(id)?.difficulty ?? BotDifficulty.Normal;
      const decision = decideBot(this.match, id, difficulty, memory, TICK_SECONDS);
      this.botMemories.set(id, decision.memory);
      frame[id] = decision.input;
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
    this.series = newSeries(this.bestOf);
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
