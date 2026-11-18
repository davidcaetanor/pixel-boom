// Variacao escolhida de cada efeito e ajustes de finalizacao.
// loudness: volume percebido alvo (RMS em dB). Define a hierarquia da mixagem:
//   impacto 16, eventos 20, acoes frequentes 22, interface 26 a 28, ambiente 30.
// tone: 'soft' (padrao) ou 'muffled' (abafado, corta bem mais agudo).
// maxMs: duracao maxima, para efeitos que precisam ser secos.
export const selection = {
  'bomb-place': { take: 10, loudness: -22 },
  'bomb-fuse': { take: 19, loudness: -33, tone: 'muffled' },
  'bomb-blink': { take: 2, loudness: -22 },
  'explosion': { take: 1, loudness: -16 },
  'explosion-chain': { take: 2, loudness: -16 },
  'crate-break': { take: 3, loudness: -21 },
  'powerup-reveal': { take: 3, loudness: -24 },
  'pickup-bomb': { take: 2, loudness: -20 },
  'pickup-range': { take: 2, loudness: -20 },
  'pickup-speed': { take: 4, loudness: -20 },
  'player-death': { take: 2, loudness: -18 },
  'player-spawn': { take: 3, loudness: -22 },
  'countdown-tick': { take: 1, loudness: -20, maxMs: 150 },
  'countdown-go': { take: 4, loudness: -19 },
  'arena-close': { take: 3, loudness: -20 },
  'match-hurry': { take: 1, loudness: -20 },
  'victory': { take: 2, loudness: -16 },
  'draw': { take: 1, loudness: -17 },
  'ui-hover': { take: 2, loudness: -28, maxMs: 80 },
  'ui-confirm': { take: 1, loudness: -26, maxMs: 250 },
  'ui-back': { take: 1, loudness: -26 },
  'player-join': { take: 3, loudness: -22 },
};
