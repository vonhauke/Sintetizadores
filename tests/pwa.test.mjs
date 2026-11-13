import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, cpSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildWeb, webFiles } from '../scripts/build-web.mjs';

let result;
before(() => { result = buildWeb({ root: '.', out: 'dist-web' }); });

const precacheOf = dir => JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(readFileSync(join(dir, 'sw.js'), 'utf8'))[1]);
const versionOf = dir => /const VERSION = '([^']+)'/.exec(readFileSync(join(dir, 'sw.js'), 'utf8'))[1];

test('todo caminho do PRECACHE existe em dist-web', () => {
  const list = precacheOf('dist-web');
  assert.ok(list.length > 30);
  for (const p of list) {
    assert.doesNotMatch(p, /^\//, p);
    assert.ok(existsSync(join('dist-web', p === './' ? 'index.html' : p)), p);
  }
  assert.ok(list.includes('./'));
  assert.ok(list.includes('./303/index.html'));
});

test('webFiles cobre menu, instrumentos, fontes e ícones', () => {
  const f = webFiles('.');
  for (const need of ['index.html', 'menu.css', 'manifest.webmanifest', 'sw.js', 'instruments.json', 'bateria/index.html', 'icons/icon-192.png'])
    assert.ok(f.includes(need), need);
  assert.ok(f.some(x => x.startsWith('fonts/') && x.endsWith('.woff2')));
});

test('VERSION muda quando um arquivo muda', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sint-'));
  for (const f of webFiles('.')) { mkdirSync(dirname(join(tmp, f)), { recursive: true }); cpSync(f, join(tmp, f)); }
  const a = buildWeb({ root: tmp, out: join(tmp, 'o1') }).version;
  const a2 = buildWeb({ root: tmp, out: join(tmp, 'o1b') }).version;
  appendFileSync(join(tmp, '303/index.html'), ' ');
  const b = buildWeb({ root: tmp, out: join(tmp, 'o2') }).version;
  assert.equal(a, a2);
  assert.notEqual(a, b);
  assert.equal(versionOf(join(tmp, 'o2')), b);
});

test('manifest e ícones', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.equal(m.name, 'Sintetizadores');
  assert.equal(m.icons.length, 3);
  const dims = m.icons.map(i => i.sizes).sort();
  assert.deepEqual(dims, ['192x192', '512x512', '512x512']);
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const i of m.icons) {
    assert.doesNotMatch(i.src, /^\//);
    const png = readFileSync(i.src);
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, i.sizes, i.src);
  }
  const big = readFileSync('build/icon.png');
  assert.equal(big.readUInt32BE(16), 1024);
});

test('index.html registra ./sw.js com caminho relativo e liga o manifest', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
});
