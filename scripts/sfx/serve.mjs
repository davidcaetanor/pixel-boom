// Serve a pagina de escuta de assets/source/sfx em http://localhost:5190 para ouvir as variacoes no navegador.
// Uso: node scripts/sfx/serve.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

// Raiz em assets para a pagina alcancar tanto source quanto atlas.
const ROOT = 'assets';
const INDEX = '/source/sfx/index.html';
const PORT = 5190;
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // Redireciona para que os caminhos relativos da pagina resolvam a partir da pasta dela.
  if (path === '/') {
    res.writeHead(302, { Location: INDEX }).end();
    return;
  }
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(normalize(ROOT))) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
