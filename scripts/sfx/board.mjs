// Monta assets/source/sfx/index.html para ouvir e comparar as variacoes geradas.
// Uso: node scripts/sfx/board.mjs
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { catalog, descriptions } from './catalog.mjs';
import { selection } from './selection.mjs';

const OUT_DIR = 'assets/source/sfx';

const sections = [];
for (const entry of catalog) {
  let files;
  try {
    files = (await readdir(join(OUT_DIR, entry.id))).filter((f) => f.endsWith('.mp3')).sort();
  } catch {
    continue;
  }
  const loop = entry.loop ? ' loop' : '';
  const take = selection[entry.id]?.take;
  const player = (label, src, cls = '') =>
    `<div class="v ${cls}"><span>${label}</span><audio controls preload="metadata" src="${src}"${loop}></audio></div>`;
  const final = take ? player('FINAL', `../../atlas/sfx/${entry.id}.ogg`, 'final') : '';
  const players = files
    .map((f) => {
      const n = Number(f.slice(-6, -4));
      return player(String(n).padStart(2, '0'), `${entry.id}/${f}`, n === take ? 'picked' : '');
    })
    .join('');
  sections.push(`<section><h2>${entry.id}</h2><p>${descriptions[entry.id] ?? entry.prompt}</p>${final}<div>${players}</div></section>`);
}

const html = `<!doctype html><meta charset="utf-8"><title>PixelBoom SFX</title>
<style>
body{font:14px system-ui;background:#1d1b26;color:#eee;max-width:900px;margin:24px auto;padding:0 16px}
section{background:#2a2736;border-radius:8px;padding:12px 16px;margin:12px 0}
h2{margin:0 0 4px;font-size:16px;color:#ffd166}p{margin:0 0 8px;color:#aaa;font-size:12px}
.v{display:inline-flex;align-items:center;gap:6px;margin:4px 12px 4px 0}audio{height:32px}
.final span{color:#06d6a0;font-weight:700}.picked span{color:#ffd166;font-weight:700}.v:not(.final):not(.picked){opacity:.55}
</style><h1>PixelBoom, efeitos sonoros</h1>${sections.join('')}`;

await writeFile(join(OUT_DIR, 'index.html'), html);
console.log(`${join(OUT_DIR, 'index.html')} com ${sections.length} efeitos`);
