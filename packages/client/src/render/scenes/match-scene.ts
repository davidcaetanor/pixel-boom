/**
 * Partida offline. O update do Phaser segue a taxa do monitor;
 * a simulacao avanca em ticks fixos pelo acumulador e o desenho interpola
 * entre eles. Enter, ao fim da rodada, inicia outra com a semente seguinte.
 * `?local&bots=N` enche a arena com N bots, para ver e ouvir a partida cheia.
 */
import Phaser from "phaser";
import {
  BotDifficulty,
  CHARACTER_COUNT,
  MatchPhase,
  TICK_SECONDS,
  advance,
  createBotMemory,
  createFixedLoop,
  createMatchState,
  decideBot,
  interpolationAlpha,
  step,
  type BotMemory,
  type FixedLoopState,
  type InputCommand,
  type MatchState,
} from "@pixelboom/shared";
import { MatchSounds } from "../../audio/match-sounds.js";
import { PlayerInput } from "../../input/player-input.js";
import { comemora, roundResult } from "../hud/messages.js";
import { TimerHud } from "../hud/timer.js";
import { ArenaView } from "../views/arena-view.js";
import { BombView } from "../views/bomb-view.js";
import { ExplosionView } from "../views/explosion-view.js";
import { PlayerView } from "../views/player-view.js";
import { PowerUpView } from "../views/powerup-view.js";

/** Id do jogador na partida offline. */
const LOCAL_PLAYER_ID = "local";
/** Faixa de sementes de 31 bits, a mesma que o RNG de shared aceita. */
const SEED_RANGE = 2 ** 31;
/** Chave no registry do Phaser que guarda a semente da proxima rodada. */
const SEED_KEY = "semente-local";
const MS_PER_SECOND = 1000;

/** Bots pedidos na URL, limitados as vagas que sobram ao lado do jogador. */
function botCount(): number {
  const pedido = Number(new URLSearchParams(window.location.search).get("bots") ?? 0);
  return Number.isInteger(pedido) ? Math.max(0, Math.min(pedido, CHARACTER_COUNT - 1)) : 0;
}

export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private previous!: MatchState;
  private loop!: FixedLoopState;
  private controls!: PlayerInput;
  private arenaView!: ArenaView;
  private bombView!: BombView;
  private explosionView!: ExplosionView;
  private playerViews!: PlayerView[];
  private bots!: Map<string, BotMemory>;
  private powerUpView!: PowerUpView;
  private hud!: TimerHud;
  private sounds!: MatchSounds;

  constructor() {
    super({ key: "match" });
  }

  create(): void {
    const semente =
      (this.registry.get(SEED_KEY) as number | undefined) ?? Math.floor(Math.random() * SEED_RANGE);
    this.registry.set(SEED_KEY, (semente + 1) % SEED_RANGE);
    const botIds = Array.from({ length: botCount() }, (_, i) => `bot${i + 1}`);
    this.bots = new Map(botIds.map((id, i) => [id, createBotMemory(semente + i)]));
    this.state = createMatchState(semente, [LOCAL_PLAYER_ID, ...botIds]);
    this.previous = this.state;
    this.loop = createFixedLoop();
    this.controls = new PlayerInput();
    this.controls.setActive(true);

    this.arenaView = new ArenaView(this, this.state.grid, this.state.players);
    this.bombView = new BombView(this);
    this.powerUpView = new PowerUpView(this);
    this.explosionView = new ExplosionView(this);
    this.playerViews = this.state.players.map((p) => new PlayerView(this, p.slot));
    this.hud = new TimerHud(this);
    this.sounds = new MatchSounds(this, LOCAL_PLAYER_ID);

    const novaRodada = (): void => {
      if (this.state.phase === MatchPhase.Finished) {
        this.scene.restart();
      }
    };
    this.input.keyboard?.on("keydown-ENTER", novaRodada);
    this.input.on("pointerup", novaRodada);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.controls.dispose());
  }

  override update(_time: number, deltaMs: number): void {
    const ticks = advance(this.loop, deltaMs / MS_PER_SECOND);
    for (let i = 0; i < ticks; i += 1) {
      this.previous = this.state;
      this.state = step(this.state, this.inputs(), TICK_SECONDS);
    }

    this.sounds.update(this.state);
    this.arenaView.render(this.state.grid, this.state.phase);
    this.powerUpView.render(this.state.powerUps);
    this.bombView.render(this.state.bombs);
    this.explosionView.render(this.state.explosions);

    const alpha = interpolationAlpha(this.loop);
    this.state.players.forEach((atual, i) => {
      const anterior = this.previous.players[i] ?? atual;
      this.playerViews[i]?.render(anterior, atual, alpha, deltaMs / MS_PER_SECOND, comemora(this.state, atual.id));
    });
    const banner =
      this.state.phase === MatchPhase.Finished
        ? `${roundResult(this.state, LOCAL_PLAYER_ID)}\nEnter: nova rodada`
        : null;
    this.hud.render(this.state, "", banner);
  }

  private inputs(): Record<string, InputCommand> {
    const inputs: Record<string, InputCommand> = { [LOCAL_PLAYER_ID]: this.controls.read() };
    for (const [id, memory] of this.bots) {
      const decision = decideBot(this.state, id, BotDifficulty.Normal, memory, TICK_SECONDS);
      this.bots.set(id, decision.memory);
      inputs[id] = decision.input;
    }
    return inputs;
  }
}
