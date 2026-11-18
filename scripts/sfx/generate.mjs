// Gera efeitos sonoros pelo ElevenLabs a partir de scripts/sfx/catalog.mjs.
// Uso:
//   node --env-file=.env scripts/sfx/generate.mjs check
//   node --env-file=.env scripts/sfx/generate.mjs [id ...] [--variations=4] [--from=1] [--force]
// --from numera a partir de outro take, para gerar novas rodadas sem apagar as anteriores.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { catalog } from './catalog.mjs';

const API = 'https://api.elevenlabs.io/v1';
const OUT_DIR = 'assets/source/sfx';
// Limite inferior da API; o silencio excedente sai no pos-processamento.
const MIN_DURATION = 0.5;
const key = process.env.ELEVENLABS_API_KEY;

if (!key) {
  console.error('ELEVENLABS_API_KEY ausente. Rode com node --env-file=.env');
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? true];
  }),
);
const ids = args.filter((a) => !a.startsWith('--'));

async function requestSound(body) {
  const res = await fetch(`${API}/sound-generation?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// A chave nao precisa de user_read: o teste gera um efeito minimo e descarta.
async function check() {
  const audio = await requestSound({ text: 'short click', duration_seconds: MIN_DURATION });
  console.log(`Conexao ok, ${audio.byteLength} bytes recebidos`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function generate(entry, index) {
  const file = join(OUT_DIR, entry.id, `${entry.id}-${String(index + 1).padStart(2, '0')}.mp3`);
  if (!flags.force && (await exists(file))) {
    console.log(`pula ${file}`);
    return;
  }
  const audio = await requestSound({
    text: entry.prompt,
    duration_seconds: Math.max(MIN_DURATION, entry.duration),
    prompt_influence: entry.influence ?? 0.6,
    loop: entry.loop ?? false,
  });
  await mkdir(join(OUT_DIR, entry.id), { recursive: true });
  await writeFile(file, audio);
  console.log(`ok ${file}`);
}

async function main() {
  if (ids[0] === 'check') return check();
  const selected = ids.length ? catalog.filter((e) => ids.includes(e.id)) : catalog;
  const variations = Number(flags.variations ?? 4);
  for (const entry of selected) {
    const count = entry.variations ?? variations;
    const from = Number(flags.from ?? 1) - 1;
    await Promise.all(Array.from({ length: count }, (_, i) => generate(entry, from + i)));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
