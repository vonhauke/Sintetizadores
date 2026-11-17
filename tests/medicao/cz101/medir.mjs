// Medições do motor de som de cz101/index.html, comparadas com docs/pesquisa/cz101.md (seção 11).
// Uso: node tests/medicao/cz101/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
import { carregaMotor, novo, render, rms, pico, dB, espectro, picoHz, FS, VOL_UNIT } from './motor.mjs';

const Motor = carregaMotor(), DD = Motor.dados, { E, tom, Env } = DD;
const linhas = []; let falhas = 0;
const fmt = (v, c = 2) => typeof v === 'number' ? v.toFixed(c).replace('.', ',') : v;
function reg(grupo, item, esperado, medido, ok, fonte = '') { if (!ok) falhas++; linhas.push([grupo, item, esperado, medido, ok ? 'ok' : 'FORA', fonte]); }
const cents = (a, b) => 1200 * Math.log2(a / b);
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const fNota = n => 440 * Math.pow(2, (n - 69) / 12);
const N = 131072;

/** timbre de teste: uma linha estável. DCW e DCA sobem a `dcw` e `dca` e ficam em sustain; as outras partes do timbre ficam neutras. */
const fixo = (w = [1, 0], dcw = 0, dca = 99, extra = {}) => tom(Object.assign({ lineSel: 0, lines: [{ w, dcw: E([[99, dcw], [50, 0]], 0, 1), dca: E([[99, dca], [50, 0]], 0, 1) }] }, extra));
const mudo = { w: [1, 0], dcw: E([[99, 0], [50, 0]], 0, 1), dca: E([[99, 0], [50, 0]], 0, 1) };
function toca(t, g = {}, notas = [60], seg = 3.2, t2 = null) { const m = novo(Motor, g, t, t2); for (const n of notas) m.msg({ t: 'on', n }); return [m, render(m, seg)]; }
const fMed = (L, f0) => picoHz(L, Math.round(0.3 * FS), N, f0 * 0.8, f0 * 1.25);
/** amplitude do harmônico k de f no espectro (máximo na vizinhança do bin) */
const harm = (mag, f, k) => { const i = Math.round(k * f / (FS / N)); let m = 0; for (let j = i - 2; j <= i + 2; j++) m = Math.max(m, mag[j] || 0); return m; };

/* ====================================================== 1. Frequências (11.1) */
{ const [, L] = toca(fixo([1, 0], 0), {}, [69]), f = fMed(L, 440);
  reg('Frequência', 'Lá4, onda 1, DCW 0 (referência 440 Hz, decisão do usuário)', '440 Hz ±0,5 cent', `${fmt(f, 3)} Hz (${fmt(cents(f, 440), 2)} cents)`, Math.abs(cents(f, 440)) < 0.5, 'decisão (c); 442 Hz no MAME (b)'); }
{ let pior = 0, pn = 0;
  for (let n = 36; n <= 84; n++) { const [, L] = toca(fixo([1, 0], 0), {}, [n]), e = Math.abs(cents(fMed(L, fNota(n)), fNota(n))); if (e > pior) { pior = e; pn = n; } }
  reg('Frequência', 'as 49 teclas (nota 36 a 84), temperamento igual', '±1 cent', `pior: ${fmt(pior, 2)} cents (nota ${pn})`, pior < 1, '(a)'); }
for (const o of [-1, 1]) { const [, L] = toca(fixo([1, 0], 0, 99, { oct: o }), {}, [60]), alvo = fNota(60) * Math.pow(2, o), c = cents(fMed(L, alvo), alvo);
  reg('Frequência', `OCTAVE ${o > 0 ? '+1' : '−1'}`, o > 0 ? '×2 (±1 cent)' : '÷2 (±1 cent)', fmt(c, 2) + ' cents', Math.abs(c) < 1, '(a)'); }
const linhaB = (t, g = {}, n = 60) => { const [, L] = toca(t, g, [n]); return L; };
const tDet = det => tom({ lineSel: 3, det, lines: [mudo, { w: [1, 0], dcw: E([[99, 0], [50, 0]], 0, 1), dca: E([[99, 99], [50, 0]], 0, 1) }] });
for (const [s, o, n, f, nome] of [[1, 0, 1, 0, 'NOTE 1'], [1, 0, 7, 0, 'NOTE 7'], [1, 0, 11, 0, 'NOTE 11'], [1, 1, 0, 0, 'OCT 1'], [1, 2, 0, 0, 'OCT 2'], [1, 3, 0, 0, 'OCT 3'], [-1, 0, 5, 0, 'sinal −, NOTE 5'], [1, 1, 11, 0, 'OCT 1 + NOTE 11']]) {
  const L = linhaB(tDet({ s, o, n, f })), ct = s * (o * 1200 + n * 100), alvo = fNota(60) * Math.pow(2, ct / 1200), c = cents(fMed(L, alvo), alvo);
  reg('Frequência', `DETUNE ${nome}`, 'semitons e oitavas exatos (±1 cent)', fmt(c, 2) + ' cents de erro', Math.abs(c) < 1, '(a)'); }
for (const [f, doc] of [[15, 23], [30, 48], [45, 73], [60, 98]]) {
  const L = linhaB(tDet({ s: 1, o: 0, n: 0, f })), f0 = fNota(60), c = cents(fMed(L, f0 * 1.06), f0);
  reg('Frequência', `DETUNE FINE ${f}`, `≈ ${doc} cents (±3)`, fmt(c, 1) + ' cents', Math.abs(c - doc) <= 3, '(c) 60 ≈ 63/64 de semitom (a)'); }
for (const r of [1, 2, 7, 12]) for (const sg of [1, -1]) {
  const [, L] = toca(fixo([1, 0], 0), { bendRange: r, bend: sg }, [60]), alvo = fNota(60) * Math.pow(2, sg * r / 12), c = cents(fMed(L, alvo), alvo);
  reg('Frequência', `BEND RANGE ${r}, roda no extremo ${sg > 0 ? 'para cima' : 'para baixo'}`, `${sg * r} semitons (±3 cents)`, fmt(c, 2) + ' cents de erro', Math.abs(c) < 3, '(a); curva da roda linear (c)'); }
for (const mt of [-100, 100]) { const [, L] = toca(fixo([1, 0], 0), { master: mt }, [60]), alvo = fNota(60) * Math.pow(2, mt / 1200), c = cents(fMed(L, alvo), alvo);
  reg('Frequência', `MASTER TUNE ${mt > 0 ? '+' : ''}${mt} cents`, '±100 cents (±3)', fmt(c, 2) + ' cents de erro', Math.abs(c) < 3, '(a)'); }
for (const tr of [-5, 6]) { const [, L] = toca(fixo([1, 0], 0), { transp: tr }, [60]), alvo = fNota(60 + tr), c = cents(fMed(L, alvo), alvo);
  reg('Frequência', `KEY TRANSPOSE ${tr > 0 ? '+' : ''}${tr}`, `${tr} semitons (±1 cent)`, fmt(c, 2) + ' cents de erro', Math.abs(c) < 1, '(a)'); }
{ const [, L] = toca(fixo([1, 2], 99), {}, [48]), mag = espectro(L, Math.round(0.3 * FS), N), f = fNota(48), r = dB(harm(mag, f, 0.5) / harm(mag, f, 1));
  reg('Frequência', 'duas formas alternadas (1+2): componente em f/2 (a fonte do MAME diz que a onda alterna a cada ciclo)', 'registrar', `${fmt(r, 1)} dB em relação à fundamental`, r > -40, '(b): código do chip'); }

/* ====================================================== 2. Formas de onda e DCW (11.2) */
const tl = (a, nivel) => 8 * Math.floor(a * 127 / 99);     // DCW em unidades do chip para o nível `a` do painel (a)
for (const w of [1, 2, 3, 4, 5]) {
  const [, L] = toca(fixo([w, 0], 0), {}, [48]), mag = espectro(L, Math.round(0.3 * FS), N), f = fNota(48) * (w === 4 ? 2 : 1);
  let pk = 0, resto = 0; const df = FS / N, ip = Math.round(f / df);
  for (let i = 1; i < mag.length; i++) { if (Math.abs(i - ip) <= 4) pk = Math.max(pk, mag[i]); else if (Math.abs(i - ip) > 40) resto = Math.max(resto, mag[i]); }   // ±40 bins: o vazamento da janela de Hann a 5 bins ainda é -50 dB
  reg('Onda', `onda ${w}, DCW 0 (seno${w === 4 ? '; no seno duplo o chip lê o cosseno com o dobro da frequência' : ''})`, 'maior outra componente abaixo de −55 dB (o piso da tabela de 12 bits com fase de 11 bits é −60 dB; limite ajustado com a sua aprovação)', `${fmt(dB(resto / pk), 1)} dB`, dB(resto / pk) < -55, w === 4 ? '(b) código do MAME' : '(a) manual: nível 00 = senoide'); }
{ const [, L] = toca(fixo([1, 0], 99), {}, [36]), mag = espectro(L, Math.round(0.3 * FS), N), f = fNota(36), a1 = harm(mag, f, 1);
  const cic = new Float32Array(2048 * 64); for (let c = 0; c < 64; c++) for (let p = 0; p < 2048; p++) cic[c * 2048 + p] = DD.amostraPD(0, 0, p, 1016) - 2048;   // ciclo exato da fórmula do chip
  const mc = espectro(cic, 0, 2048 * 64); let pior = 0, ex = 0;
  for (let k = 2; k <= 10; k++) { const med = dB(harm(mag, f, k) / a1), esp = dB(mc[64 * k] / mc[64]); pior = Math.max(pior, Math.abs(med - esp)); ex = Math.max(ex, Math.abs(esp + 20 * Math.log10(k))); }
  reg('Onda', `onda 1, DCW 99, nota grave: espectro contra o ciclo exato da fórmula do chip (a serra do chip cai em cosseno: ${fmt(ex, 1)} dB abaixo de 1/k)`, '±1 dB nos 10 primeiros harmônicos (ajustado com a sua aprovação)', `pior desvio ${fmt(pior, 2)} dB`, pior <= 1, '(b)'); }
{ const [, L] = toca(fixo([2, 0], 99), {}, [36]), mag = espectro(L, Math.round(0.3 * FS), N), f = fNota(36), a1 = harm(mag, f, 1);
  let par = -200, imp = 0; for (let k = 2; k <= 12; k += 2) par = Math.max(par, dB(harm(mag, f, k) / a1));
  reg('Onda', 'onda 2, DCW 99: harmônicos pares', 'abaixo de −30 dB', `${fmt(par, 1)} dB`, par < -30, '(b)'); }
/* fórmulas da pesquisa (seção 4.2) reescritas aqui, de forma independente, e comparadas com o motor em todas as 2048 posições */
function ref(w, pos, dcw) {
  const pivot = 1024 - dcw; let ph;
  if (w === 0) ph = pos < pivot ? Math.trunc(pos * 1024 / pivot) : 1024 + Math.trunc((pos - pivot) * 1024 / (2048 - pivot));
  else if (w === 1) { const p = pos & 1023; ph = (p < pivot ? Math.trunc(p * 1024 / pivot) : 1023) + (pos & 1024); }
  else if (w === 2) ph = pos < 2 * pivot ? Math.trunc(pos * 2048 / (2 * pivot)) : 2047;
  else if (w === 4) ph = pos < pivot ? Math.trunc(pos * 2048 / pivot) : Math.trunc((pos - pivot) * 2048 / (2048 - pivot));
  else if (w === 5) ph = pos < 1024 ? pos : pos < pivot + 1024 ? 1024 + Math.trunc((pos & 1023) * 1024 / pivot) : 2047;
  else ph = (pos + Math.trunc(pos * dcw / 64)) & 2047;
  return Math.floor(4095 * (1 - Math.cos(2 * Math.PI * ph / 2047)) / 2);
}
for (const [w, nome] of [[0, '1 serra'], [1, '2 quadrada'], [2, '3 pulso'], [4, '4 seno duplo'], [5, '5 serra-pulso']]) {
  let pior = 0; for (const a of [25, 50, 75]) for (let pos = 0; pos < 2048; pos++) pior = Math.max(pior, Math.abs(DD.amostraPD(w, 0, pos, tl(a)) - ref(w, pos, tl(a))));
  reg('Onda', `onda ${nome}, DCW 25/50/75: um ciclo contra as fórmulas da pesquisa`, 'erro ≤ 1 LSB de 12 bits', `${pior} LSB`, pior <= 1, '(b) seção 4.2'); }
for (const [nr, win, nome] of [[6, 1, 'I (serra)'], [7, 2, 'II (triângulo)'], [8, 3, 'III (trapézio)']]) {
  const [c, wi] = DD.ONDA[nr]; let pior = 0, pk = [];
  for (const a of [25, 50, 99]) {
    for (let pos = 0; pos < 2048; pos++) {
      const wn = wi === 1 ? pos : wi === 2 ? (pos < 1024 ? 2046 - 2 * pos : (pos & 1023) * 2) : (pos >= 1024 ? (pos & 1023) * 2 : 0);   // atenuação da janela, pesquisa 4.2
      let e = Math.floor(4095 * (1 - Math.cos(2 * Math.PI * ((pos + Math.trunc(pos * tl(a) / 64)) & 2047) / 2047)) / 2); if (wn) e = Math.trunc(e * (2048 - wn) / 2048);
      pior = Math.max(pior, Math.abs(DD.amostraPD(c, wi, pos, tl(a)) - e));
    }
    const [, L] = toca(fixo([nr, 0], a), {}, [36]), mag = espectro(L, Math.round(0.3 * FS), N), f = fNota(36); let kb = 1, vb = 0;
    for (let k = 1; k <= 24; k++) { const v = harm(mag, f, k); if (v > vb) { vb = v; kb = k; } }
    const lim = 1024 - Math.min(1024, Math.floor(2 ** 20 * f * 2048 / 40000 / 2 ** 20 * 4)), dcw = Math.min(tl(a), lim);
    pk.push([a, kb, 1 + dcw / 64]);
  }
  reg('Onda', `onda ${nome}: janela dentro do ciclo e formato`, 'erro ≤ 1 LSB', `${pior} LSB`, pior <= 1, '(b) seção 4.2');
  reg('Onda', `onda ${nome}: pico espectral em (1 + dcw/64) × f (nota 36; DCW 25, 50, 99)`, '±1 harmônico', pk.map(([a, k, e]) => `DCW ${a}: harmônico ${k} (esperado ${fmt(e, 1)})`).join('; '), pk.every(([, k, e]) => Math.abs(k - e) <= 1.5), '(b)');
}
{ let pior = 1e9, nn = 0;     // trecho rápido da onda: pivô / avanço de posição por amostra
  const tb = DD.tabelaPassos(440);
  for (let n = 24; n <= 108; n++) { const step = tb[n * 512], pinc = step / 2 ** 20, lim = 1024 - Math.min(1024, step >>> 18), piv = 1024 - lim; if (lim > 0 && piv / pinc < pior) { pior = piv / pinc; nn = n; } }
  reg('Onda', 'limite do DCW por nota: trecho rápido (nota 24 a 108)', '≥ 4 amostras (truncamento inteiro: até 1 pos. a menos)', `${fmt(pior, 2)} amostras na nota ${nn}`, pior >= 3.0, '(b) código do MAME; (c) o "4 amostras" é derivado'); }
for (const n of [48, 72, 96]) {
  const [m] = toca(fixo([1, 0], 99), {}, [n], 0.1), v = m.vozes.find(x => x.act), step = m.tabela[n * 512], esperado = Math.min(1016, 1024 - Math.min(1024, step >>> 18));
  reg('Onda', `DCW 99 na nota ${n}: DCW efetivo`, `${esperado}`, `${v ? v.dcwUsado : 'voz parada'}`, !!v && v.dcwUsado === esperado, '(b)'); }
for (const [n, w] of [[84, 1], [84, 3], [84, 6], [96, 1], [96, 3], [96, 6]]) {
  const [, L] = toca(fixo([w, 0], 99), {}, [n], 3.2), mag = espectro(L, Math.round(0.3 * FS), N), f = fNota(n), df = FS / N; let e = 0, tot = 0;
  for (let i = 1; i < mag.length; i++) { const p = mag[i] * mag[i]; tot += p; if (i * df > 10000) e += p; }
  reg('Onda', `aliasing: energia acima de 10 kHz em ${n === 84 ? 'Dó6' : 'Dó7'}, onda ${w}, DCW 99`, 'registrar', `${fmt(10 * Math.log10(e / tot + 1e-30), 1)} dB do total`, true, '(b)'); }
{ const fc = Math.min(18000, 0.45 * FS), w0 = 2 * Math.PI * fc / FS, al = Math.sin(w0) / (2 * Math.SQRT1_2), c = Math.cos(w0), a0 = 1 + al, b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  const H = f => { const w = 2 * Math.PI * f / FS, re = b0 + b1 * Math.cos(w) + b0 * Math.cos(2 * w), im = -(b1 * Math.sin(w) + b0 * Math.sin(2 * w)), rd = 1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w), id = -(a1 * Math.sin(w) + a2 * Math.sin(2 * w)); return 20 * Math.log10(Math.hypot(re, im) / Math.hypot(rd, id)); };
  reg('Onda', 'filtro de saída: resposta em 10, 15, 17, 20 kHz', 'aproximação; só registrar', [10000, 15000, 17000, 20000].map(f => `${f / 1000} kHz ${fmt(H(f), 1)} dB`).join('; '), true, '(c) o service manual não foi lido'); }

/* ====================================================== 3. Envelopes (11.3) */
function ticks(tipo, a, nivel, dcoNivel) {      // quantas amostras do núcleo até atingir o alvo do primeiro passo
  const e = new Env(tipo); e.carrega(E([[a, nivel], [50, 0]], 0, 1), 0); e.inicia(); const alvo = e.tgt; let n = 0;
  while (e.cur !== alvo && n < 1e8) { e.tick(); n++; } return n / 40000;
}
const caso = (tipo, rates, docs, nivel, nome) => rates.forEach((a, i) => { const t = ticks(tipo, a, nivel), d = docs[i];
  reg('Envelope', `${nome} com RATE ${a}`, `${d < 0.1 ? fmt(d * 1000, 2) + ' ms' : fmt(d, 3) + ' s'} (±5 % ou 1 amostra)`, `${t < 0.1 ? fmt(t * 1000, 2) + ' ms' : fmt(t, 3) + ' s'}`, Math.abs(t - d) <= Math.max(0.05 * d, 1 / 40000), '(b) tempos derivados do contador do chip (c)'); });
caso('dca', [99, 80, 60, 50, 40, 20], [0.0034, 0.025, 0.203, 0.542, 1.63, 13.0], 99, 'DCA 0→99');
caso('dcw', [99, 80, 60, 50, 40, 20], [0.0034, 0.025, 0.203, 0.542, 1.63, 13.0], 99, 'DCW 0→99');
caso('dco', [99, 70, 50, 30], [192 * 65536 / DD.envRate(127) / 40000, 0.017, 0.154, 1.40], 66, 'DCO 0→66 (1 oitava; no RATE 99 o esperado é 0,64 ms pela conta do contador, o 0,6 ms do documento é arredondado)');
{ const a = ticks('dcw', 60, 99), b = ticks('dcw', 60, 50), alvo = (8 * Math.floor(50 * 127 / 99)) / (8 * Math.floor(99 * 127 / 99));
  reg('Envelope', 'proporcionalidade: DCW até o nível 50 em relação ao 99', `${fmt(alvo, 3)} do tempo (±5 %)`, fmt(b / a, 3), Math.abs(b / a - alvo) <= 0.05 * alvo, '(b)'); }
{ let pior = 0; for (let b = 0; b < 112; b++) pior = Math.max(pior, Math.abs(DD.envRate(b + 8) / DD.envRate(b) - 2));
  reg('Envelope', 'dobra de velocidade a cada 8 unidades do byte de rate', '±3 %', fmt(pior * 100, 2) + ' %', pior <= 0.03, '(b)'); }
{ const f = [0, 0, 0].map(() => 0); const e = new Env('dcw'); e.carrega(E([[99, 99], [99, 40], [99, 0]], 1, 2), 0); e.inicia(); let n = 0; while (!e.wait && n < 1e6) { e.tick(); n++; }
  const alvo = DD.ALVO.dcw(DD.BL.dcw(40)), cur0 = e.cur; for (let i = 0; i < 4000; i++) e.tick(); const preso = e.cur === cur0 && e.wait && !e.done; e.solta(); let m = 0; while (!e.done && m < 1e6) { e.tick(); m++; }
  reg('Envelope', 'sustain: com a tecla presa para no nível do passo; ao soltar segue até o END', 'funcional', `parou em ${cur0 === alvo ? 'o nível 40' : cur0}; segurou 4000 amostras: ${preso}; terminou em ${e.cur}`, cur0 === alvo && preso && e.done && e.cur === 0, '(a)'); }
{ const e = new Env('dca'); e.carrega(E([[99, 99], [99, 80], [99, 70]], -1, 2), 0); e.inicia(); let n = 0; while (!e.done && n < 1e6) { e.tick(); n++; }
  reg('Envelope', 'END: o nível do último passo é forçado a 0, mesmo gravado como 70', 'nível final 0, sem passar do END', `terminou em ${e.cur} depois de ${n} amostras`, e.done && e.cur === 0, '(a)'); }
{ const e = new Env('dcw'); e.carrega(E([[99, 99], [99, 50], [99, 0]], -1, 2), 0); e.inicia(); let n = 0; while (!e.done && n < 1e6) { e.tick(); n++; }
  reg('Envelope', 'sem ponto de sustain: percorre até o END com a tecla presa', 'funcional', e.done ? 'terminou' : 'ficou preso', e.done, '(c) o manual não descreve'); }
{ const niveis = [99, 10, 80, 20, 70, 30, 60, 0], e = new Env('dcw'); e.carrega(E(niveis.map(l => [99, l]), -1, 7), 0); e.inicia();
  const vistos = []; let n = 0; while (!e.done && n < 1e6) { const p = e.i, antes = e.tgt; e.tick(); if ((e.i !== p || e.done) && e.cur === antes) vistos.push(e.cur); n++; }
  const esp = niveis.map((l, i) => i === 7 ? 0 : DD.ALVO.dcw(DD.BL.dcw(l)));
  reg('Envelope', '8 passos com níveis alternados: todos os alvos atingidos, na ordem', '±1 nível', `${vistos.length} alvos; ordem ${vistos.every((v, i) => v === esp[i]) ? 'correta' : 'errada'}`, vistos.length === 8 && vistos.every((v, i) => Math.abs(v - esp[i]) <= 65536 * 8), '(a)'); }
for (const [a, doc] of [[63, 393.75], [64, 800], [66, 1200], [72, 2400], [99, 7800]]) {
  const c = (DD.ALVO.dco(DD.BL.dco(a)) >>> 11) * 100 / 512;
  reg('Envelope', `DCO LEVEL ${a}`, `${fmt(doc, 2)} cents (±3)`, fmt(c, 2) + ' cents', Math.abs(c - doc) <= 3, '(a) especificação MIDI; (b) chip'); }
{ const pts = []; const e = new Env('dca'); e.carrega(E([[50, 99], [50, 0]], 0, 1), 0); e.inicia(); let i = 0; while (e.cur !== e.tgt) { e.tick(); i++; if (i % 2000 === 0 && (e.cur >>> 16) > 100) pts.push([i, 20 * Math.log10(DD.VOL[e.cur >>> 16])]); }
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n, b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  let pior = 0; for (const p of pts) pior = Math.max(pior, Math.abs(p[1] - (my + b * (p[0] - mx))));
  reg('Envelope', 'rampa do DCA: linear em dB (índice 100 a 508)', 'desvio ≤ 1 dB', fmt(pior, 2) + ' dB', pior <= 1, '(b)'); }
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60 }); const v = m.vozes.find(x => x.act); let n = 0; const L = new Float32Array(1);
  while (v.dca.cur !== v.dca.tgt && n < 1e6) { m.process(L, L, 1); n++; } const t = m.cnt / 40000;
  reg('Envelope', 'dentro da voz: DCA 0→99 com RATE 99', '3,4 ms (±5 % ou 1 amostra)', fmt(t * 1000, 2) + ' ms', Math.abs(t - 0.0034) <= Math.max(0.05 * 0.0034, 1 / 40000), '(b)'); }

/* ====================================================== 4. Níveis (11.4) */
const rmsNivel = a => { const [, L] = toca(fixo([1, 0], 0, a), {}, [60], 1.0); return rms(L, Math.round(0.5 * FS), Math.round(0.9 * FS)); };
{ const r = {}; for (const a of [99, 89, 79, 69, 59, 49, 39, 29, 1, 0]) r[a] = rmsNivel(a);
  for (let a = 99; a > 29; a -= 10) { const d = dB(r[a - 10]) - dB(r[a]); reg('Nível', `DCA LEVEL ${a} → ${a - 10}`, '−6,1 dB (±0,5)', fmt(d, 2) + ' dB', Math.abs(d + 6.13) <= 0.5, '(b) 0,61 dB por unidade (c)'); }
  const d1 = dB(r[1]) - dB(r[99]); reg('Nível', 'DCA LEVEL 1 em relação ao 99', '≈ −60 dB (±2)', fmt(d1, 1) + ' dB', Math.abs(d1 + 60) <= 2, '(b)');
  reg('Nível', 'DCA LEVEL 0', 'silêncio (< −90 dBFS)', fmt(dB(r[0]), 1) + ' dBFS', dB(r[0]) < -90, '(b)'); }
{ const [, L] = toca(fixo([1, 0], 99, 99), {}, [60], 1), p = pico(L, Math.round(0.4 * FS)), v = dB(p);
  reg('Nível', '1 voz, DCA 99, DCW 99: pico antes do ganho de saída', '−18 dBFS (±0,5): 1/8 do fundo de escala', fmt(v, 2) + ' dBFS', Math.abs(v + 18.06) <= 0.5, '(b)'); }
{ const [, L] = toca(fixo([1, 0], 99, 99), { vol: 1 }, Array(8).fill(60), 1), p = pico(L);
  reg('Nível', '8 vozes em uníssono, volume no máximo', 'sem clipping: pico ≤ 0 dBFS', fmt(dB(p), 2) + ' dBFS', isFinite(p) && p <= 1, '(b); limitador suave (c)'); }
{ const [, a] = toca(fixo([1, 0], 99, 99, { lineSel: 0 }), {}, [60], 1), [, b] = toca(fixo([1, 0], 99, 99, { lineSel: 2 }), {}, [60], 1), d = dB(pico(b, 24000)) - dB(pico(a, 24000));
  reg('Nível', 'linhas 1+1' + "'" + ' sem detune em relação a uma linha', '+6 dB (±0,5), se em fase', fmt(d, 2) + ' dB', Math.abs(d - 6.02) <= 0.5, '(b)'); }
{ const mudoT = tom({ lineSel: 0, lines: [mudo] }), t = fixo([1, 0], 0, 99);
  const [, a] = toca(t, { mix: 1, mixLevel: 9 }, [60], 1, mudoT), [, b] = toca(mudoT, { mix: 1, mixLevel: 9 }, [60], 1, t), d = dB(rms(b, 24000)) - dB(rms(a, 24000));
  reg('Nível', 'TONE MIX nível 9: o segundo timbre soa igual ao primeiro', '±0,5 dB', fmt(d, 2) + ' dB', Math.abs(d) <= 0.5, '(a)');
  const ls = []; for (let n = 1; n <= 8; n++) { const [, c] = toca(mudoT, { mix: 1, mixLevel: n }, [60], 1, t); ls.push(fmt(dB(rms(c, 24000)) - dB(rms(a, 24000)), 1)); }
  reg('Nível', 'TONE MIX níveis 1 a 8: curva adotada', 'sem referência; registrar (dB em relação ao nível 9)', ls.join(', '), true, '(c) 3 dB por passo'); }
{ const g = [0.2, 0.5, 0.8, 1].map(v => { const [, L] = toca(fixo([1, 0], 0, 99), { vol: v }, [60], 0.8); return fmt(dB(pico(L, 20000)), 1); });
  reg('Nível', 'VOLUME 0,2 / 0,5 / 0,8 / 1: curva do slider', 'aproximação; registrar (dBFS)', g.join(', '), true, '(c) ganho = vol²'); }

/* ====================================================== 5. Modulações (11.5) */
function traco(t, g, seg) { const m = novo(Motor, g, t); m.msg({ t: 'on', n: 60 }); const L = new Float32Array(1), x = []; for (let i = 0, n = Math.round(seg * FS); i < n; i++) { m.process(L, L, 1); x.push(m.inst[0] ? m.inst[0].vib : 0); } return x; }
const tVib = (w, r, d, p = 0) => fixo([1, 0], 0, 99, { vib: { w, r, d, p } });
for (const [w, nome] of [[1, 'triângulo'], [2, 'rampa subindo'], [3, 'rampa descendo'], [4, 'quadrada']]) {
  const x = traco(tVib(w, 63, 99), {}, 1.2).slice(Math.round(0.2 * FS)), mx = Math.max(...x.map(Math.abs)); let sobe = 0, desce = 0, alto = 0, dn = []; for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; if (d > 1e-9) sobe++; else if (d < -1e-9) desce++; if (Math.abs(x[i]) > 0.95 * mx) alto++; if (Math.abs(d) > 1e-9) dn.push(Math.abs(d)); }
  const tot = sobe + desce || 1, ok = w === 1 ? Math.abs(sobe / tot - 0.5) < 0.1 && alto / x.length < 0.2 : w === 2 ? sobe / tot > 0.9 && alto / x.length < 0.2 : w === 3 ? desce / tot > 0.9 && alto / x.length < 0.2 : alto / x.length > 0.9;
  reg('Vibrato', `onda ${w}: ${nome}`, 'forma', `sobe ${fmt(100 * sobe / tot, 0)} %, desce ${fmt(100 * desce / tot, 0)} %, nos extremos ${fmt(100 * alto / x.length, 0)} %`, ok, '(a) foto'); }
{ const medF = r => { const x = traco(tVib(1, r, 99), {}, r >= 90 ? 1.5 : 3).slice(Math.round(0.3 * FS)); let c = 0, ult = -1, t0 = 0; for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) { c++; if (ult < 0) t0 = i; ult = i; } return (c - 1) / ((ult - t0) / FS); };
  const f31 = medF(31), f63 = medF(63), f99 = medF(99), I = DD.vibInterno;
  reg('Vibrato', 'RATE 63 em relação ao 31', `${fmt(I(63) / I(31), 3)}× (±3 %)`, `${fmt(f63 / f31, 3)}× (${fmt(f31, 2)} Hz e ${fmt(f63, 2)} Hz)`, Math.abs(f63 / f31 / (I(63) / I(31)) - 1) <= 0.03, '(a) valores internos; Hz são (c)');
  reg('Vibrato', 'RATE 99 em relação ao 31', `${fmt(I(99) / I(31), 3)}× (±3 %)`, `${fmt(f99 / f31, 3)}× (${fmt(f99, 2)} Hz)`, Math.abs(f99 / f31 / (I(99) / I(31)) - 1) <= 0.03, '(a)');
  reg('Vibrato', 'razões internas RATE 0, 31, 63, 99', '1 : 32 : 131 : 671 (±3 %)', [0, 31, 63, 99].map(a => fmt(I(a) / I(0), 1)).join(' : '), [[31, 32], [63, 131], [99, 671]].every(([a, e]) => Math.abs(I(a) / I(0) / e - 1) <= 0.03), '(a)'); }
{ const x = traco(tVib(1, 63, 0), {}, 1); reg('Vibrato', 'DEPTH 0: o vibrato desliga', 'funcional', `maior desvio ${fmt(Math.max(...x.map(Math.abs)), 3)} cents`, Math.max(...x.map(Math.abs)) === 0, '(a)'); }
{ const x = traco(tVib(1, 63, 99, 63), {}, 1.4), i0 = x.findIndex(v => v !== 0), esp = DD.vibAtraso(63), md = Math.max(...x.map(Math.abs));
  reg('Vibrato', 'DELAY 63 e DEPTH 99', 'valores absolutos são aproximação; registrar', `começa em ${fmt(i0 / FS, 2)} s (modelo ${fmt(esp, 2)} s); pico ${fmt(md, 0)} cents`, true, '(c)'); }
{ const tp = (n2) => { const m = novo(Motor, { solo: 1, portOn: 1, portTime: 50 }, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60 }); const L = new Float32Array(1); for (let i = 0; i < 2000; i++) m.process(L, L, 1);
      m.msg({ t: 'on', n: 60 + n2 }); let n = 0; while (m.inst[0].port !== 0 && n < 5e5) { m.process(L, L, 1); n++; } return n / FS; };
  const a = tp(7), b = tp(12), t = DD.portSeg(50);
  reg('Portamento', 'tempo igual para a quinta e para a oitava', '±5 %', `${fmt(a, 3)} s e ${fmt(b, 3)} s`, Math.abs(a - b) <= 0.05 * b, '(a)');
  reg('Portamento', 'TIME 50: valor absoluto', 'aproximação; registrar', `${fmt(b, 3)} s (modelo ${fmt(t, 3)} s)`, true, '(c)');
  const out = (nn) => { const m = novo(Motor, { solo: 1, portOn: 0 }, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60 }); m.msg({ t: 'on', n: nn }); return m.inst.length; };
  reg('Portamento', 'PORTAMENTO desligado: segunda nota sem deslize', 'funcional', `instâncias: ${out(67)}`, out(67) === 1, '(a)'); }
{ const t = tom({ lineSel: 3, ring: 1, det: { s: 1, o: 0, n: 7, f: 0 }, lines: [{ w: [1, 0], dcw: E([[99, 0], [50, 0]], 0, 1), dca: E([[99, 99], [50, 0]], 0, 1) }, { w: [1, 0], dcw: E([[99, 0], [50, 0]], 0, 1), dca: E([[99, 99], [50, 0]], 0, 1) }] });
  const [, L] = toca(t, {}, [60]), mag = espectro(L, Math.round(0.3 * FS), N), f1 = fNota(60), f2 = f1 * Math.pow(2, 7 / 12), b = f => dB(harm(mag, f, 1) * 1 + 0 * f);
  const hz = f => { const i = Math.round(f / (FS / N)); let m = 0; for (let j = i - 3; j <= i + 3; j++) m = Math.max(m, mag[j]); return dB(m); };
  const dif = hz(f2 - f1), som = hz(f1 + f2), so2 = hz(f2);
  reg('Modulação', 'RING (1+2'+"'"+'): somas e diferenças das duas linhas', 'picos em f2−f1 e f1+f2; f2 sozinha ausente', `f2−f1 ${fmt(dif, 1)} dB, f1+f2 ${fmt(som, 1)} dB, f2 ${fmt(so2, 1)} dB`, dif - so2 > 25 && som - so2 > 25, '(a) manual; (b) produto do chip; seco/modulado (c)'); }
{ const t = tom({ lineSel: 3, noise: 1, lines: [mudo, { w: [1, 0], dcw: E([[99, 0], [50, 0]], 0, 1), dca: E([[99, 99], [50, 0]], 0, 1) }] }), m = novo(Motor, {}, t); m.msg({ t: 'on', n: 60 }); const L = new Float32Array(1); const vb = m.inst[0].voz[1], vistos = new Set(); let mudancasFora = 0, ant = 0, ult = -1;
  for (let i = 0; i < 20000; i++) { m.process(L, L, 1); vistos.add(vb.pm); if (vb.pm !== ant) { if (ult >= 0 && (m.cnt - 1) % 8 !== ult % 8) mudancasFora++; ult = m.cnt - 1; ant = vb.pm; } }
  reg('Modulação', 'NOISE: a afinação da linha 2'+"'"+' salta entre f e f × 2^(32/12), sorteio a cada 8 amostras', 'valores {0, 32 semitons}; trocas só a cada 8 amostras', `valores: ${[...vistos].sort((a, b) => a - b).join(', ')}; trocas fora da grade: ${mudancasFora}`, vistos.size === 2 && vistos.has(0) && vistos.has(32 * 512) && mudancasFora === 0, '(b) MAME; gerador aleatório (c)'); }
{ const a = tom({ lineSel: 3, ring: 1, noise: 1 }), b = tom({ lineSel: 0, ring: 1, noise: 1 });
  reg('Modulação', 'RING e NOISE: excludentes entre si; inativos com uma linha', 'funcional', `duas linhas: ring ${a.ring}, noise ${a.noise}; uma linha: ring ${b.ring}, noise ${b.noise}`, a.ring + a.noise === 1 && b.ring + b.noise === 0, '(a)'); }
{ const f = (k, n) => { const [m] = toca(fixo([1, 0], 50, 99, { lines: [{ w: [1, 0], dcw: E([[99, 50], [50, 0]], 0, 1), dca: E([[99, 99], [50, 0]], 0, 1), kfW: k }] }), {}, [n], 0.15); return m.vozes.find(v => v.act).dcwUsado; };
  const a0 = f(0, 48), b0 = f(0, 72), a9 = f(9, 48), b9 = f(9, 72);
  reg('Modulação', 'DCW KEY FOLLOW 0 e 9 (DCW efetivo nas notas 48 e 72)', '0 = sem efeito; 9 = agudos mais senoidais', `0: ${a0} e ${b0}; 9: ${a9} e ${b9}`, a0 === b0 && b9 < a9 && b9 < b0, '(a); curva (c)'); }
{ const f = (k, n) => { const m = novo(Motor, {}, tom({ lineSel: 0, lines: [{ w: [1, 0], dca: E([[60, 99], [50, 0]], 0, 1), kfA: k }] })); m.msg({ t: 'on', n }); return m.vozes.find(v => v.act).dca.rate; };
  const a0 = f(0, 48), b0 = f(0, 72), a9 = f(9, 48), b9 = f(9, 72);
  reg('Modulação', 'DCA KEY FOLLOW 0 e 9 (velocidade do envelope nas notas 48 e 72)', '0 = sem efeito; 9 = envelope mais curto nos agudos', `0: ${a0} e ${b0}; 9: ${a9} e ${b9}`, a0 === b0 && b9 > a9 && b9 > b0, '(a); curva (c)'); }

/* ====================================================== 6. Polifonia (11.6) */
const ativas = m => m.vozes.filter(v => v.act).length;
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99)); for (let n = 48; n < 57; n++) { m.msg({ t: 'on', n }); } const ns = m.inst.map(i => i.n);
  reg('Polifonia', 'LINE SELECT 1: 9 notas', '8 vozes; a 9ª rouba a mais antiga', `${ativas(m)} vozes; sobrou a nota 48? ${ns.includes(48)}; a 57? ${ns.includes(56)}`, ativas(m) === 8 && !ns.includes(48) && ns.includes(56), '(a) manual; rodízio (a) ROM'); }
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99, { lineSel: 2 })); for (let n = 48; n < 53; n++) m.msg({ t: 'on', n }); const ns = m.inst.map(i => i.n);
  reg('Polifonia', "LINE SELECT 1+1': 5 notas", '4 notas (8 vozes); a 5ª rouba', `${m.inst.length} notas, ${ativas(m)} vozes; primeira nota ainda soa? ${ns.includes(48)}`, m.inst.length === 4 && ativas(m) === 8 && !ns.includes(48), '(a)'); }
{ const m = novo(Motor, { solo: 1 }, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60 }); m.msg({ t: 'on', n: 64 }); m.msg({ t: 'on', n: 62 });
  reg('Polifonia', 'SOLO: 3 teclas', '1 nota, a última tem prioridade', `${m.inst.length} nota(s), nota ${m.inst[0].n}`, m.inst.length === 1 && m.inst[0].n === 62, '(a)'); }
{ const m = novo(Motor, { mix: 1 }, fixo([1, 0], 0, 99), fixo([4, 0], 0, 99)); m.msg({ t: 'on', n: 60 });
  reg('Polifonia', 'TONE MIX: 1 tecla', '1 nota, dois timbres', `${m.inst.length} nota, ${ativas(m)} vozes`, m.inst.length === 1 && ativas(m) === 2, '(a)'); }
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99)); const L = new Float32Array(64); m.msg({ t: 'on', n: 60 }); m.process(L, L, 64); m.msg({ t: 'on', n: 64 }); const v = m.inst[1].voz[0];
  reg('Polifonia', 'disparo: a fase zera no início de cada nota', 'posição 0 no primeiro instante', `${v.pos}`, v.pos === 0, '(b) MAME: o CZ-101 zera o contador de fase'); }

/* ====================================================== 7. Calibração e custo */
for (const n of [36, 48, 60, 72, 84]) { const m = novo(Motor, { vol: DD.PADRAO.vol }, DD.PRESETS[0]); m.msg({ t: 'on', n }); const v = dB(pico(render(m, 1.2), Math.round(0.2 * FS)));
  reg('Calibração', `painel inicial (BRASS ENS.1), nota ${n}: pico`, '−12 a −3 dBFS', fmt(v, 1) + ' dBFS', v >= -12 && v <= -3, '(c)'); }
{ const m = novo(Motor, { vol: 1 }, null); m.msg({ t: 'tom', tom: tom({ lineSel: 3, ring: 1, det: { s: 1, o: 3, n: 11, f: 60 }, lines: [{ w: [6, 1], dcw: E([[99, 99], [50, 0]], 0, 1), dca: E([[99, 99], [50, 0]], 0, 1) }] }) });
  for (let n = 36; n < 44; n++) m.msg({ t: 'on', n }); const p = pico(render(m, 2));
  reg('Calibração', 'pior caso: 8 vozes, tudo no máximo, volume 1', 'pico finito e ≤ 1', fmt(p, 3), isFinite(p) && p <= 1, '(c)'); }
{ const [, L] = toca(DD.INIT, { vol: 1 }, [], 1); reg('Calibração', 'sem tecla', 'silêncio (< −80 dBFS)', fmt(dB(pico(L)), 1) + ' dBFS', dB(pico(L)) < -80, ''); }
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60 }); render(m, 0.5); m.msg({ t: 'off', n: 60 }); const L = render(m, 3); const v = dB(pico(L, Math.round(2 * FS)));
  reg('Calibração', 'depois de soltar (envelope termina no END)', 'silêncio (< −80 dBFS)', fmt(v, 1) + ' dBFS', v < -80, ''); }
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60, at: 0.25 }); const L = render(m, 0.6); let i0 = L.findIndex(x => Math.abs(x) > 0.001); const t = i0 / FS;
  reg('Calibração', 'evento agendado: começo do som', '0,250 s (até +3 ms)', fmt(t, 4) + ' s', t >= 0.25 && t <= 0.253, ''); }
{ const m = novo(Motor, {}, fixo([1, 0], 0, 99)); m.msg({ t: 'on', n: 60 }); m.msg({ t: 'on', n: 64, seq: true, at: 0.1 }); m.msg({ t: 'on', n: 67, seq: true, at: 0.4 }); m.msg({ t: 'seqpara', at: 0.2 }); render(m, 0.8);
  reg('Calibração', '"seqpara" solta só as notas do sequenciador e cancela as agendadas', 'a nota tocada à mão continua; a do sequenciador solta; a agendada some', `notas ativas: ${m.inst.map(i => i.n).join(', ') || 'nenhuma'}`, m.inst.length === 1 && m.inst[0].n === 60, ''); }
{ const m = novo(Motor, { vol: 1 }, DD.PRESETS[0]); for (const n of [48, 52, 55, 60, 64, 67, 72, 76]) m.msg({ t: 'on', n }); const t0 = performance.now(); render(m, 10); const ms = performance.now() - t0;
  reg('Custo', '10 s de áudio, 8 vozes (neste computador, Node)', 'bem abaixo de 100 % do tempo real', fmt(ms / 100, 1) + ' % do tempo real', ms < 5000, ''); }
{ const n = DD.PRESETS.length; reg('Timbres', 'timbres de fábrica recriados', '16, com os nomes do LCD', `${n}: ${DD.PRESETS.map(p => p.nome).join(', ')}`, n === 16, '(a) nomes da ROM; parâmetros (c)'); }
{ const sem = DD.PRESETS.map((t, i) => { const m = novo(Motor, { vol: 1 }, t); m.msg({ t: 'on', n: 60 }); const p = pico(render(m, 1.5)); return [i + 1, dB(p)]; }).filter(([, v]) => !(v > -40));
  reg('Timbres', 'todos os 16 timbres soam (pico acima de −40 dBFS na nota 60)', 'sem timbre mudo', sem.length ? sem.map(([i, v]) => `${i}: ${fmt(v, 1)}`).join('; ') : 'todos soam', sem.length === 0, '(c)'); }

{ const r = DD.PRESETS.map((t, i) => { const m = novo(Motor, { vol: DD.PADRAO.vol }, t); m.msg({ t: 'on', n: 60 }); return [i + 1, dB(pico(render(m, 3)))]; });
  reg('Timbres', 'pico de cada timbre na nota 60, volume padrão', 'entre −20 e −3 dBFS', r.map(([i, v]) => i + ': ' + fmt(v, 1)).join(', '), r.every(([, v]) => v >= -20 && v <= -3), '(c)'); }

console.log('| Grupo | Medição | Esperado (pesquisa) | Medido | | Fonte |\n|---|---|---|---|---|---|');
for (const l of linhas) console.log('| ' + l.join(' | ') + ' |');
console.log(`\n${linhas.length} medições, ${falhas} fora da tolerância.`);
process.exit(falhas ? 1 : 0);
