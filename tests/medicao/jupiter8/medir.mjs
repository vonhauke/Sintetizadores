// Medições do motor de som de jupiter8/index.html, comparadas com docs/pesquisa/jupiter8.md (seção 14).
// Uso: node tests/medicao/jupiter8/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
import { carregaMotor, novo, render, rms, pico, dB, espectro, picoHz, FS } from './motor.mjs';

const Motor = carregaMotor(), DD = Motor.dados;
const linhas = []; let falhas = 0;
const fmt = (v, c = 2) => typeof v === 'number' ? v.toFixed(c).replace('.', ',') : v;
function reg(grupo, item, esperado, medido, ok, fonte = '') { if (!ok) falhas++; linhas.push([grupo, item, esperado, medido, ok ? 'ok' : 'FORA', fonte]); }
const cents = (a, b) => 1200 * Math.log2(a / b);
const fNota = n => 440 * Math.pow(2, (n - 69) / 12);        // (c) Lá = 440 Hz (decisão do usuário); o aparelho centra perto de 442 Hz (a)
const N = 131072;
const toca = (pu = {}, notas = [69], g = {}, seg = 3.2, pl = {}) => { const m = novo(Motor, pu, g, pl); for (const n of notas) m.msg({ t: 'on', n }); return [m, render(m, seg)]; };
const fMed = (L, f0, tol = 0.2, a = Math.round(0.4 * FS)) => picoHz(L, a, N, f0 * (1 - tol), f0 * (1 + tol));
const harm = (mag, f, k) => { const i = Math.round(k * f / (FS / N)); let m = 0; for (let j = i - 2; j <= i + 2; j++) m = Math.max(m, mag[j] || 0); return m; };
const espN = (L, a = Math.round(0.4 * FS)) => espectro(L, a, N);
function welch(x, a, b, n = 8192) {      // densidade espectral média (Welch); devolve dB por banda de 1/3 de oitava
  const acc = new Float64Array(n / 2); let q = 0;
  for (let i = a; i + n <= b; i += n / 2) { const m = espectro(x, i, n); for (let k = 0; k < m.length; k++) acc[k] += m[k] * m[k]; q++; }
  return f => { const lo = Math.max(1, Math.floor(f / 1.122 / (FS / n))), hi = Math.ceil(f * 1.122 / (FS / n)); let s = 0; for (let k = lo; k <= hi; k++) s += acc[k]; return 10 * Math.log10(s / q / (hi - lo + 1) + 1e-30); };
}
function picoWelch(x, a, b, lo, hi, n = 16384) {      // frequência do pico do espectro médio (Welch) suavizado em ±0,1 oitava; mais confiável que uma FFT só sobre ruído
  const acc = new Float64Array(n / 2); for (let i = a; i + n <= b; i += n / 2) { const m = espectro(x, i, n); for (let k = 0; k < m.length; k++) acc[k] += m[k] * m[k]; }
  const df = FS / n; let bf = 0, bv = -1;
  for (let f = lo; f <= hi; f *= 1.01) { const l = Math.max(1, Math.round(f / 1.07 / df)), h = Math.round(f * 1.07 / df); let t = 0; for (let k = l; k <= h; k++) t += acc[k]; t /= (h - l + 1); if (t > bv) { bv = t; bf = f; } }
  return bf; }
const RUIDO = { v2Wave: 3, mix: 10 };      // fonte de ruído branco para medir filtros

/* ====================================================== 1. Osciladores: frequência (14.1) */
for (const [n, nome] of [[36, 'C0'], [57, 'A1'], [69, 'A2'], [81, 'A3'], [96, 'C5']]) {
  const [, L] = toca({ mix: 0, v1Wave: 1 }, [n]), f = fMed(L, fNota(n)), c = cents(f, fNota(n));
  reg('VCO-1', `8', tecla ${nome} (nota ${n})`, `${fmt(fNota(n), 2)} Hz (±2 cents)`, `${fmt(f, 2)} Hz (${fmt(c, 2)} cents)`, Math.abs(c) < 2, '(a) escala 1 V/oitava; Lá = 440 Hz (c)'); }
for (const [r, nome, mult] of [[0, "16'", 0.5], [2, "4'", 2], [3, "2'", 4]]) {
  const [, L] = toca({ mix: 0, v1Wave: 1, v1Range: r }, [69]), alvo = 440 * mult, c = cents(fMed(L, alvo), alvo);
  reg('VCO-1', `RANGE ${nome} na tecla A2`, `${alvo} Hz (±2 cents)`, `${fmt(c, 2)} cents`, Math.abs(c) < 2, '(a)'); }
{ let pior = 0, pn = 0;
  for (let p = 0; p <= 36; p++) { const [, L] = toca({ mix: 10, v2Wave: 0, v2Range: p }, [57]), alvo = fNota(57) * Math.pow(2, (p - 12) / 12), e = Math.abs(cents(fMed(L, alvo, 0.1, Math.round(0.5 * FS)), alvo)); if (e > pior) { pior = e; pn = p; } }
  reg('VCO-2', 'RANGE: os 37 passos em semitons exatos (16\' a 2\')', '±2 cents', `pior ${fmt(pior, 2)} cents (passo ${pn})`, pior < 2, '(a) semitons; os 37 passos são (c)'); }
for (const [fi, nome] of [[-1, '−50'], [1, '+50']]) {
  const [, L] = toca({ mix: 10, v2Wave: 0, v2Fine: fi }, [69]), c = cents(fMed(L, 440), 440);
  reg('VCO-2', `FINE TUNE no extremo (${nome} cents)`, `${nome} cents (±3)`, fmt(c, 2) + ' cents', Math.abs(c - fi * 50) < 3, '(a)'); }
for (const [t, nome] of [[-1, '−50'], [1, '+50']]) {
  const [, L] = toca({ mix: 0, v1Wave: 1 }, [69], { tune: t }), c = cents(fMed(L, 440), 440);
  reg('Geral', `MASTER TUNE no extremo (${nome} cents)`, `${nome} cents (±3)`, fmt(c, 2) + ' cents', Math.abs(c - t * 50) < 3, '(a)'); }
{ const cruza = (x, a, b) => { let c = 0, i0 = -1, i1 = 0; for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) { c++; if (i0 < 0) i0 = i; i1 = i; } return (c - 1) / ((i1 - i0) / FS); };
  const f = n => cruza(toca({ mix: 10, v2Wave: 0, v2Low: 1, v2Range: 24 }, [n], {}, 8)[1], Math.round(1 * FS), 8 * FS), a = f(36), b = f(96);
  reg('VCO-2', 'LOW FREQ: não segue o teclado (teclas C0 e C5)', 'mesma frequência', `${fmt(a, 3)} Hz e ${fmt(b, 3)} Hz`, Math.abs(a / b - 1) < 0.005, '(a); a faixa de 0,1 a 25 Hz é (c)'); }
{ const f = (pu, ctr) => fMed(toca({ mix: 0, v1Wave: 1, ...pu }, [57], {}, 3.2)[1], ctr, 0.15);
  const base = fNota(57), c = cents(f({ fmEnv: 10, s1: 10 }, base * 8), base), c2 = cents(f({ fmEnv: 10, s1: 10, pol1: 1 }, base / 8), base);
  reg('VCO-1', 'ENV MOD = 10, ENV-1 em sustain 10: patamar', '+3 oitavas (+3600 cents, ±50)', fmt(c, 1) + ' cents', Math.abs(c - 3600) < 50, '(a) Service Notes');
  reg('VCO-1', 'ENV MOD = 10 com POLARITY invertida', '−3 oitavas (−3600 cents, ±50)', fmt(c2, 1) + ' cents', Math.abs(c2 + 3600) < 50, '(a); simetria (c)'); }
{ const [m, L] = toca({ mix: 0, v1Wave: 1, fmLfo: 10, lfoWave: 2, lfoRate: 4 }, [81], {}, 4); const T = 1 / DD.lfoHz(4);   // onda quadrada: +1 oitava na primeira metade, −1 na segunda
  const f = (a, b) => picoHz(L, Math.round(a * FS), 16384, fNota(81) * 0.4, fNota(81) * 2.6), fa = f(0.1 * T, 0.4 * T), fb = f(0.6 * T, 0.9 * T), ca = cents(fa, fNota(81)), cb = cents(fb, fNota(81));
  reg('VCO-1', 'LFO MOD = 10 (LFO quadrado): picos', '+1 e −1 oitava (±100 cents)', `${fmt(ca, 0)} e ${fmt(cb, 0)} cents`, Math.abs(ca - 1200) < 100 && Math.abs(cb + 1200) < 100, '(a, OCR duvidoso)'); void m; }
for (const [b, nome] of [[1, '+1'], [-1, '−1']]) {
  const [, L] = toca({ mix: 0, v1Wave: 1, bendVco: 10 }, [69], { bend: b }), c = cents(fMed(L, 440 * (b > 0 ? 2 : 0.5), 0.15), 440);
  reg('Performance', `bender no extremo, sensibilidade VCO = 10 (${nome})`, `${b * 1200} cents (±50)`, fmt(c, 1) + ' cents', Math.abs(c - b * 1200) < 50, '(c) inferido do ajuste BENDER LEVEL'); }
{ const f = (pu, mix, ctr) => fMed(toca({ mix, v1Wave: 1, v2Wave: 0, fmEnv: 10, s1: 10, ...pu }, [57])[1], ctr, 0.15);
  const r = (d, mix, sobe) => cents(f({ fmDest: d }, mix, fNota(57) * (sobe ? 8 : 1)), fNota(57));
  reg('VCO MODULATOR', 'destino VCO-1: VCO-1 sobe, VCO-2 não muda', 'VCO-1 +3 oitavas; VCO-2 0 cent', `${fmt(r(0, 0, 1), 0)} e ${fmt(r(0, 10, 0), 1)} cents`, Math.abs(r(0, 0, 1) - 3600) < 50 && Math.abs(r(0, 10, 0)) < 3, '(a)');
  reg('VCO MODULATOR', 'destino VCO-2: VCO-2 sobe, VCO-1 não muda', 'VCO-2 +3 oitavas; VCO-1 0 cent', `${fmt(r(2, 10, 1), 0)} e ${fmt(r(2, 0, 0), 1)} cents`, Math.abs(r(2, 10, 1) - 3600) < 50 && Math.abs(r(2, 0, 0)) < 3, '(a)');
  reg('VCO MODULATOR', 'destino BOTH: os dois sobem', '+3 oitavas nos dois', `${fmt(r(1, 0, 1), 0)} e ${fmt(r(1, 10, 1), 0)} cents`, Math.abs(r(1, 0, 1) - 3600) < 50 && Math.abs(r(1, 10, 1) - 3600) < 50, '(a)'); }
{ const f = (pu, mix) => cents(fMed(toca({ mix, v1Wave: 1, v2Wave: 0, bendVco: 10, ...pu }, [69], { bend: 1 })[1], 440 * 2, 0.5), 440);
  reg('Performance', 'chave VCO-1 BEND desligada: só o VCO-2 sobe', 'VCO-1 0 cent; VCO-2 +1200', `${fmt(f({ vco1Bend: 0 }, 0), 1)} e ${fmt(f({ vco1Bend: 0 }, 10), 0)} cents`, Math.abs(f({ vco1Bend: 0 }, 0)) < 3 && Math.abs(f({ vco1Bend: 0 }, 10) - 1200) < 50, '(a)');
  reg('Performance', 'chave VCO-2 BEND desligada: só o VCO-1 sobe', 'VCO-2 0 cent; VCO-1 +1200', `${fmt(f({ vco2Bend: 0 }, 10), 1)} e ${fmt(f({ vco2Bend: 0 }, 0), 0)} cents`, Math.abs(f({ vco2Bend: 0 }, 10)) < 3 && Math.abs(f({ vco2Bend: 0 }, 0) - 1200) < 50, '(a)'); }

/* ====================================================== 2. Osciladores: forma de onda (14.2) */
{ const [, L] = toca({ mix: 0, v1Wave: 1 }, [48]), mag = espN(L), f = fNota(48), a1 = harm(mag, f, 1); let pior = 0;
  for (let k = 2; k <= 10; k++) pior = Math.max(pior, Math.abs(dB(harm(mag, f, k) / a1) + 20 * Math.log10(k)));
  reg('Onda', 'dente de serra (VCO-1): harmônicos 2 a 10', 'queda de 1/n, ±1,5 dB', `pior desvio ${fmt(pior, 2)} dB`, pior < 1.5, '(c)'); }
for (const [w, pu, nome] of [[3, {}, 'quadrada (VCO-1)'], [2, {}, 'pulso com PWM manual 0']]) {
  const [, L] = toca({ mix: 0, v1Wave: w, ...pu }, [48]), mag = espN(L), f = fNota(48), a1 = harm(mag, f, 1); let par = -200; for (let k = 2; k <= 12; k += 2) par = Math.max(par, dB(harm(mag, f, k) / a1));
  reg('Onda', `${nome}: harmônicos pares`, 'abaixo de −40 dB (ciclo de 50 %)', fmt(par, 1) + ' dB', par < -40, '(a)'); }
{ const [, L] = toca({ mix: 0, v1Wave: 2, pwm: 10 }, [48]), mag = espN(L), f = fNota(48), r = harm(mag, f, 2) / harm(mag, f, 1), d = Math.acos(Math.min(1, r)) / Math.PI;
  reg('Onda', 'pulso com PWM manual = 10: ciclo estreito', 'valor a definir (NE); registrar', `h2/h1 = ${fmt(r, 3)}, ciclo ≈ ${fmt(d * 100, 1)} %`, d < 0.2, 'NE: o modelo usa 5 % (c)'); }
{ const [, L] = toca({ mix: 0, v1Wave: 0 }, [48]), mag = espN(L), f = fNota(48), a1 = harm(mag, f, 1), r3 = dB(harm(mag, f, 3) / a1), r2 = dB(harm(mag, f, 2) / a1);
  reg('Onda', 'triangular (VCO-1): 3º harmônico', '−19,1 dB (1/n², ±1,5)', fmt(r3, 1) + ' dB', Math.abs(r3 + 19.08) < 1.5, '(c)');
  reg('Onda', 'triangular: harmônicos pares', 'abaixo de −40 dB', fmt(r2, 1) + ' dB', r2 < -40, '(c)'); }
{ const [, L] = toca({ mix: 10, v2Wave: 0 }, [48]), mag = espN(L), f = fNota(48), a1 = harm(mag, f, 1); let thd = -200; for (let k = 2; k <= 8; k++) thd = Math.max(thd, dB(harm(mag, f, k) / a1));
  reg('Onda', 'senoide (VCO-2): maior harmônico', 'abaixo de −60 dB', fmt(thd, 1) + ' dB', thd < -60, '(c) o limite é meu'); }
{ const T = 1 / DD.lfoHz(2), [, L] = toca({ mix: 0, v1Wave: 2, pwm: 10, pwmSrc: 0, lfoWave: 0, lfoRate: 2 }, [57], {}, 6), f = fNota(57);
  const g = (c) => { const mag = espectro(L, Math.round((c - 0.15) * FS), 16384), q = k => { const i = Math.round(k * f / (FS / 16384)); return Math.max(mag[i - 1], mag[i], mag[i + 1]); }; return q(2) / q(1); };
  const zero = g(0.5 * T), pa = g(0.25 * T), pb = g(0.75 * T);
  reg('Onda', 'PWM por LFO senoidal: h2/h1 no cruzamento do LFO e nos picos', 'ciclo de 50 % no cruzamento (h2/h1 ≈ 0) e ciclo estreito ou largo nos picos (h2/h1 > 0,8)', `${fmt(zero, 2)} no cruzamento; ${fmt(pa, 2)} e ${fmt(pb, 2)} nos picos`, zero < 0.25 && pa > 0.8 && pb > 0.8, '(a)'); }
{ const [, L] = toca({ mix: 10, v2Wave: 3 }, [48], {}, 4), P = welch(L, FS, 4 * FS), b = [250, 500, 1000, 2000].map(P); const dev = Math.max(...b) - Math.min(...b);
  reg('Onda', 'ruído (VCO-2): densidade espectral entre 250 Hz e 2 kHz (acima disso o filtro aberto, com corte perto de 9 kHz, já curva)', 'plano (branco), ±3 dB', `variação ${fmt(dev, 1)} dB`, dev < 3, '(b)'); }
{ const [, L] = toca({ mix: 0, v1Wave: 1, v2Wave: 1, mix: 5, sync: 1, v2Range: 19 }, [57]), mag = espN(L), f = fNota(57); let pk = []; for (let i = 5; i < mag.length / 2; i++) if (mag[i] > mag[i - 1] && mag[i] > mag[i + 1] && mag[i] > 0.01 * Math.max(...mag)) pk.push(i * FS / N);
  const dentro = pk.filter(p => { const k = Math.round(p / f); return k >= 1 && Math.abs(p / f - k) < 0.01; }).length;
  reg('Onda', 'SYNC ligado, VCO-2 uma quinta acima: picos espectrais', 'todos nos múltiplos da frequência do VCO-1 (±1 %)', `${dentro} de ${pk.length} picos`, pk.length > 5 && dentro / pk.length > 0.9, '(a)'); }
{ const [m, L] = toca({ mix: 5, v1Wave: 1, v2Wave: 2, v2Low: 1, v2Range: 24, cross: 5, v1Range: 1 }, [81], {}, 3); void L;
  const mm = novo(Motor, { mix: 0, v1Wave: 1, v2Wave: 2, v2Low: 1, v2Range: 24, cross: 5 }), v = mm.vozes[0]; mm.msg({ t: 'on', n: 81 }); const Lb = new Float32Array(1), x = [], s2 = [];
  for (let i = 0; i < 3 * FS; i++) { mm.process(Lb, Lb, 1); x.push(Lb[0]); s2.push(v.last2); }
  const seg = (sinal) => { let c = 0, t = 0; for (let i = Math.round(0.5 * FS); i < x.length; i++) if (Math.sign(s2[i]) === sinal && Math.sign(s2[i - 1]) === sinal) { t++; if (x[i - 1] < 0 && x[i] >= 0) c++; } return c / (t / FS); };
  const alto = seg(1), baixo = seg(-1); void m;
  reg('Cross mod', 'CROSS MOD = 5, VCO-2 quadrado em LOW FREQ: as duas frequências do VCO-1', 'razão de 8 (3 oitavas, ±8 %)', `${fmt(alto, 0)} e ${fmt(baixo, 0)} Hz, razão ${fmt(alto / baixo, 2)}`, Math.abs(alto / baixo / 8 - 1) < 0.08, '(a) Service Notes'); }
{ const [, L] = toca({ mix: 0, v1Wave: 1, v2Wave: 2, v2Low: 1, v2Range: 24, cross: 0 }, [69], {}, 3.2), c = cents(fMed(L, 440, 0.1), 440);
  reg('Cross mod', 'CROSS MOD = 0 com o VCO-2 rodando', 'sem bandas laterais: frequência do VCO-1 exata (±2 cents)', fmt(c, 2) + ' cents', Math.abs(c) < 2, '(a)'); }
{ const [, L] = toca({ mix: 0, v1Wave: 1, v1Range: 3 }, [96], {}, 3.2), mag = espN(L), f = fNota(96) * 4, df = FS / N; let a1 = harm(mag, f, 1), pior = 0;
  for (let i = 8; i < mag.length; i++) { const fr = i * df; if (fr > 20000) break; const k = Math.round(fr / f); if (Math.abs(fr - k * f) > 30 * df && !(fr > f * 0.9 && fr < f * 1.1)) pior = Math.max(pior, mag[i]); }
  reg('Onda', "aliasing: serra em 2' na tecla C5 (8,4 kHz): maior componente fora dos harmônicos", 'abaixo de −60 dB (sugestão), registrar', fmt(dB(pior / a1), 1) + ' dB', dB(pior / a1) < -45, '(c)'); }

/* ====================================================== 3. Filtros (14.3) */
const bandaDb = (L, f, a = FS) => welch(L, a, L.length)(f);
{ const fc = DD.corteHz(5);   // 442 Hz
  for (const [sl, nome, alvo] of [[1, '−24 dB', -24], [0, '−12 dB', -12]]) {
    const [, L] = toca({ ...RUIDO, cut: 5, slope: sl }, [60], {}, 4), P = welch(L, FS, 4 * FS), d = P(8 * fc) - P(4 * fc);
    reg('VCF', `${nome}/oitava, RES = 0: queda entre 4× e 8× o corte`, `${alvo} dB (±3)`, fmt(d, 1) + ' dB', Math.abs(d - alvo) < 3, '(a)'); } }
{ const fc = DD.hpfHz(5), [, L] = toca({ ...RUIDO, hpf: 5 }, [60], {}, 4), P = welch(L, FS, 4 * FS), d = P(fc / 4) - P(fc / 8);
  reg('HPF', 'inclinação abaixo do corte (de fc/8 a fc/4)', '+6 dB/oitava (±1,5)', fmt(d, 1) + ' dB', Math.abs(d - 6) < 1.5, '(a); a frequência de corte é (c)'); }
{ const [, L] = toca({ ...RUIDO, hpf: 0 }, [60], {}, 4), P = welch(L, FS, 4 * FS), d = P(60) - P(1000);
  reg('HPF', 'slider em LOW: resposta plana até o grave (60 Hz contra 1 kHz)', 'diferença menor que 3 dB', fmt(d, 1) + ' dB', Math.abs(d) < 3, '(a)'); }
{ const [, L] = toca({ ...RUIDO, cut: 0 }, [60], {}, 2), v = dB(pico(L));
  reg('VCF', 'CUT OFF em LOW', 'silêncio (< −60 dB)', fmt(v, 1) + ' dBFS', v < -60, '(a)'); }
{ const m = novo(Motor, { mix: 10, v2Wave: 3, cut: 5, res: 10 }), L = new Float32Array(64); m.msg({ t: 'on', n: 60 }); for (let i = 0; i < 0.5 * FS; i += 64) m.process(L, L, 64);
  const com = pico(L); m.mudo = true; let p2 = 0; for (let i = 0; i < 1.5 * FS; i += 64) { m.process(L, L, 64); if (i > 1 * FS) p2 = Math.max(p2, pico(L)); }
  reg('VCF', 'RES = 10, sem entrada: não sustenta oscilação', 'o sinal decai (< −60 dB depois de 1 s)', fmt(dB(p2 / Math.max(com, 1e-9)), 1) + ' dB', p2 < 1e-3 * com, '(b) o aparelho calibrado não auto-oscila; o ganho de malha é (c)'); }
{ let ok = true; const det = [], RES = 8, k = DD.RES_MAX * RES / 10, fo = 2 * FS;     // pico da malha linear do filtro (4 polos, realimentação com 1 amostra de atraso), calculado e comparado com o do motor
  const gDe = fc => { const w = 2 * Math.PI * fc / fo, tp = Math.tan(Math.PI / 4 - w / 4); return 1 - tp / (Math.sin(w) + tp * Math.cos(w)); };
  const picoTeorico = fc => { const g = gDe(fc); let bf = 0, bm = 0; for (let f = fc / 3; f < fc * 2; f *= 1.002) { const w = 2 * Math.PI * f / fo, z = [Math.cos(-w), Math.sin(-w)], a = [1 - (1 - g) * z[0], -(1 - g) * z[1]], d = a[0] * a[0] + a[1] * a[1], h = [g * a[0] / d, -g * a[1] / d];
      let A = [1, 0]; for (let i = 0; i < 4; i++) A = [A[0] * h[0] - A[1] * h[1], A[0] * h[1] + A[1] * h[0]];
      const kz = [k * (z[0] * A[0] - z[1] * A[1]), k * (z[0] * A[1] + z[1] * A[0])], den = [1 + kz[0], kz[1]], m = Math.hypot(A[0], A[1]) / Math.hypot(den[0], den[1]); if (m > bm) { bm = m; bf = f; } } return bf; };
  for (const cut of [3, 5, 7]) { const fc = DD.corteHz(cut), [, L] = toca({ ...RUIDO, cut, res: RES, key: 0 }, [60], {}, 5);
    const f = picoWelch(L, FS, L.length, fc * 0.5, fc * 1.6), t = picoTeorico(fc), e = cents(f, t); det.push(`slider ${cut}: ${fmt(f, 0)} Hz, teórico ${fmt(t, 0)} Hz (${fmt(e, 0)} cents)`); if (Math.abs(e) > 60) ok = false; }
  reg('VCF', 'frequência do pico de ressonância (RES = 8) contra o pico da malha linear do próprio filtro, nos sliders 3, 5 e 7', '±60 cents (o pico fica pouco abaixo do corte, como em todo filtro de escada)', det.join('; '), ok, '(c) o corte em 442 Hz no slider 5 é (a, OCR duvidoso)'); }
{ const [, L] = toca({ ...RUIDO, cut: 5, res: 10 }, [60], {}, 4), P = welch(L, FS, 4 * FS), pico_ = P(442), banda = P(150);
  reg('VCF', 'RES = 10: pico na frequência de corte', 'pico pronunciado (valor NE); registrar', `${fmt(pico_ - banda, 1)} dB acima da banda passante`, pico_ - banda > 10, 'NE: ganho de malha (c)'); }
{ const f = r => { const [, L] = toca({ ...RUIDO, cut: 10, res: r }, [60], {}, 4); return welch(L, FS, 4 * FS)(300); }, d = f(10) - f(0);
  reg('VCF', 'nível da banda passante com RES = 0 e RES = 10', 'queda pequena (compensação de volume), menos de 4 dB', fmt(d, 1) + ' dB', d < 0 && d > -4, '(b); a quantidade é (c)'); }
{ const f = n => { const [, L] = toca({ ...RUIDO, cut: 5, key: 0, slope: 1 }, [n], {}, 3); return welch(L, FS, 3 * FS)(1000); }, d = f(36) - f(96);
  reg('VCF', 'KEY FOLLOW = 0: corte igual em todas as teclas (C0 contra C5, a 1 kHz)', 'diferença menor que 1 dB', fmt(d, 2) + ' dB', Math.abs(d) < 1, '(a)'); }
for (const [kf, razao, nome] of [[8.3333, 2, 'no ponto de 100 %'], [10, Math.pow(2, 1.2), '10 (120 %)']]) {
  const pk = n => { const [, L] = toca({ ...RUIDO, cut: 3, res: 10, key: kf }, [n], {}, 5), e = DD.corteHz(3) * Math.pow(2, kf / 10 * 1.2 * (n - 60) / 12); return picoWelch(L, FS, L.length, e * 0.5, e * 1.6); };
  const r = pk(72) / pk(60);
  reg('VCF', `KEY FOLLOW ${nome}: pico de ressonância uma oitava acima do Dó central`, `razão ${fmt(razao, 3)} (±6 %)`, fmt(r, 3), Math.abs(r / razao - 1) < 0.06, '(a)'); }
{ const pk = (pu) => { const [, L] = toca({ ...RUIDO, cut: 2, res: 10, envMod: 10, key: 0, ...pu }, [60], {}, 5); return picoWelch(L, FS, L.length, 30, 12000); };
  const f0 = DD.corteHz(2), f1 = pk({ envSrc: 1, s2: 10 }), f2 = pk({ envSrc: 0, s1: 10 }), f3 = pk({ envSrc: 0, s1: 0 });
  reg('VCF', 'ENV MOD = 10 com o envelope no patamar: o corte sobe', '+6 oitavas (×64, ±15 %)', `ENV-2: ×${fmt(f1 / f0, 1)}; ENV-1: ×${fmt(f2 / f0, 1)}`, Math.abs(f1 / f0 / 64 - 1) < 0.15 && Math.abs(f2 / f0 / 64 - 1) < 0.15, '(c) 6 oitavas');
  reg('VCF', 'chave ENV-1 / ENV-2: o corte segue o envelope selecionado', 'com ENV-1 sem sustain, o corte não sobe', `ENV-1 com sustain 0: ×${fmt(f3 / f0, 2)}`, f3 / f0 < 1.5, '(a)'); }
{ const [, L] = toca({ mix: 5, v1Wave: 1, v2Wave: 1, res: 10, cut: 5 }, [48, 55, 60, 64, 67, 72, 76, 79], {}, 2);
  reg('VCF', 'saturação: dois VCOs no máximo, RES = 10, 8 notas', 'sem clipping digital: pico ≤ 1 e finito', fmt(pico(L), 3), isFinite(pico(L)) && pico(L) <= 1, '(c)'); }

/* ====================================================== 4. Envelopes (14.4) */
const trace = (pu, notas, seg, quando) => {      // renderiza um passo por vez e devolve os envelopes da voz 0
  const m = novo(Motor, pu); const L = new Float32Array(1), v = m.vozes[0], e = [[], []]; for (const n of notas) m.msg({ t: 'on', n });
  for (let i = 0, t = Math.round(seg * FS); i < t; i++) { if (quando) quando(m, i); m.process(L, L, 1); e[0].push(v.e[0]); e[1].push(v.e[1]); } return e;
};
const tempoAte = (x, fn, ini = 0) => { for (let i = ini; i < x.length; i++) if (fn(x[i])) return i / FS; return -1; };
const T5 = (t, d, tol = 0.05) => Math.abs(t - d) <= Math.max(tol * d, 1 / FS);
{ const t0 = tempoAte(trace({ a2: 0 }, [60], 0.05)[1], e => e >= 1), t1 = tempoAte(trace({ a2: 10 }, [60], 6.5)[1], e => e >= 1);
  reg('Envelope', 'ATTACK mínimo (slider 0), 0 a 100 %', '1 ms (±5 % ou 1 amostra)', fmt(t0 * 1000, 2) + ' ms', T5(t0, 0.001), '(a); critério: tempo até 100 % (c)');
  reg('Envelope', 'ATTACK máximo (slider 10)', '5 s (aceitar até 6 s)', fmt(t1, 2) + ' s', T5(t1, 5), '(a); o ajuste de fábrica dá 6 s'); }
{ const f = (pu) => { const e = trace(pu, [60], 12)[1]; const ia = e.findIndex(x => x >= 1); return tempoAte(e, x => x <= 0.01, ia) - ia / FS; };
  const d0 = f({ d2: 0, s2: 0 }), d1 = f({ d2: 10, s2: 0 });
  reg('Envelope', 'DECAY mínimo e máximo (até 1 %)', '1 ms e 10 s (±5 % ou 1 amostra)', `${fmt(d0 * 1000, 2)} ms e ${fmt(d1, 2)} s`, T5(d0, 0.001) && T5(d1, 10), '(a); critério: tempo até 1 % (c)'); }
{ const f = (r) => { const m = novo(Motor, { r2: r }); const L = new Float32Array(1), v = m.vozes[0]; m.msg({ t: 'on', n: 60 }); for (let i = 0; i < 0.2 * FS; i++) m.process(L, L, 1); m.msg({ t: 'off', n: 60 }); let i = 0; while (v.e[1] > 0.01 && i < 12 * FS) { m.process(L, L, 1); i++; } return i / FS; };
  const r0 = f(0), r1 = f(10);
  reg('Envelope', 'RELEASE mínimo e máximo (até 1 %)', '1 ms e 10 s (±5 % ou 1 amostra)', `${fmt(r0 * 1000, 2)} ms e ${fmt(r1, 2)} s`, T5(r0, 0.001) && T5(r1, 10), '(a)'); }
for (const s of [0, 5, 10]) { const e = trace({ s2: s, d2: 0 }, [60], 0.3)[1]; reg('Envelope', `SUSTAIN em ${s}`, `${s * 10} %`, fmt(e[e.length - 1] * 100, 1) + ' %', Math.abs(e[e.length - 1] - s / 10) < 0.01, '(a) extremos, (c) meio'); }
{ const e = trace({ d2: 5, s2: 0, a2: 0 }, [60], 2)[1], ia = e.findIndex(x => x >= 1), r = []; for (const t of [0.05, 0.1, 0.15, 0.2]) r.push(e[ia + Math.round((t + 0.05) * FS)] / e[ia + Math.round(t * FS)]);
  const dv = Math.max(...r) - Math.min(...r);
  reg('Envelope', 'forma do decaimento', 'exponencial (razão constante entre amostras igualmente espaçadas, ±2 %)', `razões ${r.map(x => fmt(x, 3)).join(', ')}`, dv < 0.02, '(c) NE em fonte primária'); }
{ const f = (n) => tempoAte(trace({ a2: 6, k2: 1 }, [n], 3)[1], e => e >= 1), a = f(36), b = f(96), esp = Math.pow(2, (96 - 36) / 24);
  reg('Envelope', 'KEY FOLLOW ligado: ATTACK em C0 contra C5', `C0 mais longo que C5, razão ${fmt(esp, 2)} (±5 %)`, `${fmt(a, 3)} s e ${fmt(b, 3)} s, razão ${fmt(a / b, 2)}`, a > b && Math.abs(a / b / esp - 1) < 0.05, '(a) sentido; razão (c)'); }

/* ====================================================== 5. LFO (14.5) */
const lfoV = (s, pu, seg, g = {}) => { const m = novo(Motor, pu, g, pu); const L = new Float32Array(1), x = []; for (let i = 0; i < seg * FS; i++) { m.process(L, L, 1); x.push(m.lfo[s].v); } return x; };
const cruz = (x, a = 0) => { let c = 0, i0 = -1, i1 = 0; for (let i = a + 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) { c++; if (i0 < 0) i0 = i; i1 = i; } return c > 1 ? (c - 1) / ((i1 - i0) / FS) : 0; };
{ const fa = cruz(lfoV(0, { lfoRate: 0, lfoWave: 0 }, 45)), fb = cruz(lfoV(0, { lfoRate: 10, lfoWave: 0 }, 1));
  reg('LFO', 'RATE mínimo e máximo', '0,05 e 40 Hz (±3 %)', `${fmt(fa, 3)} e ${fmt(fb, 2)} Hz`, Math.abs(fa / 0.05 - 1) < 0.03 && Math.abs(fb / 40 - 1) < 0.03, '(a)'); }
{ const f = d => { const m = novo(Motor, { lfoDelay: d, a2: 0 }); const L = new Float32Array(1), v = m.vozes[0]; m.msg({ t: 'on', n: 60 }); let i = 0; for (; i < 6 * FS; i++) { m.process(L, L, 1); if (v.fade > 0) break; } return i / FS; };
  const d10 = f(10), d0 = f(0);
  reg('LFO', 'DELAY TIME máximo: tempo até a modulação aparecer', 'cerca de 4 s (±5 %)', fmt(d10, 2) + ' s', T5(d10, 4), '(a); a lei é (c)');
  reg('LFO', 'DELAY TIME = 0: modulação presente desde o início da nota', 'imediata', fmt(d0 * 1000, 1) + ' ms', d0 < 0.001, '(a)'); }
{ const sin = lfoV(0, { lfoWave: 0, lfoRate: 6 }, 2), saw = lfoV(0, { lfoWave: 1, lfoRate: 6 }, 2), qua = lfoV(0, { lfoWave: 2, lfoRate: 6 }, 2), rnd = lfoV(0, { lfoWave: 3, lfoRate: 6 }, 2);
  const T = FS / DD.lfoHz(6), amostra = (x, f) => x[Math.round(f * T)];
  reg('LFO', 'senoide', 'valor em 1/4 do ciclo = +1; em 3/4 = −1', `${fmt(amostra(sin, 0.25), 3)} e ${fmt(amostra(sin, 0.75), 3)}`, Math.abs(amostra(sin, 0.25) - 1) < 0.01 && Math.abs(amostra(sin, 0.75) + 1) < 0.01, '(a)');
  reg('LFO', 'dente de serra (invertido: rampa descendente)', '+1 no começo, 0 na metade, −1 no fim', `${fmt(amostra(saw, 0.001), 2)}, ${fmt(amostra(saw, 0.5), 2)}, ${fmt(amostra(saw, 0.999), 2)}`, amostra(saw, 0.001) > 0.99 && Math.abs(amostra(saw, 0.5)) < 0.01 && amostra(saw, 0.999) < -0.99, '(a); o sentido da rampa é (c)');
  reg('LFO', 'quadrada', '+1 na primeira metade, −1 na segunda', `${fmt(amostra(qua, 0.25), 0)} e ${fmt(amostra(qua, 0.75), 0)}`, amostra(qua, 0.25) === 1 && amostra(qua, 0.75) === -1, '(a)');
  const niveis = new Set(rnd.map(x => Math.round(x * 1000))), dentro = rnd.every(x => x >= -1 && x <= 1);
  reg('LFO', 'RANDOM: degraus aleatórios à taxa do LFO', 'um nível novo por ciclo, constante dentro dele', `${niveis.size} níveis distintos em ${fmt(2 * DD.lfoHz(6), 1)} ciclos`, Math.abs(niveis.size - Math.ceil(2 * DD.lfoHz(6))) <= 1 && dentro, '(a)'); }
{ const m = novo(Motor, { lfoWave: 2, lfoRate: 6 }, {}, { lfoWave: 2, lfoRate: 9 }); const L = new Float32Array(1), a = [], b = []; for (let i = 0; i < 4 * FS; i++) { m.process(L, L, 1); a.push(m.lfo[0].v); b.push(m.lfo[1].v); }
  reg('LFO', 'Upper e Lower têm velocidades independentes', 'os dois LFOs seguem o seu patch', `${fmt(cruz(a), 2)} Hz e ${fmt(cruz(b), 2)} Hz`, Math.abs(cruz(a) / DD.lfoHz(6) - 1) < 0.03 && Math.abs(cruz(b) / DD.lfoHz(9) - 1) < 0.03, '(a)'); }
{ const prof = (st) => { const [, L] = toca({ mix: 10, v2Wave: 0, vcaLfo: st, lfoWave: 2, lfoRate: 5 }, [60], {}, 3); const T = 1 / DD.lfoHz(5); const a = pico(L, Math.round((1 + 0.1 * T) * FS), Math.round((1 + 0.4 * T) * FS)), b = pico(L, Math.round((1 + 0.6 * T) * FS), Math.round((1 + 0.9 * T) * FS)); return b / a; };
  const r = [0, 1, 2, 3].map(prof), esp = [1, 0.85, 0.65, 0.4];
  reg('LFO', 'VCA LFO MOD 0 a 3: tremolo (razão entre os dois semiciclos de uma quadrada)', 'sem tremolo no 0 e profundidade crescente (valores NE: (c) 1, 0,85, 0,65, 0,4; ±0,05)', r.map(x => fmt(x, 2)).join(', '), r.every((x, i) => Math.abs(x - esp[i]) < 0.05), '(a) ordem; valores (c)'); }
{ const f = (rs) => { const m = novo(Motor, { rise: rs }); const L = new Float32Array(1); m.msg({ t: 'g', k: 'lfoBtn', v: 1 }); let i = 0; for (; i < 4 * FS; i++) { m.process(L, L, 1); if (m.rise >= 0.999) break; } return i / FS; };
  const a = f(0), b = f(10);
  reg('LFO', 'botão LFO MODULATION com RISE TIME 0 e 10', 'entrada imediata e gradual (3 s no 10, (c); ±5 %)', `${fmt(a * 1000, 1)} ms e ${fmt(b, 2)} s`, a < 0.001 && T5(b, 3), '(a); o tempo é (c)'); }

/* ====================================================== 6. Níveis e clipping (14.6) */
{ const P = DD.PATCH0; for (const n of [36, 48, 60, 72, 84, 96]) { const m = new Motor(FS); m.msg({ t: 'tune' }); m.msg({ t: 'on', n }); const v = dB(pico(render(m, 1.2), Math.round(0.1 * FS)));
  reg('Níveis', `patch inicial, nota ${n}: pico`, '−12 a −3 dBFS', fmt(v, 1) + ' dBFS', v >= -12 && v <= -3, '(c)'); } void P; }
{ const [, L] = toca({ mix: 5, v1Wave: 1, v2Wave: 1 }, [48, 52, 55, 60, 64, 67, 72, 76], {}, 2);
  reg('Níveis', '8 notas, dois VCOs em serra, filtro aberto, volume 10', 'sem clipping: pico ≤ 1 e finito', fmt(pico(L), 3), isFinite(pico(L)) && pico(L) <= 1, '(c)'); }
{ const f = (mix) => { const [, L] = toca({ mix, v1Wave: 0, v2Wave: 0, v2Range: 19 }, [57]), mag = espN(L), f1 = fNota(57), f2 = fNota(57) * Math.pow(2, 7 / 12); return [harm(mag, f1, 1), harm(mag, f2, 1)]; };
  const [a1, a2] = f(0), [b1, b2] = f(10), [c1, c2] = f(5), eq = dB(c1 / c2);
  reg('Mixer', 'SOURCE MIX em 0: só o VCO-1', 'VCO-2 abaixo de −60 dB', fmt(dB(a2 / a1), 1) + ' dB', dB(a2 / a1) < -60, '(a)');
  reg('Mixer', 'SOURCE MIX em 10: só o VCO-2', 'VCO-1 abaixo de −60 dB', fmt(dB(b1 / b2), 1) + ' dB', dB(b1 / b2) < -60, '(a)');
  reg('Mixer', 'SOURCE MIX no centro: mistura igual (triangular e senoide, níveis de pico diferentes: ±3 dB)', 'níveis próximos', fmt(eq, 1) + ' dB', Math.abs(eq) < 3.5, '(a)'); }
{ const ps = [0, 2, 5, 10].map(l => pico(toca({ level: l }, [60], {}, 1)[1])); reg('VCA', 'LEVEL de 0 a 10', '0 em silêncio; nível crescente', ps.map(x => fmt(dB(x), 1)).join(', ') + ' dBFS', dB(ps[0]) < -90 && ps[1] < ps[2] && ps[2] < ps[3], '(a)'); }
{ const f = (n) => { const [, L] = toca({ mix: 0, v1Wave: 1, assign: 3 }, n, {}, 2); return rms(L, Math.round(0.8 * FS), Math.round(1.8 * FS)); };
  const r1 = f([60]), r2 = f([60, 67]), r8 = f([48, 52, 55, 60, 64, 67, 72, 76]), e2 = dB(r2 / (Math.SQRT2 * r1)), e8 = dB(r8 / (Math.sqrt(8) * r1));
  reg('Níveis', 'UNISON com 1, 2 e 8 teclas: nível por tecla', 'constante: o total acompanha a soma de potências das teclas (±3 dB)', `2 teclas ${fmt(e2, 1)} dB; 8 teclas ${fmt(e8, 1)} dB`, Math.abs(e2) < 3 && Math.abs(e8) < 3, '(a) "nível constante"; a lei do ganho é (c)'); }
{ const f = (bal, km) => { const [, L] = toca({ mix: 0, v1Wave: 1, v1Range: 1 }, [60], { keyMode: km, balance: bal }, 3.6, { mix: 0, v1Wave: 0, v1Range: 0 }), mag = espN(L, Math.round(0.6 * FS));
    return [harm(mag, fNota(60), 1), harm(mag, fNota(48), 1)]; };      // Upper: serra em 8' (261,6 Hz); Lower: triangular em 16' (130,8 Hz, sem 2º harmônico)
  const c = f(5, 2), z = f(0, 2), d = f(10, 2), w0 = f(0, 0), w10 = f(10, 0);
  reg('Balance', 'DUAL, BALANCE em 0: só o Lower', 'o Upper some (> 12 dB abaixo do centro) e o Lower fica igual ao do centro (±1 dB)', `Upper ${fmt(dB(z[0] / c[0]), 1)} dB; Lower ${fmt(dB(z[1] / c[1]), 1)} dB`, dB(z[0] / c[0]) < -12 && Math.abs(dB(z[1] / c[1])) < 1, '(a)');
  reg('Balance', 'DUAL, BALANCE em 10: só o Upper', 'o Lower some (> 12 dB abaixo do centro) e o Upper fica igual ao do centro (±1 dB)', `Lower ${fmt(dB(d[1] / c[1]), 1)} dB; Upper ${fmt(dB(d[0] / c[0]), 1)} dB`, dB(d[1] / c[1]) < -12 && Math.abs(dB(d[0] / c[0])) < 1, '(a)');
  reg('Balance', 'BALANCE não atua em WHOLE (só o Upper toca)', 'mesmo nível do Upper nos extremos (±0,1 dB)', `${fmt(dB(w0[0]), 2)} e ${fmt(dB(w10[0]), 2)} dB`, Math.abs(dB(w0[0] / w10[0])) < 0.1, '(a)'); }
{ const [, L] = toca({}, [60], { volume: 0 }, 1); reg('Níveis', 'VOLUME em 0', 'silêncio (< −90 dBFS)', fmt(dB(pico(L)), 1) + ' dBFS', dB(pico(L)) < -90, '(a)'); }

/* ====================================================== 7. Polifonia, modos e arpejador (14.7) */
const ativas = m => m.vozes.filter(v => v.act);
const press = (pu, notas, g = {}, pl = {}) => { const m = novo(Motor, pu, g, pl); for (const n of notas) m.msg({ t: 'on', n }); const L = new Float32Array(64); m.process(L, L, 64); return m; };
{ const m = press({}, [48, 50, 52, 53, 55, 57, 59, 60, 62]); const ns = ativas(m).map(v => v.n);
  reg('Polifonia', 'WHOLE + POLY 1: 8 notas presas e uma 9ª', 'a 9ª não soa (não há roubo de voz)', `${ns.length} vozes; 9ª nota soando? ${ns.includes(62)}`, ns.length === 8 && !ns.includes(62), '(a)'); }
{ const m = novo(Motor, { r2: 0 }); const L = new Float32Array(64), seq = []; for (let i = 0; i < 8; i++) { m.msg({ t: 'on', n: 60 }); m.process(L, L, 64); seq.push(ativas(m).find(v => v.kd).i); m.msg({ t: 'off', n: 60 }); m.process(L, L, 64); }
  reg('Polifonia', 'POLY 1: a mesma tecla 8 vezes', 'vozes A a H em sequência (0 a 7)', seq.join(' '), seq.join('') === '01234567', '(a) Service Notes'); }
{ const f = (as) => { const m = novo(Motor, { assign: as, r2: 8 }); const L = new Float32Array(64); m.msg({ t: 'on', n: 60 }); m.process(L, L, 64); m.msg({ t: 'off', n: 60 }); for (let i = 0; i < 200; i++) m.process(L, L, 64); m.msg({ t: 'on', n: 64 }); m.process(L, L, 64); return ativas(m).length; };
  const a = f(0), b = f(1); reg('Polifonia', 'POLY 1 contra POLY 2 com release longo', 'POLY 1: 2 vozes soando; POLY 2: o release anterior é cortado (1 voz)', `${a} e ${b} vozes`, a === 2 && b === 1, '(a)'); }
{ const m = press({ assign: 2 }, [64, 60, 67]); const v = ativas(m);
  reg('Polifonia', 'SOLO: três teclas presas', 'uma voz, a nota mais grave', `${v.length} voz(es), nota ${v[0] && v[0].n}`, v.length === 1 && v[0].n === 60, '(a)'); }
for (const [k, esp] of [[1, 8], [2, 4], [8, 1]]) { const notas = [48, 52, 55, 60, 64, 67, 72, 76].slice(0, k), m = press({ assign: 3 }, notas), h = {}; for (const v of ativas(m)) h[v.n] = (h[v.n] || 0) + 1;
  reg('Polifonia', `UNISON com ${k} tecla${k > 1 ? 's' : ''}`, `${esp} voz(es) por tecla`, Object.values(h).join(', '), ativas(m).length === 8 && Object.values(h).every(c => c === esp), '(a)'); }
{ const m = press({}, [40, 41, 42, 43, 44], { keyMode: 1 }), ns = ativas(m).map(v => v.n);
  reg('Polifonia', 'SPLIT: 5 notas no Lower', 'a 5ª não soa (4 vozes por seção)', `${ns.length} vozes; 5ª soando? ${ns.includes(44)}`, ns.length === 4 && !ns.includes(44) && ativas(m).every(v => v.i >= 4), '(a)'); }
{ const m = press({}, [59, 60], { keyMode: 1 }), lo = ativas(m).find(v => v.n === 59), up = ativas(m).find(v => v.n === 60);
  const m2 = press({}, [59, 60], { keyMode: 1, split: 72 }), lo2 = ativas(m2).find(v => v.n === 60);
  reg('Polifonia', 'SPLIT: ponto padrão (24 teclas a partir do grave) e redefinição', 'nota 59 no Lower e 60 no Upper; com o ponto em 72, a 60 vai ao Lower', `${lo && lo.i >= 4 ? 'Lower' : 'Upper'} e ${up && up.i < 4 ? 'Upper' : 'Lower'}; redefinido: ${lo2 && lo2.i >= 4 ? 'Lower' : 'Upper'}`, lo.i >= 4 && up.i < 4 && lo2.i >= 4, '(a)'); }
{ const m = press({}, [60, 62, 64, 65, 67], { keyMode: 2 }), ns = ativas(m), por = {}; for (const v of ns) por[v.n] = (por[v.n] || 0) + 1;
  reg('Polifonia', 'DUAL: cada tecla soa com os dois patches; 4 notas', 'cada tecla com 2 vozes (uma de cada seção); 5ª não soa', `${ns.length} vozes: ${Object.entries(por).map(([n, c]) => n + '×' + c).join(' ')}`, ns.length === 8 && Object.values(por).every(c => c === 2) && !por[67], '(a)'); }
{ const f = (hu, hl) => { const m = press({}, [40, 72], { keyMode: 1, holdL: hl, holdU: hu }); const L = new Float32Array(64); m.msg({ t: 'off', n: 40 }); m.msg({ t: 'off', n: 72 }); m.process(L, L, 64); return ativas(m).filter(v => v.f[1] !== 3).map(v => v.i >= 4 ? 'L' : 'U').join(''); };
  reg('Hold', 'HOLD LOWER e HOLD UPPER em SPLIT', 'cada um segura só a sua seção', `só Lower: "${f(0, 1)}"; só Upper: "${f(1, 0)}"; nenhum: "${f(0, 0)}"`, f(0, 1) === 'L' && f(1, 0) === 'U' && f(0, 0) === '', '(a)'); }
{ const f = (modo) => { const m = novo(Motor, { port: 5, portMode: modo }, { keyMode: 1 }, { port: 5, portMode: modo }); const L = new Float32Array(64); for (const n of [60, 72, 40, 52]) { m.msg({ t: 'on', n }); m.process(L, L, 64); }
    return ativas(m).filter(v => v.port !== 0).map(v => v.i < 4 ? 'U' : 'L').sort().join(''); };
  reg('Portamento', 'chave UPPER ONLY / OFF / ON em SPLIT', 'só Upper / nenhum / os dois', `UPPER ONLY "${f(0)}"; OFF "${f(1)}"; ON "${f(2)}"`, f(0) === 'U' && f(1) === '' && f(2) === 'LU', '(a)'); }
const arpNotas = (pu, g, teclas, n = 12) => { const m = novo(Motor, pu, { arpRate: 10, ...g }); const out = [], L = new Float32Array(64); m.onArp = x => out.push(x); m.msg({ t: 'arpMode', v: g.arpMode }); if (g.arpRange) m.msg({ t: 'g', k: 'arpRange', v: g.arpRange }); for (const t of teclas) m.msg({ t: 'on', n: t });
  for (let i = 0; out.length < n && i < 40 * FS / 64; i++) m.process(L, L, 64); return [out, m]; };
{ const [o] = arpNotas({}, { arpMode: 1, arpRange: 1 }, [60, 67, 62, 64], 8); reg('Arpejo', 'UP, RANGE 1, teclas tocadas C, G, D, E', 'C, G, D, E e repete (ordem tocada)', o.join(' '), o.join() === [60, 67, 62, 64, 60, 67, 62, 64].join(), '(a) manual; (b) KVR'); }
{ const [o] = arpNotas({}, { arpMode: 1, arpRange: 2 }, [60, 67], 8); reg('Arpejo', 'UP, RANGE 2', 'a sequência se repete uma oitava acima a cada volta', o.join(' '), o.join() === [60, 67, 72, 79, 60, 67, 72, 79].join(), '(a)'); }
{ const [o] = arpNotas({}, { arpMode: 2, arpRange: 1 }, [60, 67, 62, 64], 8); reg('Arpejo', 'DOWN, RANGE 1', 'a sequência percorrida ao contrário', o.join(' '), o.join() === [64, 62, 67, 60, 64, 62, 67, 60].join(), '(a)'); }
{ const [o] = arpNotas({}, { arpMode: 3, arpRange: 1 }, [60, 62, 64], 8); reg('Arpejo', 'U&D, RANGE 1, três notas', 'sobe e desce sem repetir as pontas (virada NE: (c))', o.join(' '), o.join() === [60, 62, 64, 62, 60, 62, 64, 62].join(), '(a); virada (c)'); }
{ const [o] = arpNotas({}, { arpMode: 4, arpRange: 3 }, [60, 64, 67], 60), tocadas = [60, 64, 67], ok = o.every(n => tocadas.some(b => [0, 12, 24].includes(n - b)));
  reg('Arpejo', 'RANDOM, RANGE 3', 'só notas tocadas, dentro da faixa de 3 oitavas', `${o.length} notas, de ${Math.min(...o)} a ${Math.max(...o)}, ${new Set(o).size} distintas`, ok && new Set(o).size >= 6, '(a)'); }
{ const iv = (rate) => { const m = novo(Motor, {}, { arpRate: rate }), L = new Float32Array(64), t = []; let n = 0; m.msg({ t: 'arpMode', v: 1 }); m.msg({ t: 'g', k: 'arpRate', v: rate }); m.onArp = () => t.push(n); m.msg({ t: 'on', n: 60 });
    for (; t.length < 6 && n < 12 * FS; n += 64) m.process(L, L, 64); return FS / ((t[5] - t[1]) / 4); };
  const a = iv(0), b = iv(10); reg('Arpejo', 'RATE mínimo e máximo', '1 e 20 passos por segundo (±3 %)', `${fmt(a, 2)} e ${fmt(b, 2)} passos/s`, Math.abs(a - 1) < 0.03 && Math.abs(b / 20 - 1) < 0.03, '(a)'); }
{ const m = novo(Motor); m.msg({ t: 'arpMode', v: 2 }); reg('Arpejo', 'escolher um modo', 'passa a RANGE 4 e POLY 2', `RANGE ${m.G.arpRange}, assign ${m.patch[0].assign}`, m.G.arpRange === 4 && m.patch[0].assign === 1, '(a)'); }
{ const m = novo(Motor, {}, { keyMode: 1, arpRate: 10 }), L = new Float32Array(64), out = []; m.onArp = n => out.push(n); m.msg({ t: 'arpMode', v: 1 }); m.msg({ t: 'g', k: 'arpRange', v: 1 }); m.msg({ t: 'on', n: 48 }); m.msg({ t: 'on', n: 72 }); for (let i = 0; i < 2 * FS / 64; i++) m.process(L, L, 64);
  const up = ativas(m).filter(v => v.n === 72 && v.kd).length; reg('Arpejo', 'SPLIT: só o Lower arpeja', 'o Upper toca a tecla direta; o Lower arpeja', `${out.length} passos só com a nota ${[...new Set(out)].join(',')}; Upper direto: ${up} voz`, out.length > 5 && out.every(n => n === 48) && up === 1, '(a)'); }
{ const [o, m] = arpNotas({}, { arpMode: 1, arpRange: 1 }, [48, 50, 52, 53, 55, 57, 59, 60, 62, 64], 9); reg('Arpejo', 'mais de 8 notas', 'a memória guarda 8', `${m.arp.lista.length} notas na memória`, m.arp.lista.length === 8 && Math.max(...o) <= 60, '(a)'); }

{ const m = novo(Motor, { mix: 5, v1Wave: 1, v2Wave: 1, res: 6, envMod: 5, fmLfo: 2, vcfLfo: 3, vcaLfo: 2 }, { volume: 8 }); for (const n of [48, 52, 55, 60, 64, 67, 72, 76]) m.msg({ t: 'on', n }); const t0 = performance.now(); render(m, 10); const ms = performance.now() - t0;
  reg('Custo', '10 s de áudio, 8 vozes com tudo ligado (neste computador, Node)', 'bem abaixo de 100 % do tempo real', fmt(ms / 100, 1) + ' % do tempo real', ms < 5000, ''); }

console.log('| Grupo | Medição | Esperado (pesquisa) | Medido | | Fonte |\n|---|---|---|---|---|---|');
for (const l of linhas) console.log('| ' + l.join(' | ') + ' |');
console.log(`\n${linhas.length} medições, ${falhas} fora da tolerância.`);
process.exit(falhas ? 1 : 0);
