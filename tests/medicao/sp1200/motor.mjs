// Carrega o motor de som direto de sp1200/index.html (o mesmo texto que vira AudioWorklet na página)
// e oferece utilitários de medição. Uso: node tests/medicao/sp1200/medir.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export function fonteDsp(pagina = 'sp1200/index.html') {
  const html = readFileSync(join(raiz, pagina), 'utf8');
  const m = /<script type="text\/plain" id="dsp">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('bloco <script id="dsp"> não encontrado em ' + pagina);
  return m[1];
}
export function carregaMotor(pagina) {
  class AudioWorkletProcessor { constructor() { this.port = { onmessage: null, postMessage() {} }; } }
  const f = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentFrame', fonteDsp(pagina) + '\nreturn Motor;');
  return f(AudioWorkletProcessor, () => {}, 48000, 0);
}
export const FS = 48000;
/** Motor novo com volume geral 1 e a lista de mensagens que ele devolve em m.msgs. */
export function novo(Motor, fs = FS, g = {}) {
  const m = new Motor(fs); m.msgs = []; m.saida = x => m.msgs.push(x);
  m.msg({ t: 'g', p: Object.assign({ bpm: 120, mixVol: 1, metVol: 0.5, ac: 6, metro: 0, aloc: 0, solo: -1, cru: 0 }, g) });
  return m;
}
/** Põe um som (Int16Array de 12 bits) na posição i. */
export const poe = (m, i, d, p = {}) => m.msg({ t: 'som', i, d, p: Object.assign({ val: 16, modo: 0, canal: 7, nivel: 31 }, p) });
/** Senoide já em 12 bits a 26,04 kHz (sem passar pelo conversor de entrada). */
export function seno12(D, f, seg, amp = 0.9) { const n = Math.floor(seg * D.FA), d = new Int16Array(n); for (let i = 0; i < n; i++) d[i] = Math.round(amp * 2047 * Math.sin(2 * Math.PI * f * i / D.FA)); return d; }
export function render(m, seg) {
  const n = Math.round(seg * m.fs), L = new Float32Array(n);
  for (let i = 0; i < n; i += 128) { const k = Math.min(128, n - i); m.process(L.subarray(i, i + k), L.subarray(i, i + k), k); }
  return L;
}
export const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
export const pico = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
export const dB = v => 20 * Math.log10(Math.max(v, 1e-12));
/** Amplitude de uma senoide de frequência f no trecho [a, b) (projeção com janela de Hann). */
export function amp(x, f, fs, a = 0, b = x.length) {
  let re = 0, im = 0, w = 0; const n = b - a;
  for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), ph = 2 * Math.PI * f * i / fs; re += h * x[a + i] * Math.cos(ph); im += h * x[a + i] * Math.sin(ph); w += h; }
  return 2 * Math.hypot(re, im) / w;
}
/** Espectro de magnitude (FFT radix-2, janela de Hann), n = potência de 2. */
export function espectro(x, a, n) {
  const re = new Float64Array(n), im = new Float64Array(n); let w = 0;
  for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); re[i] = x[a + i] * h; w += h; }
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(ang * k), s = Math.sin(ang * k), p = i + k, q = p + len / 2;
      const tr = re[q] * c - im[q] * s, ti = re[q] * s + im[q] * c; re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; } }
  const mag = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) mag[i] = 2 * Math.hypot(re[i], im[i]) / w;
  return mag;
}
/** Frequência do maior pico do espectro entre f1 e f2, com interpolação parabólica em dB. Devolve [Hz, amplitude]. */
export function picoEsp(mag, fs, f1, f2) {
  const n = mag.length * 2; let b = Math.ceil(f1 * n / fs); for (let i = b; i <= Math.floor(f2 * n / fs); i++) if (mag[i] > mag[b]) b = i;
  const l = v => Math.log(Math.max(v, 1e-15)), d = (l(mag[b - 1]) - l(mag[b + 1])) / (2 * (l(mag[b - 1]) - 2 * l(mag[b]) + l(mag[b + 1])) || 1);
  return [(b + d) * fs / n, mag[b]];
}
/** Instantes (em amostras) em que |x| passa de `lim` depois de pelo menos `folga` amostras de silêncio. */
export function ataques(x, lim = 0.02, folga = 400) { const t = []; let ult = -1e9; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > lim) { if (i - ult > folga) t.push(i); ult = i; } return t; }
