// Medições do motor de arp2600/index.html, comparadas com docs/pesquisa/arp2600.md.
// Uso: node tests/medicao/arp2600/medir.mjs   (código de saída 1 se algo ficar fora da tolerância)
import { carregaMotor, novo, sonda, render, rms, pico, dB, amp, espectro, FS } from './motor.mjs';
const M = carregaMotor(), D = M.dados, pos = (hz, lf) => D.posDeHz(hz, lf);
let fora = 0;
const n3 = v => typeof v === 'number' ? (Math.abs(v) >= 1000 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(3) : v.toPrecision(3)) : String(v);
function linha(nome, esperado, medido, ok) { if (!ok) fora++; console.log(`${ok ? 'ok  ' : 'FORA'} | ${nome} | esperado ${typeof esperado === 'number' ? n3(esperado) : esperado} | medido ${n3(medido)}`); }
const perto = (nome, esp, med, tolRel, un = '') => linha(nome + (un ? ` (${un})` : ''), esp, med, Math.abs(med - esp) <= Math.abs(esp) * tolRel + 1e-9);
const titulo = t => console.log('\n## ' + t);
const media = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i]; return s / (b - a); };
const minmax = (x, a = 0, b = x.length) => { let lo = Infinity, hi = -Infinity; for (let i = a; i < b; i++) { if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i]; } return [lo, hi]; };
/** frequência por cruzamentos ascendentes do nível médio, com interpolação */
function fCruz(x, a = 0, b = x.length, nivel = null) {
  if (nivel == null) { const [lo, hi] = minmax(x, a, b); nivel = (lo + hi) / 2; }
  let p = -1, u = -1, n = 0;
  for (let i = a + 1; i < b; i++) if (x[i - 1] < nivel && x[i] >= nivel) { const t = i - 1 + (nivel - x[i - 1]) / (x[i] - x[i - 1]); if (p < 0) p = t; u = t; n++; }
  return n > 1 ? (n - 1) / (u - p) * FS : 0;
}
const assin = (x, a, b) => { const m = media(x, a, b); let s = 0, c = 0; for (let i = a; i < b; i++) { s += (x[i] - m) ** 2; if (i > a && x[i - 1] < m && x[i] >= m) c++; } return [m, Math.sqrt(s / (b - a)), c]; };
const igual = (p, q) => p.every((v, i) => Math.abs(v - q[i]) <= 1e-9 * (1 + Math.abs(v)));
const difere = (p, q) => p.some((v, i) => Math.abs(v - q[i]) > 0.01 * (Math.abs(v) + Math.abs(q[i])) + 1e-6);
/** tempo (s) do primeiro cruzamento de um nível, a partir da amostra a */
const tAte = (x, nivel, sobe, a = 0) => { for (let i = a; i < x.length; i++) if (sobe ? x[i] >= nivel : x[i] <= nivel) return (i - a) / FS; return NaN; };
function picoEsp(x, a, n, f, larg = 4) { const e = espectro(x, a, n), k = Math.round(f * n / FS); let m = 0; for (let i = k - larg; i <= k + larg; i++) if (e[i] > m) m = e[i]; return m; }

/* ------------------------------------------------------------------ */
titulo('Osciladores');
for (const v of [1, 2, 3]) {
  for (const hz of [10, 100, 1000, 10000]) {
    const m = novo(M, { ['f' + v]: pos(hz) }), r = sonda(m, [`v${v}saw`], hz < 50 ? 1.2 : 0.3);
    perto(`VCO-${v} slider em ${hz} Hz`, hz, fCruz(r[`v${v}saw`]), 0.003, 'Hz');
  }
  for (const [hz, s] of [[30, 0.6], [3, 2.5]]) {
    const m = novo(M, { ['f' + v]: pos(hz, 1), ['lf' + v]: 1 }); m.msg({ t: 'on', n: 72 });
    perto(`VCO-${v} em LF, slider em ${hz} Hz, com tecla apertada (KBD OFF)`, hz, fCruz(sonda(m, [`v${v}saw`], s)[`v${v}saw`]), 0.004, 'Hz');
  }
  { const m = novo(M, { ['f' + v]: pos(0.03, 1), ['lf' + v]: 1 }), x = sonda(m, [`v${v}saw`], 4)[`v${v}saw`];
    perto(`VCO-${v} em LF, slider no mínimo: inclinação da serra`, 0.03 * 10, (x[x.length - 1] - x[FS]) / 3, 0.01, 'V/s = 0,03 Hz'); }
  for (const [n, hz] of [[36, 65.406], [48, 130.813], [69, 440], [84, 1046.5]]) {
    const m = novo(M); m.msg({ t: 'on', n });
    perto(`VCO-${v} com KBD CV, nota ${n} (slider em 65,41 Hz)`, hz, fCruz(sonda(m, [`v${v}saw`], 0.4)[`v${v}saw`]), 0.002, 'Hz');
  }
  for (const f of [-1, 1]) { const m = novo(M, { ['f' + v]: pos(440), ['fine' + v]: f });
    perto(`VCO-${v} FINE TUNE ${f > 0 ? 'máximo' : 'mínimo'}`, 440 * 2 ** (f * 6 / 12), fCruz(sonda(m, [`v${v}saw`], 0.3)[`v${v}saw`]), 0.002, 'Hz'); }
}
{ const m = novo(M, { f1: pos(200), f2: pos(200), f3: pos(200), pw2: 25, pw3: 80 }), r = sonda(m, ['v1saw', 'v1sq', 'v2tri', 'v2saw', 'v2sin', 'v2pul', 'v3saw', 'v3pul'], 0.5);
  const fx = (nome, k, lo, hi) => { const [a, b] = minmax(r[k], 4800); linha(`${nome}: mínimo e máximo (V)`, `${lo} e ${hi}`, `${a.toFixed(2)} e ${b.toFixed(2)}`, Math.abs(a - lo) < 0.7 && Math.abs(b - hi) < 0.7); };
  fx('VCO-1 serra', 'v1saw', 0, 10); fx('VCO-1 quadrada', 'v1sq', 0, 10); fx('VCO-2 triângulo', 'v2tri', -5, 5); fx('VCO-2 serra', 'v2saw', 0, 10);
  fx('VCO-2 seno', 'v2sin', -5, 5); fx('VCO-2 pulso', 'v2pul', 0, 10); fx('VCO-3 serra', 'v3saw', 0, 10); fx('VCO-3 pulso', 'v3pul', 0, 10);
  perto('VCO-1 quadrada: ciclo de trabalho', 0.5, media(r.v1sq, 4800) / 10, 0.01);
  perto('VCO-2 PULSE WIDTH em 25%', 0.25, media(r.v2pul, 4800) / 10, 0.02); perto('VCO-3 PULSE WIDTH em 80%', 0.8, media(r.v3pul, 4800) / 10, 0.02);
  const e = espectro(r.v2sin, 4800, 16384), k = Math.round(200 * 16384 / FS); let h = 0; for (let i = 2 * k - 3; i < 8000; i++) h = Math.max(h, e[i]);
  linha('VCO-2 seno: maior componente fora da fundamental (dB)', '< -80', dB(h / e[k]), dB(h / e[k]) < -80);
  for (const [k2, nome] of [['v1saw', 'serra'], ['v2tri', 'triângulo']]) { const a1 = amp(r[k2], 200, FS, 4800, 24000), a2 = amp(r[k2], 400, FS, 4800, 24000), a3 = amp(r[k2], 600, FS, 4800, 24000);
    if (k2 === 'v1saw') { perto('serra: 2º harmônico / fundamental', 0.5, a2 / a1, 0.03); perto('serra: 3º harmônico / fundamental', 1 / 3, a3 / a1, 0.03); }
    else { linha('triângulo: 2º harmônico / fundamental', '< 0,01', a2 / a1, a2 / a1 < 0.01); perto('triângulo: 3º harmônico / fundamental', 1 / 9, a3 / a1, 0.05); } }
}
for (const [pw, esp] of [[10, 0.1], [90, 0.9]]) { const m = novo(M, { f2: pos(200), pw2: pw }); perto(`VCO-2 PULSE WIDTH no ${pw === 10 ? 'mínimo' : 'máximo'}`, esp, media(sonda(m, ['v2pul'], 0.4).v2pul, 4800) / 10, 0.03); }
{ // PWM com tensão contínua: +2,5 V vindos do inversor 2 (entrada 6 = +10 V, invertida) -> usa o inversor 1 (-(-10 V) x slider)
  const m = novo(M, { f2: pos(200), pwm2: 1, vp2: 0.25 }, [['inv1', 'v2pwm']]);
  perto('PWM: +2,5 V no jack com o slider no máximo (8% por volt)', 0.7, media(sonda(m, ['v2pul'], 0.4).v2pul, 4800) / 10, 0.02);
  const m2 = novo(M, { f2: pos(200), pwm2: 0.5, vp2: 0.25 }, [['inv1', 'v2pwm']]);
  perto('PWM: mesmo sinal com o slider na metade', 0.6, media(sonda(m2, ['v2pul'], 0.4).v2pul, 4800) / 10, 0.02);
  const m3 = novo(M, { f1: pos(40), f2: pos(1000), pwm2: 0.5 }, [['v1saw', 'v2pwm']]), x = sonda(m3, ['v2pul'], 0.6).v2pul;
  const c = picoEsp(x, 4800, 16384, 1000), l = picoEsp(x, 4800, 16384, 960), u = picoEsp(x, 4800, 16384, 1040);
  linha('PWM em taxa de áudio (serra de 40 Hz no pulso de 1 kHz): bandas laterais em 960 e 1040 Hz (dB rel. 1 kHz)', '> -30', Math.min(dB(l / c), dB(u / c)), dB(l / c) > -30 && dB(u / c) > -30);
}
{ const m = novo(M, { deriva: 1, f1: pos(440) }), x = sonda(m, ['v1saw'], 3).v1saw, f = [fCruz(x, 0, FS), fCruz(x, FS, 2 * FS), fCruz(x, 2 * FS, 3 * FS)];
  const c = Math.max(...f.map(v => Math.abs(1200 * Math.log2(v / 440))));
  linha('deriva ligada: desvio máximo em 3 s (cents)', '<= 2', c, c <= 2.05); }

/* ------------------------------------------------------------------ */
titulo('Normalizações: slider sobe -> o sinal pré-ligado aparece; cabo no jack desfaz; cabo vindo da própria fonte = igual');
{
  const BASE = { preGain: 0.1, f1: pos(100), f2: pos(150), f3: pos(230), ff: pos(2000), nNiv: 0.5, shRate: 1, shLvl: 1, sus: 1, ef: 0 };
  const CB = [['v1sq', 'preIn']], SV = 0.3;
  const roda = (p, cabos, probe) => { const m = novo(M, Object.assign({}, BASE, p), CB.concat(cabos)); m.msg({ t: 'on', n: 60 }); const x = sonda(m, [probe], 0.3)[probe]; return assin(x, 2400, x.length); };
  const fa = { fa2: 1 }, rmx = { rmA: 1, rmB: 1 };
  const T = [ // [entrada, slider (ou null), saída observada, parâmetros extras]
    ['efIn', 'ef', 'ef', {}], ['rmA', 'rmA', 'rm', { rmB: 1 }], ['rmB', 'rmB', 'rm', { rmA: 1 }],
    ['v1k', null, 'v1saw', {}], ['v1b', 'v1b', 'v1saw', {}], ['v1c', 'v1c', 'v1saw', {}], ['v1d', 'v1d', 'v1saw', {}],
    ['v2k', null, 'v2saw', {}], ['v2b', 'v2b', 'v2saw', {}], ['v2c', 'v2c', 'v2saw', {}], ['v2d', 'v2d', 'v2saw', {}], ['v2pwm', 'pwm2', 'v2pul', {}],
    ['v3k', null, 'v3saw', {}], ['v3b', 'v3b', 'v3saw', {}], ['v3c', 'v3c', 'v3saw', {}], ['v3d', 'v3d', 'v3saw', {}],
    ['fa1', 'fa1', 'vcf', rmx], ['fa2', 'fa2', 'vcf', {}], ['fa3', 'fa3', 'vcf', {}], ['fa4', 'fa4', 'vcf', {}], ['fa5', 'fa5', 'vcf', {}],
    ['fk', null, 'vcf', { fa2: 1, ff: pos(150) }], ['fc2', 'fc2', 'vcf', { fa2: 1, ff: pos(150) }], ['fc3', 'fc3', 'vcf', { fa2: 1, ff: pos(150) }],
    ['shGate', null, 'ar', { gateSw: 1, arA: 0.3, arR: 0.3 }],
    ['va1', 'va1', 'vca', { fa2: 1, gain0: 1 }], ['va2', 'va2', 'vca', Object.assign({ gain0: 1 }, rmx)],
    ['vlin', 'vlin', 'vca', { fa2: 1, va1: 1 }], ['vexp', 'vexp', 'vca', { fa2: 1, va1: 1 }],
    ['mx1', 'm1', 'mix', fa], ['mx2', 'm2', 'mix', { fa2: 1, va1: 1, gain0: 1 }],
    ['panIn', null, 'outL', { fa2: 1, m1: 1 }], ['revIn', null, 'rev', { fa2: 1, m1: 1 }],
    ['vp2', 'vp2', 'inv1', {}], ['vp4', 'vp4', 'inv1', {}], ['vp6', 'vp6', 'inv2', {}],
    ['lagIn', null, 'lag', { ef: 1 }], ['shIn', 'shLvl', 'sh', {}] ];
  let q = 0;
  for (const [ent, k, probe, extra] of T) {
    const fonte = D.NORMAL[ent], temJack = !['zero', 'p10', 'm10', 'mix'].includes(fonte);
    const zero = [['swB', ent]], propria = [[fonte, ent]];
    let ok, det;
    if (k) {
      const A = roda(Object.assign({}, extra, { [k]: 0 }), [], probe), B = roda(Object.assign({}, extra, { [k]: SV }), [], probe);
      const C = roda(Object.assign({}, extra, { [k]: SV }), zero, probe), Dd = temJack ? roda(Object.assign({}, extra, { [k]: SV }), propria, probe) : B;
      ok = difere(A, B) && igual(C, A) && igual(Dd, B);
      det = `slider muda a saída: ${difere(A, B) ? 'sim' : 'NÃO'}; cabo desfaz: ${igual(C, A) ? 'sim' : 'NÃO'}; ${temJack ? 'cabo da fonte = normalizado: ' + (igual(Dd, B) ? 'sim' : 'NÃO') : 'fonte sem jack'}`;
    } else {
      const B = roda(extra, [], probe), C = roda(extra, zero, probe), Dd = temJack ? roda(extra, propria, probe) : B;
      ok = difere(B, C) && igual(Dd, B);
      det = `sinal pré-ligado atua: ${difere(B, C) ? 'sim' : 'NÃO'}; ${temJack ? 'cabo da fonte = normalizado: ' + (igual(Dd, B) ? 'sim' : 'NÃO') : 'fonte sem jack'}`;
    }
    q++; linha(`${ent} <- ${fonte} (observado em ${probe})`, 'sim; sim; sim', det, ok);
  }
  linha('entradas com normalização testadas', 38, q, q === 38);
  // chave LF desfaz a normalização do KBD CV, mas um cabo no jack continua valendo (c)
  const m = novo(M, { f1: pos(10, 1), lf1: 1 }, [['kbd', 'v1k']]); m.msg({ t: 'on', n: 60 });
  perto('VCO-1 em LF com cabo KBD CV -> jack: volta a seguir o teclado', 40, fCruz(sonda(m, ['v1saw'], 1).v1saw), 0.005, 'Hz');
}

/* ------------------------------------------------------------------ */
titulo('Filtro (escada de 24 dB/oitava)');
{
  const ganho = (f, fc, res = 0) => { const m = novo(M, { f2: pos(f), ff: pos(fc), fa3: 0.1, res }, [['v2sin', 'fa3']]); const x = sonda(m, ['vcf'], 0.5).vcf; return amp(x, f, FS, 9600, 24000) / 0.5; };
  const g0 = ganho(50, 500);
  perto('ganho na banda passante, ressonância mínima', 1, g0, 0.03);
  perto('ganho em fc (quatro polos iguais: -12,04 dB)', -12.04, dB(ganho(500, 500) / g0), 0.05, 'dB');
  const g4 = ganho(2000, 500), g8 = ganho(4000, 500), g16 = ganho(8000, 500);
  perto('queda entre 4 fc e 8 fc', -23.3, dB(g8 / g4), 0.04, 'dB/oitava'); perto('queda entre 8 fc e 16 fc', -23.9, dB(g16 / g8), 0.04, 'dB/oitava');
  const gr = ganho(50, 500, 0.4); perto('ressonância 4 (k = 3,2): ganho em graves 1/(1+k)', dB(1 / 4.2), dB(gr), 0.05, 'dB');
  const pk = ganho(500, 500, 0.45) / ganho(50, 500, 0.45); linha('ressonância 4,5: pico em fc sobre os graves (dB)', '> 12', dB(pk), dB(pk) > 12);
  // A oscilação nasce do ruído de semente (10 µV) e leva ~107/fc s para chegar a 90% da amplitude (100 Hz: ~1,1 s; 20 Hz: ~5,9 s).
  // Por isso a janela de medição só começa depois de 150/fc s (mínimo 0,5 s); medir antes pega o ruído de semente, não a oscilação.
  for (const fc of [20, 50, 100, 200, 1000, 5000, 10000]) { const a = Math.max(0.5, 150 / fc), m = novo(M, { ff: pos(fc), res: 0.6 }), x = sonda(m, ['vcf'], a + 0.7).vcf; perto(`auto-oscilação com o slider em ${fc} Hz`, fc, fCruz(x, Math.round(a * FS)), 0.01, 'Hz'); }
  { const m = novo(M, { ff: pos(1000), res: 0.45 }), x = sonda(m, ['vcf'], 1.5).vcf, p = pico(x, FS); linha('ressonância 4,5: não oscila sozinho (V de pico)', '< 0,01', p, p < 0.01); }
  { const m = novo(M, { ff: pos(1000), res: 0.55 }), x = sonda(m, ['vcf'], 1.5).vcf, p = pico(x, FS); linha('ressonância 5,5: oscila sozinho (V de pico)', '> 0,3', p, p > 0.3); }
  { const m = novo(M, { ff: pos(1000), res: 1 }), x = sonda(m, ['vcf'], 1.5).vcf, p = pico(x, FS); linha('ressonância 10: amplitude da auto-oscilação (V de pico)', '1 a 6', p, p > 1 && p < 6); }
  { const m = novo(M, { ff: pos(200), res: 0.6 }); m.msg({ t: 'on', n: 60 }); perto('KBD CV no filtro: nota 60 (2 V) sobe 2 oitavas', 800, fCruz(sonda(m, ['vcf'], 1).vcf, FS / 2), 0.01, 'Hz'); }
  { const m = novo(M, { ff: pos(100), res: 0.6, fc2: 0.3, sus: 1 }, [['swB', 'fk']]); m.msg({ t: 'on', n: 60 }); perto('ADSR (10 V) no filtro com slider em 3: sobe 3 oitavas', 800, fCruz(sonda(m, ['vcf'], 1).vcf, FS / 2), 0.01, 'Hz'); }
  for (const f of [-1, 1]) { const m = novo(M, { ff: pos(1000), ffine: f, res: 0.6 }); perto(`FINE TUNE do filtro no ${f > 0 ? 'máximo' : 'mínimo'}`, 1000 * 2 ** (f / 2), fCruz(sonda(m, ['vcf'], 1).vcf, FS / 2), 0.01, 'Hz'); }
  { const m = novo(M, { ff: 1, res: 0.6, fc2: 1, sus: 1 }); m.msg({ t: 'on', n: 84 }); perto('corte limitado em 20 kHz com tensão de controle alta', 20000, fCruz(sonda(m, ['vcf'], 1).vcf, FS / 2), 0.02, 'Hz'); }
  { const m = novo(M, { f2: pos(150), ff: pos(1000), res: 0.6, fc3: 0.04 }), x = sonda(m, ['vcf'], 1).vcf;
    const e = espectro(x, FS / 2, 16384); let kc = 0; for (let i = 200; i < 600; i++) if (e[i] > e[kc]) kc = i; const fcar = kc * FS / 16384;
    const l = picoEsp(x, FS / 2, 16384, fcar - 150), u = picoEsp(x, FS / 2, 16384, fcar + 150);
    linha('filtro oscilando, modulado por VCO-2 a 150 Hz: bandas laterais a ±150 Hz (dB rel. portadora)', '> -30', Math.min(dB(l / e[kc]), dB(u / e[kc])), dB(l / e[kc]) > -30 && dB(u / e[kc]) > -30);
    const m0 = novo(M, { f2: pos(150), ff: pos(1000), res: 0.6 }), x0 = sonda(m0, ['vcf'], 1).vcf, c0 = picoEsp(x0, FS / 2, 16384, 1000), l0 = picoEsp(x0, FS / 2, 16384, 850, 2);
    linha('o mesmo com o slider em zero: sem banda lateral (dB)', '< -60', dB(l0 / c0), dB(l0 / c0) < -60); }
  { const m = novo(M, { f1: pos(100), ff: 1, fa2: 1 }), x = sonda(m, ['vcf'], 0.5).vcf, [lo, hi] = minmax(x, 9600);
    linha('quadrada de 0 a 10 V no filtro aberto: sai centrada em zero (V)', '±5 (±0,6)', `${lo.toFixed(2)} e ${hi.toFixed(2)}`, Math.abs(lo + 5) < 0.6 && Math.abs(hi - 5) < 0.6); }
}

/* ------------------------------------------------------------------ */
titulo('Envelopes, gate e trigger');
{
  for (const a of [0, 0.5, 0.8]) { const m = novo(M, { atk: a }); m.msg({ t: 'on', n: 60 }); const x = sonda(m, ['adsr'], D.tempoEnv(a) * 1.5 + 0.05).adsr; perto(`ADSR ataque, slider em ${a * 10}: tempo até 10 V`, D.tempoEnv(a), tAte(x, 9.999, true), 0.03, 's'); }
  { const m = novo(M, { atk: 1 }); m.msg({ t: 'on', n: 60 }); const x = render2(m, 'adsr', 11); perto('ADSR ataque no máximo', 10, tAte(x, 9.999, true), 0.03, 's'); }
  { const m = novo(M, { atk: 0.5 }); m.msg({ t: 'on', n: 60 }); const x = sonda(m, ['adsr'], 0.2).adsr, t = D.tempoEnv(0.5), v = x[Math.round(t / 2 * FS)];
    perto('ADSR ataque: nível na metade do tempo (curva RC em direção a 13 V)', 13 * (1 - Math.exp(-0.733)), v, 0.02, 'V'); }
  for (const [d, s] of [[0.5, 0.4], [0.7, 0]]) { const m = novo(M, { dec: d, sus: s }); m.msg({ t: 'on', n: 60 }); const T = D.tempoEnv(d), x = sonda(m, ['adsr'], T * 1.6 + 0.05).adsr, i0 = Math.round(tAte(x, 9.999, true) * FS);
    perto(`ADSR decaimento, slider em ${d * 10}: tempo até 1% acima do sustain`, T, tAte(x, s * 10 + (10 - s * 10) * 0.01, false, i0), 0.03, 's');
    perto(`ADSR sustain, slider em ${s * 10}`, s * 10 + (10 - s * 10) * Math.exp(-4.6 * 1.55), x[Math.round((T * 1.55) * FS) + i0], 0.02 + (s ? 0 : 1), 'V'); }
  for (const r of [0.3, 0.7]) { const m = novo(M, { rel: r }); m.msg({ t: 'on', n: 60 }); sonda(m, [], 0.05); m.msg({ t: 'off', n: 60 }); const x = sonda(m, ['adsr'], D.tempoEnv(r) * 1.3 + 0.02).adsr;
    perto(`ADSR release, slider em ${r * 10}: tempo até 1%`, D.tempoEnv(r), tAte(x, 0.1, false), 0.03, 's'); }
  for (const a of [0.2, 0.6]) { const m = novo(M, { arA: a, arR: a }); m.msg({ t: 'on', n: 60 }); const T = D.tempoEnv(a), x = sonda(m, ['ar'], T * 1.5 + 0.02).ar; perto(`AR ataque, slider em ${a * 10}`, T, tAte(x, 9.999, true), 0.03, 's');
    m.msg({ t: 'off', n: 60 }); const y = sonda(m, ['ar'], T * 1.4 + 0.02).ar; perto(`AR release, slider em ${a * 10}`, T, tAte(y, 0.1, false), 0.03, 's'); }
  { const m = novo(M); m.msg({ t: 'on', n: 60 }); const r = sonda(m, ['gate', 'trig'], 0.05); let n = 0; for (const v of r.trig) if (v > 5) n++;
    perto('gate do teclado', 10, r.gate[100], 0.001, 'V'); perto('trigger: largura do pulso de +10 V', 0.5, n / FS * 1000, 0.1, 'ms');
    m.msg({ t: 'on', n: 64 }); const r2 = sonda(m, ['trig', 'kbd'], 0.05); linha('segunda tecla com a primeira apertada: sem novo trigger', 0, Math.max(...r2.trig), Math.max(...r2.trig) === 0);
    perto('prioridade para a nota mais grave: KBD CV continua na nota 60', 2, r2.kbd[1000], 0.001, 'V');
    m.msg({ t: 'on', n: 48 }); perto('tecla mais grave assume o KBD CV', 1, sonda(m, ['kbd'], 0.02).kbd[500], 0.001, 'V');
    m.msg({ t: 'off', n: 48 }); m.msg({ t: 'off', n: 60 }); m.msg({ t: 'off', n: 64 }); const r3 = sonda(m, ['gate', 'kbd'], 0.02); linha('todas soltas: gate em 0 V e KBD CV guarda a última nota', '0 e 2,333', `${r3.gate[500]} e ${r3.kbd[500].toFixed(3)}`, r3.gate[500] === 0 && Math.abs(r3.kbd[500] - 28 / 12) < 0.001); }
  { const m = novo(M, { sus: 0.5, dec: 0.3 }); m.msg({ t: 'on', n: 60 }); sonda(m, [], 0.3); m.msg({ t: 'on', n: 62 }); const x = sonda(m, ['adsr'], 0.1).adsr; linha('tocar ligado não redispara o ADSR (fica no sustain, V)', 5, Math.max(...x), Math.abs(Math.max(...x) - 5) < 0.05); }
  { const m = novo(M); m.msg({ t: 'manual', v: 1 }); const x = sonda(m, ['adsr', 'ar'], 0.05); m.msg({ t: 'manual', v: 0 }); const y = sonda(m, ['adsr'], 0.05).adsr;
    linha('MANUAL START aciona ADSR e AR sem tecla; ao soltar, release', '10; 10; 0', `${x.adsr[2000].toFixed(1)}; ${x.ar[2000].toFixed(1)}; ${y[2000].toFixed(2)}`, x.adsr[2000] > 9.9 && x.ar[2000] > 9.9 && y[2000] < 0.01); }
  { const m = novo(M, { gateSw: 1, shRate: lnr(10, 0.2, 120) }), x = sonda(m, ['ar'], 1).ar; perto('chave em S/H GATE: envelopes disparados pelo relógio interno (10 Hz)', 10, fCruz(x, 0, FS, 5), 0.01, 'Hz');
    const m2 = novo(M, { gateSw: 0, shRate: lnr(10, 0.2, 120) }), x2 = sonda(m2, ['ar'], 0.5).ar; linha('chave em KBD GATE, sem tecla: envelope parado', 0, Math.max(...x2), Math.max(...x2) === 0);
    const m3 = novo(M, { gateSw: 1, f1: pos(3, 1), lf1: 1 }, [['v1sq', 'shGate']]), x3 = sonda(m3, ['ar'], 2).ar;
    // a janela começa em 0,2 s: a quadrada do VCO-1 já nasce em nível alto (fase inicial 0,1) e o AR dispara em t = 0; esse disparo de partida não é uma borda periódica e entrava na contagem
    perto('cabo VCO-1 (LF, 3 Hz) no jack S/H GATE: envelopes seguem o VCO', 3, fCruz(x3, Math.round(0.2 * FS), 2 * FS, 5), 0.01, 'Hz'); }
}
function lnr(v, a, b) { return Math.log(v / a) / Math.log(b); }
function render2(m, nome, seg) { const n = Math.round(seg * FS), x = new Float64Array(n), L = new Float32Array(64), k = D.NS[nome]; for (let i = 0; i < n; i += 64) { m.process(L, L, 64); x.fill(m.o[k], i, i + 64); } return x; }

/* ------------------------------------------------------------------ */
titulo('VCA');
{
  // áudio de teste: -5 V contínuos (inversor 2 com a entrada 6 em 5) no jack de áudio 1
  const vca = (p, tecla = true) => { const m = novo(M, Object.assign({ vp6: 0.5, va1: 1, sus: 1 }, p), [['inv2', 'va1']]); if (tecla) m.msg({ t: 'on', n: 60 }); return -sonda(m, ['vca'], 0.1).vca[4000] / 5; };
  linha('tudo em zero: fechado (ganho)', 0, vca({}), vca({}) === 0);
  perto('INITIAL GAIN no máximo, sem tecla', 1, vca({ gain0: 1 }, false), 0.001); perto('INITIAL GAIN em 5', 0.5, vca({ gain0: 0.5 }, false), 0.001);
  perto('controle linear: AR (10 V) com slider em 10', 1, vca({ vlin: 1 }), 0.001); perto('controle linear: slider em 4 (ganho = V/10)', 0.4, vca({ vlin: 0.4 }), 0.001);
  perto('controle exponencial: ADSR (10 V) com slider em 10', 0, dB(vca({ vexp: 1 })), 0.001 + 0.05, 'dB');
  perto('controle exponencial: slider em 9 (9 V)', -10, dB(vca({ vexp: 0.9 })), 0.01, 'dB'); perto('controle exponencial: slider em 5 (5 V)', -50, dB(vca({ vexp: 0.5 })), 0.01, 'dB');
  perto('soma das parcelas limitada a ganho 1', 1, vca({ gain0: 1, vlin: 1, vexp: 1 }), 0.001);
  const m = novo(M, { vp6: 0.5, va1: 0.5, gain0: 1 }, [['inv2', 'va1']]); perto('slider de áudio em 5: metade do sinal', -2.5, sonda(m, ['vca'], 0.05).vca[2000], 0.001, 'V');
}

/* ------------------------------------------------------------------ */
titulo('Ring modulator');
{
  const m = novo(M, { f1: pos(300), f2: pos(1000), rmA: 1, rmB: 1 }), x = sonda(m, ['rm'], 1.5).rm, a = FS, n = 16384;
  const esp = 5 * (10 / Math.PI) / 5 / 2;
  // As bandas são medidas por projeção na frequência exata (amp, janela de Hann): o pico da FFT perde até 15% quando a frequência cai entre duas raias
  // (resolução de 2,93 Hz; 400 Hz cai na raia 136,53 e 1 kHz na 341,33). Os VCOs estão exatos (300,000 Hz), então a projeção não tem esse erro.
  const proj = f => amp(x, f, FS, a, a + n);
  perto('AUDIO: serra 300 Hz x seno 1 kHz, componente soma (1300 Hz)', esp, proj(1300), 0.05, 'V'); perto('AUDIO: componente diferença (700 Hz)', esp, proj(700), 0.05, 'V');
  perto('AUDIO: soma com o 2º harmônico da serra (1600 Hz)', esp / 2, proj(1600), 0.05, 'V'); perto('AUDIO: diferença com o 2º harmônico (400 Hz)', esp / 2, proj(400), 0.05, 'V');
  const c = picoEsp(x, a, n, 1000, 2); linha('AUDIO: portadora de 1 kHz suprimida (dB rel. banda lateral)', '< -30', dB(c / esp), dB(c / esp) < -30);
  const f = picoEsp(x, a, n, 300, 2); linha('AUDIO: 300 Hz (serra) suprimido (dB rel. banda lateral)', '< -30', dB(f / esp), dB(f / esp) < -30);
  const m2 = novo(M, { f1: pos(300), f2: pos(1000), rmA: 1, rmB: 1, rmDC: 1 }), y = sonda(m2, ['rm'], 1.5).rm;
  perto('DC: a serra de 0 a 10 V tem 5 V de contínua, a portadora de 1 kHz aparece (A x B / 5)', 5, amp(y, 1000, FS, a, a + n), 0.03, 'V');
  const m3 = novo(M, { rmA: 1, rmB: 1, rmDC: 1, vp2: 0.4, vp6: 0.5 }, [['inv1', 'rmA'], ['inv2', 'rmB']]); perto('DC: +4 V x -5 V / 5', -4, sonda(m3, ['rm'], 0.05).rm[2000], 0.001, 'V');
  const m4 = novo(M, { f1: pos(300), f2: pos(1000), rmA: 0.5, rmB: 1 }); perto('slider esquerdo em 5: metade da amplitude', esp / 2, picoEsp(sonda(m4, ['rm'], 1.5).rm, a, n, 1300, 2), 0.05, 'V');
}

/* ------------------------------------------------------------------ */
titulo('FM em taxa de áudio');
{
  const fm = sl => { const m = novo(M, { f1: pos(1000), f2: pos(200), v1d: sl }), x = sonda(m, ['v1saw'], 1).v1saw, e = espectro(x, FS / 2, 16384);
    let kc = 250; for (let i = 250; i < 450; i++) if (e[i] > e[kc]) kc = i; const f = kc * FS / 16384; return [f, dB(picoEsp(x, FS / 2, 16384, f - 200, 2) / e[kc]), dB(picoEsp(x, FS / 2, 16384, f + 200, 2) / e[kc])]; };
  const [f0, l0, u0] = fm(0), [f1, l1, u1] = fm(0.02);
  linha('VCO-2 seno (200 Hz) no FM do VCO-1 (1 kHz), slider em 0: sem bandas laterais (dB)', '< -55', Math.max(l0, u0), Math.max(l0, u0) < -55);
  linha('slider em 0,2 (±0,1 oitava): bandas laterais a ±200 Hz da portadora (dB)', '-20 a -8', `${l1.toFixed(1)} e ${u1.toFixed(1)}`, l1 > -20 && l1 < -8 && u1 > -20 && u1 < -8);
  // índice esperado: desvio ~ ln2 x 0,1 x 1000 Hz = 69 Hz, beta = 0,35, J1/J0 = -15,0 dB
  perto('nível médio das bandas laterais (beta = 0,35: J1/J0)', -15, (l1 + u1) / 2, 0.12, 'dB');
  const m = novo(M, { f1: pos(1000), f2: pos(200), v1d: 0.3 }, [['v2saw', 'v1d']]), x = sonda(m, ['v1saw'], 0.5).v1saw;
  linha('FM por cabo (VCO-2 serra -> VCO-1): saída finita e dentro de 0 a 10 V', 'sim', minmax(x).map(v => v.toFixed(2)).join(' e '), x.every(Number.isFinite) && minmax(x)[0] > -0.8 && minmax(x)[1] < 10.8);
}

/* ------------------------------------------------------------------ */
titulo('Noise generator');
{
  const banda = (x, f1, f2) => { const e = espectro(x, 4096, 65536); let s = 0; for (let i = Math.round(f1 * 65536 / FS); i < Math.round(f2 * 65536 / FS); i++) s += e[i] * e[i]; return 10 * Math.log10(s / (f2 - f1)); };
  for (const [c, nome, esp] of [[1, 'WHITE', 0], [0.5, 'PINK', -9], [0, 'LOW FREQ', -18]]) { const m = novo(M, { nCor: c, nNiv: 0.2 }), x = sonda(m, ['noise'], 1.6).noise;
    linha(`${nome}: densidade em 1600–3200 Hz menos 200–400 Hz (3 oitavas)`, `${esp} dB (±2)`, banda(x, 1600, 3200) - banda(x, 200, 400), Math.abs(banda(x, 1600, 3200) - banda(x, 200, 400) - esp) < 2); }
  const niv = v => { const m = novo(M, { nNiv: v }), x = sonda(m, ['noise'], 0.5).noise; return [rms(x), pico(x)]; };
  const [r2, p2] = niv(0.2), [r5, p5] = niv(0.5), [r10, p10] = niv(1), [r0] = niv(0);
  linha('nível 0: silêncio', 0, r0, r0 === 0); perto('nível 2 para 5: o valor eficaz cresce 2,5 vezes (sem ceifar muito)', 2.5, r5 / r2, 0.08);
  linha('nível 2: sem ceifar (pico em V)', '< 10', p2, p2 < 10); linha('nível 10: ceifa em ±10 V (20 V pico a pico)', 10, p10, p10 === 10 && r10 > r5);
  const m = novo(M, { nNiv: 0.55 }), x = sonda(m, ['noise'], 1).noise; let c = 0; for (const v of x) if (Math.abs(v) >= 10) c++;
  linha('pouco acima de meio curso já há amostras ceifadas (%)', '> 0', 100 * c / x.length, c > 0);
}

/* ------------------------------------------------------------------ */
titulo('Sample & hold, relógio interno, electronic switch');
{
  for (const [p, hz] of [[0, 0.2], [0.5, 0.2 * Math.sqrt(120)], [1, 24]]) { const m = novo(M, { shRate: p }), s = hz < 1 ? 12 : 3, x = sonda(m, ['clk'], s).clk; perto(`RATE em ${p * 10}: frequência do relógio`, hz, fCruz(x, 0, x.length, 5), 0.01, 'Hz'); }
  { const m = novo(M, { shRate: 1 }), x = sonda(m, ['clk'], 0.5).clk, [lo, hi] = minmax(x); linha('relógio: onda quadrada de 0 a +10 V, 50%', '0; 10; 0,5', `${lo}; ${hi}; ${(media(x, 0, 20000) / 10).toFixed(2)}`, lo === 0 && hi === 10 && Math.abs(media(x, 0, 20000) / 10 - 0.5) < 0.02); }
  { const m = novo(M, { shRate: lnr(10, 0.2, 120), nNiv: 0.3 }), x = sonda(m, ['sh'], 2).sh; let troca = 0; const vals = new Set(); for (let i = 1; i < x.length; i++) { if (x[i] !== x[i - 1]) troca++; vals.add(x[i]); }
    perto('S/H do ruído a 10 Hz: trocas de valor por segundo', 10, troca / 2, 0.06); linha('S/H: valores distintos em 2 s (um por passo, constante entre passos)', '19 a 21', vals.size, vals.size >= 19 && vals.size <= 21);
    const [lo, hi] = minmax(x); linha('S/H: valores espalhados (V)', 'faixa > 4', hi - lo, hi - lo > 4); }
  { const m = novo(M, { shLvl: 0.5, vp6: 0.8 }, [['inv2', 'shIn']]); perto('S/H de -8 V com LEVEL em 5', -4, sonda(m, ['sh'], 1).sh[FS - 1], 0.001, 'V');
    const m0 = novo(M, { shLvl: 0, vp6: 0.8 }, [['inv2', 'shIn']]); linha('LEVEL em 0', 0, sonda(m0, ['sh'], 1).sh[FS - 1], Math.abs(sonda(m0, ['sh'], 0.1).sh[100]) === 0); }
  { const m = novo(M, { shRate: 0, f1: pos(100), f2: pos(7, 1), lf2: 1 }, [['v1sq', 'extClk'], ['v2tri', 'shIn']]), x = sonda(m, ['sh'], 1).sh; let troca = 0; for (let i = 1; i < x.length; i++) if (x[i] !== x[i - 1]) troca++;
    perto('EXT CLOCK IN (VCO-1 a 100 Hz) substitui o relógio interno: amostras por segundo', 100, troca, 0.03); }
  { const m = novo(M, { shRate: lnr(5, 0.2, 120), vp2: 0.3, vp6: 0.6 }, [['inv1', 'swA'], ['inv2', 'swB']]), x = sonda(m, ['swC', 'clk'], 1), [lo, hi] = minmax(x.swC);
    linha('switch: +3 V em A, -6 V em B; C alterna entre os dois', '-6 e 3', `${lo.toFixed(2)} e ${hi.toFixed(2)}`, Math.abs(lo + 6) < 1e-6 && Math.abs(hi - 3) < 1e-6);
    perto('switch: alternância na frequência do relógio', 5, fCruz(x.swC, 0, FS, -1.5), 0.01, 'Hz');
    let casa = 0; for (let i = 100; i < FS; i++) if ((x.clk[i] > 5) === (x.swC[i] > 0)) casa++; linha('relógio alto liga C a A (% das amostras)', '> 99', 100 * casa / (FS - 100), casa / (FS - 100) > 0.99);
    const m2 = novo(M, { shRate: lnr(5, 0.2, 120), vp6: 0.6 }, [['inv2', 'swC']]), y = sonda(m2, ['swA', 'swB'], 1); let ex = 0, soma = 0; for (let i = 100; i < FS; i++) { if ((y.swA[i] === -6) !== (y.swB[i] === -6)) ex++; soma += y.swA[i] + y.swB[i]; }
    linha('sentido contrário: -6 V em C sai ora por A, ora por B (% das amostras em que só um tem sinal)', '> 99', 100 * ex / (FS - 100), ex / (FS - 100) > 0.99); }
}

/* ------------------------------------------------------------------ */
titulo('Voltage processors, lag, envelope follower, preamp, teclado');
{
  { const m = novo(M, { vp2: 0.3, vp4: 0.5, vp6: 0.7 }, [['inv2', 'vp1'], ['kbd', 'vp3']]); m.msg({ t: 'on', n: 60 }); const r = sonda(m, ['inv1', 'inv2'], 0.02);
    perto('inversor 2: -(0,7 x 10 V)', -7, r.inv2[500], 1e-6, 'V'); perto('inversor 1: -(ent.1 [-7] + 0,3 x -10 + ent.3 [2] + 0,5 x KBD CV [2])', 7, r.inv1[500], 1e-6, 'V'); }
  for (const p of [0, 0.5, 1]) { const m = novo(M, { lag: p, vp6: 0.5 }, [['inv2', 'lagIn']]), T = D.lagS(p), x = sonda(m, ['lag'], T * 3 + 0.01).lag;
    perto(`LAG em ${p * 10}: subida de 10% a 90%`, T, tAte(x, -4.5, false) - tAte(x, -0.5, false), p === 0 ? 0.08 : 0.02, 's'); }
  { const m = novo(M, { f1: pos(500), preGain: 0.1, ef: 0.2 }, [['inv1', 'preIn']]); // quadrada de 1 V pp feita com o próprio painel: não há; usa contínua
    const m2 = novo(M, { vp2: 0.05, preGain: 0.1, ef: 1 }, [['inv1', 'preIn']]), x = sonda(m2, ['ef', 'pre'], 0.2);
    perto('preamp: 0,5 V, GAIN em 1, RANGE X10 (ganho 1)', 0.5, x.pre[5000], 0.001, 'V'); perto('envelope follower: 0,5 V de módulo (= quadrada de 1 V pico a pico) com o slider no máximo', 10, x.ef[9000], 0.01, 'V');
    linha('envelope follower: tempo até 50% (ms)', '10 (±3)', tAte(x.ef, 5, true) * 1000, Math.abs(tAte(x.ef, 5, true) * 1000 - 10) < 3); linha('envelope follower: tempo até 90% (ms)', '30 (±6)', tAte(x.ef, 9, true) * 1000, Math.abs(tAte(x.ef, 9, true) * 1000 - 30) < 6); }
  for (const [g, r, esp] of [[1, 0, 1], [0.5, 1, 5], [0.02, 2, 2], [1, 2, 12]]) { const m = novo(M, { vp2: 0.01, preGain: g, preRange: r }, [['inv1', 'preIn']]);
    perto(`preamp: 0,1 V com GAIN em ${g * 10} e RANGE ${['X10', 'X100', 'X1000'][r]}${esp === 12 ? ' (ceifa no trilho)' : ''}`, esp, sonda(m, ['pre'], 0.01).pre[200], 0.001, 'V'); }
  { const m = novo(M); m.msg({ t: 'on', n: 48 }); perto('KBD CV: nota 48 (uma oitava acima da mais grave)', 1, sonda(m, ['kbd'], 0.01).kbd[100], 1e-6, 'V');
    const m2 = novo(M, { interval: 2, tune: 0.25 }); m2.msg({ t: 'on', n: 48 }); perto('TONE INTERVAL em 2 e TUNE em +3 semitons', 2.25, sonda(m2, ['kbd'], 0.01).kbd[100], 1e-6, 'V');
    const m3 = novo(M, { porta: 1 }); m3.msg({ t: 'on', n: 36 }); sonda(m3, [], 0.01); m3.msg({ t: 'off', n: 36 }); m3.msg({ t: 'on', n: 48 }); const x = sonda(m3, ['kbd'], 1).kbd;
    perto('PORTAMENTO no máximo: constante de tempo (63% do salto)', 0.5, tAte(x, 0.632, true), 0.02, 's');
    const m4 = novo(M, { porta: 0.5 }); m4.msg({ t: 'on', n: 36 }); sonda(m4, [], 0.01); m4.msg({ t: 'off', n: 36 }); m4.msg({ t: 'on', n: 48 }); perto('PORTAMENTO em 5', 0.125, tAte(sonda(m4, ['kbd'], 0.5).kbd, 0.632, true), 0.02, 's'); }
  { const m = novo(M, { f1: pos(100) }, [['v1saw', 'mult1'], ['mult3', 'vp1']]), r = sonda(m, ['inv1', 'v1saw'], 0.05); let d = 0;
    // O MULTIPLE lê o valor do passo anterior (atraso de meio passo, projeto do motor). Na borda de queda da serra (0 a 10 V em ~2 amostras) esse atraso aparece como
    // erro de ~5 V em uma amostra por ciclo; essas amostras (e as duas vizinhas) ficam fora. Nas demais o erro é de ~0,01 V.
    for (let i = 10; i < 2400; i++) { if (Math.abs(r.v1saw[i] - r.v1saw[i - 1]) > 1 || Math.abs(r.v1saw[i + 1] - r.v1saw[i]) > 1) continue; d = Math.max(d, Math.abs(r.inv1[i] + r.v1saw[i])); }
    linha('MULTIPLE: sinal que entra num jack sai por outro (erro máximo, V)', '< 0,7 (uma amostra de atraso)', d, d < 0.7); }
}

/* ------------------------------------------------------------------ */
titulo('Mixer, pan, reverb e saída');
{
  const P0 = { vp6: 0.5 }, cb = [['inv2', 'mx1']];
  { const m = novo(M, Object.assign({ m1: 0.6 }, P0), cb), r = sonda(m, ['mix', 'mixA', 'outL', 'outR'], 0.02); perto('mixer: -5 V com slider em 6', -3, r.mix[500], 1e-6, 'V'); perto('jack depois do slider 1', -3, r.mixA[500], 1e-6, 'V');
    perto('PAN no centro: metade para cada lado', -1.5, r.outL[500], 1e-6, 'V'); linha('PAN no centro: L = R', 'iguais', r.outL[500] - r.outR[500], r.outL[500] === r.outR[500]); }
  { const m = novo(M, Object.assign({ m1: 0.6, pan: -1 }, P0), cb), r = sonda(m, ['outL', 'outR'], 0.02); linha('PAN todo à esquerda (V em L e em R)', '-3 e 0', `${r.outL[500]} e ${r.outR[500]}`, Math.abs(r.outL[500] + 3) < 1e-9 && r.outR[500] === 0); }
  { const m = novo(M, Object.assign({ m1: 0.6, pan: 1 }, P0), cb), r = sonda(m, ['outL', 'outR'], 0.02); linha('PAN todo à direita', '0 e -3', `${r.outL[500]} e ${r.outR[500]}`, Math.abs(r.outR[500] + 3) < 1e-9 && r.outL[500] === 0); }
  { const m = novo(M, P0, [['inv2', 'inL']]), r = sonda(m, ['outL', 'outR'], 0.02); linha('LEFT INPUT vai só para a esquerda', '-5 e 0', `${r.outL[500]} e ${r.outR[500]}`, r.outL[500] === -5 && r.outR[500] === 0); }
  // reverb: nota curta pelo caminho pré-ligado; mede a cauda
  const cauda = (p, cabos = []) => { const m = novo(M, Object.assign({ fa2: 1, va1: 1, vlin: 1, m2: 1, ff: pos(3000) }, p), cabos); m.msg({ t: 'on', n: 60 }); render(m, 0.1); m.msg({ t: 'off', n: 60 }); return render(m, 3); };
  { const [L, R] = cauda({ revL: 1, revR: 0 }), a = rms(L, 0.1 * FS, 0.3 * FS), b = rms(L, Math.round(1.1 * FS), Math.round(1.3 * FS));   // 1.1 * 48000 = 52800.00000000001 não é índice: x[...] dava undefined e o RMS saía NaN
    linha('reverb: há cauda depois da nota (dBFS, 0,1 a 0,3 s)', '> -50', dB(a), dB(a) > -50); linha('reverb: decaimento em 1 s (dB); aproximação de ~2 s para 60 dB', '-20 a -45', dB(b / a), dB(b / a) < -20 && dB(b / a) > -45);
    linha('slider R em zero: sem mola na direita (dBFS)', '< -90', dB(rms(R, 0.1 * FS, 0.3 * FS)), dB(rms(R, 0.1 * FS, 0.3 * FS)) < -90); }
  { const [L] = cauda({ revL: 0, revR: 0 }); linha('sliders do reverb em zero: sem cauda (dBFS)', '< -90', dB(rms(L, 0.1 * FS, 0.3 * FS)), dB(rms(L, 0.1 * FS, 0.3 * FS)) < -90); }
  { const [L] = cauda({ revL: 1 }, [['rev', 'vp1']]); linha('cabo no REVERB OUTPUT tira a mola da saída principal (dBFS)', '< -90', dB(rms(L, 0.1 * FS, 0.3 * FS)), dB(rms(L, 0.1 * FS, 0.3 * FS)) < -90); }
  // nível do patch inicial
  for (const n of [36, 48, 60, 72, 84]) { const m = new M(FS); m.msg({ t: 'on', n }); const [L, R] = render(m, 2), p = dB(Math.max(pico(L), pico(R))); linha(`patch inicial, nota ${n}: pico (dBFS)`, '-12 a -3', p, p >= -12 && p <= -3); }
  { const m = new M(FS); m.msg({ t: 'on', n: 48 }); render(m, 1); m.msg({ t: 'off', n: 48 }); const [L] = render(m, 6); linha('patch inicial: silêncio depois de soltar (dBFS, 5 a 6 s)', '< -70', dB(rms(L, 5 * FS, 6 * FS)), dB(rms(L, 5 * FS, 6 * FS)) < -70); }
  { const m = new M(FS), [L] = render(m, 1); linha('patch inicial sem tecla: silêncio (dBFS)', '< -80', dB(pico(L)), dB(pico(L)) < -80); }
  { const m = new M(FS); m.msg({ t: 'on', n: 60 }); m.msg({ t: 'on', n: 67 }); const [L] = render(m, 1); const e = espectro(L, 16384, 16384), k1 = Math.round(261.6 * 16384 / FS), k2 = Math.round(392 * 16384 / FS);
    linha('monofônico: com duas teclas (60 e 67) só soa a mais grave (dB de 392 Hz rel. 261,6 Hz)', '< -40', dB(e[k2] / e[k1]), dB(e[k2] / e[k1]) < -40); }
  { // pior caso: todos os sliders no máximo, ressonância alta, ruído, realimentação VCA -> filtro
    const p = {}; for (const k in D.PADRAO) p[k] = 1; Object.assign(p, { preRange: 2, pw2: 50, pw3: 50, lf1: 0, lf2: 0, lf3: 0, gateSw: 0, rmDC: 1, f1: 0.5, f2: 0.52, f3: 0.6, ff: 0.7, fine1: 0, fine2: 0, fine3: 0, ffine: 0, interval: 1, tune: 0, porta: 0, atk: 0, pan: 0 });
    const m = new M(FS); m.msg({ t: 'ps', p }); m.msg({ t: 'cabos', c: [['vca', 'fa4'], ['outL', 'preIn'], ['inv1', 'vp3'], ['pre', 'inR']] }); m.msg({ t: 'on', n: 60 }); const [L, R] = render(m, 3), pk = Math.max(pico(L), pico(R));
    // Critério "≤ 1" (decisão de Pedro, 15/11/2026): o limitador tem assíntota em 1 (em precisão dupla o pico é 0,9999999994) e só chega a 1,000 ao ser gravado em Float32.
    linha('pior caso (tudo no máximo, com realimentações por cabo): pico digital', '≤ 1 e finito', pk, pk <= 1 && L.every(Number.isFinite) && R.every(Number.isFinite)); }
  { // aliasing: serra de 3520 Hz direto na saída (cabo VCO-1 -> LEFT INPUT)
    const m = novo(M, { f1: pos(3520) }, [['v1saw', 'inL']]), [L] = render(m, 1), n = 32768, e = espectro(L, 8192, n), k0 = 3520 * n / FS; let pior = 0, fp = 0;
    for (let i = 20; i < 20000 * n / FS; i++) { const h = i / k0, perto = Math.abs(h - Math.round(h)) * k0 < 6; if (!perto && e[i] > pior) { pior = e[i]; fp = i * FS / n; } }
    const f = e[Math.round(k0)]; linha(`aliasing: maior componente não harmônica abaixo de 20 kHz, serra de 3520 Hz (dB rel. fundamental; em ${Math.round(fp)} Hz)`, '< -50', dB(pior / f), dB(pior / f) < -50); }
  { const m = novo(M, { f1: pos(100) }, [['v1saw', 'inL']]), [L] = render(m, 1); perto('escala da saída: serra de 10 V pico a pico -> pico a pico digital (10 V x 0,17 = 1,7, antes do limitador)', 2 * (0.7 + 0.3 * Math.tanh((0.85 - 0.7) / 0.3)), Math.max(...L.slice(24000)) - Math.min(...L.slice(24000)), 0.05); }
}

/* ------------------------------------------------------------------ */
titulo('Agendamento e mensagens');
{
  const m = novo(M, { fa2: 1, va1: 1, vlin: 1, m2: 1 }); m.msg({ t: 'on', n: 60, at: 0.25, seq: 1 }); m.msg({ t: 'off', n: 60, at: 0.5, seq: 1 });
  const x = sonda(m, ['gate'], 0.7).gate; perto('evento agendado: gate sobe na amostra pedida', 0.25, tAte(x, 5, true), 0.001, 's'); perto('evento agendado: gate desce na amostra pedida', 0.5, tAte(x, 5, false, 13000) + 13000 / FS, 0.001, 's');
  const m2 = novo(M); m2.msg({ t: 'on', n: 60, at: 0.01, seq: 1 }); m2.msg({ t: 'off', n: 60, at: 5, seq: 1 }); sonda(m2, [], 0.05); m2.msg({ t: 'seqpara' }); linha('"seqpara" solta as notas do sequenciador', 0, sonda(m2, ['gate'], 0.01).gate[100], sonda(m2, ['gate'], 0.01).gate[100] === 0);
}

console.log(`\n${fora} medição(ões) fora da tolerância.`);
process.exit(fora ? 1 : 0);
