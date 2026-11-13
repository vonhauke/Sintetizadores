// Baixa as fontes do Google Fonts para fonts/ e gera fonts/fonts.css.
// Uso: node scripts/vendor-fonts.mjs  (só para reproduzir; o resultado é versionado)
import { writeFileSync, mkdirSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const API = 'https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600'
  + '&family=Barlow+Condensed:wght@500;600;700&family=Michroma&display=swap';

const css = await (await fetch(API, { headers: { 'User-Agent': UA } })).text();
mkdirSync('fonts', { recursive: true });

const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
  .filter(m => m[1] === 'latin' || m[1] === 'latin-ext');

let out = '';
const done = new Map();
for (const [, subset, block] of blocks) {
  const family = /font-family:\s*'([^']+)'/.exec(block)[1].replace(/\s+/g, '');
  const weight = /font-weight:\s*(\d+)/.exec(block)[1];
  const remote = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
  const name = `${family}-${weight}-${subset}.woff2`;
  if (!done.has(name)) {
    const buf = Buffer.from(await (await fetch(remote)).arrayBuffer());
    writeFileSync(`fonts/${name}`, buf);
    done.set(name, buf.length);
  }
  out += `/* ${subset} */\n` + block.replace(remote, `./${name}`) + '\n';
}
writeFileSync('fonts/fonts.css', out);
console.log(`${blocks.length} blocos, ${done.size} arquivos`);
