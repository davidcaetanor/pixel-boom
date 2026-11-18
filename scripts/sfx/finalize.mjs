// Finaliza as variacoes escolhidas em assets/atlas/sfx, servida pelo cliente: mono, sem silencio nas pontas,
// agudo domado e volume percebido ajustado por efeito. Exporta .ogg e .mp3.
// Uso: node scripts/sfx/finalize.mjs [id ...]
// Requer ffmpeg: usa FFMPEG, o PATH ou a instalacao do winget.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { catalog } from './catalog.mjs';
import { selection } from './selection.mjs';

const SRC = 'assets/source/sfx';
const OUT = 'assets/atlas/sfx';
const FFMPEG = findFfmpeg();
// Teto de pico em dBFS. A margem cobre os picos entre amostras criados na decodificacao.
const PEAK_CEILING = -2;

// Terminais abertos antes da instalacao pelo winget nao enxergam o PATH novo,
// entao procura tambem na pasta de pacotes do winget.
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const packages = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
  if (existsSync(packages)) {
    for (const pkg of readdirSync(packages).filter((d) => d.startsWith('Gyan.FFmpeg'))) {
      for (const build of readdirSync(join(packages, pkg))) {
        const exe = join(packages, pkg, build, 'bin', 'ffmpeg.exe');
        if (existsSync(exe)) return exe;
      }
    }
  }
  console.error('ffmpeg nao encontrado. Instale com: winget install Gyan.FFmpeg');
  process.exit(1);
}

// A faixa de 2 a 5 kHz e onde o ouvido e mais sensivel; o chiptune gerado concentra ali
// a aspereza. Corte largo nessa regiao e prateleira forte acima dela.
const TONES = {
  soft: 'equalizer=f=3200:t=o:w=1.5:g=-6,highshelf=f=6000:g=-9,lowpass=f=11000',
  muffled: 'equalizer=f=2800:t=o:w=2:g=-9,highshelf=f=3500:g=-14,lowpass=f=4500',
};
// Remove grave inaudivel e deslocamento DC, que roubam margem sem somar nada.
const CLEAN = 'highpass=f=60';
const TRIM = [
  'silenceremove=start_periods=1:start_threshold=-45dB',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-50dB',
  'afade=t=in:d=0.03',
  'areverse',
].join(',');

function ffmpeg(args) {
  const res = spawnSync(FFMPEG, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || `ffmpeg falhou (${res.error?.message})`);
  return res.stderr;
}

function measureMean(file, filters) {
  const log = ffmpeg(['-i', file, '-af', `${filters},volumedetect`, '-f', 'null', '-']);
  const match = log.match(/mean_volume: (-?[\d.]+) dB/);
  if (!match) throw new Error(`sem leitura de volume em ${file}`);
  return Number(match[1]);
}

const FADE_OUT = 0.04;

function cutTo(seconds) {
  return `atrim=end=${seconds},afade=t=out:st=${(seconds - FADE_OUT).toFixed(3)}:d=${FADE_OUT}`;
}

function finalize(id) {
  const pick = selection[id];
  const entry = catalog.find((e) => e.id === id);
  const src = join(SRC, id, `${id}-${String(pick.take).padStart(2, '0')}.mp3`);
  // maxMs encurta efeitos que precisam ser secos, com saida suave para nao estalar.
  const cut = pick.maxMs === undefined ? null : cutTo(pick.maxMs / 1000);
  // Loop mantem as pontas, senao a emenda estala.
  const shaped = ['aformat=channel_layouts=mono', CLEAN, entry.loop ? null : TRIM, cut, TONES[pick.tone ?? 'soft']]
    .filter(Boolean)
    .join(',');
  // O ganho iguala o volume percebido; o pico so e contido pelo teto.
  const gain = pick.loudness - measureMean(src, shaped);
  const limit = 10 ** (PEAK_CEILING / 20);
  // level=0 desliga a normalizacao automatica do alimiter, que levaria o pico de volta a 0 dBFS.
  const chain = `${shaped},volume=${gain.toFixed(2)}dB,alimiter=limit=${limit.toFixed(4)}:attack=1:release=30:level=0`;

  const codecs = { ogg: ['-c:a', 'libvorbis', '-q:a', '5'], mp3: ['-c:a', 'libmp3lame', '-b:a', '128k'] };
  for (const [ext, codec] of Object.entries(codecs)) {
    ffmpeg(['-y', '-i', src, '-af', chain, '-ar', '44100', '-ac', '1', ...codec, join(OUT, `${id}.${ext}`)]);
  }
  console.log(`ok ${id} (take ${pick.take}, ganho ${gain.toFixed(1)} dB)`);
}

await mkdir(OUT, { recursive: true });
const ids = process.argv.slice(2);
for (const id of ids.length ? ids : Object.keys(selection)) finalize(id);
