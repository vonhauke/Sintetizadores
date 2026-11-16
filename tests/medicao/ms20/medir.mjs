// Medições do motor de som de ms20/index.html, comparadas com docs/pesquisa/ms20.md.
// Uso: node tests/medicao/ms20/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
import { carregaMotor, novo, render, rms, pico, dB, espectro, picoHz, FS, NEUTRO } from './motor.mjs';

const Motor = carregaMotor(), DD = Motor.dados;
const S = {}; DD.FONTES.forEach((k, i) => { S[k] = i; });
const linhas = []; let falhas = 0;
const fmt = (v, c = 2) => typeof v === 'number' ? v.toFixed(c).replace('.', ',') : v;
function reg(grupo, item, esperado, medido, ok, fonte = '') { if (!ok) falhas++; linhas.push([grupo, item, esperado, medido, ok ? 'ok' : 'FORA', fonte]); }
const cents = (a, b) => 1200 * Math.log2(a / b);
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const fNota = n => DD.F_REF * Math.pow(2, (n - DD.NOTA_BASE) / 12);
/** potência média (Welch) numa banda de 1/3 de oitava em torno de f, em dB */
function bandas(x, a, b, n = 8192) {
  const acc = new Float64Array(n / 2); let q = 0;
  for (let i = a; i + n <= b; i += n / 2) { const m = espectro(x, i, n); for (let k = 0; k < m.length; k++) acc[k] += m[k] * m[k]; q++; }
  return f => { const lo = Math.max(1, Math.floor(f / 1.122 / (FS / n))), hi = Math.ceil(f * 1.122 / (FS / n)); let s = 0; for (let k = lo; k <= hi; k++) s += acc[k]; return 10 * Math.log10(s / q / (hi - lo + 1) + 1e-30); };
}
const toca = (p, cabos, nota = 48, seg = 1.5, sonda) => { const m = novo(Motor, p, cabos); if (nota != null) m.msg({ t: 'on', n: nota }); return [m, ...render(m, seg, sonda)]; };
const LIN = { lvl1: 1.5 };   // nível baixo: o limitador de diodos fica na região linear

/* 1. Altura dos VCOs: Hz/V, tecla mais grave = 1 V = 65,41 Hz em 8' */
for (const [nota, sc] of [[36, 2], [48, 2], [60, 2], [72, 2], [48, 0], [48, 1], [48, 3]]) {
  const [, L] = toca({ ...LIN, vco1Scale: sc }, {}, nota, 3), alvo = fNota(nota) * Math.pow(2, sc - 2), f = picoHz(L, FS, 65536, alvo * 0.94, alvo * 1.06);
  reg('VCO 1', `nota MIDI ${nota}, SCALE ${["32'", "16'", "8'", "4'"][sc]}`, fmt(alvo) + ' Hz', `${fmt(f)} Hz (${fmt(cents(f, alvo), 1)} cents)`, Math.abs(cents(f, alvo)) < 3, 'Hz/V (a); referência (c)');
}
for (const [sc, pitch, tune, nome, ct] of [[1, 0, 0, "SCALE 8'", 0], [0, 0, 0, "SCALE 16'", -1200], [3, 0, 0, "SCALE 2'", 2400], [1, 5, 0, 'PITCH +5', 1200], [1, -5, 0, 'PITCH −5', -1200], [1, 0, 5, 'MASTER TUNE +5', 100], [1, 0, -5, 'MASTER TUNE −5', -100]]) {
  const [, L] = toca({ lvl1: 0, lvl2: 1.5, vco2Scale: sc, pitch, tune }, {}, 48, 3), alvo = fNota(48) * Math.pow(2, ct / 1200), f = picoHz(L, FS, 65536, alvo * 0.94, alvo * 1.06), c = cents(f, alvo);
  reg('VCO 2', nome, `${ct >= 0 ? '+' : ''}${ct} cents sobre o Dó (mais ${2} cents de desvio fixo (c))`, `${fmt(c + ct, 1)} cents`, perto(c, 2, 3), '±1 oitava, ±100 cents (a)');
}
/* 2. Largura de pulso: razão entre 2º harmônico e fundamental = cos(pi·d) */
for (const [pw, d] of [[0, 0.5], [5, 0.25], [9, 0.05]]) {
  const [, L] = toca({ ...LIN, vco1Wave: 2, pw }, {}, 60, 2), f = fNota(60), m = espectro(L, FS / 2, 65536), b = k => { const i = Math.round(k * f / (FS / 65536)); return Math.max(m[i - 1], m[i], m[i + 1]); };
  const r = b(2) / b(1), alvo = Math.cos(Math.PI * d);
  reg('VCO 1', `PW em ${pw}: pulso de ${d * 100} %`, `h2/h1 = ${fmt(alvo)}`, fmt(r), perto(r, alvo, 0.06), '1:1 até sumir (a)');
}
{ const [, L] = toca({ ...LIN, vco1Wave: 2, pw: 10 }, {}, 60, 1.5); reg('VCO 1', 'PW em 10', 'o pulso some (silêncio)', fmt(dB(rms(L, FS / 2)), 1) + ' dBFS', dB(rms(L, FS / 2)) < -60, '(a)'); }
{ const [, L] = toca({ lvl1: 0, lvl2: 1.5, vco2Wave: 2 }, {}, 60, 2), f = fNota(60) * Math.pow(2, 2 / 1200), m = espectro(L, FS / 2, 65536), b = k => { const i = Math.round(k * f / (FS / 65536)); return Math.max(m[i - 1], m[i], m[i + 1]); };
  reg('VCO 2', 'pulso fixo', 'h2/h1 = 0,71 (25 %)', fmt(b(2) / b(1)), perto(b(2) / b(1), 0.707, 0.06), '(b)'); }
/* 3. Ring: somas e diferenças, sem a fundamental do VCO 2 sozinha */
{ const [, L] = toca({ lvl1: 0, lvl2: 1.5, vco2Wave: 3, pitch: 2.5 }, {}, 60, 2.5), f1 = fNota(60), f2 = f1 * Math.pow(2, 0.5 + 2 / 1200), m = espectro(L, FS / 2, 65536), b = f => { const i = Math.round(f / (FS / 65536)); return Math.max(m[i - 2], m[i - 1], m[i], m[i + 1], m[i + 2]); };
  const dif = dB(b(f2 - f1)), som = dB(b(f1 + f2)), so2 = dB(b(f2));
  reg('VCO 2', 'RING com VCO 2 meia oitava acima', 'picos em f2−f1 e f1+f2; f2 sozinha ausente', `f2−f1 ${fmt(dif, 1)} dB, f1+f2 ${fmt(som, 1)} dB, f2 ${fmt(so2, 1)} dB`, dif - so2 > 25 && som - so2 > 25, 'somas e diferenças (a); modelo (c)'); }
/* 4. Aliasing da serra numa nota aguda */
{ const [, L] = toca({ ...LIN, vco1Scale: 3 }, {}, 72, 2.5), f = fNota(72) * 2, m = espectro(L, FS / 2, 65536), df = FS / 65536; let h1 = 0, pior = 0;
  for (let i = 4; i < m.length; i++) { const fr = i * df, k = Math.round(fr / f); if (k === 1 && Math.abs(fr - f) < 6 * df) h1 = Math.max(h1, m[i]); if (fr < 18000 && Math.abs(fr - k * f) > 12 * df) pior = Math.max(pior, m[i]); }
  reg('VCO 1', `aliasing da serra em ${fmt(f, 0)} Hz`, 'abaixo de −60 dB da fundamental', fmt(dB(pior / h1), 1) + ' dB', dB(pior / h1) < -60, ''); }

/* 5. Passa-baixas: 12 dB/oitava; em fc, sem PEAK, −7,4 dB (amortecimento 7/3) */
{ const [, L] = toca({ lvl1: 1.5, vco1Wave: 3, lpCut: 5 }, {}, 48, 12), fc = DD.corteHz(5), B = bandas(L, FS, 12 * FS);
  const incl = B(fc * 8) - B(fc * 4), emFc = B(fc) - B(fc / 8);
  reg('LPF', 'inclinação entre 4·fc e 8·fc (fc = ' + fmt(fc, 0) + ' Hz)', '−12 dB/oitava', fmt(incl, 1) + ' dB/oitava', perto(incl, -12, 1.5), '(b) Stinchcombe');
  reg('LPF', 'nível em fc com PEAK 0', '−7,4 dB (1/(7/3))', fmt(emFc, 1) + ' dB', perto(emFc, -7.4, 1.5), '(b) H(s) com R1=R2/3'); }
/* 6. Passa-altas: 6 dB/oitava */
{ const [, L] = toca({ lvl1: 1.5, vco1Wave: 3, hpCut: 8 }, {}, 48, 12), fc = DD.corteHz(8), B = bandas(L, FS, 12 * FS), incl = B(fc / 8) - B(fc / 16), alto = B(fc * 3) - B(fc * 3.8);
  reg('HPF', 'inclinação entre fc/16 e fc/8 (fc = ' + fmt(fc, 0) + ' Hz)', '+6 dB/oitava', fmt(incl, 1) + ' dB/oitava', perto(incl, 6, 1.2), '(b) Stinchcombe, SOS');
  reg('HPF', 'acima do corte', 'plano', fmt(alto, 1) + ' dB entre 3·fc e 3,8·fc', Math.abs(alto) < 1.5, ''); }
/* 7. Ressonância e auto-oscilação */
{ const [, L0] = toca({ lvl1: 1.5, vco1Wave: 3, lpCut: 5, lpPeak: 0 }, {}, 48, 10), [, L1] = toca({ lvl1: 0.5, vco1Wave: 3, lpCut: 5, lpPeak: 2 / DD.K_MAX * 10 }, {}, 48, 10), fc = DD.corteHz(5);
  const B0 = bandas(L0, FS, 10 * FS), B1 = bandas(L1, FS, 10 * FS), g = (B1(fc) - B1(fc / 8)) - (B0(fc) - B0(fc / 8));
  reg('LPF', 'ganho em fc com ganho de laço 2 (PEAK ' + fmt(2 / DD.K_MAX * 10, 1) + ') em relação a PEAK 0', 'cerca de +17 dB (de 3/7 para 3; a média em 1/3 de oitava reduz)', fmt(g, 1) + ' dB', g > 9 && g < 18, '(b)'); }
for (const [filtro, kc, kp] of [['LPF', 'lpCut', 'lpPeak'], ['HPF', 'hpCut', 'hpPeak']]) {
  const lim = 7 / 3 / DD.K_MAX * 10;
  const [, La] = toca({ lvl1: 0, [kc]: 5, [kp]: lim - 0.4, ...(filtro === 'HPF' ? { lpCut: 10 } : {}) }, {}, 48, 3), [, Lb] = toca({ lvl1: 0, [kc]: 5, [kp]: lim + 0.3 }, {}, 48, 3);
  reg(filtro, `PEAK ${fmt(lim - 0.4, 1)} (abaixo do limiar ${fmt(lim, 2)})`, 'não oscila', fmt(dB(rms(La, 2 * FS)), 1) + ' dBFS', dB(rms(La, 2 * FS)) < -70, 'oscila com ganho de laço 7/3 (b)');
  reg(filtro, `PEAK ${fmt(lim + 0.3, 1)} (acima do limiar)`, 'auto-oscila', fmt(dB(rms(Lb, 2 * FS)), 1) + ' dBFS', dB(rms(Lb, 2 * FS)) > -30, 'de plano até a auto-oscilação (a)');
  for (const k of [0, 2.5, 5, 7.5, 10]) {
    const [, L] = toca({ lvl1: 0, [kc]: k, [kp]: 10, ...(filtro === 'HPF' ? { lpCut: 10 } : { hpCut: 0 }) }, {}, 48, 4), alvo = DD.corteHz(k), f = picoHz(L, 2 * FS, 65536, alvo * 0.6, Math.min(23000, alvo * 1.6));
    reg(filtro, `auto-oscilação com CUTOFF em ${k}`, fmt(alvo, 0) + ' Hz', `${fmt(f, 0)} Hz (${fmt(cents(f, alvo), 0)} cents)`, Math.abs(cents(f, alvo)) < 120, '50 Hz a 15 kHz (a); lei do knob (c)');
  }
}
/* 8. Limitador de diodos no laço */
{ const n = lvl => { const [, L] = toca({ lvl1: lvl, lpCut: 10 }, {}, 48, 1.5); return dB(rms(L, FS / 2)); }, a = n(1.5), b = n(10), ideal = 20 * Math.log10(100 / 2.25);
  reg('Limitador', 'nível de saída com VCO 1 LEVEL 1,5 → 10', `bem menos que os ${fmt(ideal, 1)} dB lineares (comprime)`, fmt(b - a, 1) + ' dB', b - a < ideal - 8 && b - a > 6, 'diodos conduzem perto de 0,5 V (b)');
  const osc = lvl => { const [, L] = toca({ lvl1: lvl, vco1Scale: 1, lpCut: 6.5, lpPeak: 10 }, {}, 36, 3), fc = DD.corteHz(6.5), m = espectro(L, FS, 65536); let p = 0; for (let i = Math.round(fc * 0.8 / (FS / 65536)); i < fc * 1.25 / (FS / 65536); i++) p = Math.max(p, m[i]); return dB(p); };
  const o0 = osc(0), o10 = osc(10);
  reg('Limitador', 'auto-oscilação do LPF com serra forte na entrada (LEVEL 0 → 10)', 'a entrada disputa o limitador: a oscilação cai', `${fmt(o0, 1)} → ${fmt(o10, 1)} dB`, o0 - o10 > 3, '(b) Kassutronics; (c) no Korg35');
  const gr = pk => { const [, L] = toca({ lvl1: 1, lpCut: 7, lpPeak: pk }, {}, 36, 3), m = espectro(L, FS, 65536), i = Math.round(fNota(36) / (FS / 65536)); return dB(Math.max(m[i - 1], m[i], m[i + 1])); };
  const g0 = gr(0), g8 = gr(8);
  reg('Limitador', 'fundamental grave (65 Hz) com sinal fraco, PEAK 0 → 8', 'não muda (o ganho em baixa frequência não depende do PEAK)', fmt(g8 - g0, 2) + ' dB', Math.abs(g8 - g0) < 1, '(b) Stinchcombe');
  const gf = pk => { const [, L] = toca({ lvl1: 10, lpCut: 7, lpPeak: pk }, {}, 36, 3), m = espectro(L, FS, 65536), i = Math.round(fNota(36) / (FS / 65536)); return dB(Math.max(m[i - 1], m[i], m[i + 1])); };
  const h0 = gf(0), h10 = gf(10);
  reg('Limitador', 'fundamental grave com sinal forte, PEAK 0 → 10', 'cai (a ressonância ocupa o limitador)', fmt(h10 - h0, 2) + ' dB', h10 - h0 < -1, '(c)');
  reg('Limitador', 'curva do estágio: entrada 1 mV / 8 mV / 50 mV', '58 mV (linear) / perto de 0,3 V / perto de 0,45 V', [0.001, 0.008, 0.05].map(v => fmt(DD.limitador(v), 3) + ' V').join(' / '), perto(DD.limitador(0.001), 0.0584, 0.004) && DD.limitador(0.05) < 0.5 && DD.limitador(0.05) > 0.38, 'ganho 58,4; condução perto de 0,5 V (b)'); }

/* 9. Envelopes (sondando as tensões dos jacks) */
const tAte = (tr, de, cond) => { for (let i = de; i < tr.length; i++) if (cond(tr[i])) return (i - de) * 16 / FS; return NaN; };
for (const k of [0, 5, 10]) {
  const T = DD.tempoEg(k), m = novo(Motor, { eg2Attack: k, eg2Sustain: 10 }); m.msg({ t: 'on', n: 48 }); const [, tr] = render(m, T * 1.3 + 0.05, S.eg2Rev), t = tAte(tr, 0, v => v <= 0.001);
  reg('EG2', `ATTACK TIME em ${k}`, fmt(T * 1000, 1) + ' ms até o topo', fmt(t * 1000, 1) + ' ms', perto(t, T, T * 0.03 + 0.0008), 'máx. 10 s (a); curva e mínimo (c)');
}
for (const k of [0, 5, 10]) {
  const T = DD.tempoEg(k), m = novo(Motor, { eg2Release: k }); m.msg({ t: 'on', n: 48 }); render(m, 0.05); m.msg({ t: 'off', n: 48 }); const [, tr] = render(m, T * 1.3 + 0.05, S.eg2Rev), t = tAte(tr, 0, v => v >= 4.95);
  reg('EG2', `RELEASE TIME em ${k}`, fmt(T * 1000, 1) + ' ms até 1 %', fmt(t * 1000, 1) + ' ms', perto(t, T, T * 0.04 + 0.0008), 'máx. 10 s (a)');
}
{ const T = DD.tempoEg(5), m = novo(Motor, { eg2Decay: 5, eg2Sustain: 4 }); m.msg({ t: 'on', n: 48 }); const [, tr] = render(m, T * 3, S.eg2Rev), t = tAte(tr, 0, v => v >= 3 - 0.03), fim = 5 - tr[tr.length - 1];
  reg('EG2', 'DECAY TIME em 5, SUSTAIN LEVEL em 4', `${fmt(T * 1000, 0)} ms até 1 % do caminho; repouso em 2,00 V`, `${fmt(t * 1000, 0)} ms; ${fmt(fim, 2)} V`, perto(t, T, T * 0.06) && perto(fim, 2, 0.02), 'sustentação 0 a 5 V (a)'); }
for (const k of [0, 5, 10]) {
  const T = DD.tempoHold(k), m = novo(Motor, { eg2Hold: k, eg2Release: 0 }); m.msg({ t: 'on', n: 48 }); render(m, 0.05); m.msg({ t: 'off', n: 48 }); const [, tr] = render(m, T + 0.2, S.eg2Rev), t = tAte(tr, 0, v => v > 0.05);
  reg('EG2', `HOLD TIME em ${k}`, `release começa ${fmt(T, 3)} s depois de soltar`, fmt(t, 3) + ' s', perto(t, T, T * 0.01 + 0.002), 'adia o release (b); máx. 20 s (a)');
}
{ const Td = DD.tempoDelay(5), Ta = DD.tempoEg(5), m = novo(Motor, { eg1Delay: 5, eg1Attack: 5, eg1Release: 5 }); const [, pre] = render(m, 0.02, S.eg1); m.msg({ t: 'on', n: 48 }); const [, tr] = render(m, Td + Ta + 0.1, S.eg1), [, rv] = render(m, 0.01, S.eg1Rev);
  const t1 = tAte(tr, 0, v => v > -4.99), t2 = tAte(tr, 0, v => v >= -0.001);
  reg('EG1', 'repouso / topo', 'OUT −5 V em repouso e 0 V no topo; REV OUT 0 V no topo', `${fmt(pre[pre.length - 1], 2)} V / ${fmt(tr[tr.length - 1], 2)} V; REV ${fmt(rv[0], 2)} V`, perto(pre[pre.length - 1], -5, 0.01) && perto(tr[tr.length - 1], 0, 0.01) && perto(rv[0], 0, 0.01), '(a)');
  reg('EG1', 'DELAY TIME 5 e ATTACK TIME 5', `espera ${fmt(Td * 1000, 0)} ms, depois sobe em ${fmt(Ta * 1000, 0)} ms`, `${fmt(t1 * 1000, 0)} ms; ${fmt((t2 - t1) * 1000, 0)} ms`, perto(t1, Td, 0.004) && perto(t2 - t1, Ta, 0.006), 'trapezoidal (b)');
  m.msg({ t: 'off', n: 48 }); const [, rl] = render(m, 0.3, S.eg1), t3 = tAte(rl, 0, v => v <= -4.95);
  reg('EG1', 'RELEASE TIME 5', fmt(DD.tempoEg(5) * 1000, 0) + ' ms até 1 %', fmt(t3 * 1000, 0) + ' ms', perto(t3, DD.tempoEg(5), 0.006), ''); }

/* 10. Gerador de modulação */
for (const k of [0, 5, 10]) {
  const alvo = DD.mgHz(k), m = novo(Motor, { mgFreq: k }), seg = Math.max(2, 3.2 / alvo), [, tr] = render(m, seg, S.mgTri); const z = []; let mx = -9, mn = 9;
  for (let i = 1; i < tr.length; i++) { if (tr[i - 1] < 0 && tr[i] >= 0) z.push(i - tr[i] / (tr[i] - tr[i - 1])); mx = Math.max(mx, tr[i]); mn = Math.min(mn, tr[i]); }
  const f = (z.length - 1) / ((z[z.length - 1] - z[0]) * 16 / FS);
  reg('MG', `FREQUENCY em ${k}`, `${fmt(alvo, 2)} Hz, ±2,5 V`, `${fmt(f, 3)} Hz, ${fmt(mn, 2)} a ${fmt(mx, 2)} V`, perto(f, alvo, alvo * 0.02) && perto(mx, 2.5, 0.05) && perto(mn, -2.5, 0.05), '0,1 a 20 Hz; 5 Vp-p (a)');
}
for (const [k, sobe, nome] of [[0, 0.02, 'serra descendente / pulso largo'], [5, 0.5, 'triângulo / quadrada'], [10, 0.98, 'serra ascendente / pulso estreito']]) {
  const m = novo(Motor, { mgFreq: 8, mgWave: k }), [, tr] = render(m, 3, S.mgTri), m2 = novo(Motor, { mgFreq: 8, mgWave: k }), [, rc] = render(m2, 3, S.mgRect); let up = 0, alto = 0, n = 0;
  for (let i = 1; i < tr.length; i++) { if (tr[i] > tr[i - 1]) up++; if (rc[i] > 2.5) alto++; n++; }
  reg('MG', `WAVE FORM em ${k}: ${nome}`, `sobe em ${fmt(sobe * 100, 0)} % do ciclo; retângulo alto em ${fmt((1 - sobe) * 100, 0)} %`, `${fmt(100 * up / n, 1)} %; ${fmt(100 * alto / n, 1)} %`, perto(up / n, sobe, 0.03) && perto(alto / n, 1 - sobe, 0.03), '(a); sentido do knob (c)');
}

/* 11. Teclado, portamento, tensões dos jacks */
{ const m = novo(Motor); m.msg({ t: 'on', n: 36 }); render(m, 0.05); const a = m.V[S.kbdCv], ta = m.V[S.kbdTrig]; m.msg({ t: 'off', n: 36 }); m.msg({ t: 'on', n: 72 }); render(m, 0.05); const b = m.V[S.kbdCv]; m.msg({ t: 'off', n: 72 }); render(m, 0.01);
  reg('Teclado', 'KBD CV OUT na tecla mais grave / mais aguda', '1 V / 8 V (dobra a cada oitava)', `${fmt(a, 3)} V / ${fmt(b, 3)} V`, perto(a, 1, 0.001) && perto(b, 8, 0.001), '0 a +8 V exponencial (a); 1 V na base (c)');
  reg('Teclado', 'TRIG OUT com tecla / sem tecla', '0 V (terra) / +5 V', `${fmt(ta, 0)} V / ${fmt(m.V[S.kbdTrig], 0)} V`, ta === 0 && m.V[S.kbdTrig] === 5, 'S-trig (a)'); }
{ const m = novo(Motor, { eg2Decay: 6, eg2Sustain: 3 }); m.msg({ t: 'on', n: 48 }); render(m, 0.3); const e1 = m.V[S.eg2Rev]; m.msg({ t: 'on', n: 60 }); const [L] = render(m, 0.5), e2 = m.V[S.eg2Rev], fa = picoHz(L, 0, 16384, 60, 2000);
  m.msg({ t: 'on', n: 55 }); const [L2] = render(m, 0.5), fb = picoHz(L2, 0, 16384, 60, 2000); m.msg({ t: 'off', n: 60 }); const [L3] = render(m, 0.5), fc = picoHz(L3, 0, 16384, 60, 2000);
  reg('Teclado', 'segunda tecla mais aguda com a primeira presa', 'soa a mais aguda', fmt(fa, 1) + ' Hz', Math.abs(cents(fa, fNota(60))) < 15, 'prioridade para a nota aguda (b)');
  reg('Teclado', 'terceira tecla, mais grave que a segunda', 'continua na mais aguda', fmt(fb, 1) + ' Hz', Math.abs(cents(fb, fNota(60))) < 15, '(b)');
  reg('Teclado', 'soltando a mais aguda', 'passa para a seguinte mais aguda (Sol)', fmt(fc, 1) + ' Hz', Math.abs(cents(fc, fNota(55))) < 15, '(b)');
  reg('Teclado', 'envelope ao ligar notas (legato)', 'não redispara (EG2 segue caindo)', `REV OUT ${fmt(e1, 2)} → ${fmt(e2, 2)} V`, e2 >= e1 - 0.01, 'um só disparo (b)'); }
{ const T = DD.tempoPorta(5), m = novo(Motor, { porta: 5 }); m.msg({ t: 'on', n: 36 }); render(m, T * 3); m.msg({ t: 'off', n: 36 }); m.msg({ t: 'on', n: 48 }); const [, tr] = render(m, T * 2, S.kbdCv), t = tAte(tr, 0, v => v >= 1.99);
  reg('Portamento', 'TIME em 5, salto de uma oitava', fmt(T * 1000, 0) + ' ms até 1 % do alvo', fmt(t * 1000, 0) + ' ms', perto(t, T, T * 0.05), 'máx. 10 s (a); curva (c)');
  const m2 = novo(Motor, { porta: 0 }); m2.msg({ t: 'on', n: 48 }); render(m2, 0.002); reg('Portamento', 'TIME em 0', 'sem deslize', fmt(m2.V[S.kbdCv], 3) + ' V em 2 ms', perto(m2.V[S.kbdCv], 2, 0.001), ''); }

/* 12. Painel de cabos: cada entrada e a normalização que ela desfaz */
const f0de = (p, cabos, nota = 48, lo = 20, hi = 4000) => { const [, L] = toca(p, cabos, nota, 2); return picoHz(L, FS, 32768, lo, hi); };
{ const base = f0de(LIN, {}), fT = f0de({ ...LIN, fmMg: 2, roda: 1 }, { total: 'roda' });
  reg('Cabos', 'RODA (+5 V) → TOTAL, MG/T.EXT da FM em 2', '+1 oitava (1 oitava/V × 0,2 × 5 V), sem vibrato do MG', fmt(cents(fT, base), 0) + ' cents', perto(cents(fT, base), 1200, 15), 'substitui o MG (a)');
  const [, Lv] = toca({ ...LIN, fmMg: 2, mgFreq: 6 }, {}, 48, 2), [, Lc] = toca({ ...LIN, fmMg: 2, mgFreq: 6, roda: 0 }, { total: 'roda' }, 48, 2); const larg = L => { const m = espectro(L, FS / 2, 32768); let mx = 0, q = 0; for (const v of m) mx = Math.max(mx, v); for (const v of m) if (v > mx * 0.1) q++; return q; };
  reg('Cabos', 'sem cabo em TOTAL, MG/T.EXT em 2', 'vibrato do MG (espectro espalhado)', `${larg(Lv)} bins fortes contra ${larg(Lc)} com cabo`, larg(Lv) > 3 * larg(Lc), 'triangular ligada internamente (a)');
  const fF = f0de({ ...LIN, fmEg1: 4, roda: 0.5 }, { freq: 'roda' });
  reg('Cabos', 'RODA (+2,5 V) → FREQ, EG1/EXT em 4', '+1 oitava', fmt(cents(fF, base), 0) + ' cents', perto(cents(fF, base), 1200, 15), '1 oitava/V (a); substitui o EG1 (a)');
  const [m] = toca({ ...LIN, fmEg1: 2, eg1Attack: 10 }, {}, null, 0.01); m.msg({ t: 'on', n: 48 }); const [L] = render(m, 1.2), fE = picoHz(L, 0, 32768, 20, 2000);
  reg('Cabos', 'sem cabo em FREQ, EG1/EXT em 2, ataque do EG1 lento', 'começa cerca de 1 oitava abaixo e sobe', fmt(cents(fE, base), 0) + ' cents no começo', cents(fE, base) < -500, 'EG1 ligado à altura (a)(b)');
  const o = (p, cabos) => { const [, L] = toca({ lvl1: 0, lpPeak: 10, ...p }, cabos, 48, 2.5); return picoHz(L, FS, 32768, 30, 20000); };
  const c0 = o({ lpCut: 2, lpEg2: 0 }, {}), c1 = o({ lpCut: 2, lpEg2: 5, roda: 0.5 }, { lpCv: 'roda' }), c2 = o({ lpCut: 2, lpEg2: 5, eg2Sustain: 10 }, {});
  reg('Cabos', 'RODA (+2,5 V) → CUTOFF FREQ do LPF, EG2/EXT em 5', '+2,5 oitavas (2 oitavas/V)', fmt(cents(c1, c0) / 1200, 2) + ' oitavas', perto(cents(c1, c0) / 1200, 2.5, 0.15), '2 oitavas/V (a); substitui o EG2 (a)');
  reg('Cabos', 'sem cabo, EG2/EXT em 5, EG2 no topo (5 V)', '+5 oitavas', fmt(cents(c2, c0) / 1200, 2) + ' oitavas', perto(cents(c2, c0) / 1200, 5, 0.25), 'EG2 ligado ao corte (b)');
  const oh = (p, cabos) => { const [, L] = toca({ lvl1: 0, hpPeak: 10, lpCut: 10, ...p }, cabos, 48, 2.5); return picoHz(L, FS, 32768, 30, 20000); };
  const h0 = oh({ hpCut: 2 }, {}), h1 = oh({ hpCut: 2, hpEg2: 5, roda: 0.5 }, { hpCv: 'roda' }), h2 = oh({ hpCut: 2, hpMg: 4, roda: 0.5 }, { total: 'roda' });
  reg('Cabos', 'RODA (+2,5 V) → CUTOFF FREQ do HPF, EG2/EXT em 5', '+2,5 oitavas', fmt(cents(h1, h0) / 1200, 2) + ' oitavas', perto(cents(h1, h0) / 1200, 2.5, 0.15), '(a)');
  reg('Cabos', 'RODA (+2,5 V) → TOTAL, MG/T.EXT do HPF em 4', '+2 oitavas', fmt(cents(h2, h0) / 1200, 2) + ' oitavas', perto(cents(h2, h0) / 1200, 2, 0.15), 'TOTAL age em VCO e VCF (a)');
  const v2 = f0de({ lvl1: 0, lvl2: 1.5, roda: 0.4 }, { vco2Cv: 'roda' }), [, Lz] = toca({ lvl1: 0, lvl2: 1.5, roda: 0 }, { vco2Cv: 'roda' }, 48, 1);
  reg('Cabos', 'RODA (+2 V) → VCO 2 CV IN, tecla qualquer', '130,8 Hz (2 V × 65,4 Hz/V), sem seguir o teclado', fmt(v2, 1) + ' Hz', Math.abs(cents(v2, 2 * DD.F_REF)) < 12, 'Hz/V linear (a); substitui o teclado (b)');
  reg('Cabos', 'RODA no centro (0 V) → VCO 2 CV IN', 'VCO 2 para (0 Hz)', fmt(dB(rms(Lz, FS / 2)), 1) + ' dBFS', dB(rms(Lz, FS / 2)) < -60, '(b) SOS');
  const v12 = f0de({ ...LIN, lvl2: 0, roda: 0.2 }, { vco12Cv: 'roda' }, 60);
  reg('Cabos', 'RODA (+1 V) → VCO 1+2 CV IN, tecla Dó 4', '65,4 Hz (ignora o teclado)', fmt(v12, 1) + ' Hz', Math.abs(cents(v12, DD.F_REF)) < 12, '(a)'); }
{ const [, L] = toca({ mgFreq: 7, mgWave: 5, eg2Decay: 3, eg2Sustain: 0 }, { trigIn: 'mgRect' }, null, 3), f = DD.mgHz(7); let q = 0, on = false;
  for (let i = FS / 2; i < 2.5 * FS; i += 48) { const r = rms(L, i, i + 48); if (!on && r > 0.02) { on = true; q++; } else if (on && r < 0.004) on = false; }
  reg('Cabos', 'retângulo do MG → TRIG IN, sem tecla', `notas repetidas a ${fmt(f, 2)} Hz (${fmt(f * 2, 0)} em 2 s)`, q + ' ataques em 2 s', Math.abs(q - f * 2) <= 1.5, 'gatilho externo (a)');
  const [, Lk] = toca({ mgFreq: 7 }, { trigIn: 'botao' }, 48, 1); reg('Cabos', 'BOTÃO → TRIG IN, tecla apertada e botão solto', 'silêncio (o teclado deixa de disparar)', fmt(dB(rms(Lk, FS / 2)), 1) + ' dBFS', dB(rms(Lk, FS / 2)) < -70, 'substitui o gatilho do teclado (a)(b)');
  const [, Lb] = toca({ botao: 1 }, { trigIn: 'botao' }, null, 1); reg('Cabos', 'BOTÃO apertado → TRIG IN, sem tecla', 'soa', fmt(dB(rms(Lb, FS / 2)), 1) + ' dBFS', dB(rms(Lb, FS / 2)) > -40, 'botão vai ao terra (a)');
  const m = novo(Motor, { botao: 1, fmEg1: 0 }, { eg1Trig: 'botao' }); render(m, 0.1); const a = m.V[S.eg1], b = m.V[S.eg2Rev];
  reg('Cabos', 'BOTÃO apertado → EG 1 TRIG IN, sem tecla', 'só o EG1 dispara (EG1 0 V; EG2 REV +5 V)', `${fmt(a, 2)} V; ${fmt(b, 2)} V`, perto(a, 0, 0.01) && perto(b, 5, 0.01), '(a)'); }
{ const m = novo(Motor, { mgFreq: 7.5 }, { shClock: 'mgRect', shIn: 'white' }), [, tr] = render(m, 2, S.shOut); let mud = 0; const vals = new Set();
  for (let i = 1; i < tr.length; i++) if (tr[i] !== tr[i - 1]) { mud++; vals.add(tr[i]); }
  const f = DD.mgHz(7.5); reg('Cabos', 'ruído branco → S&H IN, retângulo do MG → CLOCK', `degraus a ${fmt(f, 2)} Hz (${fmt(2 * f, 0)} em 2 s), dentro de ±2,5 V`, `${mud} degraus`, Math.abs(mud - 2 * f) <= 1.5 && [...vals].every(v => Math.abs(v) <= 2.5), 'amostra a cada gatilho (b)');
  const m2 = novo(Motor, { mgFreq: 8, roda: 0.5 }, { vcaIn: 'mgTri', vcaCtl: 'roda' }), [, t2] = render(m2, 1, S.vcaOut); let mx = 0; for (const v of t2) mx = Math.max(mx, Math.abs(v));
  reg('Cabos', 'VCA de modulação: triângulo do MG na entrada, +2,5 V no controle', '±1,25 V na saída (metade)', '±' + fmt(mx, 2) + ' V', perto(mx, 1.25, 0.05), 'controle 0 a +5 V (a); lei linear (c)');
  const [, Li] = toca({ roda: 1 }, { initGain: 'roda' }, null, 1); reg('Cabos', 'RODA (+5 V) → INITIAL GAIN, sem tecla', 'soa (VCA aberto)', fmt(dB(rms(Li, FS / 2)), 1) + ' dBFS', dB(rms(Li, FS / 2)) > -40, 'soma ao EG2 (a)');
  const [, Le] = toca({ lvl1: 0 }, { extSig: 'white' }, 48, 1), [, Ln] = toca({ lvl1: 0 }, {}, 48, 1); reg('Cabos', 'ruído branco → EXT SIGNAL IN, VCOs em zero', 'ruído na saída (sem cabo: silêncio)', `${fmt(dB(rms(Le, FS / 2)), 1)} dBFS (sem cabo ${fmt(dB(rms(Ln, FS / 2)), 1)})`, dB(rms(Le, FS / 2)) > -40 && dB(rms(Ln, FS / 2)) < -80, '(a)');
  const mr = novo(Motor), n = 4 * FS, W = new Float32Array(n), P = new Float32Array(n), tmp = new Float32Array(1); for (let i = 0; i < n; i++) { mr.process(tmp, tmp, 1); W[i] = mr.V[S.white] / 2.5; P[i] = mr.V[S.pink] / 2.5; }
  const BW = bandas(W, 0, n), BP = bandas(P, 0, n), dw = BW(4000) - BW(500), dp = BP(4000) - BP(500);
  reg('Ruído', 'branco e rosa: 4 kHz em relação a 500 Hz', 'branco 0 dB; rosa −9 dB (−3 dB/oitava)', `${fmt(dw, 1)} dB; ${fmt(dp, 1)} dB`, Math.abs(dw) < 1.2 && perto(dp, -9, 1.5), '(a)');
  reg('Ruído', 'excursão', 'até ±2,5 V (5 Vp-p)', `branco ±${fmt(2.5 * pico(W), 2)} V; rosa ±${fmt(2.5 * pico(P), 2)} V`, pico(W) <= 1 && pico(P) <= 1 && pico(P) > 0.5, '(a)'); }
/* 13. Processador de sinal externo, alimentado pelo jack PHONES */
{ const m = novo(Motor, { vco1Wave: 0, lvl1: 4, lpCut: 6, espLevel: 8, espLow: 0, espHigh: 6, espThr: 3 }, { espIn: 'phones' }); m.msg({ t: 'on', n: 57 }); render(m, 1); const f = fNota(57), cv = m.V[S.espCv], ev = m.V[S.espEnv], tg = m.V[S.espTrig];
  reg('ESP', 'triângulo de 220 Hz em SIGNAL IN: CV OUT com CV ADJUST em 5', fmt(f / DD.F_REF, 2) + ' V (Hz/V)', fmt(cv, 2) + ' V', perto(cv, f / DD.F_REF, 0.15), '0 a +8,4 V (a); escala (c)');
  reg('ESP', 'ENV OUT e TRIG OUT com sinal', 'envelope acima de 0 V; gatilho no terra', `${fmt(ev, 2)} V; ${fmt(tg, 0)} V`, ev > 0.3 && ev <= 5 && tg === 0, '0 a +5 V (a)');
  m.msg({ t: 'off', n: 57 }); render(m, 1); reg('ESP', 'sem sinal', 'ENV OUT perto de 0 V; gatilho solto (+5 V)', `${fmt(m.V[S.espEnv], 3)} V; ${fmt(m.V[S.espTrig], 0)} V`, m.V[S.espEnv] < 0.05 && m.V[S.espTrig] === 5, '');
  const bp = (lo, hi) => { const mm = novo(Motor, { vco1Wave: 0, lvl1: 4, lpCut: 6, espLevel: 5, espLow: lo, espHigh: hi }, { espIn: 'phones' }); mm.msg({ t: 'on', n: 57 }); const [, tr] = render(mm, 1, S.espBpf); return dB(rms(tr, tr.length / 2)); };
  const a = bp(0, 10), b = bp(10, 10), c = bp(0, 0);
  reg('ESP', 'passa-faixa: LOW CUT 0 → 10 e HIGH CUT 10 → 0, tom de 220 Hz', 'os dois atenuam', `${fmt(b - a, 1)} dB; ${fmt(c - a, 1)} dB`, b - a < -6 && c - a < -3, '50–2 500 Hz e 100–5 000 Hz (a)');
  const am = lv => { const mm = novo(Motor, { vco1Wave: 0, lvl1: 4, lpCut: 6, espLevel: lv }, { espIn: 'phones' }); mm.msg({ t: 'on', n: 57 }); const [, tr] = render(mm, 0.5, S.espAmp); return pico(tr, tr.length / 2); };
  reg('ESP', 'SIGNAL LEVEL 2 → 10 na saída do amplificador', 'sobe e satura em ±5 V', `±${fmt(am(2), 2)} V → ±${fmt(am(10), 2)} V`, am(10) > am(2) * 3 && am(10) <= 5, '(c)'); }

/* 14. Nível de saída e pior caso */
{ const m = novo(Motor, DD.PADRAO); m.msg({ t: 'on', n: 36 }); const [L] = render(m, 1.5), pk = dB(pico(L));
  reg('Saída', 'painel inicial, nota grave', 'pico entre −12 e −3 dBFS', fmt(pk, 1) + ' dBFS', pk >= -12 && pk <= -3, 'briefing');
  let pior = 0; for (const extra of [{}, { hpPeak: 10, hpCut: 6 }, { lpPeak: 10, lpCut: 5 }, { vco2Wave: 3 }]) { const mm = novo(Motor, { lvl1: 10, lvl2: 10, volume: 10, roda: 1, lpCut: 10, ...extra }, { initGain: 'roda', extSig: 'white' }); mm.msg({ t: 'on', n: 40 }); const [X] = render(mm, 1.5); pior = Math.max(pior, pico(X)); }
  reg('Saída', 'pior caso (tudo no máximo, INITIAL GAIN +5 V, ruído na entrada externa)', 'nunca passa de 1,0 (sem clipping digital)', fmt(pior, 3), pior < 1, 'limitador de segurança (c)');
  const v = k => { const [, X] = toca({ volume: k }, {}, 48, 1); return dB(rms(X, FS / 2)); };
  reg('Saída', 'VOLUME 0', 'silêncio', fmt(v(0), 0) + ' dBFS', v(0) < -100, ''); }

/* 15. Cada controle, um a um: mudou o som no sentido certo */
function carac(p, cabos) {
  const m = novo(Motor, Object.assign({ lvl1: 5, lpCut: 6, eg2Sustain: 6, eg2Decay: 4 }, p), cabos || {}); m.msg({ t: 'on', n: 48 }); const [L] = render(m, 1.2); m.msg({ t: 'off', n: 48 }); const [Rl] = render(m, 0.4);
  const mag = espectro(L, 0.35 * FS, 32768), df = FS / 32768; let a = 0, b = 0, g = 0; for (let i = 2; i < mag.length; i++) { const e = mag[i] * mag[i]; a += e * i * df; b += e; if (i * df < 200) g += e; }
  let bi = 2; for (let i = 2; i < 3000 / df; i++) if (mag[i] > mag[bi]) bi = i;
  const jan = []; for (let i = 0.3 * FS; i < 1.2 * FS - 480; i += 480) jan.push(dB(rms(L, i, i + 480)));
  const med = jan.reduce((x, y) => x + y, 0) / jan.length, dv = Math.sqrt(jan.reduce((x, y) => x + (y - med) * (y - med), 0) / jan.length);
  return { nivel: dB(rms(L, 0.3 * FS, 1.2 * FS)), brilho: a / (b + 1e-30), f0: bi * df, graves: 10 * Math.log10(g + 1e-30), ataque: dB(rms(L, 0, 0.03 * FS)), cauda: dB(rms(Rl, 0.05 * FS, 0.3 * FS)), varia: dv };
}
const T = [   // [controle, painel A, painel B, característica, sentido (+1 sobe, −1 desce, 0 só muda), cabos]
  ['VCO 1 WAVE FORM (triângulo → serra)', { vco1Wave: 0 }, { vco1Wave: 1 }, 'brilho', 1], ['VCO 1 WAVE FORM (serra → ruído)', { vco1Wave: 1 }, { vco1Wave: 3 }, 'brilho', 1],
  ['VCO 1 PW', { vco1Wave: 2, pw: 0 }, { vco1Wave: 2, pw: 8 }, 'brilho', 1], ['VCO 1 SCALE', { vco1Scale: 1 }, { vco1Scale: 3 }, 'f0', 1],
  ['VCO 2 WAVE FORM (serra → RING)', { lvl1: 0, lvl2: 5, vco2Wave: 0, pitch: 1.5 }, { lvl1: 0, lvl2: 5, vco2Wave: 3, pitch: 1.5 }, 'brilho', 0], ['VCO 2 PITCH', { lvl1: 0, lvl2: 5, pitch: -3 }, { lvl1: 0, lvl2: 5, pitch: 3 }, 'f0', 1],
  ['VCO 2 SCALE', { lvl1: 0, lvl2: 5, vco2Scale: 0 }, { lvl1: 0, lvl2: 5, vco2Scale: 2 }, 'f0', 1], ['PORTAMENTO TIME', { porta: 0 }, { porta: 9 }, 'f0', -1], ['MASTER TUNE', { tune: -5 }, { tune: 5 }, 'f0', 1],
  ['VCO 1 LEVEL', { lvl1: 0.5 }, { lvl1: 8 }, 'nivel', 1], ['VCO 2 LEVEL', { lvl1: 0, lvl2: 0.5 }, { lvl1: 0, lvl2: 8 }, 'nivel', 1],
  ['FM MG/T.EXT', { fmMg: 0 }, { fmMg: 5 }, 'brilho', 0], ['FM EG1/EXT (com ataque lento do EG1)', { fmEg1: 0, eg1Attack: 9 }, { fmEg1: 3, eg1Attack: 9 }, 'f0', -1],
  ['HPF CUTOFF FREQUENCY', { hpCut: 0 }, { hpCut: 7 }, 'graves', -1], ['HPF PEAK', { hpCut: 5, hpPeak: 0 }, { hpCut: 5, hpPeak: 8.5 }, 'brilho', 0],
  ['HPF MG/T.EXT', { hpCut: 5, hpMg: 0 }, { hpCut: 5, hpMg: 6 }, 'varia', 1], ['HPF EG2/EXT', { hpCut: 2, hpEg2: 0 }, { hpCut: 2, hpEg2: 6 }, 'graves', -1],
  ['LPF CUTOFF FREQUENCY', { lpCut: 3 }, { lpCut: 8 }, 'brilho', 1], ['LPF PEAK', { lpCut: 5, lpPeak: 0 }, { lpCut: 5, lpPeak: 8.5 }, 'brilho', 1],
  ['LPF MG/T.EXT', { lpCut: 4, lpMg: 0 }, { lpCut: 4, lpMg: 6 }, 'varia', 1], ['LPF EG2/EXT', { lpCut: 3, lpEg2: 0 }, { lpCut: 3, lpEg2: 6 }, 'brilho', 1],
  ['MG WAVE FORM (com LPF MG/T.EXT)', { lpCut: 4, lpMg: 6, mgWave: 5 }, { lpCut: 4, lpMg: 6, mgWave: 0 }, 'brilho', 0], ['MG FREQUENCY (com FM)', { fmMg: 3, mgFreq: 2 }, { fmMg: 3, mgFreq: 9 }, 'brilho', 0],
  ['EG1 DELAY TIME (com FM EG1/EXT)', { fmEg1: 3, eg1Delay: 0 }, { fmEg1: 3, eg1Delay: 9 }, 'f0', -1], ['EG1 ATTACK TIME (com FM EG1/EXT)', { fmEg1: 3, eg1Attack: 0 }, { fmEg1: 3, eg1Attack: 9.5 }, 'f0', -1],
  ['EG1 RELEASE TIME (EG1 OUT → LPF CUTOFF, cauda)', { lpCut: 9, lpEg2: 4, eg2Release: 7, eg1Release: 0 }, { lpCut: 9, lpEg2: 4, eg2Release: 7, eg1Release: 9 }, 'cauda', 1, { lpCv: 'eg1' }],
  ['EG2 HOLD TIME', { eg2Hold: 0, eg2Release: 0 }, { eg2Hold: 7, eg2Release: 0 }, 'cauda', 1], ['EG2 ATTACK TIME', { eg2Attack: 0 }, { eg2Attack: 7 }, 'ataque', -1], ['EG2 DECAY TIME', { eg2Sustain: 0, eg2Decay: 3 }, { eg2Sustain: 0, eg2Decay: 9 }, 'nivel', 1],
  ['EG2 SUSTAIN LEVEL', { eg2Sustain: 1 }, { eg2Sustain: 10 }, 'nivel', 1], ['EG2 RELEASE TIME', { eg2Release: 0 }, { eg2Release: 8 }, 'cauda', 1], ['VOLUME', { volume: 3 }, { volume: 10 }, 'nivel', 1],
  ['RODA (→ FREQ)', { fmEg1: 5, roda: -0.5 }, { fmEg1: 5, roda: 0.5 }, 'f0', 1, { freq: 'roda' }], ['BOTÃO (→ CLOCK do S&H, com ruído amostrado no corte)', { lpEg2: 5, botao: 0 }, { lpEg2: 5, botao: 1 }, 'brilho', 0, { shClock: 'botao', shIn: 'white', lpCv: 'shOut' }],
  ['ESP SIGNAL LEVEL (PHONES → ESP → ENV OUT → LPF CUTOFF)', { lpCut: 3, lpEg2: 6, espLevel: 1 }, { lpCut: 3, lpEg2: 6, espLevel: 10 }, 'brilho', 1, { espIn: 'phones', lpCv: 'espEnv' }],
  ['ESP LOW CUT FREQ (idem)', { lpCut: 3, lpEg2: 6, espLevel: 8, espLow: 0 }, { lpCut: 3, lpEg2: 6, espLevel: 8, espLow: 10 }, 'brilho', -1, { espIn: 'phones', lpCv: 'espEnv' }],
  ['ESP HIGH CUT FREQ (idem)', { lpCut: 3, lpEg2: 6, espLevel: 8, espHigh: 0 }, { lpCut: 3, lpEg2: 6, espLevel: 8, espHigh: 10 }, 'brilho', 1, { espIn: 'phones', lpCv: 'espEnv' }],
  ['ESP CV ADJUST (CV OUT → VCO 2 CV IN)', { lvl1: 3, lvl2: 8, vco1Wave: 0, espLevel: 8, espCv: 3 }, { lvl1: 3, lvl2: 8, vco1Wave: 0, espLevel: 8, espCv: 7 }, 'brilho', 1, { espIn: 'phones', vco2Cv: 'espCv' }],
  ['ESP THRESHOLD LEVEL (TRIG OUT → EG 1 TRIG IN, FM EG1/EXT)', { fmEg1: 3, espLevel: 8, espThr: 0 }, { fmEg1: 3, espLevel: 8, espThr: 10 }, 'f0', -1, { espIn: 'phones', eg1Trig: 'espTrig' }] ];
for (const [nome, a, b, c, sentido, cabos] of T) {
  const x = carac(a, cabos)[c], y = carac(b, cabos)[c], d = y - x, rel = Math.abs(d) / (Math.abs(x) + Math.abs(y) + 1e-9);
  const mudou = c === 'f0' || c === 'brilho' ? rel > 0.004 : Math.abs(d) > 0.5, ok = mudou && (sentido === 0 || Math.sign(d) === sentido);
  reg('Controles', nome, sentido > 0 ? `${c} sobe` : sentido < 0 ? `${c} desce` : `${c} muda`, `${fmt(x, 2)} → ${fmt(y, 2)}`, ok, '');
}

/* 16. Custo de processamento */
{ const m = novo(Motor, { lvl1: 8, lvl2: 8, vco2Wave: 3, hpPeak: 9.5, lpPeak: 9.5, lpCut: 6, hpCut: 4, lpMg: 5 }, { espIn: 'phones', lpCv: 'espEnv' }); m.msg({ t: 'on', n: 48 }); const t0 = performance.now(); render(m, 10); const ms = performance.now() - t0;
  reg('Custo', '10 s de áudio, tudo ligado (neste computador, Node)', 'bem abaixo de 100 % do tempo real', fmt(ms / 100, 1) + ' % do tempo real', ms < 5000, ''); }

console.log('| Grupo | Medição | Esperado (pesquisa) | Medido | | Fonte |\n|---|---|---|---|---|---|');
for (const l of linhas) console.log('| ' + l.join(' | ') + ' |');
console.log(`\n${linhas.length} medições, ${falhas} fora da tolerância.`);
process.exit(falhas ? 1 : 0);
