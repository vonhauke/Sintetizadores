// Carrega o motor de som direto de tr808/index.html (o mesmo texto que vira AudioWorklet na página)
// e oferece utilitários de medição. Uso: node tests/medicao/tr808/medir.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export function fonteDsp(pagina = 'tr808/index.html') {
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
export const novo = (Motor, fs = FS, p = {}) => { const m = new Motor(fs); if (Object.keys(p).length) m.msg({ t: 'p', p }); return m; };

/** Renderiza uma voz na saída MULTI OUT (em volts, antes do resistor de mistura).
    disparos: [{ t: segundos, ac: bool }]. Chama m[voz].amostra(m.p[voz]) como o motor faz. */
export function renderVoz(m, voz, seg, disparos = [{ t: 0.01, ac: false }]) {
  const n = Math.round(seg * m.fs), y = new Float64Array(n), ds = disparos.map(d => ({ i: Math.round(d.t * m.fs), ac: d.ac }));
  for (let i = 0; i < n; i++) {
    for (const d of ds) if (d.i === i) m.msg({ t: 'trig', v: voz, ac: d.ac });
    if (m.tick) m.tick();   // fonte de ruído compartilhada, uma amostra por passo
    y[i] = m[voz].amostra(m.p[voz]);
  }
  return { y, t0: ds[0].i / m.fs };
}
/** Renderiza a saída digital (mix + master) em blocos de 128, como o AudioWorklet. */
export function render(m, seg, disparos = [{ t: 0.01, v: 'bd', ac: false }]) {
  const n = Math.round(seg * m.fs), L = new Float32Array(n), R = new Float32Array(n), ds = disparos.map(d => ({ i: Math.round(d.t * m.fs), v: d.v, ac: d.ac }));
  for (let i = 0; i < n; i += 128) {
    const k = Math.min(128, n - i);
    for (const d of ds) if (d.i >= i && d.i < i + k) { /* disparo no início do bloco: precisão de 128 amostras (2,7 ms) basta para medir nível */ m.msg({ t: 'trig', v: d.v, ac: d.ac }); }
    m.process(L.subarray(i, i + k), R.subarray(i, i + k), k);
  }
  return L;
}
export const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
export const pico = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
export const vpp = (x, a = 0, b = x.length) => { let lo = Infinity, hi = -Infinity; for (let i = a; i < b; i++) { if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i]; } return hi - lo; };
export const dB = v => 20 * Math.log10(Math.max(v, 1e-12));
/** Espectro de magnitude (FFT radix-2, janela de Hann), n = potência de 2. */
export function espectro(x, a, n) {
  const re = new Float64Array(n), im = new Float64Array(n); let w = 0;
  for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); re[i] = (x[a + i] || 0) * h; w += h; }
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(ang * k), s = Math.sin(ang * k), p = i + k, q = p + len / 2;
      const tr = re[q] * c - im[q] * s, ti = re[q] * s + im[q] * c; re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; } }
  const mag = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) mag[i] = 2 * Math.hypot(re[i], im[i]) / w;
  return mag;
}
/** Frequência do maior pico do espectro entre f1 e f2 (interpolação parabólica em log). Devolve [Hz, amplitude]. */
export function picoEsp(mag, fs, f1, f2) {
  const n = mag.length * 2; let b = Math.ceil(f1 * n / fs); for (let i = b; i <= Math.floor(f2 * n / fs); i++) if (mag[i] > mag[b]) b = i;
  const l = v => Math.log(Math.max(v, 1e-15)), d = (l(mag[b - 1]) - l(mag[b + 1])) / (2 * (l(mag[b - 1]) - 2 * l(mag[b]) + l(mag[b + 1])) || 1);
  return [(b + d) * fs / n, mag[b]];
}
/** Energia do espectro entre f1 e f2 (soma de |X|²). */
export function energiaBanda(mag, fs, f1, f2) { const n = mag.length * 2; let s = 0; for (let i = Math.ceil(f1 * n / fs); i <= Math.floor(f2 * n / fs); i++) s += mag[i] * mag[i]; return s; }
/** Instantes (s) dos cruzamentos por zero (interpolação linear), a partir de `a` amostras. dir: +1 subida, -1 descida, 0 ambos. */
export function cruzamentos(x, fs, a = 0, b = x.length, dir = 0) {
  const t = [];
  for (let i = Math.max(a, 1); i < b; i++) { const p = x[i - 1], q = x[i]; if ((p < 0 && q >= 0 && dir >= 0) || (p > 0 && q <= 0 && dir <= 0)) t.push((i - 1 + p / (p - q)) / fs); }
  return t;
}
/** Extremos locais |x| (máximos de módulo entre cruzamentos). Devolve [{t, v}]. */
export function extremos(x, fs, a = 0, b = x.length) {
  const r = []; let i = a, sinal = Math.sign(x[a]) || 1, pv = 0, pi = a;
  for (; i < b; i++) { const s = Math.sign(x[i]); if (s !== 0 && s !== sinal) { r.push({ t: pi / fs, v: pv }); sinal = s; pv = 0; } if (Math.abs(x[i]) > pv) { pv = Math.abs(x[i]); pi = i; } }
  return r;
}
/** Tempo (s, desde `t0`) até o envelope de picos cair a `fracao` do maior pico (interpolação log entre extremos). */
export function tempoAte(x, fs, t0, fracao = 0.1) {
  const e = extremos(x, fs, Math.round(t0 * fs)); if (!e.length) return NaN;
  let k = 0; for (let i = 1; i < e.length; i++) if (e[i].v > e[k].v) k = i;
  const alvo = e[k].v * fracao;
  for (let i = k + 1; i < e.length; i++) if (e[i].v <= alvo) { const a = e[i - 1], b = e[i], u = (Math.log(alvo) - Math.log(a.v)) / (Math.log(b.v) - Math.log(a.v)); return a.t + u * (b.t - a.t) - t0; }
  return Infinity;
}
/** Amplitude inicial de um componente senoidal amortecido (f, decay a −20 dB = T20) em x, por filtro casado em [t0, t0+dur]. */
export function ampDecai(x, fs, t0, f, T20, dur = 0.12) {
  const al = Math.LN10 / T20, a = Math.round(t0 * fs), n = Math.round(dur * fs); let re = 0, im = 0, e2 = 0;
  for (let i = 0; i < n; i++) { const t = i / fs, e = Math.exp(-al * t), ph = 2 * Math.PI * f * t; re += x[a + i] * e * Math.cos(ph); im += x[a + i] * e * Math.sin(ph); e2 += e * e; }
  return 2 * Math.hypot(re, im) / e2;
}
/** Como tempoAte, mas pelo envelope RMS (janela `jan` s, passo de 1 amostra): serve com ruído, onde os picos são aleatórios. */
export function tempoAteRms(x, fs, t0, fracao = 0.1, jan = 0.004) {
  const a = Math.round(t0 * fs), w = Math.round(jan * fs), n = x.length - a - w; if (n <= 0) return NaN; const e = new Float64Array(n); let s = 0;
  for (let i = 0; i < w; i++) s += x[a + i] ** 2; for (let i = 0; i < n; i++) { e[i] = Math.sqrt(s / w); s += x[a + i + w] ** 2 - x[a + i] ** 2; }
  let k = 0; for (let i = 1; i < n; i++) if (e[i] > e[k]) k = i; const alvo = e[k] * fracao;
  for (let i = k; i < n; i++) if (e[i] <= alvo) return (i + w / 2) / fs;   // desde o disparo (t0 = início da janela 0)
  return Infinity;
}
