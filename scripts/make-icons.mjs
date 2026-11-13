// Gera assets/icon.svg e os PNGs de ícone. Uso: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

// Desenho: fundo escuro, onda dente-de-serra laranja e quatro pads embaixo (legível em 16 px).
const content = `
  <path d="M110 270 L190 150 L190 270 L270 150 L270 270 L350 150 L350 270 L402 205" fill="none" stroke="#e8743b" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="#e4e6e8"><rect x="110" y="330" width="62" height="62" rx="12"/><rect x="194" y="330" width="62" height="62" rx="12"/>
  <rect x="278" y="330" width="62" height="62" rx="12"/><rect x="362" y="330" width="40" height="62" rx="12" opacity=".55"/></g>`;
const svg = ({ rounded, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34383d"/><stop offset="1" stop-color="#16181a"/></linearGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="96"' : ''} fill="url(#g)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${content}</g>
</svg>`;

mkdirSync('assets', { recursive: true });
mkdirSync('icons', { recursive: true });
mkdirSync('build', { recursive: true });
writeFileSync('assets/icon.svg', svg({ rounded: true, scale: 1 }));

const png = (s, size, out) => sharp(Buffer.from(s), { density: 384 }).resize(size, size).png().toFile(out);
const regular = svg({ rounded: true, scale: 1 });
const maskable = svg({ rounded: false, scale: 0.7 }); // área segura de 80% (margem de 20%)
await png(regular, 192, 'icons/icon-192.png');
await png(regular, 512, 'icons/icon-512.png');
await png(maskable, 512, 'icons/icon-maskable-512.png');
await png(regular, 1024, 'build/icon.png');
console.log('ícones gerados');
