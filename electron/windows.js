// Funções puras usadas por main.js (separadas para poderem ser testadas sem o Electron).
import path from 'node:path';

const toPosixRoot = root => {
  let p = String(root).split(String.fromCharCode(92)).join("/");
  if (/^[A-Za-z]:/.test(p)) p = '/' + p;
  return path.posix.normalize(p).replace(/\/+$/, '');
};

const pathOf = url => decodeURIComponent(new URL(url).pathname);

/** Verdadeiro só para file:// dentro de appRoot. */
export function isInternalUrl(url, appRoot) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:') return false;
    const p = path.posix.normalize(decodeURIComponent(u.pathname));
    const root = toPosixRoot(appRoot);
    return p === root || p.startsWith(root + '/');
  } catch {
    return false;
  }
}

/** Chave estável do instrumento (sem hash nem query), para reaproveitar a janela. */
export function windowKey(url) {
  return path.posix.normalize(pathOf(url));
}
