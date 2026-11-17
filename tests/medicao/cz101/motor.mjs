// Carrega o motor de som direto de cz101/index.html (o mesmo texto que vira AudioWorklet na página)
// e oferece utilitários de medição. Uso: node tests/medicao/cz101/medir.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export function fonteDsp(pagina = 'cz101/index.html') {
  const html = readFileSync(join(raiz, pagina), 'utf8');
  const m = /<script type="text\/plain" id="dsp">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('bloco <script id="dsp"> não encontrado em ' + pagina);
  return m[1];
}
/** Devolve a classe Motor. O shim cobre o que o texto espera do AudioWorkletGlobalScope. */
export function carregaMotor(pagina) {
  const registrados = {};
  class AudioWorkletProcessor { constructor() { this.port = { onmessage: null, postMessage() {} }; } }
  const f = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentFrame', fonteDsp(pagina) + '\nreturn Motor;');
  const Motor = f(AudioWorkletProcessor, (nome, classe) => { registrados[nome] = classe; }, 48000, 0);
  Motor.registrados = registrados;
  return Motor;
}

export const FS = 48000;
/** Volume com o qual o ganho total (vol² · G_SAIDA) vale 1: a escala fica a de 16 bits do núcleo dividida por 32768. */
export const VOL_UNIT = null;   // calculado em novo(): 1 / sqrt(G_SAIDA)
/** Cria um motor com parâmetros globais `g` e o timbre `tomA` (e `tomB` para o TONE MIX). */
export function novo(Motor, g = {}, tomA = null, tomB = null, fs = FS) {
  const m = new Motor(fs);
  m.msg({ t: 'ps', p: Object.assign({ vol: 1 / Math.sqrt(Motor.dados.G_SAIDA) }, g) });
  if (tomA) m.msg({ t: 'tom', tom: tomA }); if (tomB) m.msg({ t: 'tom2', tom: tomB });
  return m;
}
/** Renderiza `seg` segundos e devolve o sinal. */
export function render(m, seg) {
  const n = Math.round(seg * m.fs), L = new Float32Array(n), B = 64;
  for (let i = 0; i < n; i += B) { const k = Math.min(B, n - i); m.process(L.subarray(i, i + k), L.subarray(i, i + k), k); }
  return L;
}
export const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
export const pico = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
export const dB = v => 20 * Math.log10(Math.max(v, 1e-12));
/** Espectro de magnitude (FFT radix-2, janela de Hann), n = potência de 2. Devolve amplitudes por bin. */
export function espectro(x, a, n) {
  const re = new Float64Array(n), im = new Float64Array(n); let w = 0;
  for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); re[i] = x[a + i] * h; w += h; }
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const c = Math.cos(ang * k), s = Math.sin(ang * k), p = i + k, q = p + len / 2;
      const tr = re[q] * c - im[q] * s, ti = re[q] * s + im[q] * c;
      re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
    }
  }
  const mag = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) mag[i] = 2 * Math.hypot(re[i], im[i]) / w;
  return mag;
}
/** frequência do maior pico do espectro entre lo e hi (interpolação parabólica em log) */
export function picoHz(x, a, n, lo, hi, fs = FS) {
  const mag = espectro(x, a, n), df = fs / n; let bi = Math.max(1, Math.round(lo / df));
  for (let i = bi; i <= Math.min(mag.length - 2, Math.round(hi / df)); i++) if (mag[i] > mag[bi]) bi = i;
  const l = Math.log(mag[bi - 1] + 1e-30), c = Math.log(mag[bi] + 1e-30), r = Math.log(mag[bi + 1] + 1e-30);
  return (bi + 0.5 * (l - r) / (l - 2 * c + r)) * df;
}
