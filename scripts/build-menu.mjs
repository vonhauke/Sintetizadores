// Gera os cartões do menu (index.html) a partir de instruments.json.
// Estático de propósito: fetch() não funciona em file://.
import { readFileSync, writeFileSync } from 'node:fs';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const list = JSON.parse(readFileSync('instruments.json', 'utf8'));
const cards = list.map(i =>
  `    <li><a class="card" href="${i.path}" target="_blank"><h2>${esc(i.name)}</h2><p>${esc(i.description)}</p></a></li>`
).join('\n');
const html = readFileSync('index.html', 'utf8').replace(
  /<!-- cards -->[\s\S]*<!-- \/cards -->/,
  `<!-- cards -->\n${cards}\n<!-- /cards -->`
);
writeFileSync('index.html', html);
