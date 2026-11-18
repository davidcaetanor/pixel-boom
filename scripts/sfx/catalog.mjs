// Catalogo de efeitos do PixelBoom. Toda entrada segue a mesma familia sonora:
// chiptune 16 bits com corpo, cartoon, seco, ataque imediato, sem voz.
const STYLE = 'retro 16-bit game sound effect, cartoon, dry, no reverb, instant attack, no voice';

const sfx = (id, duration, description, extra = {}) => ({
  id,
  duration,
  prompt: `${description}. ${STYLE}`,
  ...extra,
});

export const catalog = [
  // Bomba
  sfx('bomb-place', 0.5, 'round cartoon bomb placed on the floor, solid wooden knock with a short clack, punchy mid-range, clear and present, not boomy, no hiss'),
  sfx('bomb-fuse', 1.5, 'close-up crackling of a small wood fire, crisp dry pops and snaps, mid-range clicks, steady texture, no rumble, no hiss, no wind', { loop: true }),
  sfx('bomb-blink', 0.5, 'two quick high-pitched chiptune warning beeps, urgent but playful'),
  sfx('explosion', 0.9, 'punchy cartoon bomb explosion, crunchy bitcrushed noise burst with deep thump and fast decay, fun not scary'),
  sfx('explosion-chain', 1.2, 'rapid chain of three cartoon bomb explosions in quick succession, bitcrushed crunch, fun not scary'),

  // Arena
  sfx('crate-break', 0.6, 'wooden crate smashed by explosion, cartoon splinter crack with small debris rattle'),
  sfx('powerup-reveal', 0.5, 'magical item popping out of debris, short shimmering chime with a soft pop'),

  // Itens
  sfx('pickup-bomb', 0.5, 'bright chiptune pickup, quick rising arpeggio ending in a round bouncy plop, extra bomb collected'),
  sfx('pickup-range', 0.5, 'bright chiptune pickup, rising arpeggio with an expanding whoosh sweep, power reach increased'),
  sfx('pickup-speed', 0.5, 'bright chiptune pickup, very fast zippy upward pitch run with a swoosh, speed boost'),

  // Jogador
  sfx('player-death', 0.9, 'cartoon character knocked out, short descending pitch slide ending in a comic pop and dizzy twinkle, lighthearted not sad'),
  sfx('player-spawn', 0.6, 'character appearing on the arena, quick sparkly teleport blip rising in pitch'),

  // Partida
  sfx('countdown-tick', 0.3, 'single short chiptune countdown beep, mid pitch, clean square wave'),
  sfx('countdown-go', 0.7, 'chiptune start signal, higher pitched bright beep with a short triumphant flourish'),
  sfx('arena-close', 2.0, 'heavy stone walls about to slide shut, low rumbling build-up with a rising two-note chiptune pulse that speeds up, ending in one solid stone thud, tense but playful, not shrill'),
  sfx('match-hurry', 1.2, 'chiptune alarm, fast alternating two-tone warning, time almost over, energetic'),
  sfx('victory', 2.5, 'short chiptune victory jingle, upbeat 16-bit fanfare, four bright notes ending on a major chord'),
  sfx('draw', 2.0, 'short chiptune jingle for a tie game, playful shrug melody, two notes up two notes down, neutral'),

  // Interface
  sfx('ui-hover', 0.2, 'tiny soft chiptune tick, menu cursor move, very subtle'),
  sfx('ui-confirm', 0.3, 'short chiptune menu confirm blip, two ascending notes, pleasant'),
  sfx('ui-back', 0.3, 'short chiptune menu cancel blip, two descending notes, soft'),
  sfx('player-join', 0.6, 'cheerful chiptune doorbell, new player joined the lobby, two friendly notes'),
];

// Descricao em portugues exibida na pagina de escuta.
export const descriptions = {
  'bomb-place': 'Bomba colocada no chao: batida firme de madeira com um estalo curto, medio presente, sem estrondo nem chiado.',
  'bomb-fuse': 'Pavio queimando: estalos secos de fogo pequeno, abafados no tratamento para nao chiar. Toca em loop.',
  'bomb-blink': 'Dois bipes agudos e rapidos de alerta, urgentes mas divertidos, para a bomba piscando.',
  'explosion': 'Explosao cartoon com soco: estouro de ruido granulado, grave curto e queda rapida. Divertida, nao assustadora.',
  'explosion-chain': 'Tres explosoes cartoon em sequencia rapida, para reacao em cadeia.',
  'crate-break': 'Caixa de madeira destruida pela explosao: estalo de lascas e chocalho de destrocos.',
  'powerup-reveal': 'Item magico surgindo dos destrocos: brilho curto com um pop suave.',
  'pickup-bomb': 'Coleta de bomba extra: arpejo subindo que termina num plop redondo.',
  'pickup-range': 'Coleta de alcance: arpejo subindo com um sopro que se expande.',
  'pickup-speed': 'Coleta de velocidade: corrida de notas muito rapida para cima com um zunido.',
  'player-death': 'Personagem nocauteado: escorregada de tom para baixo, pop comico e brilho de tontura. Leve, nao triste.',
  'player-spawn': 'Personagem surgindo na arena: blip de teletransporte com brilho, subindo de tom.',
  'countdown-tick': 'Bipe unico e curto da contagem regressiva, tom medio, onda quadrada limpa.',
  'countdown-go': 'Sinal de largada: bipe mais agudo com um floreio curto de triunfo.',
  'arena-close': 'Aviso de anel fechando: ronco de pedra subindo com pulso de duas notas acelerando, terminando num baque de pedra no instante do fechamento.',
  'match-hurry': 'Alarme de tempo acabando: dois tons alternando rapido, energico.',
  'victory': 'Vinheta curta de vitoria: fanfarra de quatro notas terminando em acorde maior.',
  'draw': 'Vinheta curta de empate: melodia de "dar de ombros", duas notas sobem e duas descem.',
  'ui-hover': 'Tique minusculo e suave ao mover o cursor no menu.',
  'ui-confirm': 'Blip de confirmar no menu, duas notas subindo, agradavel.',
  'ui-back': 'Blip de voltar no menu, duas notas descendo, suave.',
  'player-join': 'Campainha alegre de jogador entrando no lobby, duas notas amigaveis.',
};
