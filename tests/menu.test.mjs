import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const list = JSON.parse(readFileSync('instruments.json', 'utf8'));
const html = readFileSync('index.html', 'utf8');

test('instruments.json: 7 entradas válidas', () => {
  assert.equal(list.length, 7);
  assert.equal(new Set(list.map(i => i.id)).size, 7);
  for (const i of list) {
    assert.ok(i.name && i.description, i.id);
    assert.equal(i.path, `${i.id}/index.html`);
    assert.ok(existsSync(i.path), i.path);
  }
});

test('menu: um link target=_blank por instrumento', () => {
  for (const i of list) {
    assert.match(html, new RegExp(`<a [^>]*href="${i.path}"[^>]*target="_blank"|<a [^>]*target="_blank"[^>]*href="${i.path}"`), i.id);
  }
});

test('menu: nenhum link termina em /', () => {
  assert.doesNotMatch(html, /href="[^"]*\/"/);
});

test('menu: título e fontes locais', () => {
  assert.match(html, /<title>Sintetizadores<\/title>/);
  assert.match(html, /href="fonts\/fonts\.css"/);
});
