// Carrega o motor de som direto de jupiter8/index.html (o mesmo texto que vira AudioWorklet na página)
// e oferece utilitários de medição. Uso: node tests/medicao/jupiter8/medir.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export function fonteDsp(pagina = 'jupiter8/index.html') {
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
/** Patch de teste neutro: só o VCO-1 em serra, filtro todo aberto, sem ressonância, envelopes em degrau (ataque e release mínimos, sustain no máximo). */
export const NEUTRO = { lfoRate: 5, lfoDelay: 0, lfoWave: 0, fmLfo: 0, fmEnv: 0, fmDest: 1, pwm: 0, pwmSrc: 1, cross: 0, v1Range: 1, v1Wave: 1,
  sync: 0, v2Low: 0, v2Range: 12, v2Fine: 0, v2Wave: 0, mix: 0, hpf: 0, cut: 10, res: 0, slope: 1, envMod: 0, envSrc: 1, vcfLfo: 0, key: 0,
  level: 10, vcaLfo: 0, a1: 0, d1: 5, s1: 10, r1: 0, k1: 0, pol1: 0, a2: 0, d2: 5, s2: 10, r2: 0, k2: 0,
  vco1Bend: 1, vco2Bend: 1, vcfBend: 0, vcoMod: 1, vcfMod: 0, bendVco: 0, bendVcf: 0, lfoVco: 0, lfoVcf: 0, rise: 0, port: 0, portMode: 1, assign: 0 };
/** Cria um motor com os globais `g`, o patch Upper `pu` e o Lower `pl` (sobre o patch neutro). Volume 5 (nível médio, abaixo do limitador). */
export function novo(Motor, pu = {}, g = {}, pl = {}, fs = FS) {
  const m = new Motor(fs);
  m.msg({ t: 'tune' });   // sem deriva entre vozes, para medir frequências
  m.msg({ t: 'gs', g: Object.assign({ volume: 5 }, g) });
  m.msg({ t: 'patch', s: 0, p: Object.assign({}, NEUTRO, pu) }); m.msg({ t: 'patch', s: 1, p: Object.assign({}, NEUTRO, pl) });
  return m;
}
/** Renderiza `seg` segundos e devolve o sinal. */
export function render(m, seg) {
  const n = Math.round(seg * m.fs), L = new Float32Array(n), B = 512;
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
