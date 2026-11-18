/**
 * Efeitos da partida deduzidos da diferenca entre dois MatchState seguidos,
 * sem repetir regra de jogo. Eventos de outros jogadores soam mais baixos,
 * posicionados no estereo pela coluna e atenuados pela distancia ao jogador.
 */
import type Phaser from "phaser";
import {
  ARENA_COLS,
  BALANCE,
  CELL_CENTER,
  CellKind,
  MatchPhase,
  cellIndex,
  playerCell,
  ringClosesAt,
  ringScheduleOf,
  ringsDue,
  spiralClosesAt,
  type Bomb,
  type MatchState,
  type Player,
} from "@pixelboom/shared";
import { SFX, playSfx, setLoop, type PlayOptions, type SfxKey } from "./sfx.js";

/** Mesma janela em que a BombView comeca a piscar o clarao. */
const BLINK_BEFORE_MS = 600;
const FUSE_MS = BALANCE.time.bombFuse * 1000;
/** Explosoes novas no mesmo quadro a partir das quais vira reacao em cadeia. */
const CHAIN_FROM = 2;
/** Abertura do estereo; 1 poria a borda da arena inteira num lado so. */
const PAN_WIDTH = 0.6;
const OWN: PlayOptions = { volume: 0.7 };
/** Por efeito, antes da atenuacao por distancia. */
const OTHERS_VOLUME: Partial<Record<SfxKey, number>> = {
  [SFX.bombPlace]: 0.18,
  [SFX.explosion]: 0.36,
  [SFX.explosionChain]: 0.36,
  [SFX.playerDeath]: 0.4,
  [SFX.crateBreak]: 0.2,
  [SFX.powerUpReveal]: 0.24,
};
/** Ate esta distancia, em celulas, o evento alheio soa sem atenuacao. */
const NEAR_CELLS = 3;
/** A partir desta distancia a atenuacao para no piso. */
const FAR_CELLS = 12;
/** Fracao do volume que sobra para eventos longe. */
const FAR_FLOOR = 0.3;
/** Instante, no arena-close.ogg finalizado, em que o climax vira baque; depende do arquivo. */
const ARENA_CLOSE_LEAD_S = 1.5;

interface Spot {
  readonly x: number;
  readonly y: number;
}

function brokenCrates(before: MatchState, state: MatchState): number[] {
  const cells: number[] = [];
  state.grid.cells.forEach((cell, i) => {
    if (before.grid.cells[i] === CellKind.Crate && cell !== CellKind.Crate) {
      cells.push(i);
    }
  });
  return cells;
}

function isMoving(phase: MatchPhase): boolean {
  return phase === MatchPhase.Playing || phase === MatchPhase.SuddenDeath;
}

function centerOf(cells: readonly number[]): Spot {
  const sum = cells.reduce((acc, cell) => ({ x: acc.x + (cell % ARENA_COLS), y: acc.y + Math.floor(cell / ARENA_COLS) }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / cells.length, y: sum.y / cells.length };
}

function panAt(column: number): number {
  return ((column + CELL_CENTER) / ARENA_COLS * 2 - 1) * PAN_WIDTH;
}

function falloff(distance: number): number {
  const t = Math.min(Math.max((distance - NEAR_CELLS) / (FAR_CELLS - NEAR_CELLS), 0), 1);
  return 1 - t * (1 - FAR_FLOOR);
}

export class MatchSounds {
  private previous: MatchState | null = null;
  /** Vivo ou nao, por jogador, como foi desenhado da ultima vez. */
  private readonly shownAlive = new Map<string, boolean>();
  private readonly bombBirth = new Map<number, number>();
  /** Bombas do proprio jogador, pelo id, com a celula de onde vao explodir. */
  private readonly ownBombs = new Map<number, number>();
  /** Celulas de bombas proprias que sumiram neste tick; a explosao nasce nelas. */
  private detonatedOwnCells = new Set<number>();
  private readonly blinked = new Set<number>();
  /** Se alguma explosao deste tick saiu de bomba propria; caixa e item herdam. */
  private ownBlast = false;
  /** Referencia da distancia; null com o jogador morto. */
  private listener: Spot | null = null;
  private warnedClose = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly localId: string,
  ) {
    scene.events.once("shutdown", () => setLoop(scene.sound, SFX.bombFuse, false));
  }

  /**
   * `shown` sao os jogadores como foram desenhados. Online os adversarios sao
   * desenhados com atraso de interpolacao; a morte deles soa quando aparece.
   */
  update(state: MatchState, shown: readonly Player[] = state.players): void {
    const self = state.players.find((p) => p.id === this.localId);
    this.listener = self?.alive === true ? { x: self.x, y: self.y } : null;
    this.deaths(shown);

    const before = this.previous;
    this.previous = state;
    if (before === null) {
      if (state.phase === MatchPhase.Countdown) {
        this.play(SFX.playerSpawn);
      }
      return;
    }
    if (state.tick !== before.tick) {
      this.closingWarning(state);
      this.phase(before, state);
      this.bombs(before, state);
      this.explosions(before, state);
      this.arena(before, state);
      this.pickups(before, state);
    }
    this.blink(state);
    // Com oito jogadores sempre ha bomba acesa; o loop de todas vira zumbido.
    setLoop(this.scene.sound, SFX.bombFuse, this.ownBombs.size > 0 && isMoving(state.phase));
  }

  private play(key: SfxKey, options?: PlayOptions): void {
    playSfx(this.scene.sound, key, options);
  }

  private playAt(key: SfxKey, spot: Spot, own: boolean): void {
    if (own) {
      this.play(key, OWN);
      return;
    }
    // Morto, o jogador assiste a arena inteira: sem atenuacao por distancia.
    const distance =
      this.listener === null ? 0 : Math.hypot(spot.x + CELL_CENTER - this.listener.x, spot.y + CELL_CENTER - this.listener.y);
    this.play(key, { volume: (OTHERS_VOLUME[key] ?? 1) * falloff(distance), pan: panAt(spot.x), secondary: true });
  }

  private phase(before: MatchState, state: MatchState): void {
    if (state.phase === MatchPhase.Countdown) {
      if (Math.ceil(-state.elapsed) !== Math.ceil(-before.elapsed)) {
        this.play(SFX.countdownTick);
      }
      return;
    }
    if (state.phase === before.phase) {
      return;
    }
    if (state.phase === MatchPhase.Playing && before.phase === MatchPhase.Countdown) {
      this.play(SFX.countdownGo);
    } else if (state.phase === MatchPhase.SuddenDeath) {
      this.play(SFX.matchHurry);
    } else if (state.phase === MatchPhase.Finished) {
      if (state.winnerId === null) {
        this.play(SFX.draw);
      } else if (state.winnerId === this.localId) {
        this.play(SFX.victory);
      }
    }
  }

  /**
   * Avisa antes de cada anel fechar, pelo mesmo cronograma que a simulacao usa.
   * No duelo a espiral fecha uma celula a cada meio segundo; um aviso por
   * celula viraria ruido, entao so o inicio da espiral e avisado.
   */
  private closingWarning(state: MatchState): void {
    if (!isMoving(state.phase)) {
      return;
    }
    const schedule = ringScheduleOf(state);
    const nextRing = ringClosesAt(ringsDue(state.elapsed, schedule), schedule);
    const spiralStart = spiralClosesAt(0);
    const next = state.duel && state.elapsed < spiralStart ? spiralStart : nextRing;
    if (Number.isFinite(next) && next !== this.warnedClose && state.elapsed >= next - ARENA_CLOSE_LEAD_S) {
      this.warnedClose = next;
      this.play(SFX.arenaClose);
    }
  }

  /** Online o dono nao chega; a bomba nova na celula do proprio jogador e dele. */
  private isOwn(bomb: Bomb, state: MatchState): boolean {
    if (bomb.ownerId !== "") {
      return bomb.ownerId === this.localId;
    }
    const self = state.players.find((p) => p.id === this.localId);
    if (self === undefined) {
      return false;
    }
    const cell = playerCell(self);
    return cell.x === bomb.x && cell.y === bomb.y;
  }

  private bombs(before: MatchState, state: MatchState): void {
    const known = new Set(before.bombs.map((b) => b.id));
    const now = this.scene.time.now;
    for (const bomb of state.bombs) {
      if (!known.has(bomb.id)) {
        const own = this.isOwn(bomb, state);
        this.bombBirth.set(bomb.id, now);
        if (own) {
          this.ownBombs.set(bomb.id, cellIndex(bomb.x, bomb.y));
        }
        this.playAt(SFX.bombPlace, bomb, own);
      }
    }
    const alive = new Set(state.bombs.map((b) => b.id));
    this.detonatedOwnCells = new Set();
    for (const id of this.bombBirth.keys()) {
      if (!alive.has(id)) {
        const cell = this.ownBombs.get(id);
        if (cell !== undefined) {
          this.detonatedOwnCells.add(cell);
        }
        this.bombBirth.delete(id);
        this.ownBombs.delete(id);
        this.blinked.delete(id);
      }
    }
  }

  /** So bombas proprias: com oito jogadores, o aviso de todas vira ruido. */
  private blink(state: MatchState): void {
    const now = this.scene.time.now;
    for (const bomb of state.bombs) {
      const birth = this.bombBirth.get(bomb.id);
      if (!this.ownBombs.has(bomb.id) || birth === undefined || this.blinked.has(bomb.id)) {
        continue;
      }
      if (now - birth > FUSE_MS - BLINK_BEFORE_MS) {
        this.blinked.add(bomb.id);
        this.play(SFX.bombBlink, OWN);
      }
    }
  }

  private explosions(before: MatchState, state: MatchState): void {
    const known = new Set(before.explosions.map((e) => e.id));
    const fresh = state.explosions.filter((e) => !known.has(e.id));
    this.ownBlast = fresh.some(
      (e) => e.ownerId === this.localId || e.cells.some((cell) => this.detonatedOwnCells.has(cell)),
    );
    if (fresh.length === 0) {
      return;
    }
    const spot = centerOf(fresh.flatMap((e) => e.cells));
    this.playAt(fresh.length >= CHAIN_FROM ? SFX.explosionChain : SFX.explosion, spot, this.ownBlast);
  }

  private arena(before: MatchState, state: MatchState): void {
    const broken = brokenCrates(before, state);
    if (broken.length > 0) {
      this.playAt(SFX.crateBreak, centerOf(broken), this.ownBlast);
    }
    const known = new Set(before.powerUps.map((p) => cellIndex(p.x, p.y)));
    const revealed = state.powerUps.filter((p) => !known.has(cellIndex(p.x, p.y)));
    if (revealed.length > 0) {
      this.playAt(SFX.powerUpReveal, centerOf(revealed.map((p) => cellIndex(p.x, p.y))), this.ownBlast);
    }
  }

  private deaths(shown: readonly Player[]): void {
    for (const player of shown) {
      if (this.shownAlive.get(player.id) === true && !player.alive) {
        this.playAt(SFX.playerDeath, playerCell(player), player.id === this.localId);
      }
      this.shownAlive.set(player.id, player.alive);
    }
  }

  private pickups(before: MatchState, state: MatchState): void {
    const old = before.players.find((p) => p.id === this.localId);
    const player = state.players.find((p) => p.id === this.localId);
    if (old === undefined || player === undefined || !player.alive) {
      return;
    }
    if (player.maxBombs > old.maxBombs) {
      this.play(SFX.pickupBomb, OWN);
    }
    if (player.range > old.range) {
      this.play(SFX.pickupRange, OWN);
    }
    if (player.speedBoost > old.speedBoost) {
      this.play(SFX.pickupSpeed, OWN);
    }
  }
}
