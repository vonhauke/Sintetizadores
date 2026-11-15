// Medições do motor de som de 106/index.html, comparadas com docs/pesquisa/106.md.
// Uso: node tests/medicao/106/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
import { readFileSync } from 'node:fs';
import { carregaMotor, novo, render, rms, pico, dB, amp, espectro, f0, FS } from './motor.mjs';

const Motor = carregaMotor(), DD = Motor.dados;
const linhas = []; let falhas = 0;
const fmt = (v, c = 2) => typeof v === 'number' ? v.toFixed(c).replace('.', ',') : v;
function reg(grupo, item, esperado, medido, ok, fonte = '') { if (!ok) falhas++; linhas.push([grupo, item, esperado, medido, ok ? 'ok' : 'FORA', fonte]); }
const cents = (a, b) => 1200 * Math.log2(a / b);
const perto = (a, b, tol) => Math.abs(a - b) <= tol;

/** frequência do maior pico do espectro perto de `alvo` (interpolação parabólica em dB) */
function picoHz(x, a, n, lo, hi) {
  const mag = espectro(x, a, n), df = FS / n; let bi = Math.max(1, Math.round(lo / df));
  for (let i = bi; i <= Math.min(mag.length - 2, Math.round(hi / df)); i++) if (mag[i] > mag[bi]) bi = i;
  const l = Math.log(mag[bi - 1] + 1e-30), c = Math.log(mag[bi] + 1e-30), r = Math.log(mag[bi + 1] + 1e-30);
  return (bi + 0.5 * (l - r) / (l - 2 * c + r)) * df;
}
/** espectro médio de potência (Welch) em bandas de 1/3 de oitava; devolve função f -> dB */
function bandas(x, a, b, n = 16384) {
  const acc = new Float64Array(n / 2); let q = 0;
  for (let i = a; i + n <= b; i += n / 2) { const m = espectro(x, i, n); for (let k = 0; k < m.length; k++) acc[k] += m[k] * m[k]; q++; }
  return f => { const lo = Math.max(1, Math.floor(f / 1.122 / (FS / n))), hi = Math.ceil(f * 1.122 / (FS / n)); let s = 0; for (let k = lo; k <= hi; k++) s += acc[k]; return 10 * Math.log10(s / q / (hi - lo + 1) + 1e-30); };
}
const semVar = m => { m.vozes.forEach(v => { v._i = v.i; }); };   // (as medições de corte descontam o desvio fixo de cada voz)
const DESVIO0 = 0.2;                                               // desvio de corte da voz 1, em passos

/* 1. Frequência do DCO */
for (const [nota, range] of [[36, 1], [48, 1], [60, 1], [69, 1], [84, 1], [96, 1], [60, 0], [60, 2], [96, 2]]) {
  const m = novo(Motor, { range }); m.msg({ t: 'on', n: nota }); const [L] = render(m, 3);
  const alvo = 440 * Math.pow(2, (nota - 69) / 12) * [0.5, 1, 2][range], f = picoHz(L, FS, 65536, alvo * 0.94, alvo * 1.06), c = cents(f, alvo);
  reg('DCO', `nota MIDI ${nota}, RANGE ${["16'", "8'", "4'"][range]}`, fmt(alvo) + ' Hz', `${fmt(f)} Hz (${fmt(c, 1)} cents)`, Math.abs(c) < 3, 'afinação temperada; divisor inteiro (a)');
}

/* 2. PWM manual: ciclo de 50 % a 95 % */
for (const [pwm, alvo] of [[0, 50], [64, 72.7], [127, 95]]) {
  const m = novo(Motor, { saw: 0, pulse: 1, pwm, pwmMan: 1 }); m.msg({ t: 'on', n: 36 }); const [L] = render(m, 1.5);
  let alto = 0, tot = 0, med = 0; for (let i = FS / 2; i < 1.5 * FS; i++) med += L[i]; med /= FS;
  const lim = (Math.max(...L.subarray(FS / 2)) + Math.min(...L.subarray(FS / 2))) / 2;
  for (let i = FS / 2; i < 1.5 * FS; i++) { tot++; if (L[i] > lim) alto++; }
  reg('DCO', `PWM manual em ${pwm}`, alvo + ' %', fmt(100 * alto / tot, 1) + ' %', perto(100 * alto / tot, alvo, 1.5), 'notas de serviço (a)');
}

/* 3. Aliasing do DCO em nota aguda */
for (const [nome, p] of [['serra', {}], ['pulso 50 %', { saw: 0, pulse: 1 }]]) {
  const m = novo(Motor, Object.assign({ range: 2 }, p)); m.msg({ t: 'on', n: 96 }); const [L] = render(m, 3);
  const n = 65536, mag = espectro(L, FS, n), df = FS / n, fund = m.vozes[0].inc * m.fs2;
  let h1 = 0, pior = 0, piorF = 0, vaz = 0;
  for (let k = 3; k < 20000 / df; k++) {
    const h = k * df / fund, dist = Math.abs(h - Math.round(h)) * fund / df;
    const meio = Math.abs(2 * h - Math.round(2 * h)) * fund / 2 / df;   // meios harmônicos = vazamento do sub-oscilador, não aliasing
    if (Math.round(h) === 1 && dist < 4) h1 = Math.max(h1, mag[k]);
    else if (meio > 30 && mag[k] > pior) { pior = mag[k]; piorF = k * df; }
    else if (dist > 30 && meio <= 6) vaz = Math.max(vaz, mag[k]);
  }
  const r = dB(pior / h1);
  reg('DCO', `aliasing, ${nome} em ${fmt(fund, 0)} Hz (dó mais agudo em 4')`, 'abaixo de −60 dB', `${fmt(r, 1)} dB (pior em ${fmt(piorF, 0)} Hz)`, r < -60, 'critério meu (c)');
  if (nome === 'serra') reg('DCO', 'vazamento do sub-oscilador com SUB em 0 (meia frequência)', '−56 dB do nível máximo do sub (medido num aparelho)', fmt(dB(vaz / h1), 1) + ' dB da fundamental da serra', dB(vaz / h1) < -40, '(b)');
}

/* 4. VCF: corte ao longo do slider (pela frequência de auto-oscilação) */
for (const [b, alvo] of [[16, 19.7], [32, 67.2], [49, 248], [64, 796.3], [80, 2725.3], [96, 9297.3], [108, 21635]]) {
  const m = novo(Motor, { saw: 0, vcfFreq: b, vcfRes: 127 }); m.msg({ t: 'on', n: 60 }); const [L] = render(m, 6);
  const esperado = alvo * Math.pow(2, DESVIO0 * 0.111), f = picoHz(L, 2 * FS, 131072, esperado * 0.8, Math.min(23000, esperado * 1.25)), c = cents(f, esperado);
  reg('VCF', `corte com FREQ em ${b} (auto-oscilação)`, fmt(alvo, 1) + ' Hz', `${fmt(f / Math.pow(2, DESVIO0 * 0.111), 1)} Hz (${fmt(c, 0)} cents)`, Math.abs(c) < (b >= 108 ? 250 : 40), b === 49 ? 'notas de serviço: 248 Hz (a)' : 'curva medida num aparelho (b)');
}
/* 5. VCF: inclinação (ruído branco, FREQ 64, ressonância 0) */
{
  const ref = novo(Motor, { saw: 0, noise: 127, vcfFreq: 127 }); ref.msg({ t: 'on', n: 60 }); const [A] = render(ref, 12);
  const m = novo(Motor, { saw: 0, noise: 127, vcfFreq: 64 }); m.msg({ t: 'on', n: 60 }); const [B] = render(m, 12);
  const ra = bandas(A, FS, 12 * FS), rb = bandas(B, FS, 12 * FS), fc = 796.3 * Math.pow(2, DESVIO0 * 0.111);
  const at = f => rb(f) - ra(f), i1 = at(fc * 8) - at(fc * 4), i2 = at(fc * 16) - at(fc * 8);
  reg('VCF', 'atenuação no corte (4 polos iguais)', '−12 dB', fmt(at(fc), 1) + ' dB', perto(at(fc), -12, 1.5), 'cascata de 4 polos (b)');
  reg('VCF', 'inclinação entre 2 e 3 oitavas acima do corte', '−23,3 dB/oitava (tende a −24)', fmt(i1, 1) + ' dB/oitava', perto(i1, -23.3, 1.5), '24 dB/oitava (b)');
  reg('VCF', 'inclinação entre 3 e 4 oitavas acima do corte', '−23,8 dB/oitava', fmt(i2, 1) + ' dB/oitava', perto(i2, -23.8, 2), '24 dB/oitava (b)');
}
/* 6. Auto-oscilação: início e nível */
{
  let inicio = -1; const niv = {};
  for (let r = 100; r <= 127; r++) { const m = novo(Motor, { saw: 0, vcfFreq: 64, vcfRes: r }); m.msg({ t: 'on', n: 60 }); const [L] = render(m, 3); const p = pico(L, 2 * FS, 3 * FS); niv[r] = p; if (inicio < 0 && p > 0.005) inicio = r; }
  const s = novo(Motor, {}); s.msg({ t: 'on', n: 60 }); const [S] = render(s, 1);
  reg('VCF', 'RES em que a auto-oscilação começa', 'perto do fim do curso (~120)', String(inicio), inicio >= 112 && inicio <= 124, 'forma da curva (b), limiar (c)');
  reg('VCF', 'nível da auto-oscilação com RES 127, relativo a uma serra', 'não encontrado', fmt(dB(niv[127] / pico(S, FS / 2, FS)), 1) + ' dB', niv[127] > 0.02, '(c)');
  const m = novo(Motor, { saw: 0, vcfFreq: 64, vcfRes: 127 }); render(m, 1); m.msg({ t: 'on', n: 60 }); const [L] = render(m, 0.05);
  reg('VCF', 'auto-oscilação presente 10 ms depois da tecla', 'sim', fmt(dB(pico(L, 0.006 * FS, 0.012 * FS) / niv[127]), 1) + ' dB do regime', pico(L, 0.006 * FS, 0.012 * FS) > 0.5 * niv[127], 'o circuito oscila sempre (c)');
}
/* 7. VCF: acompanhamento do teclado, ENV, LFO e bender (frequência de auto-oscilação) */
const osc = (p, nota, seg = 4, extra) => { const m = novo(Motor, Object.assign({ saw: 0, vcfRes: 127 }, p)); if (extra) extra(m); m.msg({ t: 'on', n: nota }); const [L] = render(m, seg); return [m, L]; };
{
  const [, A] = osc({ vcfFreq: 49, vcfKybd: 127 }, 60), [, B] = osc({ vcfFreq: 49, vcfKybd: 127 }, 84), [, C] = osc({ vcfFreq: 49, vcfKybd: 0 }, 84);
  const fa = picoHz(A, 2 * FS, 65536, 150, 400), fb = picoHz(B, 2 * FS, 65536, 600, 1500), fc = picoHz(C, 2 * FS, 65536, 150, 400);
  reg('VCF', 'KYBD 127: C4 → C6 (2 oitavas)', '248 → 992 Hz (2,00 oitavas)', `${fmt(fa, 0)} → ${fmt(fb, 0)} Hz (${fmt(Math.log2(fb / fa))} oitavas)`, perto(Math.log2(fb / fa), 2, 0.06), 'notas de serviço, após o ajuste WIDTH (a)');
  reg('VCF', 'KYBD 0: C4 → C6', 'não muda', `${fmt(Math.log2(fc / fa))} oitavas`, Math.abs(Math.log2(fc / fa)) < 0.02, 'manual (a)');
  const [, E] = osc({ vcfFreq: 20, vcfEnv: 64, envS: 127 }, 60, 6), [, E0] = osc({ vcfFreq: 20 }, 60, 6);
  const fe = picoHz(E, 2 * FS, 65536, 1000, 12000), f00 = picoHz(E0, 2 * FS, 131072, 15, 60);
  reg('VCF', 'ENV em 64 com o envelope cheio', '7 oitavas (metade de 14)', fmt(Math.log2(fe / f00)) + ' oitavas', perto(Math.log2(fe / f00), 7, 0.25), 'notas de serviço: 14 oitavas no máximo (a)');
  const [, N] = osc({ vcfFreq: 100, vcfEnv: 64, envS: 127, envNeg: 1 }, 60), [, N0] = osc({ vcfFreq: 100 }, 60);
  const fn = picoHz(N, 2 * FS, 65536, 30, 400), fn0 = picoHz(N0, 2 * FS, 65536, 6000, 20000);
  reg('VCF', 'chave de polaridade invertida, ENV 64', '−7 oitavas', fmt(Math.log2(fn / fn0)) + ' oitavas', perto(Math.log2(fn / fn0), -7, 0.3), 'manual (a) e firmware (b)');
  const [, Bd] = osc({ vcfFreq: 49, bendVcf: 1, bend: 1 }, 60), [, Bd0] = osc({ vcfFreq: 49 }, 60);
  const fbd = picoHz(Bd, 2 * FS, 65536, 1500, 5000), fbd0 = picoHz(Bd0, 2 * FS, 65536, 150, 400);
  reg('Bender', 'VCF no máximo, alavanca toda à direita', '+3,5 oitavas', '+' + fmt(Math.log2(fbd / fbd0)) + ' oitavas', perto(Math.log2(fbd / fbd0), 3.5, 0.15), 'notas de serviço (a)');
  // LFO no VCF: extremos da frequência ao longo de um ciclo lento
  const [, Lf] = osc({ vcfFreq: 64, vcfLfo: 127, lfoRate: 6 }, 60, 8); let lo = 1e9, hi = 0;
  for (let i = FS; i + 4096 < 8 * FS; i += 480) { const f = f0(Lf, FS, i, 2048, 60, 12000); if (f > 60 && f < 12000) { lo = Math.min(lo, f); hi = Math.max(hi, f); } }
  reg('VCF', 'LFO em 127: excursão do corte', '±3,5 oitavas (7 no total)', fmt(Math.log2(hi / lo)) + ' oitavas no total', perto(Math.log2(hi / lo), 7, 0.6), 'notas de serviço (a)');
}

/* 8. Envelope: valor interno de 14 bits (o que o firmware calcularia) e nível audível */
function envInterno(p, segOn, segOff) {     // devolve amostras de [t, env] a cada 1 ms
  const m = novo(Motor, Object.assign({ vcaGate: 0 }, p)); m.msg({ t: 'on', n: 72 }); const out = [], L = new Float32Array(48), R = new Float32Array(48);
  const N = Math.round((segOn + segOff) * 1000);
  for (let i = 0; i < N; i++) { if (i === Math.round(segOn * 1000)) m.msg({ t: 'off', n: 72 }); m.process(L, R, 48); out.push([(i + 1) / 1000, m.vozes[0].env / 0x3FFF, rms(L)]); }
  return out;
}
const tAte = (e, cond, de = 0) => { for (const x of e) if (x[0] >= de && cond(x)) return x[0] - de; return NaN; };
for (const [a, alvo, tol, nota] of [[0, 0.0042, 0.006, 'especificação: 1,5 ms (a); firmware: 1 laço, ~4 ms (b)'], [64, 0.542, 0.03, 'firmware (b)'], [127, 3.31, 0.1, 'especificação: 3 s (a); firmware: 3,3 s (b)']]) {
  const e = envInterno({ envA: a }, 4, 0), t = tAte(e, x => x[1] >= 0.999);
  reg('ENV', `ataque com A em ${a}: tempo até o máximo`, fmt(alvo, 3) + ' s', fmt(t, 3) + ' s', perto(t, alvo, tol), nota);
  if (a === 127) { const meio = e.find(x => x[0] >= t / 2)[1]; reg('ENV', 'forma do ataque: nível na metade do tempo', '50 % (rampa linear)', fmt(meio * 100, 1) + ' %', perto(meio, 0.5, 0.02), 'firmware (b)'); }
}
for (const [d, a50, a10, tol, nota] of [[0, 0.0042, 0.0042, 0.006, 'especificação: 1,5 ms (a)'], [64, 0.72, 2.23, 0.06, 'firmware (b)'], [127, 9.67, 21.7, 0.4, 'especificação: 12 s (a); firmware: 9,6 s à metade (b)']]) {
  const e = envInterno({ envD: d, envS: 0 }, 30, 0), tp = tAte(e, x => x[1] >= 0.999), t50 = tAte(e, x => x[1] <= 0.5, tp), t25 = tAte(e, x => x[1] <= 0.25, tp), t10 = tAte(e, x => x[1] <= 0.1, tp);
  reg('ENV', `decaimento com D em ${d}: tempo até 50 % / 10 %`, `${fmt(a50, 3)} / ${fmt(a10, 2)} s`, `${fmt(t50, 3)} / ${fmt(t10, 2)} s`, perto(t50, a50, tol) && perto(t10, a10, tol * 3 + 0.01), nota);
  if (d === 64) reg('ENV', 'forma do decaimento: 100→50 % contra 50→25 %', 'tempos iguais (exponencial)', `${fmt(t50, 3)} s e ${fmt(t25 - t50, 3)} s`, perto((t25 - t50) / t50, 1, 0.08), 'firmware (b)');
  if (d === 127) { const aud = tAte(e, x => x[2] <= e[40][2] * 0.1, 0.05); reg('ENV', 'decaimento com D em 127: som 20 dB abaixo', '~12 s (queda percebida)', fmt(aud, 1) + ' s', aud > 8 && aud < 24, 'especificação (a), comentário de KR (b)'); }
}
{
  const e = envInterno({ envD: 40, envS: 64 }, 3, 0), s = e[e.length - 1][1];
  reg('ENV', 'sustentação com S em 64', '50 %', fmt(s * 100, 1) + ' %', perto(s, 0.5, 0.01), 'S × 128 em 14 bits (b)');
  for (const [r, a50, tol] of [[0, 0.0042, 0.006], [64, 0.72, 0.06], [127, 9.67, 0.4]]) {
    const x = envInterno({ envR: r }, 0.5, 30), t = tAte(x, y => y[1] <= 0.5, 0.5);
    reg('ENV', `soltura com R em ${r}: tempo até 50 %`, fmt(a50, 3) + ' s', fmt(t, 3) + ' s', perto(t, a50, tol), 'mesma tabela do decaimento (b)');
  }
  const g = envInterno({ vcaGate: 1, envA: 127 }, 0.2, 0.2), sobe = tAte(g, x => x[2] > 0.9 * g[150][2]), cai = tAte(g, x => x[2] < 0.1 * g[150][2], 0.2);
  reg('VCA', 'modo GATE: abre e fecha', 'poucos ms (1 laço + RC de 0,69 ms)', `${fmt(sobe * 1000, 0)} ms / ${fmt(cai * 1000, 0)} ms`, sobe < 0.012 && cai < 0.012, '(b)');
}

/* 9. LFO: frequência (pela modulação do corte sobre ruído) e atraso */
function envRuido(p, seg, jan = 96) { const m = novo(Motor, Object.assign({ vcfFreq: 66, vcfLfo: 40 }, p)); m.msg({ t: 'on', n: 96 });   // serra aguda com o corte modulado: o nível acompanha o LFO
  const [L] = render(m, seg); const e = []; for (let i = 0; i + jan <= L.length; i += jan) e.push(rms(L, i, i + jan)); return e; }
function periodo(e, dt, pmin, pmax) {
  const n = e.length; let med = 0; for (const v of e) med += v; med /= n; let best = -Infinity, bl = 0; const r = [];
  for (let l = Math.floor(pmin / dt); l <= Math.min(n - 2, Math.ceil(pmax / dt)); l++) { let s = 0; for (let i = 0; i + l < n; i++) s += (e[i] - med) * (e[i + l] - med); s /= (n - l); r[l] = s; if (s > best) { best = s; bl = l; } }
  for (let l = Math.floor(pmin / dt) + 1; l < bl; l++) if (r[l] > 0.9 * best && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { bl = l; break; }   // primeiro máximo, não um múltiplo do período
  const d = r[bl - 1] != null && r[bl + 1] != null ? (r[bl - 1] - r[bl + 1]) / (2 * (r[bl - 1] - 2 * r[bl] + r[bl + 1])) : 0;
  return (bl + d) * dt;
}
for (const [rate, alvo, seg, pmin, pmax, tol, nota] of [[0, 0.036, 100, 15, 45, 0.004, 'especificação: 0,1 Hz (a); firmware: 0,036 Hz (b)'], [64, 4.54, 8, 0.1, 0.5, 0.15, 'firmware (b)'], [106, 11.71, 6, 0.05, 0.13, 0.4, 'medido num aparelho: 11,67 Hz (b)'], [127, 29.5, 4, 0.02, 0.05, 1.2, 'especificação: 30 Hz (a); firmware: 29,5 Hz (b)']]) {
  const e = envRuido({ lfoRate: rate }, seg), f = 1 / periodo(e.slice(Math.round(0.5 * FS / 96)), 96 / FS, pmin, pmax);
  reg('LFO', `frequência com RATE em ${rate}`, fmt(alvo, 3) + ' Hz', fmt(f, 3) + ' Hz', perto(f, alvo, tol), nota);
}
{
  const jan = 4800, prof = e => { const o = []; for (let i = 0; i + 50 <= e.length; i += 50) { let lo = 1e9, hi = 0; for (let j = i; j < i + 50; j++) { lo = Math.min(lo, e[j]); hi = Math.max(hi, e[j]); } o.push(hi / lo); } return o; };
  const e = envRuido({ lfoRate: 100, lfoDelay: 127 }, 7), pr = prof(e), cheio = pr[pr.length - 1];   // janelas de 0,1 s
  const ini = pr.findIndex(v => v > 1 + (cheio - 1) * 0.03) * 0.1, fim = pr.findIndex(v => v > 1 + (cheio - 1) * 0.9) * 0.1;
  reg('LFO', 'DELAY TIME em 127: começa a modular / profundidade cheia', '~3,3 s / ~4,4 s', `${fmt(ini, 1)} s / ${fmt(fim, 1)} s`, perto(ini, 3.4, 0.3) && perto(fim, 4.3, 0.5), 'especificação: 0 a 3 s (a); firmware (b)');
  const z = prof(envRuido({ lfoRate: 100, lfoDelay: 0 }, 1.5));
  reg('LFO', 'DELAY TIME em 0', 'modula desde o início', `profundidade ${fmt(z[1] / cheio * 100, 0)} % em 0,1–0,2 s`, z[1] > 0.6 * cheio, 'firmware (b)');
}
/* 10. LFO e bender no DCO: profundidade */
function excursao(p, seg = 4) { const m = novo(Motor, p); m.msg({ t: 'on', n: 72 }); const [L] = render(m, seg); let lo = 1e9, hi = 0; for (let i = FS; i + 1024 < seg * FS; i += 240) { const f = f0(L, FS, i, 768, 250, 1100); lo = Math.min(lo, f); hi = Math.max(hi, f); } return [lo, hi]; }
{
  const [lo, hi] = excursao({ dcoLfo: 127, lfoRate: 6 }, 8), c = cents(hi, lo) / 2;
  reg('DCO', 'LFO em 127: desvio de afinação', '±400 cents', '±' + fmt(c, 0) + ' cents', perto(c, 400, 25), 'notas de serviço (a)');
  const [l2, h2] = excursao({ dcoLfo: 2 }, 3);
  reg('DCO', 'LFO em 2 (zona morta da tabela)', '0 cents', '±' + fmt(cents(h2, l2) / 2, 1) + ' cents', cents(h2, l2) < 4, 'firmware (b)');
  const [l3, h3] = excursao({ bendLfo: 1, lfoTrig: 1, lfoRate: 6 }, 8);
  reg('Bender', 'LFO TRIG com o slider LFO no máximo', 'não encontrado (uso ±400 cents)', '±' + fmt(cents(h3, l3) / 2, 0) + ' cents', perto(cents(h3, l3) / 2, 400, 25), '(c)');
  const a = novo(Motor, { bendDco: 1, bend: 1 }); a.msg({ t: 'on', n: 60 }); const [A] = render(a, 2), fa = picoHz(A, FS / 2, 65536, 400, 700);
  const b = novo(Motor, { bendDco: 1, bend: -1 }); b.msg({ t: 'on', n: 60 }); const [B] = render(b, 2), fb = picoHz(B, FS / 2, 65536, 100, 170);
  reg('Bender', 'DCO no máximo, alavanca nos extremos', '±1200 cents', `+${fmt(cents(fa, 261.626), 0)} / ${fmt(cents(fb, 261.626), 0)} cents`, perto(cents(fa, 261.626), 1200, 5) && perto(cents(fb, 261.626), -1200, 5), 'notas de serviço (a)');
}
/* 11. Portamento: tempo por oitava */
for (const [v, alvo] of [[1, 0.051], [64, 1.30], [96, 4.335]]) {
  const m = novo(Motor, { porta: v, portaOn: 1, assign: 1 }); m.msg({ t: 'on', n: 60 }); render(m, 0.3); m.msg({ t: 'off', n: 60 }); m.msg({ t: 'on', n: 72 });
  const L = new Float32Array(48), R = new Float32Array(48); let t = 0; while (m.vozes[0].afin < 72 && t < 20000) { m.process(L, R, 48); t++; }
  reg('Portamento', `tempo em ${v}: uma oitava`, fmt(alvo, 3) + ' s', fmt(t / 1000, 3) + ' s', perto(t / 1000, alvo, alvo * 0.08 + 0.006), 'tabela do firmware (b)');
}
{ const m = novo(Motor, { porta: 64, portaOn: 0, assign: 1 }); m.msg({ t: 'on', n: 60 }); render(m, 0.1); m.msg({ t: 'off', n: 60 }); m.msg({ t: 'on', n: 72 }); render(m, 0.02);
  reg('Portamento', 'chave em OFF', 'sem deslize', m.vozes[0].afin === 72 ? 'sem deslize' : 'deslizou', m.vozes[0].afin === 72, 'manual (a)'); }

/* 12. HPF: resposta de cada posição em relação à posição 1 (ruído, bandas de 1/3 de oitava) */
{
  const r = []; for (let h = 0; h < 4; h++) { const m = novo(Motor, { saw: 0, noise: 127, hpf: h }); m.msg({ t: 'on', n: 60 }); const [L] = render(m, 40); r.push(bandas(L, FS, 40 * FS, 32768)); }
  const d = (h, f) => r[h](f) - r[1](f);
  reg('HPF', 'posição 0: 30 Hz / 100 Hz / 2 kHz', '+9,6 / +6,0 / +1,4 dB', `${fmt(d(0, 30), 1)} / ${fmt(d(0, 100), 1)} / ${fmt(d(0, 2000), 1)} dB`, perto(d(0, 30), 9.6, 1.5) && perto(d(0, 100), 6.0, 1.2) && perto(d(0, 2000), 1.4, 0.6), 'reforço de graves (a); curva (b)');
  reg('HPF', 'posição 2: 59 Hz / 236 Hz / 2 kHz', '−12,3 / −3,0 / −0,1 dB', `${fmt(d(2, 59), 1)} / ${fmt(d(2, 236), 1)} / ${fmt(d(2, 2000), 1)} dB`, perto(d(2, 59), -12.3, 1.5) && perto(d(2, 236), -3, 1) && perto(d(2, 2000), 0, 0.5), '236 Hz, 1 polo (b)');
  reg('HPF', 'posição 3: 188 Hz / 754 Hz / 6 kHz', '−12,3 / −3,0 / −0,1 dB', `${fmt(d(3, 188), 1)} / ${fmt(d(3, 754), 1)} / ${fmt(d(3, 6000), 1)} dB`, perto(d(3, 188), -12.3, 1.5) && perto(d(3, 754), -3, 1) && perto(d(3, 6000), 0, 0.5), '754 Hz, 1 polo (b)');
}

/* 13. Chorus: atraso ao longo do tempo (pico da autocorrelação de ruído em cada canal) */
function atrasos(modo, seg = 8) {
  const faz = ch => { const m = novo(Motor, { saw: 0, noise: 127, chorus: ch }); m.msg({ t: 'on', n: 60 }); return render(m, seg); };
  const [D] = faz(0), [L, R] = faz(modo), out = [], C = DD.CH;   // mesma semente de ruído: o sinal direto é idêntico nas duas rodadas
  const WL = L.map((v, i) => (v - C.dir * D[i]) / C.atr), WR = R.map((v, i) => (v - C.dir * D[i]) / C.atr);
  const N = 960, lmin = Math.floor(0.001 * FS), lmax = Math.ceil(0.0065 * FS);
  for (let i = FS; i + N + lmax < seg * FS; i += 480) {
    const um = W => { let b = -Infinity, bl = lmin; const r = []; for (let l = lmin - 1; l <= lmax + 1; l++) { let q = 0; for (let k = 0; k < N; k++) q += D[i + k] * W[i + k + l]; r[l] = q; if (l >= lmin && l <= lmax && q > b) { b = q; bl = l; } }
      return (bl + (r[bl - 1] - r[bl + 1]) / (2 * (r[bl - 1] - 2 * r[bl] + r[bl + 1]))) / FS * 1000; };
    out.push([um(WL), um(WR)]);
  }
  return out;
}
function taxa(x, dt) { const med = (Math.max(...x) + Math.min(...x)) / 2, t = []; for (let i = 1; i < x.length; i++) if (x[i - 1] < med && x[i] >= med) t.push((i - 1 + (med - x[i - 1]) / (x[i] - x[i - 1])) * dt); return (t.length - 1) / (t[t.length - 1] - t[0]); }
for (const [modo, hz] of [[1, 0.513], [2, 0.863]]) {
  const a = atrasos(modo), l = a.map(x => x[0]), r = a.map(x => x[1]), lo = Math.min(...l), hi = Math.max(...l);
  const f = taxa(l, 0.01);
  let cov = 0, vl = 0, vr = 0; const ml = l.reduce((s, v) => s + v, 0) / l.length, mr = r.reduce((s, v) => s + v, 0) / r.length;
  for (let i = 0; i < l.length; i++) { cov += (l[i] - ml) * (r[i] - mr); vl += (l[i] - ml) ** 2; vr += (r[i] - mr) ** 2; }
  const nome = ['', 'I', 'II'][modo];
  reg('Chorus', `${nome}: taxa do LFO`, fmt(hz, 3) + ' Hz', fmt(f, 3) + ' Hz', perto(f, hz, 0.02), modo === 1 ? 'Juno-60 (b); 0,514 Hz medido num 106 (b)' : 'Juno-60 (b)');
  reg('Chorus', `${nome}: atraso mínimo / máximo (canal esquerdo)`, '1,66 / 5,35 ms', `${fmt(lo)} / ${fmt(hi)} ms`, perto(lo, 1.66 + 0.03, 0.12) && perto(hi, 5.35 + 0.03, 0.12), 'Juno-60 (b)');
  reg('Chorus', `${nome}: canais em oposição`, 'correlação −1', fmt(cov / Math.sqrt(vl * vr)), cov / Math.sqrt(vl * vr) < -0.95, '(b)');
}
{
  const dif = modo => { const m = novo(Motor, { chorus: modo }); for (const n of [48, 55, 60, 64]) m.msg({ t: 'on', n }); const [L, R] = render(m, 3); let s = 0; for (let i = FS; i < 3 * FS; i++) s += (L[i] - R[i]) ** 2; return [Math.sqrt(s / (2 * FS)), rms(L, FS, 3 * FS)]; };
  const [d0, n0] = dif(0), [d1, n1] = dif(1);
  reg('Chorus', 'OFF: saída mono (L = R)', 'diferença nula', fmt(dB(d0 / n0), 0) + ' dB', d0 < 1e-6, '(a)');
  reg('Chorus', 'I: diferença entre canais / nível em relação a OFF', 'estéreo; nível parecido', `${fmt(dB(d1 / n1), 1)} dB / ${fmt(dB(n1 / n0), 1)} dB`, d1 > 0.1 * n1 && Math.abs(dB(n1 / n0)) < 3, '(c)');
  const m = novo(Motor, { chorus: 1 }); const [L] = render(m, 2); const z = novo(Motor, {}); const [Z] = render(z, 2);
  reg('Chorus', 'chiado sem nota, chorus I / OFF (volume 8)', 'não encontrado (uso ~−79 dBFS antes do volume)', `${fmt(dB(rms(L, FS, 2 * FS)), 1)} / ${fmt(dB(rms(Z, FS, 2 * FS)), 0)} dBFS`, rms(L, FS, 2 * FS) < 1e-3 && rms(Z, FS, 2 * FS) < 1e-6, '(c)');
}

/* 14. Nível de saída e clipping */
{
  const acorde = [48, 55, 60, 64, 67, 72];
  const toca = (p, notas, seg = 3) => { const m = novo(Motor, p); for (const n of notas) m.msg({ t: 'on', n }); const [L, R] = render(m, seg); return [pico(L, 0, L.length), rms(L, FS, seg * FS), Math.max(pico(L), pico(R))]; };
  const [p1, r1] = toca({}, [60]), [p6, r6] = toca({}, acorde), [, ru] = toca({ assign: 2 }, [60]);
  reg('Saída', '1 voz, serra, LEVEL 64, volume 8: pico', 'sem clipping', fmt(dB(p1), 1) + ' dBFS', p1 < 0.7, '(c)');
  reg('Saída', '6 vozes (acorde), mesmas condições: pico / RMS', 'sem clipping (abaixo de −3 dBFS)', `${fmt(dB(p6), 1)} / ${fmt(dB(r6), 1)} dBFS`, p6 < 0.7, '(c)');
  reg('Saída', '6 vozes contra 1 voz (RMS)', 'soma sem compensação: +7,8 dB para fases independentes', '+' + fmt(dB(r6 / r1), 1) + ' dB', dB(r6 / r1) > 5 && dB(r6 / r1) < 11, '(b)');
  reg('Saída', 'uníssono contra 1 voz (RMS)', 'mais alto, sem compensação', '+' + fmt(dB(ru / r1), 1) + ' dB', ru > r1 * 1.5, '(b)');
  const pior = toca({ pulse: 1, sub: 127, noise: 127, vcaLevel: 127, vcfRes: 100, hpf: 0, chorus: 2, assign: 2, volume: 1 }, [36], 3)[2];
  reg('Saída', 'pior caso (tudo no máximo, uníssono, volume 10): pico', 'nunca passa de 0 dBFS (limitador)', fmt(dB(pior), 2) + ' dBFS', pior < 1, '(c)');
  // patches de fábrica: nível com acorde de 4 notas
  const ORD = ['lfoRate', 'lfoDelay', 'dcoLfo', 'pwm', 'noise', 'vcfFreq', 'vcfRes', 'vcfEnv', 'vcfLfo', 'vcfKybd', 'vcaLevel', 'envA', 'envD', 'envS', 'envR', 'sub'];
  const bruto = /const FAB_HEX = '([0-9a-f]+)'/.exec(readFileSync(new URL('../../../106/index.html', import.meta.url), 'utf8'))[1];
  const hex = Array.from({ length: 128 }, (_, i) => { const b = []; for (let k = 0; k < 18; k++) b.push(parseInt(bruto.substr(i * 36 + 2 * k, 2), 16)); const p = {}; ORD.forEach((k, j) => { p[k] = b[j]; }); const s1 = b[16], s2 = b[17];
    return Object.assign(p, { range: s1 & 4 ? 2 : s1 & 2 ? 1 : 0, pulse: s1 >> 3 & 1, saw: s1 >> 4 & 1, chorus: s1 & 32 ? 0 : s1 & 64 ? 1 : 2, pwmMan: s2 & 1, envNeg: s2 >> 1 & 1, vcaGate: s2 >> 2 & 1, hpf: 3 - (s2 >> 3 & 3) }); });
  reg('Patches', 'dados de fábrica embutidos', '128 patches de 18 bytes', `${bruto.length / 36} patches`, bruto.length === 4608, 'KR-106 (b)');
  if (hex) { let max = 0, min = 9, qual = ''; const mudos = []; hex.forEach((h, i) => { const m = new Motor(FS); m.msg({ t: 'ps', p: Object.assign({ volume: 0.8 }, h) }); for (const n of [48, 55, 60, 64]) m.msg({ t: 'on', n }); const [L] = render(m, 1.5); const p = pico(L); if (p > max) { max = p; qual = i; } min = Math.min(min, p); if (!(p > 1e-4)) mudos.push(i); });
    reg('Saída', '128 patches de fábrica, acorde de 4 notas, volume 8: maior pico', 'abaixo de 0 dBFS', `${fmt(dB(max), 1)} dBFS (patch ${qual})`, max < 1, '(c)');
    reg('Patches', 'todos os 128 patches produzem som em 1,5 s', 'nenhum mudo', mudos.length ? 'mudos: ' + mudos.join(', ') : `nenhum mudo (menor pico ${fmt(dB(min), 1)} dBFS)`, mudos.length === 0, ''); }
}

/* 15. Polifonia e atribuição de vozes */
{
  let m = novo(Motor, { assign: 0 }); for (const n of [60, 62, 64, 65, 67, 69]) m.msg({ t: 'on', n }); const antes = m.vozes.map(v => v.nota).join(' ');
  m.msg({ t: 'on', n: 71 }); const depois = m.vozes.map(v => v.nota).join(' ');
  reg('Vozes', 'POLY 1: seis notas e depois a sétima', 'a 7ª toma a voz da 1ª', `${antes} → ${depois}`, depois === '71 62 64 65 67 69', 'notas de serviço, modo rotativo (a)');
  m = novo(Motor, { assign: 0 }); const usadas = []; for (const n of [60, 62, 64]) { m.msg({ t: 'on', n }); m.msg({ t: 'off', n }); usadas.push(m.ultima + 1); }
  reg('Vozes', 'POLY 1: três notas em staccato', 'vozes em ciclo', usadas.join(', '), new Set(usadas).size === 3, 'modo rotativo (a); qual botão: (c)');
  m = novo(Motor, { assign: 1 }); const u2 = []; for (const n of [60, 62, 64]) { m.msg({ t: 'on', n }); m.msg({ t: 'off', n }); u2.push(m.ultima + 1); }
  reg('Vozes', 'POLY 2: três notas em staccato', 'sempre a voz 1', u2.join(', '), u2.join() === '1,1,1', 'modo não rotativo (a); qual botão: (c)');
  m = novo(Motor, { assign: 2 }); m.msg({ t: 'on', n: 60 }); m.msg({ t: 'on', n: 67 }); const un = m.vozes.map(v => v.nota).join(' '); m.msg({ t: 'off', n: 67 }); const volta = m.vozes.map(v => v.nota).join(' ');
  reg('Vozes', 'uníssono: duas teclas, depois solta a segunda', 'seis vozes na última nota; volta à anterior', `${un} → ${volta}`, un === '67 67 67 67 67 67' && volta === '60 60 60 60 60 60', 'manual (a); prioridade (c)');
  m = novo(Motor, {}); m.msg({ t: 'pedal', v: 1 }); m.msg({ t: 'on', n: 60 }); m.msg({ t: 'off', n: 60 }); const preso = m.vozes[0].gate; m.msg({ t: 'pedal', v: 0 });
  reg('Vozes', 'pedal de sustentação', 'segura a nota até soltar o pedal', preso && !m.vozes[0].gate ? 'segura e solta' : 'falhou', preso && !m.vozes[0].gate, 'manual (a)');
  m = novo(Motor, {}); m.msg({ t: 'on', n: 60, at: 0.5, seq: 1 }); m.msg({ t: 'off', n: 60, at: 0.75, seq: 1 }); const [L] = render(m, 1); let ini = 0; while (ini < L.length && Math.abs(L[ini]) < 1e-3) ini++;
  reg('Agenda', 'nota agendada para 0,500 s', 'começa em 0,500 s', fmt(ini / FS, 4) + ' s', perto(ini / FS, 0.5, 0.004), 'relógio do AudioContext');
}

/* 16. Cada controle, um por um: o som muda, e para o lado certo? */
{
  const base = { lfoRate: 80, pwm: 60, vcfFreq: 70, vcfRes: 40, vcfKybd: 64, envD: 50, envS: 80, envR: 30, vcaGate: 0, pulse: 1, sub: 0, range: 1 };
  const carac = p => {                  // características simples do som: nível, brilho (centroide), graves, diferença L/R, variação lenta
    const m = novo(Motor, Object.assign({}, base, p)); m.msg({ t: 'on', n: 48 }); const [L, R] = render(m, 2); m.msg({ t: 'off', n: 48 }); const [T] = render(m, 0.4);
    const mag = espectro(L, FS, 32768); let s = 0, sf = 0, g = 0; for (let k = 2; k < mag.length; k++) { const e = mag[k] * mag[k]; s += e; sf += e * k * FS / 32768; if (k * FS / 32768 < 100) g += e; }
    let d = 0; for (let i = FS; i < 2 * FS; i++) d += (L[i] - R[i]) ** 2;
    const jan = []; for (let i = FS / 2; i + 2400 <= 2 * FS; i += 2400) jan.push(rms(L, i, i + 2400));
    return { nivel: dB(rms(L, FS, 2 * FS)), ataque: dB(rms(L, 0, 0.05 * FS)), brilho: sf / s, graves: 10 * Math.log10(g / s + 1e-12), estereo: Math.sqrt(d / FS), cauda: dB(rms(T, 0.1 * FS, 0.4 * FS)), varia: dB(Math.max(...jan) / Math.min(...jan)), ritmo: (() => { const e = []; for (let i = FS / 2; i + 734 <= 2 * FS; i += 734) e.push(rms(L, i, i + 734)); const md = (Math.max(...e) + Math.min(...e)) / 2; let c = 0; for (let i = 1; i < e.length; i++) if (e[i - 1] < md && e[i] >= md) c++; return c; })(), f0: f0(L, FS, FS, 8192, 30, 2000), sub: amp(L, 65.4, FS, FS, 2 * FS) };
  };
  const ref = carac({});
  const T = [   // [controle, valores, característica, sentido esperado (+1 sobe, -1 desce, 0 só muda)]
    ['LFO RATE (com VCF LFO)', { vcfLfo: 110, lfoRate: 20 }, { vcfLfo: 110, lfoRate: 70 }, 'ritmo', 1], ['LFO DELAY TIME (com VCF LFO)', { vcfLfo: 110, lfoDelay: 0 }, { vcfLfo: 110, lfoDelay: 127 }, 'varia', -1],
    ['DCO LFO', { dcoLfo: 0 }, { dcoLfo: 127 }, 'f0', 0], ['DCO PWM (MAN)', { saw: 0, pwm: 0 }, { saw: 0, pwm: 120 }, 'brilho', 1], ['chave PWM LFO/MAN', { saw: 0, pwm: 100, pwmMan: 1 }, { saw: 0, pwm: 100, pwmMan: 0, lfoRate: 60 }, 'brilho', 0],
    ['botão de pulso', { pulse: 0 }, { pulse: 1 }, 'nivel', 1], ['botão de serra', { saw: 0 }, { saw: 1 }, 'nivel', 1], ['pulso e serra desligados', { sub: 0 }, { sub: 0, pulse: 0, saw: 0 }, 'nivel', -1], ['DCO SUB', { sub: 0 }, { sub: 127 }, 'sub', 1], ['DCO NOISE', { noise: 0, vcfFreq: 110 }, { noise: 127, vcfFreq: 110 }, 'brilho', 1],
    ['RANGE', { range: 0 }, { range: 2 }, 'f0', 1], ['HPF FREQ', { hpf: 0 }, { hpf: 3 }, 'graves', -1], ['VCF FREQ', { vcfFreq: 30 }, { vcfFreq: 110 }, 'brilho', 1], ['VCF RES', { vcfRes: 0 }, { vcfRes: 115 }, 'brilho', 1],
    ['VCF ENV', { vcfFreq: 40, vcfEnv: 0 }, { vcfFreq: 40, vcfEnv: 100 }, 'brilho', 1], ['chave de polaridade', { vcfEnv: 60, envNeg: 0 }, { vcfEnv: 60, envNeg: 1 }, 'brilho', -1], ['VCF LFO', { vcfLfo: 0 }, { vcfLfo: 100 }, 'varia', 1],
    ['VCF KYBD', { vcfKybd: 0 }, { vcfKybd: 127 }, 'brilho', -1], ['chave ENV/GATE', { envA: 110, vcaGate: 0 }, { envA: 110, vcaGate: 1 }, 'ataque', 1], ['VCA LEVEL', { vcaLevel: 0 }, { vcaLevel: 127 }, 'nivel', 1],
    ['ENV A', { envA: 0 }, { envA: 100 }, 'ataque', -1], ['ENV D', { envS: 0, envD: 20 }, { envS: 0, envD: 110 }, 'nivel', 1], ['ENV S', { envS: 10 }, { envS: 127 }, 'nivel', 1], ['ENV R', { envR: 0 }, { envR: 110 }, 'cauda', 1],
    ['CHORUS OFF → I', { chorus: 0 }, { chorus: 1 }, 'estereo', 1], ['CHORUS I → II', { chorus: 1 }, { chorus: 2 }, 'estereo', 0], ['VOLUME', { volume: 0.3 }, { volume: 1 }, 'nivel', 1],
    ['BENDER DCO (alavanca à direita)', { bend: 1, bendDco: 0 }, { bend: 1, bendDco: 1 }, 'f0', 1], ['BENDER VCF (alavanca à direita)', { bend: 1, bendVcf: 0 }, { bend: 1, bendVcf: 1 }, 'brilho', 1], ['BENDER LFO (LFO TRIG)', { lfoTrig: 1, bendLfo: 0 }, { lfoTrig: 1, bendLfo: 1 }, 'f0', 0] ];
  for (const [nome, a, b, c, sentido] of T) {
    const x = carac(a)[c], y = carac(b)[c], d = y - x, rel = Math.abs(d) / (Math.abs(x) + Math.abs(y) + 1e-9);
    const mudou = c === 'f0' || c === 'brilho' || c === 'sub' || c === 'estereo' || c === 'ritmo' ? rel > 0.004 : Math.abs(d) > 0.5, ok = mudou && (sentido === 0 || Math.sign(d) === sentido);
    reg('Controles', nome, sentido > 0 ? `${c} sobe` : sentido < 0 ? `${c} desce` : `${c} muda`, `${fmt(x, 2)} → ${fmt(y, 2)}`, ok, 'manual (a)');
  }
}

/* 17. Custo de processamento */
{ const m = novo(Motor, { pulse: 1, sub: 100, chorus: 1, vcfRes: 127 }); for (const n of [48, 52, 55, 60, 64, 67]) m.msg({ t: 'on', n }); const t0 = performance.now(); render(m, 10); const ms = performance.now() - t0;
  reg('Custo', '10 s de áudio, 6 vozes, chorus (neste computador, Node)', 'bem abaixo de 100 % do tempo real', fmt(ms / 100, 1) + ' % do tempo real', ms < 5000, ''); }

console.log('| Grupo | Medição | Esperado (pesquisa) | Medido | | Fonte |\n|---|---|---|---|---|---|');
for (const l of linhas) console.log('| ' + l.join(' | ') + ' |');
console.log(`\n${linhas.length} medições, ${falhas} fora da tolerância.`);
process.exit(falhas ? 1 : 0);
