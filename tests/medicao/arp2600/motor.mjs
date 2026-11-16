// Carrega o motor de som direto de arp2600/index.html (o mesmo texto que vira AudioWorklet na página)
// e oferece utilitários de medição. Uso: node tests/medicao/arp2600/medir.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export function fonteDsp(pagina = 'arp2600/index.html') {
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
/** Painel "em branco": todos os atenuadores em zero, sem deriva, sem reverb. Só entra som o que o teste abrir. */
export const BRANCO = { preGain: 0, preRange: 0, ef: 0, rmA: 0, rmB: 0, rmDC: 0,
  f1: 0.27187, fine1: 0, lf1: 0, v1b: 0, v1c: 0, v1d: 0, f2: 0.27187, fine2: 0, lf2: 0, pw2: 50, v2b: 0, v2c: 0, v2d: 0, pwm2: 0,
  f3: 0.27187, fine3: 0, lf3: 0, pw3: 50, v3b: 0, v3c: 0, v3d: 0,
  ff: 1, ffine: 0, res: 0, fa1: 0, fa2: 0, fa3: 0, fa4: 0, fa5: 0, fc2: 0, fc3: 0,
  atk: 0, dec: 0, sus: 1, rel: 0, arA: 0, arR: 0, gateSw: 0, gain0: 0, va1: 0, va2: 0, vlin: 0, vexp: 0,
  m1: 0, m2: 0, pan: 0, revL: 0, revR: 0, nCor: 1, nNiv: 0.5, vp2: 0, vp4: 0, vp6: 0, lag: 0, shLvl: 1, shRate: 0.5,
  tune: 0, interval: 1, porta: 0, deriva: 0 };
/** Cria um motor com o painel em branco mais os dados em `p`; `cabos` = [[saída, entrada], ...]. */
export function novo(Motor, p = {}, cabos = [], fs = FS) {
  const m = new Motor(fs);
  m.msg({ t: 'ps', p: Object.assign({}, BRANCO, p) });
  if (cabos.length) m.msg({ t: 'cabos', c: cabos });
  return m;
}
/** Renderiza `seg` segundos lendo, a cada amostra, a tensão (em volts) das saídas internas em `nomes`.
    Devolve { nome: Float64Array } mais L e R (escala digital). */
export function sonda(m, nomes, seg) {
  const n = Math.round(seg * m.fs), r = { L: new Float32Array(n), R: new Float32Array(n) }, NS = m.constructor.dados.NS;
  for (const k of nomes) r[k] = new Float64Array(n);
  for (let i = 0; i < n; i++) { m.process(r.L.subarray(i, i + 1), r.R.subarray(i, i + 1), 1); for (const k of nomes) r[k][i] = m.o[NS[k]]; }
  return r;
}
/** Renderiza `seg` segundos e devolve [L, R]. */
export function render(m, seg) {
  const n = Math.round(seg * m.fs), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += 128) { const k = Math.min(128, n - i); m.process(L.subarray(i, i + k), R.subarray(i, i + k), k); }
  return [L, R];
}
export const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
export const pico = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
export const dB = v => 20 * Math.log10(Math.max(v, 1e-12));
/** Amplitude de uma senoide de frequência f no trecho [a, b) (projeção em seno e cosseno, janela de Hann). */
export function amp(x, f, fs, a = 0, b = x.length) {
  let re = 0, im = 0, w = 0; const n = b - a;
  for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), ph = 2 * Math.PI * f * i / fs; re += h * x[a + i] * Math.cos(ph); im += h * x[a + i] * Math.sin(ph); w += h; }
  return 2 * Math.hypot(re, im) / w;
}
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
/** Frequência fundamental por autocorrelação com interpolação parabólica. */
export function f0(x, fs, a, n, fmin = 15, fmax = 6000) {
  const lmin = Math.floor(fs / fmax), lmax = Math.min(n >> 1, Math.ceil(fs / fmin)); let best = -1, bl = lmin; const r = new Float64Array(lmax + 2);
  for (let l = lmin - 1; l <= lmax + 1; l++) { let s = 0; for (let i = 0; i < n - lmax - 1; i++) s += x[a + i] * x[a + i + l]; r[l] = s; }
  // primeiro máximo local próximo do global (evita pegar um múltiplo do período)
  let glob = -Infinity; for (let l = lmin; l <= lmax; l++) glob = Math.max(glob, r[l]);
  for (let l = lmin; l <= lmax; l++) if (r[l] > 0.97 * glob && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { bl = l; best = r[l]; break; }
  const d = (r[bl - 1] - r[bl + 1]) / (2 * (r[bl - 1] - 2 * r[bl] + r[bl + 1]) || 1);
  return fs / (bl + d);
}
