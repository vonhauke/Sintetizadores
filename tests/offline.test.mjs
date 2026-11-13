import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ids = ['101', '106', '303', '606', '808', '909', 'bumbo-808', 'caixa-808', 'bateria'];

for (const id of ids) {
  test(`${id}: sem URLs externas e sem caminhos absolutos`, () => {
    const html = readFileSync(`${id}/index.html`, 'utf8');
    assert.doesNotMatch(html, /(src|href)="https?:|url\(\s*['"]?https?:|@import[^;]*https?:/);
    assert.doesNotMatch(html, /(src|href)="\/(?!\/)/);
    assert.match(html, /href="\.\.\/fonts\/fonts\.css"/);
  });
}

test('fonts.css aponta só para arquivos existentes', () => {
  const css = readFileSync('fonts/fonts.css', 'utf8');
  const urls = [...css.matchAll(/url\(\s*['"]?\.\/([^'")]+)['"]?\s*\)/g)].map(m => m[1]);
  assert.ok(urls.length > 0);
  for (const u of urls) assert.ok(existsSync(`fonts/${u}`), u);
  assert.doesNotMatch(css, /https?:/);
});
