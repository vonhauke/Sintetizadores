// Servidor estático mínimo para testes locais.
// Uso: node scripts/serve.mjs [pasta] [porta] [prefixo]   ex.: node scripts/serve.mjs dist-web 8099 /Sintetizadores/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? 8099);
const prefix = process.argv[4] ?? '/';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(prefix)) { res.writeHead(404).end('fora do prefixo'); return; }
  p = p.slice(prefix.length);
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const file = resolve(join(root, p));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { const data = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data); }
  catch { res.writeHead(404).end('não encontrado'); }
}).listen(port, () => console.log(`http://localhost:${port}${prefix}`));
