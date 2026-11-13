// Monta dist-web/ (o app web/PWA). Exporta webFiles() e buildWeb().
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const walk = (root, dir) => readdirSync(join(root, dir)).flatMap(n => {
  const rel = `${dir}/${n}`;
  return statSync(join(root, rel)).isDirectory() ? walk(root, rel) : [rel];
});

/** Caminhos relativos (com /) de tudo que o app web precisa. */
export function webFiles(root = '.') {
  const list = JSON.parse(readFileSync(join(root, 'instruments.json'), 'utf8'));
  return [
    'index.html', 'menu.css', 'manifest.webmanifest', 'sw.js', 'instruments.json',
    ...list.map(i => i.path),
    ...walk(root, 'fonts'),
    ...walk(root, 'icons'),
  ].sort();
}

export function buildWeb({ root = '.', out = 'dist-web' } = {}) {
  const files = webFiles(root);
  rmSync(out, { recursive: true, force: true });
  for (const f of files) { mkdirSync(dirname(join(out, f)), { recursive: true }); cpSync(join(root, f), join(out, f)); }

  const precache = ['./', ...files.filter(f => f !== 'sw.js').map(f => `./${f}`)];
  const hash = createHash('sha256');
  for (const f of files.filter(f => f !== 'sw.js')) hash.update(f).update(readFileSync(join(root, f)));
  const version = hash.digest('hex').slice(0, 12);

  const sw = readFileSync(join(root, 'sw.js'), 'utf8')
    .replace(/const PRECACHE = \[\];/, () => `const PRECACHE = ${JSON.stringify(precache, null, 2)};`)
    .replace(/const VERSION = '[^']*';/, () => `const VERSION = '${version}';`);
  writeFileSync(join(out, 'sw.js'), sw);
  return { version, files, precache };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { version, files } = buildWeb();
  console.log(`dist-web/: ${files.length} arquivos, versão ${version}`);
}
