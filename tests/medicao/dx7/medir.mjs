// Medições do motor de som de dx7/index.html, comparadas com docs/pesquisa/dx7.md (seção 11).
// Uso: node tests/medicao/dx7/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
import { carregaMotor, novo, render, rms, pico, dB, espectro as espectro0, picoHz as picoHz0, FS } from './motor.mjs';
// janela maior que o sinal vira erro (antes disso a conta dava NaN e a comparação passava em silêncio)
const espectro = (x, a, n) => { if (a + n > x.length) throw new Error(`janela curta: ${a + n} > ${x.length}`); return espectro0(x, a, n); };
const picoHz = (x, a, n, lo, hi, fs) => { if (a + n > x.length) throw new Error(`janela curta: ${a + n} > ${x.length}`); return picoHz0(x, a, n, lo, hi, fs); };

const Motor = carregaMotor(), DD = Motor.dados, FC = DD.FC;
const linhas = []; let falhas = 0;
const fmt = (v, c = 2) => typeof v === 'number' ? v.toFixed(c).replace('.', ',') : v;
/** ok === null: só registro (sem referência primária); não conta como falha. */
function reg(grupo, item, esperado, medido, ok, fonte = '') { if (ok === false) falhas++; linhas.push([grupo, item, esperado, medido, ok === null ? 'registro' : ok ? 'ok' : 'FORA', fonte]); }
const cents = (a, b) => 1200 * Math.log2(a / b);
const fNota = n => 440 * Math.pow(2, (n - 69) / 12);
const N = 65536;

/** patch de teste: todos os operadores mudos (OL 0), envelopes quadrados; `ops` dá alterações por número de operador (1 a 6) */
function P(o = {}) {
  const p = DD.patchInit(); p.nome = 'TESTE';
  for (const op of p.ops) op.ol = 0;
  for (const k of Object.keys(o)) if (k !== 'ops') p[k] = o[k];
  for (const i of Object.keys(o.ops || {})) Object.assign(p.ops[i - 1], o.ops[i]);
  return p;
}
const seno = (extra = {}, g = {}) => P(Object.assign({ alg: 15, ops: { 1: Object.assign({ ol: 99 }, extra) } }, g));   // algoritmo 16: só o operador 1 é portadora
function toca(p, g = {}, notas = [60], seg = 2.2, vel = 127, fs = FS) { seg = Math.max(seg, 1.9); const m = novo(Motor, p, g, fs); for (const n of notas) m.msg({ t: 'on', n, v: vel }); return [m, render(m, seg)]; }
const fMed = (L, f0, fs = FS) => picoHz(L, Math.round(0.3 * fs), N, f0 * 0.7, f0 * 1.4, fs);
/** frequência por cruzamentos ascendentes de zero (para sons lentos) */
function fCruz(x, fs) { const t = []; for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) t.push(i - 1 + (-x[i - 1]) / (x[i] - x[i - 1])); return t.length < 2 ? 0 : (t.length - 1) * fs / (t[t.length - 1] - t[0]); }
/** amplitude do pico no espectro numa faixa */
const linha = (L, f, fs = FS, a = Math.round(0.3 * fs), n = N) => { const mag = espectro(L, a, n), df = fs / n, i = Math.round(f / df); let m = 0; for (let j = i - 3; j <= i + 3; j++) m = Math.max(m, mag[j] || 0); return m; };
/** amplitude de uma senoide na frequência exata `f` (DFT com janela de Hann): sem a perda de "scalloping" de medir pelo bin mais próximo */
function ampExata(L, f, fs = FS, a = Math.round(0.3 * fs), n = N) { if (a + n > L.length) throw new Error('janela curta'); let re = 0, im = 0, w = 0; for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), ph = 2 * Math.PI * f * i / fs; re += L[a + i] * h * Math.cos(ph); im -= L[a + i] * h * Math.sin(ph); w += h; } return 2 * Math.hypot(re, im) / w; }
/** lista de linhas espectrais (máximos locais acima de `lim` dB do maior) */
function linhasEsp(L, fs = FS, lim = -50, a = Math.round(0.3 * fs), n = N) {
  const mag = espectro(L, a, n); let mx = 0; for (const v of mag) mx = Math.max(mx, v); const out = [];
  for (let i = 4; i < mag.length - 4; i++) { if (mag[i] < mx * Math.pow(10, lim / 20)) continue; let loc = true; for (let j = -4; j <= 4; j++) if (mag[i + j] > mag[i]) { loc = false; break; } if (loc) out.push([i * fs / n, 20 * Math.log10(mag[i] / mx)]); }
  return out;
}
const J = (n, x) => { const M = 4000; let s = 0; for (let i = 0; i <= M; i++) { const t = Math.PI * i / M, w = i === 0 || i === M ? 1 : i % 2 ? 4 : 2; s += w * Math.cos(n * t - x * Math.sin(t)); } return s * (Math.PI / M) / 3 / Math.PI; };
const TLd = ol => ol >= 20 ? 99 - ol : [127, 122, 118, 114, 110, 107, 104, 102, 100, 98, 96, 94, 92, 90, 88, 86, 85, 84, 82, 81][ol];
const indice = ol => Math.PI * Math.pow(2, 33 / 16 - TLd(ol) / 8);
/** nível (dB) de um seno medido pela linha espectral */
const nivel = (L, f) => dB(linha(L, f));
/** envelope de pico (janelas de `ms` ms) em dB */
function envDB(L, ms = 2, fs = FS) { const w = Math.round(ms * fs / 1000), o = []; for (let i = 0; i + w <= L.length; i += w) o.push(dB(pico(L, i, i + w))); return o; }

/* ====================================================== 1. Frequência (11.1) */
{ let pior = 0, pn = 0;
  for (let n = 36; n <= 96; n++) { const [, L] = toca(seno(), {}, [n], 1.2), f = fMed(L, fNota(n)), e = Math.abs(cents(f, fNota(n))); if (e > pior) { pior = e; pn = n; } }
  reg('Frequência', 'senoide pura (VOICE INIT), 61 teclas, nota 36 a 96', '±1,2 cent (um passo de quantização)', `pior: ${fmt(pior, 2)} cents (nota ${pn})`, pior <= 1.2, '(a)/(b) 4.2'); }
{ const [, L] = toca(seno(), {}, [69], 1.2), f = fMed(L, 440); reg('Frequência', 'lá 440 Hz', '±1,2 cent', `${fmt(f, 3)} Hz (${fmt(cents(f, 440), 2)} cents)`, Math.abs(cents(f, 440)) <= 1.2, '(a) MAN'); }
{ let pior = 0, desc = '';
  for (const c of [0, 1, 2, 3, 7, 15, 31]) { const [, L] = toca(seno({ coarse: c }), {}, [48], 1.2), r = (c === 0 ? 0.5 : c), alvo = fNota(48) * r, e = cents(fMed(L, alvo), alvo); if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = 'COARSE ' + c; } }
  for (const fn of [1, 50, 99]) { const [, L] = toca(seno({ coarse: 1, fine: fn }), {}, [48], 1.2), alvo = fNota(48) * (1 + fn / 100), e = cents(fMed(L, alvo), alvo); if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = 'FINE ' + fn; } }
  reg('Frequência', 'modo RATIO: COARSE 0,1,2,3,7,15,31; FINE 1, 50, 99', 'nota × COARSE × (1 + FINE/100), ±1,2 cent', `pior: ${fmt(pior, 2)} cents (${desc})`, Math.abs(pior) <= 1.2, '(a) 4.3'); }
{ const [, L] = toca(seno({ coarse: 0, fine: 99 }), {}, [48], 1.2), alvo = fNota(48) * 0.5 * 1.99, e = cents(fMed(L, alvo), alvo);
  reg('Frequência', 'COARSE 0 com FINE 99 (multiplica 0,5)', '0,995 × nota', fmt(e, 2) + ' cents de erro', Math.abs(e) <= 1.2, '(c) 4.3'); }
{ let pior = 0, desc = '', seguiu = 0;
  for (const c of [0, 1, 2, 3]) for (const fn of [0, 50, 99]) {
    const alvo = Math.pow(10, c) * Math.pow(10, fn / 100); let e;
    if (alvo < 40) { const [, L] = toca(seno({ modo: 1, coarse: c, fine: fn }), {}, [60], 12 / Math.max(1, alvo / 4) + 4), f = fCruz(L.subarray(Math.round(0.5 * FS)), FS); e = cents(f, alvo); }
    else { const [, L] = toca(seno({ modo: 1, coarse: c, fine: fn }), {}, [60], 1.2), f = picoHz(L, Math.round(0.3 * FS), N, alvo * 0.7, alvo * 1.4); e = cents(f, alvo); }
    if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = `COARSE ${c} FINE ${fn}`; }
  }
  const [, L1] = toca(seno({ modo: 1, coarse: 3, fine: 0 }), {}, [36], 1.2), [, L2] = toca(seno({ modo: 1, coarse: 3, fine: 0 }), {}, [96], 1.2);
  seguiu = Math.abs(cents(fMed(L1, 1000), fMed(L2, 1000)));
  reg('Frequência', 'modo FIXED: COARSE 0 a 3, FINE 0, 50, 99 (1 Hz a 9772 Hz)', '10^(COARSE mod 4) × 10^(FINE/100) Hz, ±0,2 % (3,5 cents)', `pior: ${fmt(pior, 2)} cents (${desc})`, Math.abs(pior) <= 3.5, '(a) 4.4');
  reg('Frequência', 'FIXED não segue o teclado (notas 36 e 96)', 'mesma frequência', fmt(seguiu, 2) + ' cents de diferença', seguiu < 0.5, '(b) 4.4'); }
for (const o of [-7, 0, 7]) for (const n of [36, 60, 84]) {
  const [, L] = toca(seno({ det: o + 7 }), {}, [n], 1.6), f = fMed(L, fNota(n)); reg('Frequência', `DETUNE ${o > 0 ? '+' : ''}${o}, nota ${n}`, 'sem valor primário (aproximação do Dexed, (c))', fmt(cents(f, fNota(n)), 2) + ' cents', null, '(c) 4.5; passo de 1,17 cent limita a resolução'); }
for (const tr of [0, 48]) { const [, L] = toca(seno(), {}, [60], 1.2); void L; const [, L2] = toca(P({ alg: 15, tr, ops: { 1: { ol: 99 } } }), {}, [60], 1.2), alvo = fNota(60) * Math.pow(2, (tr - 24) / 12), e = cents(fMed(L2, alvo), alvo);
  reg('Frequência', `KEY TRANSPOSE ${tr - 24 > 0 ? '+' : ''}${tr - 24} semitons`, '±24 semitons (±1,2 cent)', fmt(e, 2) + ' cents de erro', Math.abs(e) <= 1.2, '(a) 2.2'); }
for (const t of [-75, 75]) { const [, L] = toca(seno(), { tune: t }, [69], 1.2), e = cents(fMed(L, 440), 440) - t;
  reg('Frequência', `MASTER TUNE ${t > 0 ? '+' : ''}${t} cents`, `${t} cents (±1,2)`, fmt(e, 2) + ' cents de erro', Math.abs(e) <= 1.2, '(a) 4.7'); }
{ let pior = 0, desc = '';
  for (const [r, sg] of [[0, 1], [2, 1], [2, -1], [12, 1], [12, -1]]) { const [, L] = toca(seno(), { bendRange: r, bend: 0 }, [60], 0.2); void L;
    const m = novo(Motor, seno(), { bendRange: r }); m.msg({ t: 'ctl', k: 'bend', v: sg }); m.msg({ t: 'on', n: 60, v: 100 }); const L2 = render(m, 2.2), alvo = fNota(60) * Math.pow(2, sg * r / 12), e = cents(fMed(L2, alvo), alvo);
    if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = `RANGE ${r} ${sg > 0 ? '+' : '−'}`; } }
  reg('Frequência', 'pitch bend, RANGE 0, 2, 12 nos dois sentidos', 'RANGE semitons (±1,2 cent)', `pior: ${fmt(pior, 2)} cents (${desc})`, Math.abs(pior) <= 1.2, '(a) 4.7; curva da roda linear (c)');
  let pe = 0, dd = '';
  for (const [st, b] of [[1, 0.04], [1, 0.1], [1, 0.5], [12, 0.3], [12, 0.6], [12, 1], [4, 0.45]]) { const m = novo(Motor, seno(), { bendStep: st }); m.msg({ t: 'ctl', k: 'bend', v: b }); m.msg({ t: 'on', n: 60, v: 100 }); const L2 = render(m, 2.2);
    const semis = Math.round(b * 12 / st) * st, alvo = fNota(60) * Math.pow(2, semis / 12), e = cents(fMed(L2, alvo), alvo); if (Math.abs(e) > Math.abs(pe)) { pe = e; dd = `STEP ${st}, roda ${b} = ${semis} semitons`; } }
  reg('Frequência', 'pitch bend com STEP 1, 4 e 12 (degraus em semitons, faixa 12)', 'frequência em semitons inteiros múltiplos de STEP (±1,2 cent)', `pior: ${fmt(pe, 2)} cents (${dd})`, Math.abs(pe) <= 1.2, '(a) 4.7'); }
{ let pior = 0, desc = '';
  for (const [lv, alvoOit] of [[0, -4], [50, 0], [99, 127 / 32], [40, -10 / 32], [60, 10 / 32], [20, -30 / 32]]) {
    const m = novo(Motor, seno(), {}); const p = seno(); p.pl = [lv, lv, lv, lv]; p.pr = [99, 99, 99, 99]; m.msg({ t: 'patch', p }); m.msg({ t: 'on', n: 60, v: 100 }); const L = render(m, 2.2);
    const alvo = fNota(60) * Math.pow(2, alvoOit), e = cents(picoHz(L, Math.round(0.5 * FS), N, alvo * 0.8, alvo * 1.25), alvo); if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = 'nível ' + lv; } }
  reg('Frequência', 'pitch EG: níveis 0, 20, 40, 50, 60, 99 (parados)', '−4 oit, −30/32 oit, −375 cents, 0, +375 cents, +127/32 oit (±1,2 cent)', `pior: ${fmt(pior, 2)} cents (${desc})`, Math.abs(pior) <= 1.2, '(a) tabela do firmware, 1/32 de oitava por unidade (b)');
  reg('Frequência', 'pitch EG nível 99 vs. manual ("+4 oitavas")', '4 oitavas no manual; tabela dá 127/32 = 3,97 oitavas', fmt(1200 * 127 / 32, 0) + ' cents na tabela (4800 no manual)', null, '(a) MAN e FW; diferença de 37 cents registrada');
  const tOit = r => { const p = seno(); p.pl = [82, 82, 82, 50]; p.pr = [r, 99, 99, 99]; const m = novo(Motor, p); m.msg({ t: 'on', n: 60, v: 100 }); const v = m.vozes[0]; let k = 0; while (!(v.pix >= 1) && k < 4e6) { m.process(new Float32Array(64), new Float32Array(64), 64); k += 64; } return k / FS; };
  for (const r of [50, 99]) { const t = tOit(r), esp = 1 / DD.peVel(r); reg('Frequência', `pitch EG: tempo de 1 oitava com taxa ${r}`, `${fmt(esp, 3)} s (tabela ÷ 21,3), ±5 %`, fmt(t, 3) + ' s', Math.abs(t / esp - 1) <= 0.05 || Math.abs(t - esp) < 0.01, '(b) 4.6; tabela de taxas reconstruída (c)'); } }
{ const tPor = tp => { const m = novo(Motor, seno(), { mono: 1, portaTime: tp, portaModo: 1 }); m.msg({ t: 'on', n: 48, v: 100 }); render(m, 0.3); m.msg({ t: 'on', n: 60, v: 100 }); const v = m.vozes[0]; const t0 = m.frame; let k = 0; while (v.gl !== 0 && k < 5e6) { m.process(new Float32Array(64), new Float32Array(64), 64); k += 64; } return [k / FS, tp]; };
  for (const tp of [25, 50, 75, 99]) { const [t] = tPor(tp), esp = 12 / (2100 * Math.pow(2, -0.062 * tp * 127 / 99)); reg('Frequência', `portamento TIME ${tp}: tempo de uma oitava (12 semitons)`, `≈ ${fmt(esp, 3)} s (modelo do Dexed, (c)), ±5 %`, fmt(t, 3) + ' s', Math.abs(t / esp - 1) <= 0.05, '(c) 4.7; sem valor primário'); }
  const m = novo(Motor, seno(), { mono: 1, portaTime: 0, portaModo: 1 }); m.msg({ t: 'on', n: 48, v: 100 }); m.msg({ t: 'on', n: 60, v: 100 }); reg('Frequência', 'portamento TIME 0', 'instantâneo (sem deslize)', m.vozes[0].gl === 0 ? 'instantâneo' : 'desliza', m.vozes[0].gl === 0, '(a) FW');
  const g = novo(Motor, seno(), { mono: 1, portaTime: 60, portaModo: 1, gliss: 1 }); g.msg({ t: 'on', n: 48, v: 100 }); render(g, 0.2); g.msg({ t: 'on', n: 60, v: 100 }); let desv = 0, vistas = 0;
  for (let k = 0; k < 400; k++) { g.process(new Float32Array(256), new Float32Array(256), 256); const o = g.vozes[0].inc[0], f = o * FC / 16777216, sem = 12 * Math.log2(f / fNota(60)) , d = Math.abs(sem - Math.round(sem)); if (g.vozes[0].gl !== 0) { desv = Math.max(desv, d); vistas++; } }
  reg('Frequência', 'glissando: a frequência durante o deslize anda em semitons inteiros', 'múltiplos de 1 semitom (±1,2 cent)', fmt(desv * 100, 2) + ' cents (' + vistas + ' leituras)', vistas > 20 && desv * 100 <= 1.2, '(b) DEX'); }
reg('Frequência', 'taxa de amostragem do núcleo', '49 096 Hz (4,71325 MHz ÷ 96), reamostrada para a taxa do contexto', FC + ' Hz', FC === 49096, '(a)/(b) 3.1');

/* ====================================================== 2. Espectro, algoritmos, realimentação (11.2) */
{ let pior = 0, desc = '', n = 0;
  for (const ol of [60, 70, 80, 90, 99]) {
    const p = P({ alg: 0, ops: { 1: { ol: 99 }, 2: { ol } } }), [mm, L] = toca(p, {}, [60], 2.2), f = mm.vozes[0].inc[0] * FC / 16777216, I = indice(ol);
    const ex = h => Math.abs(J(h - 1, I) + (h % 2 ? -1 : 1) * J(h + 1, I)), a1 = ampExata(L, f), e1 = ex(1);
    for (let h = 2; h <= 6; h++) { if (ex(h) < 0.1 * Math.max(e1, 0.3)) continue; const dif = 20 * Math.log10(ampExata(L, h * f) / a1) - 20 * Math.log10(ex(h) / e1); n++; if (Math.abs(dif) > Math.abs(pior)) { pior = dif; desc = `OL ${ol}, parcial ${h}`; } } }
  reg('Espectro', 'par 1:1 (algoritmo 1), OP2 = 60..99: parciais 2 a 6 contra Bessel com I = π·2^(33/16 − TL/8)', '±1 dB (parciais acima de −20 dB do maior)', `pior: ${fmt(pior, 2)} dB (${desc}; ${n} parciais)`, Math.abs(pior) <= 1, '(b) 3.3'); }
{ const tabI = [[99, 13.12], [90, null], [80, null]]; void tabI; const i99 = indice(99), i20 = indice(20), i19 = indice(19), i0 = indice(0);
  reg('Espectro', 'índice de modulação com OL 99', '≈ 13,12 rad', fmt(i99, 2) + ' rad', Math.abs(i99 - 13.12) < 0.02, '(b) 3.3'); reg('Espectro', 'cada 8 passos de OL dobram o índice', 'razão 2', fmt(indice(91) / indice(99) * 2 / 2 * 1, 3) + ' (OL 91/99 = ' + fmt(indice(91) / indice(99), 3) + ')', Math.abs(indice(91) / indice(99) - 0.5) < 1e-9, '(b) 3.3'); void i20; void i19; void i0; }
/* 11. cada algoritmo */
{ const pior = []; let totalAlg = 0, falha11 = 0; const fo = 130.8128;
  const ratio = [[1, 0], [1, 41], [2, 13], [3, 7], [4, 29], [6, 47]];
  const R = i => ratio[i][0] * (1 + ratio[i][1] / 100);
  const medeFora = (p, c) => { const [, L] = toca(p, {}, [48], 1.2), a = Math.round(0.3 * FS); const mag = espectro(L, a, N), df = FS / N, i0 = Math.round(R(c) * fo / df); let tot = 0, perto = 0; for (let i = 1; i < mag.length; i++) { const e = mag[i] * mag[i]; tot += e; if (Math.abs(i - i0) <= 5) perto += e; } return tot > 0 ? 1 - perto / tot : 0; };
  for (let a = 0; a < 32; a++) {
    const al = DD.ALG[a], cars = [], mods = []; for (let o = 0; o < 6; o++) (al.car[o] ? cars : mods).push(o);
    const base = {}; for (let o = 0; o < 6; o++) base[o + 1] = { coarse: ratio[o][0], fine: ratio[o][1] };
    // (a) moduladores mudos: número de parciais = número de portadoras
    const ops1 = {}; for (let o = 0; o < 6; o++) ops1[o + 1] = Object.assign({}, base[o + 1], { ol: al.car[o] ? 99 : 0 });
    const [, L] = toca(P({ alg: a, ops: ops1 }), {}, [48], 1.2), ls = linhasEsp(L, FS, -50);
    const okParc = ls.length === cars.length; totalAlg++; if (!okParc) { falha11++; pior.push(`alg ${a + 1}: ${ls.length} parciais, esperava ${cars.length}`); }
    // (b) um modulador por vez: só as portadoras que ele alimenta diretamente ganham bandas laterais
    for (const m of mods) {
      const dest = cars.filter(c => al.mods[c].includes(m));
      for (const c of cars) {
        const ops = {}; for (let o = 0; o < 6; o++) ops[o + 1] = Object.assign({}, base[o + 1], { ol: o === c ? 99 : (o === m ? 80 : 0) });
        const fora = medeFora(P({ alg: a, ops }), c), moduladaEsp = dest.includes(c), ok = moduladaEsp ? fora > 0.05 : fora < 0.002;
        if (!ok) { falha11++; pior.push(`alg ${a + 1}: mod ${m + 1} → portadora ${c + 1}: energia fora da linha ${fmt(fora * 100, 2)} % (esperado ${moduladaEsp ? 'modulada' : 'pura'})`); }
      }
    }
    // (c) todos ligados: as portadoras com entrada de modulação ganham bandas, as outras não
    for (const c of cars) {
      const ops = {}; for (let o = 0; o < 6; o++) ops[o + 1] = Object.assign({}, base[o + 1], { ol: o === c || !al.car[o] ? 80 : 0 }); ops[c + 1].ol = 99;
      const fora = medeFora(P({ alg: a, ops }), c), tem = al.mods[c].length > 0, ok = tem ? fora > 0.05 : fora < 0.002;
      if (!ok) { falha11++; pior.push(`alg ${a + 1}: todos ligados, portadora ${c + 1}: ${fmt(fora * 100, 2)} % (esperado ${tem ? 'modulada' : 'pura'})`); }
    }
  }
  reg('Algoritmos', `${totalAlg} algoritmos: nº de parciais = nº de portadoras; cada modulador só afeta as portadoras que ele alimenta; sem modulação a portadora é pura`, 'sem divergências', falha11 ? falha11 + ' divergências: ' + pior.slice(0, 6).join('; ') : 'conferido (parciais, um modulador por vez, todos ligados)', falha11 === 0, '(b) 3.4'); }
/* 12. compensação por número de portadoras */
{ const ref = alg => { const ops = {}; for (let o = 1; o <= 6; o++) ops[o] = { ol: DD.ALG[alg].car[o - 1] ? 99 : 0, coarse: 1, fine: 0 }; const [, L] = toca(P({ alg, ops }), {}, [60], 1.6); return rms(L, Math.round(0.4 * FS)); };
  const r16 = ref(15);
  for (const [alg, n, esp] of [[0, 2, 0], [4, 3, -0.23], [21, 4, 0], [30, 5, -0.32], [31, 6, -0.24]]) { const d = dB(ref(alg) / r16);
    reg('Algoritmos', `compensação de nível, algoritmo ${alg + 1} (${n} portadoras iguais em fase) contra o 16 (1)`, `${fmt(esp, 2)} dB (±0,1)`, fmt(d, 2) + ' dB', Math.abs(d - esp) <= 0.1, '(b) 3.4; esperado de 2^1,625, 2^2,375 e 2^2,625 (c)'); } }
/* 13. realimentação */
{ const alg = 31, esp = []; const f0 = fNota(60); let prev = -1, cresce = true;
  for (let fb = 0; fb <= 7; fb++) { const [, L] = toca(P({ alg, fb, ops: { 6: { ol: 99 } } }), {}, [60], 1.6), ls = linhasEsp(L, FS, -60), a1 = linha(L, f0);
    let alto = 0; const mag = espectro(L, Math.round(0.3 * FS), N), df = FS / N; for (let i = Math.round(20000 / df); i < mag.length; i++) alto = Math.max(alto, mag[i]);
    esp.push([fb, ls.length, dB(alto / a1), dB(linha(L, 2 * f0) / a1), dB(linha(L, 3 * f0) / a1)]); if (ls.length < prev) cresce = false; prev = ls.length; }
  reg('Realimentação', 'OP6 sozinho, FEEDBACK 0: senoide pura', 'uma só linha acima de −60 dBc', `${esp[0][1]} linha(s)`, esp[0][1] === 1, '(a) 3.5');
  reg('Realimentação', 'o espectro cresce a cada passo de FEEDBACK (linhas acima de −60 dBc)', 'não decresce', esp.map(e => e[1]).join(', '), cresce, '(b) 3.5');
  reg('Realimentação', 'FEEDBACK 7: forma próxima de dente de serra (2º e 3º harmônico em relação ao 1º)', '2º ≈ −6 dB, 3º ≈ −9,5 dB (±6 dB; valor absoluto é aproximação)', `2º ${fmt(esp[7][3], 1)} dB, 3º ${fmt(esp[7][4], 1)} dB`, null, '(c) 3.5');
  { const [, L7] = toca(P({ alg, fb: 7, ops: { 6: { ol: 99 } } }), {}, [60], 1.9), mag7 = espectro(L7, Math.round(0.3 * FS), N), df7 = FS / N;
    const maxFaixa = (a, b) => { let m = 0; for (let i = Math.round(a / df7); i < Math.round(b / df7); i++) m = Math.max(m, mag7[i]); return m; };
    const altoA = dB(maxFaixa(20000, 24000) / maxFaixa(8000, 12000));
    reg('Realimentação', 'FEEDBACK 7: sem oscilação em Nyquist (a maior linha acima de 20 kHz é menor que a maior entre 8 e 12 kHz; efeito da média de 2 amostras)', '< 0 dB (o espectro decresce)', fmt(altoA, 1) + ' dB', altoA < 0, '(b) 3.5'); }
  reg('Realimentação', 'conteúdo harmônico 2º (dBc) para FEEDBACK 0..7', 'cresce', esp.map(e => fmt(e[3], 1)).join(' / '), null, '(c) registro'); }
/* 14. laços dos algoritmos 4 e 6 */
{ const d = (alg, ops, fb) => { const [, L] = toca(P({ alg, fb, ops }), {}, [60], 1.6); return linhasEsp(L, FS, -50).length; };
  const a4 = [d(3, { 4: { ol: 99 }, 5: { ol: 85 }, 6: { ol: 85 } }, 0), d(3, { 4: { ol: 99 }, 5: { ol: 85 }, 6: { ol: 85 } }, 7), d(3, { 4: { ol: 99 }, 5: { ol: 0 }, 6: { ol: 85 } }, 7), d(3, { 4: { ol: 99 }, 5: { ol: 85 }, 6: { ol: 0 } }, 7)];
  const a4s6 = d(3, { 4: { ol: 99 }, 5: { ol: 85 }, 6: { ol: 0 } }, 0);
  reg('Realimentação', 'algoritmo 4: o laço 6>5>4>6 só existe com os operadores 4, 5 e 6 ligados (linhas com FEEDBACK 0 / 7 / 7 sem OP5 / 7 sem OP6 / 0 sem OP6)', 'FB 7 muda o espectro com os três; sem OP5 fica senoide pura (1 linha); sem OP6 o FB 7 não muda nada (o OP5 puro continua modulando o 4)', a4.join(' / ') + ' / ' + a4s6, a4[1] > a4[0] && a4[2] === 1 && a4[3] === a4s6, '(b) 3.4');
  const a6 = [d(5, { 5: { ol: 99 }, 6: { ol: 85 } }, 0), d(5, { 5: { ol: 99 }, 6: { ol: 85 } }, 7), d(5, { 5: { ol: 99 }, 6: { ol: 0 } }, 7)];
  reg('Realimentação', 'algoritmo 6: o laço 6>5>6 (a saída do 5 volta para o 6)', 'FB 7 muda o espectro com OP5 e OP6; sem OP6, senoide pura', a6.join(' / '), a6[1] > a6[0] && a6[2] === 1, '(b) 3.4'); }
/* 15. key sync */
{ const prim = sync => { const p = seno(); p.sync = sync; const m = novo(Motor, p); const o = []; for (let k = 0; k < 4; k++) { m.msg({ t: 'on', n: 60, v: 100 }); o.push(m.vozes.find(v => v.ativa).ph[0]); render(m, 0.05); m.msg({ t: 'panico' }); } return o; };
  const a = prim(1), b = prim(0), igual = (x, y) => x === y;
  reg('Espectro', 'OSC KEY SYNC ligado: notas repetidas começam com a mesma fase', 'fase inicial 0', a.every(x => igual(x, a[0])) ? 'fase inicial 0 em todas' : 'diferentes', a.every(x => x === 0), '(a) 3.2');
  reg('Espectro', 'OSC KEY SYNC desligado: a fase inicial varia', 'fase inicial diferente a cada nota', b.every(x => igual(x, b[0])) ? 'idênticas' : 'diferentes', !b.every(x => igual(x, b[0])), '(a) 3.2'); }

/* ====================================================== 3. Níveis (11.3) */
const lsb = dBrel => 8192 * Math.pow(10, dBrel / 20);               // amplitude em unidades da saída de 14 bits
const tolQ = dBrel => 0.2 + 7 / lsb(dBrel);                         // 0,2 dB mais o efeito de truncar para zero uma senoide de poucas unidades
const lvOf = (patch, nota = 60, vel = 127) => { const m = novo(Motor, patch); m.msg({ t: 'on', n: nota, v: vel }); render(m, 0.02); return m.vozes[0].lv[0]; };
const nivelOL = (extra, g = {}, vel = 127, nota = 60) => { const [, L] = toca(seno(extra), g, [nota], 1.6, vel); return nivel(L, fNota(nota)); };
{ const r0 = nivelOL({ ol: 99 }); let pior = 0, desc = '';
  let razao = 0;
  for (const ol of [99, 98, 90, 80, 70, 60, 50, 40, 30, 20]) { const v = nivelOL({ ol }) - r0, esp = (ol - 99) * 0.7526, e = v - esp, r = Math.abs(e) / tolQ(esp); if (r > razao) { razao = r; pior = e; desc = 'OL ' + ol; } }
  reg('Níveis', 'OUTPUT LEVEL 99..20: dB em relação ao OL 99', '0,7526 dB por passo (±0,2 dB; abaixo de −40 dB soma-se 7/amplitude em unidades, pela saída de 14 bits)', `pior: ${fmt(pior, 2)} dB (${desc}), ${fmt(razao * 100, 0)} % da tolerância`, razao <= 1, '(b)/(a) 5.2');
  const tb = DD.escalaOL; let p2 = 0, d2 = '';
  for (let ol = 0; ol < 20; ol++) { const lv = lvOf(seno({ ol })), esp = Math.max(DD.LVMIN, 32 * tb(ol) - 224), e = lv - esp; if (Math.abs(e) > Math.abs(p2)) { p2 = e; d2 = 'OL ' + ol; } }
  reg('Níveis', 'OUTPUT LEVEL 0 a 19: nível do envelope lido dentro do motor (esses valores ficam abaixo do piso da saída de 14 bits)', '32 × OL′ − 224 (1/256 de oitava, mínimo 16), exato', `pior: ${p2} passos (${d2})`, p2 === 0, '(b) 5.2 e 5.3');
  const v0 = nivelOL({ ol: 0 }) - r0; reg('Níveis', 'OUTPUT LEVEL 0 e 1', 'derivado: −95,6 dB (abaixo da resolução da saída de 14 bits)', `OL 0: ${fmt(v0, 1)} dB; OL 1: ${fmt(nivelOL({ ol: 1 }) - r0, 1)} dB`, null, '(c) 5.2; os níveis mínimos ficam no piso de quantização'); }
{ const base = nivelOL({ ol: 99 }); let pior = 0, desc = '';
  let razao = 0;
  for (const l of [99, 98, 97, 96, 90, 80, 50, 20]) { const p = seno({ l: [l, l, l, 0] }); const [, L] = toca(p, {}, [60], 1.6, 127), v = nivel(L, fNota(60)) - base, esp = (DD.escalaL(l) - 63) * 1.5052, e = v - esp, r = Math.abs(e) / (tolQ(esp) + 0.1); if (r > razao) { razao = r; pior = e; desc = 'L ' + l; } }
  reg('Níveis', 'níveis do EG L = 99, 98, 97, 96, 90, 80, 50, 20: dB em relação a L 99', '1,505 dB por unidade escalada: 98 = 99, 96 = 97 (±0,3 dB; abaixo de −40 dB soma-se 7/amplitude em unidades)', `pior: ${fmt(pior, 2)} dB (${desc}), ${fmt(razao * 100, 0)} % da tolerância`, razao <= 1, '(b) 5.3');
  { let pl = 0, dl = ''; for (const l of [99, 98, 97, 96, 90, 80, 50, 20, 10, 5, 0]) { const lv = lvOf(seno({ l: [l, l, l, 0] })), esp = Math.max(DD.LVMIN, 64 * DD.escalaL(l) + 32 * 127 - 4256), e = lv - esp; if (Math.abs(e) > Math.abs(pl)) { pl = e; dl = 'L ' + l; } }
    reg('Níveis', 'níveis do EG L = 99 a 0: nível interno lido dentro do motor', '64 × nível escalado + 32 × OL′ − 4256 (exato)', `pior: ${pl} passos (${dl})`, pl === 0, '(b) 5.3'); } }
{ const ref = nivelOL({ kvs: 0 }, {}, 127); let pior = 0, desc = '';
  for (const v of [1, 32, 64, 100, 127]) { const x = nivelOL({ kvs: 0 }, {}, v) - ref; if (Math.abs(x) > Math.abs(pior)) { pior = x; desc = 'vel ' + v; } }
  reg('Níveis', 'KVS 0: a velocidade não altera o nível', '0 dB', `pior: ${fmt(pior, 2)} dB (${desc})`, Math.abs(pior) <= 0.05, '(a) 5.4');
  let pv = 0, dv = ''; const tab = [];
  let rz = 0; for (const k of [1, 4, 7]) for (const v of [1, 32, 64, 100, 127]) { const lvv = lvOf(seno({ kvs: k }), 60, v) - lvOf(seno({ kvs: k }), 60, 127), esp = -DD.velAtt(v, k) * 0.7526, intern = lvv / 256 * 6.0206, e = intern - esp; tab.push(`${k}/${v}: ${fmt(intern, 1)}`); if (Math.abs(e) > Math.abs(pv)) { pv = e; dv = `KVS ${k} vel ${v}`; }
    if (esp > -45) { const m = nivelOL({ kvs: k }, {}, v) - nivelOL({ kvs: k }, {}, 127), ea = m - esp, r = Math.abs(ea) / (tolQ(esp) + 0.8); if (r > rz) rz = r; } }
  reg('Níveis', 'velocidade medida na saída de áudio (valores até −45 dB)', 'contra as mesmas tabelas (±1 dB e a quantização de 14 bits)', fmt(rz * 100, 0) + ' % da tolerância', rz <= 1, '(a)/(b) 5.4');
  reg('Níveis', 'velocidade com KVS 1, 4, 7 e vel 32, 64, 100, 127: nível medido contra as tabelas do firmware', '−(tabela × KVS / 8) × 0,7526 dB, lido no nível interno (±0,1 dB)', `pior: ${fmt(pv, 2)} dB (${dv}). ${tab.join('; ')}`, Math.abs(pv) <= 0.1, '(a) tabelas; combinação com KVS é leitura (b)');
  const f1 = nivelOL({ kvs: 7 }, {}, 1) - nivelOL({ kvs: 7 }, {}, 127);
  const lv1 = lvOf(seno({ kvs: 7 }), 60, 1), lv127 = lvOf(seno({ kvs: 7 }), 60, 127), d84 = (lv127 - lv1) / 256 * 6.0206;
  reg('Níveis', 'KVS 7, toque mais fraco (vel 1): quase mudo', '≈ −84 dB em relação à vel 127 (a pesquisa dá −79 dB contra a vel 100 e +5,3 dB para a 127, no Dexed): nível interno ±1 dB; na saída abaixo do piso', `nível interno −${fmt(d84, 1)} dB; na saída ${f1 < -80 ? 'mudo' : fmt(f1, 1) + ' dB'}`, Math.abs(d84 - 84.3) <= 1 && f1 < -80, '(c) 5.4 (conta derivada)');
  const f100 = nivelOL({ kvs: 7 }, {}, 100) - nivelOL({ kvs: 7 }, {}, 127);
  reg('Níveis', 'KVS 7, vel 100 em relação à vel 127', 'pesquisa (Dexed): −5,3 dB (c); tabelas do firmware dão ' + fmt(-DD.velAtt(100, 7) * 0.7526, 1) + ' dB', fmt(f100, 1) + ' dB', null, '(c) 5.4; divergência de ~2 dB entre as duas leituras, registrada'); }
{ // escala de teclado: BP 39 = nota 60
  const baseNota = n => nivelOL({ ol: 70 }, {}, 127, n); let pior = 0, desc = '', razao = 0, interno = 0, nAudio = 0, nInt = 0;
  const nomes = ['−LIN', '−EXP', '+EXP', '+LIN']; const slope = {};
  for (let c = 0; c < 4; c++) for (const dep of [99, 50]) for (const lado of [-1, 1]) for (const oit of [1, 2, 3]) {
    const n = 60 + lado * 12 * oit, ex = lado < 0 ? { lc: c, ld: dep } : { rc: c, rd: dep }, unid = DD.klsUnid(n, { bp: 39, lc: c, rc: c, ld: dep, rd: dep }), efet = Math.max(0, Math.min(127, DD.escalaOL(70) + unid)) - DD.escalaOL(70), esp = efet * 0.7526;
    const nome = `${nomes[c]} ${dep} ${lado < 0 ? 'esq' : 'dir'} ${oit} oit`;
    if (esp > -30) { const m = nivelOL(Object.assign({ ol: 70 }, ex), {}, 127, n) - baseNota(n), e = m - esp, r = Math.abs(e) / (tolQ(esp - 10) + 0.1); nAudio++; if (c === 0 && dep === 99) slope[lado + ':' + oit] = m; if (r > razao) { razao = r; pior = e; desc = nome; } }
    else { const ref = lvOf(seno({ ol: 70 }), n), lv = lvOf(seno(Object.assign({ ol: 70 }, ex)), n) - ref, e = lv - (Math.max(DD.LVMIN, ref + efet * 32) - ref); nInt++; if (Math.abs(e) > Math.abs(interno)) interno = e; if (c === 0 && dep === 99) slope[lado + ':' + oit] = (lv + ref - ref) / 256 * 6.0206; } }
  reg('Níveis', `keyboard level scaling: 4 curvas, DEPTH 99 e 50, 1 a 3 oitavas, dois lados (${nAudio} casos medidos no áudio, ${nInt} pelo nível interno por ficarem abaixo de −30 dB)`, 'unidades de 0,7526 dB da tabela do firmware (±0,3 dB no áudio; exato no nível interno)', `áudio: pior ${fmt(pior, 2)} dB (${desc}), ${fmt(razao * 100, 0)} % da tolerância; interno: ${interno} passos`, razao <= 1 && interno === 0, '(a) tabelas; escala 329/32768 (b)');
  const s1 = -slope['1:1'], s2 = (-slope['1:3']) / 3;
  reg('Níveis', '−LIN, DEPTH 99: dB por oitava', 'manual: 22 dB/oitava; fórmula do Dexed ≈ 23,9', `${fmt(s1, 1)} dB na 1ª oitava, ${fmt(s2, 1)} dB/oitava média em 3`, null, '(a) MAN vs (c) conta; diferença registrada para decisão');
  const grupo = []; for (let d = 0; d <= 8; d++) grupo.push(DD.klsUnid(60 + d, { bp: 39, lc: 3, rc: 3, ld: 99, rd: 99 }));
  reg('Níveis', 'grupos de 3 teclas', 'degraus a cada 3 teclas (grupos 0,0,1,1,1,2,2,2,3 nas notas BP+0 a BP+8)', grupo.join(' '), grupo[1] === 0 && grupo[2] === grupo[3] && grupo[3] === grupo[4] && grupo[4] < grupo[5] && grupo[5] === grupo[6] && grupo[6] === grupo[7], '(b) 5.5'); }
{ const al = 31, ops = {}; for (let o = 1; o <= 6; o++) ops[o] = { ol: 99, coarse: o % 2 ? 1 : 2, fine: 0 };
  const [, L1] = toca(P({ alg: al, ops }), {}, [48], 2, 127), [, L16] = toca(P({ alg: al, ops }), {}, [36, 40, 43, 47, 48, 52, 55, 59, 60, 64, 67, 71, 72, 76, 79, 83], 2, 127);
  const p1 = pico(L1, Math.round(0.3 * FS)), p16 = pico(L16);
  reg('Níveis', 'algoritmo 32, tudo em 99, velocidade 127: 1 nota', 'pico ≤ 1 e entre −12 e −3 dBFS', fmt(dB(p1), 1) + ' dBFS', p1 <= 1 && dB(p1) >= -12 && dB(p1) <= -3, '(c) padrão do repositório');
  reg('Níveis', 'o mesmo com 16 notas', 'sem corte (pico ≤ 1,0; limitador suave)', fmt(p16, 3) + ' (' + fmt(dB(p16), 1) + ' dBFS)', p16 <= 1 && isFinite(p16), '(c) 7.2: saturação do estágio analógico desconhecida'); }
{ const m = novo(Motor, seno()); for (let n = 40; n < 56; n++) m.msg({ t: 'on', n, v: 100 }); render(m, 0.05); const a16 = m.vozes.filter(v => v.ativa).length; m.msg({ t: 'on', n: 80, v: 100 }); render(m, 0.05);
  const notas = m.vozes.filter(v => v.ativa).map(v => v.nota);
  reg('Níveis', 'polifonia: 16 notas; a 17ª corta a mais antiga', '16 vozes; a nota 40 some, a 80 entra', `${a16} vozes; depois: ${notas.length} vozes, ${notas.includes(40) ? 'nota 40 ainda soa' : 'nota 40 cortada'}, ${notas.includes(80) ? 'nota 80 soa' : 'sem nota 80'}`, a16 === 16 && notas.length === 16 && !notas.includes(40) && notas.includes(80), '(a) MAN');
  const q = novo(Motor, seno(), { mono: 1 }); q.msg({ t: 'on', n: 60, v: 100 }); q.msg({ t: 'on', n: 64, v: 100 }); q.msg({ t: 'on', n: 67, v: 100 }); render(q, 0.05);
  reg('Níveis', 'modo MONO: uma nota só', '1 voz ativa', q.vozes.filter(v => v.ativa).length + ' voz(es)', q.vozes.filter(v => v.ativa).length === 1 && q.vozes[0].nota === 67, '(a) MAN');
  q.msg({ t: 'off', n: 67 }); render(q, 0.05); reg('Níveis', 'MONO: soltar a última nota volta para a anterior ainda pressionada', 'nota 64', 'nota ' + q.vozes[0].nota, q.vozes[0].nota === 64 && q.vozes[0].baixo, '(c)'); }
reg('Níveis', 'volume por MIDI em 8 degraus', 'não implementado no motor: é do painel (fase D); o motor aceita volume contínuo', 'NE', null, '(a) 6.4; tabela do firmware não foi lida');

/* ====================================================== 4. Envelopes (11.4) */
const qr = (r, rs = 0) => Math.min(63, ((r * 41) >> 6) + rs), taxaDB = q => 0.2819 * Math.pow(2, q >> 2) * (1 + 0.25 * (q & 3));
/** inclinação (dB/s) da queda do pico, por regressão entre -2 dB e -25 dB (ou o que couber) do início da queda */
function inclinacao(L, fs, t0, ms = 1) {
  const e = envDB(L, ms, fs); const i0 = Math.round(t0 * 1000 / ms), k = 1000 / ms; let mx = -1e9; for (let i = i0; i < e.length; i++) mx = Math.max(mx, e[i]);
  const xs = [], ys = []; for (let i = i0; i < e.length; i++) if (e[i] <= mx - 2 && e[i] >= mx - 25) { xs.push(i / k); ys.push(e[i]); }
  if (xs.length < 3) return NaN; const n = xs.length, mx_ = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx_) * (ys[i] - my); sxx += (xs[i] - mx_) ** 2; } return sxy / sxx;
}
{ let pior = 0, desc = '', n = 0;
  for (const r of [20, 40, 50, 60, 80]) { const q = qr(r), esp = -taxaDB(q), p = seno({ r: [99, r, 99, 99], l: [99, 0, 0, 0] });
    const seg = Math.min(14, Math.max(0.5, 30 / -esp) + 0.4), [, L] = toca(p, {}, [60], seg, 127), s = inclinacao(L, FS, 0.15); n++; const e = s / esp - 1; if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = `R ${r}: ${fmt(s, 1)} dB/s contra ${fmt(esp, 1)}`; } }
  reg('Envelope', 'queda: inclinação (dB/s) com R = 20, 40, 50, 60, 80; reta em dB', '0,2819 × 2^(qrate/4) × (1 + 0,25 × (qrate mod 4)) dB/s (±5 %)', `pior: ${fmt(pior * 100, 1)} % (${desc})`, Math.abs(pior) <= 0.05, '(b) 5.3'); }
{ let pior = 0, desc = '';
  for (const r of [0, 10, 99]) { const m = novo(Motor, seno({ r: [99, r, 99, 99], l: [99, 0, 0, 0] })); m.msg({ t: 'on', n: 60, v: 127 }); render(m, 0.05); const v = m.vozes[0], inc = v.einc[0], dbs = inc * FC * 6.0206 / 256, esp = taxaDB(qr(r)), e = dbs / esp - 1; if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = `R ${r}: ${fmt(dbs, 2)} dB/s contra ${fmt(esp, 2)}`; } }
  reg('Envelope', 'queda com R = 0, 10 e 99 (lido dentro do motor, porque 5 minutos ou 1 ms não cabem numa janela de áudio)', 'mesma fórmula (±1 %)', `pior: ${fmt(pior * 100, 2)} % (${desc})`, Math.abs(pior) <= 0.01, '(b) 5.3; R 0 ≈ 0,28 dB/s, R 99 ≈ 16165 dB/s (c)'); }
{ const modelo = r1 => { const q = qr(r1), d = (4 + (q & 3)) * Math.pow(2, q >> 2) / 16384; let l = 1700; const t = [], a = []; for (let i = 0; l < 3840 && i < 5e6; i++) { l += d * ((4352 - l) >> 8 | 0); if (l > 3840) l = 3840; a.push(Math.pow(2, (l - 3840) / 256)); } let t10 = a.findIndex(x => x >= 0.1), t90 = a.findIndex(x => x >= 0.9); void t; return (t90 - t10) / FC; };
  for (const r of [30, 50, 70, 99]) { const [, L] = toca(seno({ r: [r, 99, 99, 99] }), {}, [60], 1.5, 127), e = (() => { const w = Math.round(0.0005 * FS), o = []; for (let i = 0; i + w <= L.length; i += Math.round(w / 2)) o.push(pico(L, i, i + w)); return o; })(), mx = Math.max(...e), dt = 0.00025;
    const i10 = e.findIndex(x => x >= 0.1 * mx), i90 = e.findIndex(x => x >= 0.9 * mx), t = (i90 - i10) * dt, esp = modelo(r), ok = Math.abs(t - esp) <= Math.max(0.001, 0.1 * esp);
    reg('Envelope', `ataque: tempo de 10 % a 90 % da amplitude, R1 = ${r}`, `${fmt(esp * 1000, 1)} ms (modelo do MSFA-E, ±10 % ou 1 ms)`, fmt(t * 1000, 1) + ' ms', ok, '(b) 5.3'); }
  const [, L] = toca(seno({ r: [50, 99, 99, 99] }), {}, [60], 0.2, 127), w = Math.round(0.0002 * FS), p0 = pico(L, 0, w * 3), ini = dB(p0 / 0.6);
  reg('Envelope', 'salto inicial do ataque', 'começa ≈ 50 dB abaixo do máximo (40 dB acima do piso de 90 dB)', fmt(ini, 1) + ' dB do máximo no primeiro 0,6 ms', ini > -56 && ini < -40, '(b) 5.3; 1700 contra 1716 passos registrado'); }
{ const p = seno({ r: [95, 95, 95, 95], l: [99, 50, 80, 0] }), m = novo(Motor, p); m.msg({ t: 'on', n: 60, v: 127 }); const L = render(m, 1.2); const pl = (a, b) => dB(pico(L, Math.round(a * FS), Math.round(b * FS))); m.msg({ t: 'off', n: 60 }); const L2 = render(m, 1.5);
  const ref = DD.escalaL(99), v3 = (DD.escalaL(80) - ref) * 1.5052; const nivelFinal = dB(pico(L2, Math.round(1.2 * FS))), l4 = (DD.escalaL(0) * 64 + 32 * 127 - 4256 - 3840) / 256 * 6.0206;
  reg('Envelope', 'sequência L = 99, 50, 80, 0 (R = 95): patamar em L3 e release até L4', `L3 = ${fmt(v3, 1)} dB em relação a 99 (±0,5 dB); depois do release, L4 = ${fmt(l4, 1)} dB (silêncio)`, `patamar ${fmt(pl(0.8, 1.2) - 20 * Math.log10(0.6 / 0.6), 1)} dBFS; depois ${fmt(nivelFinal, 1)} dBFS`, Math.abs(pl(0.8, 1.2) - dB(0.6) - v3) <= 0.5 && nivelFinal < -60, '(a) 5.3'); }
{ const m = novo(Motor, seno({ r: [99, 99, 99, 99], l: [99, 20, 50, 0] }, {})), v = m.vozes[0]; m.msg({ t: 'on', n: 60, v: 127 }); const vis = [v.ix[0]]; for (let k = 0; k < 4000 && vis.length < 4; k++) { m.process(new Float32Array(8), new Float32Array(8), 8); if (!vis.length || vis[vis.length - 1] !== v.ix[0]) vis.push(v.ix[0]); }
  reg('Envelope', 'segmentos 1, 2 e 3 em ordem com níveis que sobem e descem (L 99, 20, 50)', 'índices 0, 1, 2 (sustenta em L3)', vis.join(', '), vis.join() === '0,1,2' && v.feito[0] === 1, '(a) 5.3'); }
{ let pior = 0, desc = '';
  for (const [n, rs] of [[36, 0], [36, 3], [36, 7], [60, 0], [60, 3], [60, 7], [96, 0], [96, 3], [96, 7]]) { const x = Math.max(0, Math.min(31, ((n / 3) | 0) - 7)), q = qr(40, (rs * x) >> 3), esp = -taxaDB(q);
    const seg = Math.min(14, 40 / -esp + 0.4), [, L] = toca(seno({ r: [99, 40, 99, 99], l: [99, 0, 0, 0], rs }), {}, [n], seg, 127, FS); const s = inclinacao(L, FS, 0.15, n < 48 ? 20 : 2), e = s / esp - 1; if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = `nota ${n}, RS ${rs}: ${fmt(s, 1)} contra ${fmt(esp, 1)} dB/s`; } }
  reg('Envelope', 'rate scaling: queda em C1, C3 e C6 com sensibilidade 0, 3 e 7', 'qrate + (RS × x) >> 3, x = nota/3 − 7 (±5 %)', `pior: ${fmt(pior * 100, 1)} % (${desc})`, Math.abs(pior) <= 0.05, '(b) 5.6'); }
reg('Envelope', 'degraus do envelope (0,0235 dB)', 'reproduzidos: o nível do envelope é inteiro em 1/256 de oitava', 'por construção', null, '(b) 5.3');
reg('Envelope', 'tempo de espera em segmento entre níveis iguais', 'não implementado: o segmento termina na hora (a tabela de 77 durações do Dexed não foi reproduzida)', 'NE', null, '(b) 5.3');

/* ====================================================== 5. LFO e modulação (11.5) */
{ const hzMedido = s => { const m = novo(Motor, seno({}, { lfoV: s, lfoW: 1 })); m.msg({ t: 'patch', p: P({ alg: 15, ops: { 1: { ol: 99 } }, lfoV: s, lfoW: 1 }) }); const dur = s < 10 ? 8 : 2; const p0 = m.lfoP; render(m, dur); return (m.lfoP - p0) / dur; };
  let pior = 0, desc = ''; for (const s of [0, 10, 30, 50, 70, 90, 99]) { const h = hzMedido(s), esp = DD.lfoHz(s), e = h / esp - 1; if (Math.abs(e) > Math.abs(pior)) { pior = e; desc = `SPEED ${s}: ${fmt(h, 3)} Hz contra ${fmt(esp, 3)}`; } }
  reg('LFO', 'frequência para SPEED 0, 10, 30, 50, 70, 90, 99', 'tabela da seção 6.1 (±3 %)', `pior: ${fmt(pior * 100, 2)} % (${desc})`, Math.abs(pior) <= 0.03, '(b) 6.1; entre os pontos medidos, interpolação linear (c)'); }
{ const m = novo(Motor, P({ alg: 15, ops: { 1: { ol: 99 } } })); const forma = w => { m.p.lfoW = w; const v = []; for (let i = 0; i < 400; i++) { m.lfoP = i / 400; v.push(m.lfoOnda()); } return v; };
  const tri = forma(0), sd = forma(1), su = forma(2), sq = forma(3), se = forma(4);
  reg('LFO', 'triângulo: de −1 a +1, simétrico', 'máx 1, mín −1, média 0', `${fmt(Math.max(...tri), 2)} / ${fmt(Math.min(...tri), 2)} / ${fmt(tri.reduce((a, b) => a + b) / 400, 3)}`, Math.abs(Math.max(...tri) - 1) < 0.02 && Math.abs(Math.min(...tri) + 1) < 0.02 && Math.abs(tri.reduce((a, b) => a + b) / 400) < 0.01, '(a) 6.1');
  reg('LFO', 'serra descendente / ascendente', 'rampas opostas', `${fmt(sd[0], 2)}→${fmt(sd[399], 2)} / ${fmt(su[0], 2)}→${fmt(su[399], 2)}`, sd[1] < sd[0] && su[1] > su[0], '(a) 6.1');
  reg('LFO', 'quadrada: metade em +1, metade em −1', '50 % de ciclo ativo', fmt(sq.filter(x => x > 0).length / 4, 0) + ' %', sq.filter(x => x > 0).length === 200, '(a) 6.1');
  let err = 0; for (let i = 0; i < 400; i++) err = Math.max(err, Math.abs(se[i] - Math.sin(2 * Math.PI * (i + 0.5) / 400)));
  reg('LFO', 'seno (tabela de 8 bits): erro máximo contra o seno ideal', '< 0,06', fmt(err, 3), err < 0.06, '(a) 6.1');
  const sh = novo(Motor, P({ alg: 15, ops: { 1: { ol: 99 } }, lfoW: 5, lfoV: 50 })); const valores = []; for (let k = 0; k < 400; k++) { sh.process(new Float32Array(256), new Float32Array(256), 256); valores.push(sh.lfoOnda()); }
  let mud = 0; for (let i = 1; i < valores.length; i++) if (valores[i] !== valores[i - 1]) mud++; const ciclos = 400 * 256 / FS * DD.lfoHz(50);
  reg('LFO', 'sample & hold: um valor novo por ciclo', `${fmt(ciclos, 1)} ciclos → ≈ ${fmt(ciclos, 0)} mudanças (±1)`, mud + ' mudanças', Math.abs(mud - ciclos) <= 1.5, '(a) 6.1'); }
{ const tl = d => { const m = novo(Motor, P({ alg: 15, ops: { 1: { ol: 99 } }, lfoW: 3, lfoV: 50, lfoPmd: 99, pms: 7, lfoD: d })); m.msg({ t: 'on', n: 60, v: 100 }); const o = []; for (let k = 0; k < 6000; k++) { m.process(new Float32Array(64), new Float32Array(64), 64); o.push(Math.abs(m.dp)); } const dt = 64 / FS; let t0 = o.findIndex(x => x > 1e-6), t1 = o.findIndex(x => x > 0.99 * PM); return [t0 < 0 ? NaN : t0 * dt, t1 < 0 ? NaN : t1 * dt]; }; const PM = DD.PM_OITAVAS;
  for (const d of [0, 50, 99]) { const [a, b] = tl(d), esp = DD.lfoAtraso(d); reg('LFO', `DELAY ${d}: tempo até o início e até a profundidade total`, `referência Dexed: início ${fmt(esp[0], 2)} s, total ${fmt(esp[0] + esp[1], 2)} s (c)`, `${fmt(a, 2)} s e ${fmt(b, 2)} s (janela de 6 s)`, null, '(c) 6.1; sem tabela em segundos'); } }
{ const rows = []; for (const [pms, pmd] of [[1, 99], [4, 99], [7, 99], [7, 25], [7, 50]]) { const m = novo(Motor, P({ alg: 15, ops: { 1: { ol: 99 } }, lfoW: 3, lfoV: 50, lfoPmd: pmd, pms })); m.msg({ t: 'on', n: 60, v: 100 }); let mx = 0; for (let k = 0; k < 2000; k++) { m.process(new Float32Array(64), new Float32Array(64), 64); mx = Math.max(mx, Math.abs(m.dp)); } rows.push(`PMS ${pms}/PMD ${pmd}: ±${fmt(mx * 1200, 0)} cents`); }
  reg('LFO', 'vibrato: desvio de pico', 'sem referência primária; escolha de projeto: 1 oitava com PMS 7 e PMD 99, proporcional (PMS/255 × PMD/99)', rows.join('; '), null, '(c) 6.2'); }
{ const rows = []; let okAll = true; for (const ams of [1, 2, 3]) { const p = seno({ ams }); p.lfoW = 3; p.lfoV = 3; p.lfoAmd = 99; const m = novo(Motor, p); m.msg({ t: 'on', n: 60, v: 127 }); const L = render(m, 1.5); const e = envDB(L, 5); let mx = -1e9, mn = 1e9; for (let i = 20; i < e.length; i++) { mx = Math.max(mx, e[i]); } const alvo = []; for (let i = 20; i < e.length; i++) if (e[i] < mx - 3) alvo.push(e[i]); const dbq = Math.min(...e.slice(20)); const prof = mx - dbq, esp = DD.AM_DB * DD.AMS_FAT[ams]; rows.push(`AMS ${ams}: ${fmt(prof, 1)} dB (esp. ${fmt(esp, 1)})`); if (Math.abs(prof - esp) > 0.6) okAll = false; void mn; void alvo; }
  reg('LFO', 'tremolo: profundidade com AMS 1, 2, 3 e AMD 99 (quadrada lenta)', 'AMS × 24 dB com fatores 0,259 / 0,427 / 1 (aproximação, (c)); ±0,6 dB', rows.join('; '), okAll, '(c) 6.3'); }
{ const pr = lfoSync => { const p = P({ alg: 15, ops: { 1: { ol: 99 } }, lfoSync, lfoV: 30 }); const m = novo(Motor, p); render(m, 0.37); const antes = m.lfoP; m.msg({ t: 'on', n: 60, v: 100 }); return [antes, m.lfoP]; };
  const a = pr(1), b = pr(0); reg('LFO', 'SYNC ligado: a fase volta a zero a cada nota', 'fase 0', fmt(a[1], 3), a[1] === 0 && a[0] > 0, '(a) 6.1'); reg('LFO', 'SYNC desligado: a fase continua', 'fase igual à de antes', fmt(b[1], 3), b[1] === b[0], '(a) 6.1'); }
{ let achados = []; const efeito = (pms, ctl, c, ams = 0) => { const p = P({ alg: 15, ops: { 1: { ol: 99, ams } }, pms, lfoPmd: 0, lfoAmd: 0, lfoW: 3, lfoV: 30 }); const m = novo(Motor, p, { ctl: { wheel: Object.assign({ range: 99, pitch: 0, amp: 0, bias: 0 }, ctl) } }); m.msg({ t: 'ctl', k: 'wheel', v: c }); m.msg({ t: 'on', n: 60, v: 127 }); let mxp = 0, mn = 1e9, mx = -1e9; for (let k = 0; k < 800; k++) { m.process(new Float32Array(256), new Float32Array(256), 256); mxp = Math.max(mxp, Math.abs(m.dp)); mn = Math.min(mn, m.vozes[0].lv[0]); mx = Math.max(mx, m.vozes[0].lv[0]); } return [mxp * 1200, (mx - mn) / 256 * 6.0206, mx]; };
  const r1 = efeito(7, { pitch: 1 }, 1), r2 = efeito(0, { pitch: 1 }, 1), r3 = efeito(7, { pitch: 1, range: 50 }, 1), r4 = efeito(7, { pitch: 1, range: 0 }, 1);
  reg('Controladores', 'roda de modulação → PITCH, RANGE 99 / 50 / 0 com PMS 7', 'proporcional ao RANGE; 0 anula', `${fmt(r1[0], 0)} / ${fmt(r3[0], 0)} / ${fmt(r4[0], 0)} cents`, r1[0] > 100 && Math.abs(r3[0] / r1[0] - 50 / 99) < 0.02 && r4[0] === 0, '(a) 6.4');
  reg('Controladores', 'PMS 0 na voz anula o efeito do controlador', '0', fmt(r2[0], 2) + ' cents', r2[0] === 0, '(a) 6.4');
  const a1 = efeito(3, { amp: 1 }, 1, 3), a2 = efeito(3, { amp: 1 }, 1, 0), b1 = efeito(3, { bias: 1 }, 0, 3), b2 = efeito(3, { bias: 1 }, 1, 3);
  reg('Controladores', 'roda → AMPLITUDE com AMS 3 e com AMS 0', 'AMS 3: profundidade de tremolo; AMS 0: nenhuma', `${fmt(a1[1], 1)} dB e ${fmt(a2[1], 1)} dB`, a1[1] > 5 && a2[1] < 0.05, '(a) 6.4');
  reg('Controladores', 'roda → EG BIAS: controlador em 0 atenua os operadores com AMS, em 1 deixa no máximo', 'nível em 1 maior que em 0', `nível em 0: ${b1[2]}; em 1: ${b2[2]} (1/256 de oitava)`, b2[2] > b1[2], '(c) 6.4'); }

/* ====================================================== 6. Filtro e saída (11.6) */
for (const fsx of [48000, 44100, 49096]) { const g = [];
  for (const [nota, coarse] of [[60, 1], [96, 1], [96, 2], [96, 4], [96, 6], [96, 8], [96, 10], [96, 11]]) { const f = fNota(nota) * coarse; if (f > 0.49 * fsx) continue; const [mm, L] = toca(seno({ coarse }), {}, [nota], 1.4, 127, fsx), fx = mm.vozes[0].inc[0] * FC / 16777216; g.push([f, dB(ampExata(L, fx, fsx))]); }
  const ref = g[0][1]; const rel = g.map(([f, v]) => [f, v - ref]); const f3 = (() => { for (let i = 1; i < rel.length; i++) if (rel[i][1] < -3) return rel[i - 1][0] + (rel[i][0] - rel[i - 1][0]) * (-3 - rel[i - 1][1]) / (rel[i][1] - rel[i - 1][1]); return NaN; })();
  reg('Filtro', `resposta da cadeia de saída (senoides de 0,26 a 23 kHz, taxa ${fsx} Hz)`, 'ponto de −3 dB entre 15 e 17 kHz (referência ~16 kHz (b); a inclinação é escolha de projeto)', `−3 dB em ≈ ${fmt(f3 / 1000, 1)} kHz; ` + rel.map(([f, v]) => `${fmt(f / 1000, 1)}k: ${fmt(v, 1)}`).join(', '), f3 > 15000 && f3 < 17000, '(b) 7.1; ordem do filtro não encontrada'); }
{ const nm = 3; const p = P({ alg: 0, ops: { 1: { ol: 99, coarse: 1 }, 2: { ol: 99, coarse: nm } } }); const m = novo(Motor, p, {}, FC); m.msg({ t: 'on', n: 100, v: 127 }); const L = render(m, 2.2); const a = Math.round(0.3 * FC), n = 65536, mag = espectro(L, a, n), df = FC / n, I = indice(99), v0 = m.vozes[0], fcar = v0.inc[0] * FC / 16777216, fmod = v0.inc[1] * FC / 16777216;
  let melhor = null; for (let k = -40; k <= 40; k++) { const f = fcar + k * fmod; if (f <= FC / 2 || f > FC * 3) continue; const amp = Math.abs(J(k, I)); if (!melhor || amp > melhor.amp) melhor = { k, f, amp }; }
  const dobra = (() => { let f = melhor.f % FC; if (f > FC / 2) f = FC - f; return f; })(), obtido = (() => { let mx = 0; const i0 = Math.round(dobra / df); for (let j = i0 - 2; j <= i0 + 2; j++) mx = Math.max(mx, mag[j]); return mx; })();
  reg('Filtro', 'aliasing: a parcial mais forte acima de Nyquist (24,5 kHz) dobra para baixo (taxa de contexto = 49 096 Hz)', `parcial de ${fmt(melhor.f / 1000, 2)} kHz aparece em ${fmt(dobra / 1000, 2)} kHz`, `linha em ${fmt(dobra / 1000, 2)} kHz: ${fmt(dB(obtido), 1)} dB`, obtido > 1e-3, '(b) 7.2'); }
{ const out = []; for (const nivelDb of [0, -20, -40]) { const ol = 99 + Math.round(nivelDb / 0.7526), [, L] = toca(seno({ ol }), {}, [60], 1.6); const a = Math.round(0.3 * FS), mag = espectro(L, a, N), df = FS / N, i0 = Math.round(fNota(60) / df); let s = 0, ru = 0; for (let i = 1; i < mag.length; i++) { const e = mag[i] * mag[i]; if (Math.abs(i - i0) <= 4) s += e; else ru += e; } out.push(`${nivelDb} dB: ${fmt(10 * Math.log10(s / Math.max(ru, 1e-30)), 1)} dB`); }
  reg('Filtro', 'relação sinal/ruído de uma senoide em 0, −20 e −40 dB (saída de 12 bits com 4 faixas)', 'sem referência: o ruído cai com o sinal por causa das faixas', out.join('; '), null, '(b) 7.2'); }

/* ====================================================== 7. Patches recriados */
{ const lin = []; let bad = 0;
  for (const [i, pt] of DD.FAB.entries()) { const m = novo(Motor, pt); m.msg({ t: 'on', n: 60, v: 100 }); const L = render(m, 4), pk = pico(L, Math.round(0.05 * FS)), fim = pico(L, Math.round(3.6 * FS)); lin.push(`${pt.nome}: ${fmt(dB(pk), 1)} dBFS`); if (!(dB(pk) >= -30 && dB(pk) <= -3) || !isFinite(pk)) bad++; void i; void fim; }
  reg('Patches', 'seis patches recriados (nota 60, vel 100): pico', 'entre −30 e −3 dBFS e finito (não são os de fábrica; (c))', lin.join('; '), bad === 0, '(c) 9'); }
{ let bad = [];
  for (const pt of DD.FAB) { const m = novo(Motor, pt); m.msg({ t: 'on', n: 48, v: 100 }); render(m, 1); m.msg({ t: 'off', n: 48 }); const L = render(m, 8); if (dB(pico(L, Math.round(7 * FS))) > -60) bad.push(pt.nome); }
  reg('Patches', 'depois de soltar a nota, cada patch recriado fica em silêncio em 8 s', 'sem nota presa (< −60 dBFS)', bad.length ? 'presos: ' + bad.join(', ') : 'todos soltam', bad.length === 0, ''); }
{ const nomes = DD.FAB.map(x => x.nome), ok = nomes.every(n => n.length <= 10) && DD.FAB.every(pt => JSON.stringify(DD.norm(pt)) === JSON.stringify(pt));
  reg('Patches', 'nomes de até 10 caracteres e valores já dentro das faixas (norm não muda nada)', 'verdadeiro', nomes.join(', '), ok, ''); }

{ const m = novo(Motor, seno()); m.msg({ t: 'on', n: 60, v: 100, at: 0.25 }); const L = render(m, 0.6); const i0 = L.findIndex(x => Math.abs(x) > 0.001), t = i0 / FS;
  reg('Agendamento', 'evento com hora ("at", relógio do AudioContext)', 'a nota começa em 0,250 s (até +3 ms)', fmt(t, 4) + ' s', t >= 0.25 && t <= 0.253, ''); }
{ const m = novo(Motor, seno({}, {})); m.msg({ t: 'on', n: 60, v: 100 }); m.msg({ t: 'on', n: 64, v: 100, seq: 1, at: 0.1 }); m.msg({ t: 'on', n: 67, v: 100, seq: 1, at: 0.6 }); render(m, 0.3); m.msg({ t: 'seqpara' }); render(m, 3);
  const vivas = m.vozes.filter(v => v.ativa).map(v => v.nota);
  reg('Agendamento', '"seqpara" solta só as notas do sequenciador e cancela as agendadas', 'a nota tocada à mão continua; a do sequenciador solta; a agendada some', 'notas ativas: ' + (vivas.join(', ') || 'nenhuma'), vivas.length === 1 && vivas[0] === 60, ''); }

/* ====================================================== 8. Calibração e custo */
{ let falta = 0; const dados = DD.patchInit(), n0 = DD.norm(null), n1 = DD.norm({ ops: [{ ol: 'x', r: [500, -3] }], alg: 99, nome: 'NOME MUITO LONGO' });
  reg('Calibração', 'norm: valores inválidos são limitados e o nome cortado em 10 caracteres', 'ops[0].ol = 99 (padrão do VOICE INIT para valor inválido), r limitados a 0..99, alg 31, nome de 10 letras', `ol ${n1.ops[0].ol}, r ${n1.ops[0].r.slice(0, 2)}, alg ${n1.alg}, nome "${n1.nome}"`, n1.ops[0].ol === 99 && n1.ops[0].r[0] === 99 && n1.ops[0].r[1] === 0 && n1.alg === 31 && n1.nome.length === 10, ''); void falta; void dados; void n0; }
{ const [, L] = toca(DD.patchInit(), {}, [], 1); reg('Calibração', 'sem tecla', 'silêncio (< −80 dBFS)', fmt(dB(pico(L)), 1) + ' dBFS', dB(pico(L)) < -80, ''); }
{ const m = novo(Motor, seno()); m.msg({ t: 'on', n: 60, v: 100 }); render(m, 0.5); m.msg({ t: 'off', n: 60 }); const L = render(m, 2.5), v = dB(pico(L, Math.round(1.5 * FS))); reg('Calibração', 'depois de soltar (L4 = 0)', 'silêncio (< −80 dBFS) e voz liberada', fmt(v, 1) + ' dBFS, ' + m.vozes.filter(x => x.ativa).length + ' voz(es)', v < -80 && m.vozes.every(x => !x.ativa), ''); }
{ const m = novo(Motor, seno()); m.msg({ t: 'sus', on: true }); m.msg({ t: 'on', n: 60, v: 100 }); render(m, 0.3); m.msg({ t: 'off', n: 60 }); render(m, 0.3); const a = m.vozes[0].ativa; m.msg({ t: 'sus', on: false }); const L = render(m, 2); reg('Calibração', 'pedal de sustain', 'a nota continua com o pedal; solta ao levantá-lo', a ? 'segurou' : 'soltou', a && dB(pico(L, Math.round(1.6 * FS))) < -80, '(a) MAN'); }
{ const m = novo(Motor, seno(), {}); m.msg({ t: 'on', n: 60, v: 100, f: 0 }); m.fila.push({ t: 'on', n: 64, v: 100, f: Math.round(0.25 * FS) }); const L = render(m, 0.6); void L; reg('Calibração', 'mensagem agendada pela fila (campo f)', 'a nota 64 entra no quadro 12000', 'vozes: ' + m.vozes.filter(v => v.ativa).map(v => v.nota).join(','), m.vozes.filter(v => v.ativa).length === 2, ''); }
{ const m = novo(Motor, P({ alg: 31, ops: { 1: { ol: 99 }, 2: { ol: 99 }, 3: { ol: 99 }, 4: { ol: 99 }, 5: { ol: 99 }, 6: { ol: 99 } } })); for (let n = 40; n < 56; n++) m.msg({ t: 'on', n, v: 127 }); const t0 = performance.now(); const L = render(m, 10); const ms = performance.now() - t0, ok = isFinite(pico(L));
  reg('Custo', '10 s de áudio, 16 vozes com 6 portadoras (neste computador, Node)', 'bem abaixo de 100 % do tempo real', fmt(ms / 100, 1) + ' % do tempo real', ok && ms < 5000, ''); }
{ let nan = false; for (const a of [0, 3, 5, 12, 20, 27, 31]) { const m = novo(Motor, P({ alg: a, fb: 7, ops: { 1: { ol: 99 }, 2: { ol: 99 }, 3: { ol: 99 }, 4: { ol: 99 }, 5: { ol: 99 }, 6: { ol: 99 } } })); for (const n of [24, 60, 100]) m.msg({ t: 'on', n, v: 127 }); const L = render(m, 0.7); for (let i = 0; i < L.length; i++) if (!isFinite(L[i]) || Math.abs(L[i]) > 1) { nan = true; break; } }
  reg('Calibração', 'casos extremos (fb 7, tudo em 99, várias notas e algoritmos): sem NaN e sem passar de 1,0', 'finito e |x| ≤ 1', nan ? 'FALHA' : 'ok', !nan, ''); }

console.log('| Grupo | Medição | Esperado (pesquisa) | Medido | | Fonte |\n|---|---|---|---|---|---|');
for (const l of linhas) console.log('| ' + l.join(' | ') + ' |');
console.log(`\n${linhas.length} medições, ${falhas} fora da tolerância, ${linhas.filter(l => l[4] === 'registro').length} só registro.`);
process.exit(falhas ? 1 : 0);
