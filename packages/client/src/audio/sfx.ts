/**
 * Os arquivos saem de scripts/sfx/finalize.mjs com o volume relativo entre eles
 * resolvido; aqui entram volume geral, limites de vozes e o barramento dos
 * outros jogadores.
 */
import Phaser from "phaser";

export const SFX = {
  bombPlace: "bomb-place",
  bombFuse: "bomb-fuse",
  bombBlink: "bomb-blink",
  explosion: "explosion",
  explosionChain: "explosion-chain",
  crateBreak: "crate-break",
  powerUpReveal: "powerup-reveal",
  pickupBomb: "pickup-bomb",
  pickupRange: "pickup-range",
  pickupSpeed: "pickup-speed",
  playerDeath: "player-death",
  playerSpawn: "player-spawn",
  countdownTick: "countdown-tick",
  countdownGo: "countdown-go",
  arenaClose: "arena-close",
  matchHurry: "match-hurry",
  victory: "victory",
  draw: "draw",
  uiHover: "ui-hover",
  uiConfirm: "ui-confirm",
  uiBack: "ui-back",
  playerJoin: "player-join",
} as const;

export type SfxKey = (typeof SFX)[keyof typeof SFX];

const MASTER_VOLUME = 0.8;
/** Copias simultaneas de um mesmo efeito; a mais antiga cede lugar. */
const MAX_COPIES = 3;
/** Efeitos de evento unico na tela, que nao fazem sentido sobrepostos. */
const SINGLE_COPY: ReadonlySet<SfxKey> = new Set([
  SFX.countdownTick,
  SFX.countdownGo,
  SFX.arenaClose,
  SFX.matchHurry,
  SFX.victory,
  SFX.draw,
  SFX.uiHover,
]);

export function loadSfx(scene: Phaser.Scene): void {
  for (const key of Object.values(SFX)) {
    scene.load.audio(key, [`sfx/${key}.ogg`, `sfx/${key}.mp3`]);
  }
}

/**
 * Limitador na saida geral: so age quando muitos efeitos se somam no mesmo
 * instante. Sons isolados ficam abaixo do limiar e passam intactos.
 */
const LIMITER = { threshold: -12, knee: 6, ratio: 12, attack: 0.003, release: 0.25 } as const;

/**
 * O DynamicsCompressor do Web Audio aplica ganho de compensacao automatico.
 * Valor medido para os parametros de LIMITER: um tom a -30 dBFS sai a -30 dBFS.
 */
const MAKEUP_CANCEL_DB = -5.4;

/** Barramento dos outros jogadores, abaixado enquanto toca um som do proprio. */
const DUCK_LEVEL = 0.5;
const DUCK_ATTACK_S = 0.01;
const DUCK_HOLD_S = 0.25;
const DUCK_RELEASE_S = 0.15;
let othersBus: GainNode | null = null;

export function configureSound(sound: Phaser.Sound.BaseSoundManager): void {
  sound.volume = MASTER_VOLUME;
  if (!(sound instanceof Phaser.Sound.WebAudioSoundManager)) {
    return;
  }
  const { context, masterVolumeNode } = sound;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.threshold;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;
  const cancel = context.createGain();
  cancel.gain.value = 10 ** (MAKEUP_CANCEL_DB / 20);
  masterVolumeNode.disconnect();
  masterVolumeNode.connect(limiter);
  limiter.connect(cancel);
  cancel.connect(context.destination);

  othersBus = context.createGain();
  othersBus.connect(sound.destination);
}

function duckOthers(): void {
  if (othersBus === null) {
    return;
  }
  const now = othersBus.context.currentTime;
  const gain = othersBus.gain;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(DUCK_LEVEL, now, DUCK_ATTACK_S);
  gain.setTargetAtTime(1, now + DUCK_HOLD_S, DUCK_RELEASE_S);
}

function routeToOthers(instance: Phaser.Sound.BaseSound): void {
  if (othersBus === null || !(instance instanceof Phaser.Sound.WebAudioSound)) {
    return;
  }
  const output = instance.pannerNode ?? instance.volumeNode;
  output.disconnect();
  output.connect(othersBus);
}

/** Copias do mesmo efeito mais proximas que isso se fundem num ataque so. */
const MIN_GAP_MS = 70;
const lastPlayed = new Map<SfxKey, number>();

export interface PlayOptions {
  /** 0 a 1, multiplicado pelo volume geral. */
  readonly volume?: number;
  /** -1 esquerda, 1 direita. */
  readonly pan?: number;
  /** Evento de outro jogador: cede lugar quando a mixagem esta cheia. */
  readonly secondary?: boolean;
}

/**
 * Vozes simultaneas a partir das quais eventos secundarios sao descartados.
 * Os do proprio jogador sempre tocam.
 */
const MAX_VOICES = 4;

export function playSfx(sound: Phaser.Sound.BaseSoundManager, key: SfxKey, options: PlayOptions = {}): void {
  if (options.secondary === true && sound.getAllPlaying().length >= MAX_VOICES) {
    return;
  }
  const now = performance.now();
  if (now - (lastPlayed.get(key) ?? -Infinity) < MIN_GAP_MS) {
    return;
  }
  lastPlayed.set(key, now);
  const limit = SINGLE_COPY.has(key) ? 1 : MAX_COPIES;
  const playing = sound.getAll(key).filter((s) => s.isPlaying);
  if (playing.length >= limit) {
    const oldest = playing[0];
    oldest?.stop();
    oldest?.destroy();
  }
  for (const finished of sound.getAll(key).filter((s) => !s.isPlaying && !s.isPaused)) {
    finished.destroy();
  }
  const instance = sound.add(key, { volume: options.volume ?? 1, pan: options.pan ?? 0 });
  if (options.secondary === true) {
    routeToOthers(instance);
  } else {
    duckOthers();
  }
  instance.play();
}

/** Liga e desliga um efeito em loop, sem reiniciar o que ja toca. */
export function setLoop(sound: Phaser.Sound.BaseSoundManager, key: SfxKey, on: boolean): void {
  const current = sound.get(key);
  if (on && (current === null || !current.isPlaying)) {
    (current ?? sound.add(key, { loop: true })).play();
  } else if (!on && current?.isPlaying === true) {
    current.stop();
  }
}
