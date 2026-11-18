/** Numeros de jogo. Dimensoes e layout da arena ficam em ./arena.ts. */
export const BALANCE = {
  /** Progressao do jogador. Velocidade em celulas por segundo. */
  player: {
    speedInitial: 3.5,
    /** Impulso de velocidade: soma fixa por um tempo; pegar outro so reinicia o tempo. */
    speedBoost: 1,
    speedBoostSeconds: 12,

    bombsInitial: 1,
    bombsStep: 1,
    bombsMax: 6,

    rangeInitial: 2,
    rangeStep: 1,
    rangeMax: 6,

    /** Lado da caixa de colisao do jogador, em celulas. */
    hitboxSize: 0.8,
  },

  /** Colisao contra a grade. */
  physics: {
    /** Tolerancia para que encostar na borda de uma celula nao conte como ocupa-la. */
    collisionEpsilon: 1e-9,
  },

  /** Tempos em segundos. */
  time: {
    bombFuse: 2.5,
    flameOnScreen: 0.5,
    countdown: 3,
    suddenDeathStart: 90,
    suddenDeathRingInterval: 15,
    /** Aneis internos que nunca fecham: a briga final acontece neles. */
    suddenDeathOpenRings: 2,
    matchMax: 180,
    /** Pausa entre o fim de uma rodada online e o inicio da proxima. */
    roundRestartDelay: 5,
    /** Pausa entre o fim de uma serie e o inicio da proxima. */
    seriesRestartDelay: 10,
  },

  /** Geracao do mapa. Fracoes de 0 a 1. */
  mapGeneration: {
    crateDensityMin: 0.55,
    crateDensityMax: 0.65,
    powerUpChance: 0.3,
    /** Peso de cada tipo no sorteio do item, na ordem de POWER_UP_KINDS. */
    powerUpWeights: [40, 35, 25],
  },

  /** Cadencia da simulacao de passo fixo. */
  simulation: {
    tickHz: 30,
    deltaClampMs: 100,
  },

  /** Sala de espera. A capacidade conta humanos e bots. */
  room: {
    capacityMin: 2,
    capacityMax: 8,
  },

  /** Rede. */
  net: {
    patchesPerSecond: 30,
    interpolationBufferMs: 66,
    maxClientsPerRoom: 8,
    /** Jogadores conectados para a sala comecar uma rodada. */
    minPlayersToStart: 2,
    /** Mensagens aceitas por cliente por segundo. */
    maxMessagesPerSecond: 60,
    /** Entradas em espera por jogador no servidor, cerca de 200 ms a 30 Hz. */
    maxQueuedInputs: 6,
  },

  /** Bot. Tempos em segundos; chances de 0 a 1. */
  ai: {
    /** Folga entre a chegada prevista numa celula e a chama, nos dois sentidos. */
    flameMargin: 0.2,
    /** Um alvo novo so substitui o atual se valer este tanto a mais. */
    targetHysteresis: 1.5,
    /** Tempo minimo com o mesmo alvo enquanto ele continuar seguro. */
    targetHoldTime: 0.6,
    /** Pesos da escolha de alvo; travelCost e descontado por segundo de caminho. */
    powerUpValue: 8,
    crateValue: 3,
    travelCost: 1,
    /** Abaixo desta distancia, chegar mais perto nao vale mais nada. */
    enemyComfortCells: 2,
    difficulty: {
      normal: {
        /** Bomba inimiga mais nova que isto ainda nao foi notada. */
        reactionTime: 0.9,
        /** Chance por segundo de soltar bomba quando ela prende o adversario. */
        attackChance: 0.05,
        /** Chance por segundo de soltar bomba com o adversario so na linha da explosao. */
        pokeChance: 0.02,
        /** Desconto por celula de distancia ate o adversario mais proximo. */
        enemyPull: 0.15,
        /** Com a arena fechando, chances e atracao multiplicadas por isto; chance limitada a 1 por segundo. */
        pressure: 1.5,
        /** Intervalo entre decisoes de alvo e de bomba; fugir de perigo continua imediato. */
        thinkSeconds: 0.35,
      },
      hard: {
        reactionTime: 0.12,
        attackChance: 0.9,
        pokeChance: 0.8,
        enemyPull: 0.5,
        pressure: 3,
        thinkSeconds: 0,
      },
    },
  },

  /** Duelo de desempate da serie, so entre os lideres empatados. */
  duel: {
    /** Aneis ja fechados no inicio: um a mais aberto que o fechamento final. */
    closedRings: 3,
    /** Segundos de duelo ate a parede comecar a avancar em espiral. */
    spiralStart: 20,
    /** Uma celula vira parede a cada intervalo: ninguem e esmagado junto, salvo na mesma celula. */
    spiralCellSeconds: 0.5,
  },

  /** Formato da partida. */
  match: {
    /** Formatos de serie que o anfitriao pode escolher, em rodadas. */
    bestOfOptions: [1, 3, 5, 7],
    bestOfDefault: 5,
  },
} as const;

/** Duracao de um tick da simulacao, em segundos. */
export const TICK_SECONDS = 1 / BALANCE.simulation.tickHz;

export type Balance = typeof BALANCE;
