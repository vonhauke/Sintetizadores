// Mede o motor de tr808/index.html fora do navegador e compara com docs/pesquisa/tr808.md.
// Uso: node tests/medicao/tr808/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
// Tolerâncias: marcadas "(tol. minha)" quando a fonte não dá tolerância. Valores esperados vêm do tr808.md.
import { carregaMotor, novo, renderVoz, render, vpp, dB, pico, rms, espectro, picoEsp, energiaBanda, cruzamentos, tempoAte, tempoAteRms, ampDecai, resposta, FS } from './motor.mjs';

const Motor = carregaMotor(), D = Motor.dados;
let fora = 0; const linhas = [];
const f = (v, c = 2) => typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v)) : String(v);
function confere(nome, esperado, medido, ok) { if (!ok) fora++; linhas.push([ok ? 'ok  ' : 'FORA', nome, esperado, medido]); }
/** Linha informativa: aparece no relatório e não conta como ok nem como fora (hipótese ou valor sem critério na fonte). */
function info(nome, esperado, medido) { linhas.push(['info', nome, esperado, medido]); }
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const titulo = t => linhas.push(['', '— ' + t + ' —', '', '']);
/** Vpp digital esperado de uma voz no mix: o sinal da voz (volts, MULTI OUT) passa pelos dois polos do master e leva o ganho do resistor de mistura, o ×1,5 do 2º estágio e a referência de 15 V. */
const vppMix = (y, g) => { const p = D.mkMasterPolos(FS), z = Float64Array.from(y, v => p.process(v)); return vpp(z) * g * D.MASTER.g2 / D.MASTER.vRef; };
const semitons = (a, b) => 12 * Math.log2(a / b);
const freqEm = (x, t0, a, b) => { const c = cruzamentos(x, FS, Math.round((t0 + a) * FS), Math.round((t0 + b) * FS), 1).filter(t => t > 0); return c.length < 2 ? NaN : (c.length - 1) / (c[c.length - 1] - c[0]); };

const bd = (p = {}, ac = false, seg = 3) => { const m = novo(Motor, FS, { acLevel: 1, bd: Object.assign({ level: 1, tone: 0.5, decay: 0.5 }, p) }); return renderVoz(m, 'bd', seg, [{ t: 0.01, ac }]); };

// ===== 1. bumbo: frequência e varredura =====
titulo('bumbo: frequência (DECAY no máximo)');
{
  const { y, t0 } = bd({ decay: 1 }, false, 4);
  const fFim = freqEm(y, t0, 0.6, 1.6);
  confere('f0 com DECAY longo (0,6 a 1,6 s)', '49,5 Hz ±0,5 (decisão do usuário; tol. minha)', f(fFim) + ' Hz', perto(fFim, 49.5, 0.5));
  const mag = espectro(y, Math.round((t0 + 0.6) * FS), 65536), [fp] = picoEsp(mag, FS, 30, 80);
  confere('f0 pelo pico do espectro (0,6 a 1,9 s)', '49,5 Hz ±0,5', f(fp) + ' Hz', perto(fp, 49.5, 0.5));
  const fIni = freqEm(y, t0, 0.02, 0.12), st = semitons(fIni, fFim);
  confere('varredura: 20 a 120 ms contra o final', '> 1 semitom e ≤ 3,3 (Werner 48 a 58 Hz; tol. minha)', f(st) + ' semitons (' + f(fIni, 1) + ' Hz)', st > 1 && st <= 3.3);
  let min = 1e9, max = 0; for (let a = 0.02; a < 0.3; a += 0.02) { const q = freqEm(y, t0, a, a + 0.1); if (q < min) min = q; if (q > max) max = q; }
  confere('frequência instantânea nos primeiros 0,4 s dentro de 48 a 58 Hz', '48 a 58 Hz (S4, Fig. 11)', f(min, 1) + ' a ' + f(max, 1) + ' Hz', min >= 48 && max <= 58);
  confere('o topo da varredura chega perto de 58 Hz (janela de 100 ms)', '≥ 53 Hz (tol. minha)', f(max, 1) + ' Hz', max >= 53);
}

// ===== 2. bumbo: ataque =====
titulo('bumbo: ataque (subida de >1 oitava em ~6 ms, em toda nota)');
for (const ac of [false, true]) {
  const { y, t0 } = bd({ decay: 1, tone: 1 }, ac, 1), c = cruzamentos(y, FS, Math.round(t0 * FS) + 1, Math.round((t0 + 0.05) * FS), 0).filter(t => t > t0);
  // semiciclo inicial: do início do pulso até o 1º cruzamento por zero; comparado com o semiciclo estável (1/(2·49,5) = 10,1 ms)
  const meio = c.length >= 2 ? c[1] - c[0] : NaN, estavel = 1 / (2 * 49.5);
  confere(`${ac ? 'com' : 'sem'} accent: 1º semiciclo completo`, `≤ metade do estável (${f(estavel * 1000, 1)} ms): freq ≥ 2× (tol. minha)`, f(meio * 1000, 2) + ' ms (' + f(1 / (2 * meio), 0) + ' Hz)', meio <= estavel / 2);
}

// ===== 3. bumbo: decay (critério 1/10 do Vpp, ~−20 dB) =====
titulo('bumbo: decay a −20 dB (DECAY mínimo, 12 h, máximo)');
for (const [p, alvo] of [[0, 50], [0.5, 300], [1, 800]]) {
  const { y, t0 } = bd({ decay: p }, false, 4), T = tempoAte(y, FS, t0, 0.1) * 1000;
  confere(`DECAY = ${p === 0 ? 'mínimo' : p === 1 ? 'máximo' : '12 h'}`, `${alvo} ms ±10 % (tol. minha; tabela p.14)`, f(T, 0) + ' ms', perto(T, alvo, alvo * 0.1));
}

// ===== 4. bumbo: nível e accent =====
titulo('bumbo: amplitude no MULTI OUT (LEVEL no máximo, TONE e DECAY a 12 h)');
{
  const n = bd({}, false), a = bd({}, true), z = bd({}, true), pn = vpp(n.y), pa = vpp(a.y);
  confere('normal', '3,5 Vpp ±5 % (tabela p.14)', f(pn) + ' Vpp', perto(pn, 3.5, 0.175));
  confere('accent no máximo', '10 Vpp ±5 %', f(pa) + ' Vpp', perto(pa, 10, 0.5));
  confere('razão accent/normal', '2,86 (10/3,5)', f(pa / pn), perto(pa / pn, 10 / 3.5, 0.15));
  const m0 = novo(Motor, FS, { acLevel: 0, bd: { level: 1, tone: 0.5, decay: 0.5 } }), q = renderVoz(m0, 'bd', 3, [{ t: 0.01, ac: true }]);
  confere('accent com ACCENT LEVEL no mínimo = normal (procedimento da p.14)', '3,5 Vpp ±5 %', f(vpp(q.y)) + ' Vpp', perto(vpp(q.y), 3.5, 0.175));
  // timbre: energia de 1 a 6 kHz (onde domina o "click" do pulso) sobre a total, nos 170 ms iniciais. A banda >150 Hz foi trocada: ali domina o ataque do ressonador, que cresce junto com o corpo
  const razaoHF = r => { const mg = espectro(r.y, Math.round(r.t0 * FS), 8192); return energiaBanda(mg, FS, 1000, 6000) / energiaBanda(mg, FS, 20, 8000); };
  const dif = dB(Math.sqrt(razaoHF(a) / razaoHF(n)));
  confere('accent muda o timbre (energia 1 a 6 kHz / total, 170 ms iniciais)', '|diferença| ≥ 0,5 dB (tol. minha; texto da Roland e S4)', f(dif) + ' dB', Math.abs(dif) >= 0.5);
}

// ===== 5. bumbo: ressonador sem oscilador livre =====
titulo('bumbo: ressonador excitado por pulso, sem oscilador livre');
{
  const { y, t0 } = bd({ decay: 1 }, false, 8), i0 = Math.round(t0 * FS);
  confere('silêncio exato antes do disparo', '0', f(pico(y, 0, i0 - 1), 12), pico(y, 0, i0 - 1) === 0);
  const fim = rms(y, Math.round(7 * FS), Math.round(8 * FS)), ref = pico(y);
  confere('decai a < −60 dB em 7 s (DECAY máximo)', '< −60 dB', f(dB(fim / ref), 1) + ' dB', dB(fim / ref) < -60);
  const um = vpp(bd({ decay: 0.5 }, false, 2).y), m = novo(Motor, FS, { acLevel: 1, bd: { level: 1, tone: 0.5, decay: 0.5 } }), r = renderVoz(m, 'bd', 2, [{ t: 0.01, ac: false }, { t: 0.1, ac: false }, { t: 0.19, ac: false }]);
  confere('3 disparos a 90 ms: sem "machine gun" nem salto (S4, Fig. 12)', 'Vpp ≤ 2× o de um disparo (tol. minha)', f(vpp(r.y) / um) + '×', vpp(r.y) <= 2 * um);
}

// ===== 6. bumbo: TONE, LEVEL, mix =====
titulo('bumbo: TONE (passa-baixas), LEVEL e mix');
{
  const esp = (tone) => { const { y, t0 } = bd({ tone, decay: 0.5 }, true, 1); return espectro(y, Math.round(t0 * FS), 8192); };
  const lo = esp(0), hi = esp(1), at = (mg, fq) => mg[Math.round(fq * 8192 / FS)];
  const d = dB(at(hi, 2000) / at(lo, 2000));
  // fc = 1/(2π·R_eq·C45), R_eq = R171 + (R172 ∥ VR5), C45 0,1 µF (S4, Tab. 1; valores: Parte B 3.1). TONE mín.: ~305 Hz; máx.: ~7,2 kHz (c: lei do potenciômetro C)
  const teor = dB(1 / Math.hypot(1, 2000 / 7234)) - dB(1 / Math.hypot(1, 2000 / 305));
  confere('TONE máximo contra mínimo em 2 kHz', f(teor, 1) + ' dB ±4 (filtro RC de 1 polo, valores lidos; lei do pot. é (c))', f(d, 1) + ' dB', perto(d, teor, 4));
  const z = bd({ level: 0 }, false, 1); confere('LEVEL no mínimo: mudo', '0 V', f(pico(z.y), 9), pico(z.y) === 0);
  const m = novo(Motor, FS, { master: 1, acLevel: 1, bd: { level: 1, tone: 0.5, decay: 0.5 } }), vy = renderVoz(novo(Motor, FS, { acLevel: 1, bd: { level: 1, tone: 0.5, decay: 0.5 } }), 'bd', 1).y;
  const d2 = render(m, 1, [{ t: 0.01, v: 'bd', ac: false }]), esperado = vppMix(vy, D.GANHO_MIX.bd);
  confere('mix: BD com ganho 1,5 (Parte C, seção 10)', f(esperado, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esperado, esperado * 0.03));
}


// ===== 7. caixa =====
const sd = (p = {}, ac = false, seg = 1, extra = {}) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, sd: Object.assign({ level: 1, tone: 0.5, snappy: 0.5 }, p) }, extra)); return renderVoz(m, 'sd', seg, [{ t: 0.01, ac }]); };
const bandaDb = (r, f1, f2, n = 16384) => dB(Math.sqrt(energiaBanda(espectro(r.y, Math.round(r.t0 * FS), n), FS, f1, f2)));
titulo('caixa: osciladores (bridged-T revisados)');
if (!D.SD) { fora++; linhas.push(['FORA', 'caixa: motor ainda não tem a voz SD', 'D.SD', 'ausente']); } else {
  const lo = sd({ tone: 0, snappy: 0 }, false, 2), hi = sd({ tone: 1, snappy: 0 }, false, 2);
  const [fl] = picoEsp(espectro(lo.y, Math.round(lo.t0 * FS), 32768), FS, 120, 260), [fh] = picoEsp(espectro(hi.y, Math.round(hi.t0 * FS), 32768), FS, 260, 500);
  confere('oscilador grave (TONE mínimo, SNAPPY 0)', '173,3 Hz ±1 (Parte B 3.2, versão revisada)', f(fl, 1) + ' Hz', perto(fl, 173.3, 1));
  confere('oscilador agudo (TONE máximo, SNAPPY 0)', '336,0 Hz ±1', f(fh, 1) + ' Hz', perto(fh, 336.0, 1));
  const tl = tempoAte(lo.y, FS, lo.t0, 0.1) * 1000, th = tempoAte(hi.y, FS, hi.t0, 0.1) * 1000, tq = (q, f0) => Math.LN10 * 2 * q / (2 * Math.PI * f0) * 1000;
  confere('decay a −20 dB do grave, Q = 16,3', f(tq(16.3, 173.3), 1) + ' ms ±10 % (T = ln10·2Q/ω)', f(tl, 1) + ' ms', perto(tl, tq(16.3, 173.3), tq(16.3, 173.3) * 0.1));
  confere('decay a −20 dB do agudo, Q = 9,9', f(tq(9.9, 336), 1) + ' ms ±10 %', f(th, 1) + ' ms', perto(th, tq(9.9, 336), tq(9.9, 336) * 0.1));
  const Tl = Math.LN10 * 2 * 16.3 / (2 * Math.PI * 173.3), Th = Math.LN10 * 2 * 9.9 / (2 * Math.PI * 336), comp = r => [ampDecai(r.y, FS, r.t0, 173.3, Tl), ampDecai(r.y, FS, r.t0, 336, Th)];
  const [lm, hm] = comp(sd({ tone: 0.5, snappy: 0 }, false, 1));
  // extremos: linha espectral do outro oscilador (o filtro casado vaza: o agudo decai em 21 ms e é largo; por isso aqui se usa o espectro)
  const linha = (r, f1, f2) => dB(picoEsp(espectro(r.y, Math.round(r.t0 * FS), 32768), FS, f1, f2)[1]);
  confere('TONE mínimo: agudo some (linha em 336 Hz relativa à de 173 Hz)', '< −40 dB', f(linha(lo, 300, 380) - linha(lo, 150, 200), 1) + ' dB', linha(lo, 300, 380) - linha(lo, 150, 200) < -40);
  confere('TONE máximo: grave some (linha em 173 Hz relativa à de 336 Hz)', '< −40 dB', f(linha(hi, 150, 200) - linha(hi, 300, 380), 1) + ' dB', linha(hi, 150, 200) - linha(hi, 300, 380) < -40);
  confere('TONE 12 h: osciladores com peso igual (mistura linear do pot. B)', 'razão grave/agudo 0 dB ±2 (o sinc do pulso de 1 ms dá ~1 dB)', f(dB(lm / hm), 1) + ' dB', Math.abs(dB(lm / hm)) <= 2);
  confere('TONE: pesos 1−θ e θ (θ = 0,25: grave/agudo = +9,5 dB)', '9,5 dB ±2', f(dB(comp(sd({ tone: 0.25, snappy: 0 }, false, 1))[0] / comp(sd({ tone: 0.25, snappy: 0 }, false, 1))[1]), 1) + ' dB', Math.abs(dB(comp(sd({ tone: 0.25, snappy: 0 }, false, 1))[0] / comp(sd({ tone: 0.25, snappy: 0 }, false, 1))[1]) - 9.54) <= 2);
}
titulo('caixa: ruído (branco, VCA, passa-altas 2750 Hz Q 0,73)');
if (D.SD) {
  const r = sd({ tone: 0.5, snappy: 1 }, false, 1), ref = bandaDb(r, 4000, 5000);
  // modelo: passa-altas de 2ª ordem (f0 2750, Q 0,73) × passa-baixas de 1 polo em 7,23 kHz da banda do ruído (lote 6+, Parte C seção 4)
  const H = fq => { const x = fq / 2750, hp = x * x / Math.hypot(1 - x * x, x / 0.73), lp = 1 / Math.hypot(1, fq / 7230); return dB(hp * lp); };
  for (const [a, b] of [[700, 900], [1400, 1800], [2400, 3000], [5500, 7000]]) {
    const c = Math.sqrt(a * b), med = bandaDb(r, a, b) - ref + 0, teo = H(c) - H(Math.sqrt(4000 * 5000)) + 10 * Math.log10((b - a) / 1000);
    confere(`espectro do ruído em ${a} a ${b} Hz, relativo a 4 a 5 kHz`, f(teo, 1) + ' dB ±2,5 (HP 2750/Q 0,73 e polo de 7,23 kHz)', f(med, 1) + ' dB', perto(med, teo, 2.5));
  }
  const s0 = bandaDb(sd({ snappy: 0 }), 3000, 8000), s1 = bandaDb(sd({ snappy: 1 }), 3000, 8000), sm = bandaDb(sd({ snappy: 0.5 }), 3000, 8000);
  confere('SNAPPY no mínimo: sem ruído', '< −50 dB contra SNAPPY máximo', f(s0 - s1, 1) + ' dB', s0 - s1 < -50);
  confere('SNAPPY a 12 h: amplitude do ruído pela metade (pot. B linear)', '−6 dB ±1,5', f(sm - s1, 1) + ' dB', perto(sm - s1, -6.02, 1.5));
}
titulo('caixa: decay, amplitude, accent e mix (LEVEL máx.; TONE, SNAPPY a 12 h)');
if (D.SD) {
  const n = sd({}, false), a = sd({}, true), T = tempoAteRms(n.y, FS, n.t0, 0.1) * 1000, pn = vpp(n.y), pa = vpp(a.y);
  confere('decay a −20 dB (envelope RMS de 4 ms)', '60 ms ±20 % (tabela p.14; tol. minha: tabela é "typical and variable")', f(T, 1) + ' ms', perto(T, 60, 12));
  confere('normal', '3 Vpp ±5 % (tabela p.14)', f(pn) + ' Vpp', perto(pn, 3, 0.15));
  confere('accent no máximo', '10 Vpp ±5 %', f(pa) + ' Vpp', perto(pa, 10, 0.5));
  const q = sd({}, true, 1, { acLevel: 0 }); confere('accent com ACCENT LEVEL no mínimo = normal', '3 Vpp ±5 %', f(vpp(q.y)) + ' Vpp', perto(vpp(q.y), 3, 0.15));
  const hf = r => bandaDb(r, 3000, 8000) - bandaDb(r, 100, 500), dif = hf(a) - hf(n);
  confere('accent muda o timbre (energia 3 a 8 kHz contra 100 a 500 Hz)', '|diferença| ≥ 0,5 dB (tol. minha)', f(dif) + ' dB', Math.abs(dif) >= 0.5);
  const i0 = Math.round(n.t0 * FS); confere('silêncio exato antes do disparo', '0', f(pico(n.y, 0, i0 - 1), 12), pico(n.y, 0, i0 - 1) === 0);
  const fim = rms(sd({}, false, 3).y, Math.round(2 * FS), Math.round(3 * FS)); confere('decai a zero (sem oscilador livre)', '< −80 dB', f(dB(fim / pico(n.y)), 1) + ' dB', dB(fim / pico(n.y)) < -80);
  const T512 = 512 / FS;   // disparo no início de um bloco de 128 amostras, para a mesma realização do ruído nas duas medidas
  const ref = renderVoz(novo(Motor, FS, { acLevel: 1, sd: { level: 1, tone: 0.5, snappy: 0.5 } }), 'sd', 1, [{ t: T512, ac: false }]);
  const m = novo(Motor, FS, { master: 1, acLevel: 1, sd: { level: 1, tone: 0.5, snappy: 0.5 } }), d2 = render(m, 1, [{ t: T512, v: 'sd', ac: false }]), esp = vppMix(ref.y, D.GANHO_MIX.sd);
  confere('mix: SD com ganho 1,0 (Parte C, seção 10)', f(esp, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esp, esp * 0.03));
}

// ===== 8. toms e congas (LT/LC, MT/MC, HT/HC: 3 circuitos com chave tom/conga) =====
// Tabela da p.14 (a): TUNING baixo/meio/alto em Hz, decay (meio), Vpp normal/accent. HT = LC está impresso assim (Parte B, seção 2).
const TAB = {
  lt: { tom: { f: [80, 90, 100], T: 200, v: [3.5, 12] }, conga: { f: [165, 185, 220], T: 180, v: [3.5, 12] } },
  mt: { tom: { f: [120, 135, 160], T: 130, v: [3, 11] }, conga: { f: [250, 280, 310], T: 100, v: [3, 10] } },
  ht: { tom: { f: [165, 185, 220], T: 100, v: [3.5, 12] }, conga: { f: [370, 400, 455], T: 80, v: [3.5, 12] } },
};
const tm = (c, conga, p = {}, ac = false, seg = 1.5, extra = {}) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, [c]: Object.assign({ level: 1, tuning: 0.5, modo: conga ? 1 : 0 }, p) }, extra)); return renderVoz(m, c, seg, [{ t: 0.01, ac }]); };
const fPico = (r, fa, f1, f2, jan = 0.25) => { const mg = espectro(r.y, Math.round((r.t0 + jan * 0.4) * FS), 16384); return picoEsp(mg, FS, f1, f2)[0]; };
titulo('toms e congas: 3 circuitos com chave tom/conga (frequência, decay, nível, queda de pitch, ruído)');
if (!D.TOM) { fora++; linhas.push(['FORA', 'toms e congas: motor ainda não tem as vozes LT, MT e HT', 'D.TOM', 'ausente']); } else {
  for (const c of ['lt', 'mt', 'ht']) for (const conga of [false, true]) {
    const t = TAB[c][conga ? 'conga' : 'tom'], nome = `${c.toUpperCase()}${conga ? ' (conga)' : ' (tom)'}`;
    // frequência assentada nos três pontos do TUNING (janela que começa depois da queda de pitch)
    const fs3 = [0, 0.5, 1].map((th, i) => fPico(tm(c, conga, { tuning: th }, false, 1.2), th, t.f[i] * 0.85, t.f[i] * 1.15));
    confere(`${nome}: TUNING mínimo / 12 h / máximo`, t.f.join(' / ') + ' Hz ±3 % (tabela p.14; tol. minha)', fs3.map(v => f(v, 1)).join(' / ') + ' Hz', fs3.every((v, i) => perto(v, t.f[i], t.f[i] * 0.03)));
    const r = tm(c, conga), T = tempoAteRms(r.y, FS, r.t0, 0.1, 2 / t.f[1]) * 1000;   // janela RMS de 2 períodos: constante para uma senoide e estável com o ruído dos toms (com 1 período o ruído desviava até 20 %; o tom sozinho dá 204/133/101 ms)
    confere(`${nome}: decay a −20 dB (TUNING 12 h; RMS de 2 períodos)`, t.T + ' ms ±15 % (tabela p.14; tol. minha)', f(T, 0) + ' ms', perto(T, t.T, t.T * 0.15));
    const pn = vpp(r.y), pa = vpp(tm(c, conga, {}, true).y);
    confere(`${nome}: amplitude normal / accent`, t.v.join(' / ') + ' Vpp ±5 % (tabela p.14)', f(pn) + ' / ' + f(pa) + ' Vpp', perto(pn, t.v[0], t.v[0] * 0.05) && perto(pa, t.v[1], t.v[1] * 0.05));
    // queda de pitch pelos diodos: começa mais alto e cai (a); a magnitude não foi encontrada (c)
    const fi = freqEm(r.y, r.t0, 0.004, 0.03), ff = fs3[1];   // final pelo pico espectral (o ruído dos toms polui o cruzamento de zero)
    confere(`${nome}: queda de pitch (4 a 30 ms contra o final)`, 'início > final (texto p.6); magnitude: não encontrada (c)', f(fi, 1) + ' Hz → ' + f(ff, 1) + ' Hz', fi > ff * 1.02);
    const acm = tm(c, conga, {}, true), a1 = bandaDb(acm, 2 * t.f[1], 12 * t.f[1], 16384) - bandaDb(acm, 0.5 * t.f[1], 1.5 * t.f[1], 16384), a0 = bandaDb(r, 2 * t.f[1], 12 * t.f[1], 16384) - bandaDb(r, 0.5 * t.f[1], 1.5 * t.f[1], 16384);
    confere(`${nome}: accent muda o timbre (energia 2 a 12 f0 contra 0,5 a 1,5 f0)`, '|diferença| ≥ 0,5 dB (tol. minha)', f(a1 - a0) + ' dB', Math.abs(a1 - a0) >= 0.5);
    const i0 = Math.round(r.t0 * FS), fim = rms(tm(c, conga, {}, false, 3).y, Math.round(2 * FS), Math.round(3 * FS));
    confere(`${nome}: silêncio antes do disparo e decai a zero`, '0 e < −80 dB', f(pico(r.y, 0, i0 - 1), 12) + ' e ' + f(dB(fim / pico(r.y)), 1) + ' dB', pico(r.y, 0, i0 - 1) === 0 && dB(fim / pico(r.y)) < -80);
  }
  // ruído rosa: passa-baixas de 2 polos em 273 Hz, Q 0,74, aplicado ao ruído branco (Parte C, seção 4)
  const mR = novo(Motor, FS), N = 1 << 18, pnv = new Float64Array(N); for (let i = 0; i < N; i++) { mR.tick(); pnv[i] = mR.fonte.pn; }
  const mg = espectro(pnv, 0, 65536), banda = (a, b) => dB(Math.sqrt(energiaBanda(mg, FS, a, b) / (b - a)));
  const Hp = fq => { const x = fq / 273, lp = 1 / Math.hypot(1 - x * x, x / 0.74), wn = 1 / Math.hypot(1, fq / 7230); return dB(lp * wn); };
  for (const [a, b] of [[40, 80], [150, 250], [500, 700], [1200, 1800], [3000, 4000]]) {
    const c = Math.sqrt(a * b), med = banda(a, b) - banda(40, 80), teo = Hp(c) - Hp(Math.sqrt(40 * 80));
    confere(`ruído "rosa": espectro em ${a} a ${b} Hz, relativo a 40 a 80 Hz`, f(teo, 1) + ' dB ±2 (2 polos, 273 Hz, Q 0,74)', f(med, 1) + ' dB', perto(med, teo, 2));
  }
  // ruído isolado de cada circuito: saída com e sem o ruído (mesma realização, ganho zerado por um instante)
  for (const c of ['lt', 'mt', 'ht']) {
    const e = D.TOM[c].tom, e2 = D.TOM[c].conga, g = e.gN, g2 = e2.gN, r1 = tm(c, false);
    e.gN = 0; const r0 = tm(c, false); e.gN = g;
    const ru = Float64Array.from(r1.y, (v, i) => v - r0.y[i]), Tn = tempoAteRms(ru, FS, r1.t0, 0.1, 0.02) * 1000, esperado = D.TOM_RUIDO_DECAY * TAB[c].tom.T;
    confere(`${c.toUpperCase()} tom: decay do ruído, "um pouco mais longo" que o do tom`, f(esperado, 0) + ' ms ±15 % (fator ' + D.TOM_RUIDO_DECAY + ' é (c): sem fonte)', f(Tn, 0) + ' ms', perto(Tn, esperado, esperado * 0.15) && Tn > TAB[c].tom.T);
    confere(`${c.toUpperCase()} conga: sem ruído (toms têm; congas não, decisão do usuário)`, 'ganho do ruído = 0', String(g2), g2 === 0 && g > 0);
  }
  // mix: ganho 1,0 para os três circuitos (Parte C, seção 10), com o disparo alinhado ao bloco de 128 amostras
  for (const c of ['lt', 'mt', 'ht']) {
    const T512 = 512 / FS, ref = renderVoz(novo(Motor, FS, { acLevel: 1, [c]: { level: 1, tuning: 0.5, modo: 0 } }), c, 1, [{ t: T512, ac: false }]);
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, [c]: { level: 1, tuning: 0.5, modo: 0 } }), 1, [{ t: T512, v: c, ac: false }]), esp = vppMix(ref.y, D.GANHO_MIX[c]);
    confere(`mix: ${c.toUpperCase()} com ganho 1,0`, f(esp, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esp, esp * 0.03));
  }
  // exclusividade: cada par é um único circuito; um 2º disparo durante o som reexcita o mesmo ressonador, nunca soma duas vozes
  for (const c of ['lt', 'mt', 'ht']) { const um = vpp(tm(c, false).y), m = novo(Motor, FS, { acLevel: 1, [c]: { level: 1, tuning: 0.5, modo: 0 } }), r = renderVoz(m, c, 1.5, [{ t: 0.01, ac: false }, { t: 0.06, ac: false }]);
    confere(`${c.toUpperCase()}/${{ lt: 'LC', mt: 'MC', ht: 'HC' }[c]}: par exclusivo (um circuito só; 2º disparo não soma vozes)`, 'Vpp ≤ 2× o de um disparo', f(vpp(r.y) / um) + '×', vpp(r.y) <= 2 * um); }
}

// ===== 9. seis osciladores quadrados, filtros dos metais, prato, OH e CH =====
titulo('metais: seis osciladores quadrados (HD14584), soma e passa-bandas do IC3');
if (!D.METAL) { fora++; linhas.push(['FORA', 'metais: motor ainda não tem a fonte metálica nem CY, OH, CH', 'D.METAL', 'ausente']); } else {
  const m = novo(Motor, FS), N = 1 << 18, bus = new Float64Array(N), sq = Array.from({ length: 6 }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) { m.tick(); bus[i] = m.metal.bus; for (let k = 0; k < 6; k++) sq[k][i] = m.metal.sq[k]; }
  const mg = espectro(bus, 0, N), nomes = ['#1 (R40, C1)', '#2 (R42, C3)', '#3 (R41, C2)', '#4 (R43, C4)', '#5 cowbell 2 (TM2)', '#6 cowbell 1 (TM1)'];
  D.METAL.osc.forEach((fq, k) => { const [fp] = picoEsp(mg, FS, fq - 3, fq + 3); confere(`oscilador ${nomes[k]}`, f(fq, 1) + ' Hz ±0,3 (Parte C, seção 2)', f(fp, 2) + ' Hz', perto(fp, fq, 0.3)); });
  const alto = sq.map(x => (x.reduce((a, v) => a + v, 0) / N + 1) / 2);   // pela média de ±1 (contar amostras positivas erra com PolyBLEP: a borda cai entre amostras)
  confere('ciclo de trabalho dos seis (a 5 V, independente de RC)', '47,98 % ±0,3 (b: Werner)', alto.map(v => f(v * 100, 2)).join(' / ') + ' %', alto.every(v => perto(v * 100, 47.98, 0.3)));
  confere('amplitude dos osciladores', 'quadrada de ±1 (sem excesso nas bordas: PolyBLEP)', f(Math.max(...sq.map(x => pico(x))), 3), Math.max(...sq.map(x => pico(x))) < 1.1);
  const mkBP = D.mkBP, mkHP = D.mkHP, Hp1 = D.Hp1;
  const pbA = resposta(mkBP(7117, 6.05, FS), FS), pbB = resposta(mkBP(3454, 6.05, FS), FS);
  confere('IC3 pino 7 (banda alta): centro', '7117 Hz ±1,5 % (Parte C, 3.1)', f(pbA.pico[0], 0) + ' Hz', perto(pbA.pico[0], 7117, 7117 * 0.015));
  confere('IC3 pino 7: Q pela largura a −3 dB', '6,05 ±8 %', f(7117 / pbA.bw3, 2), perto(7117 / pbA.bw3, 6.05, 6.05 * 0.08));
  confere('IC3 pino 1 (banda baixa): centro', '3454 Hz ±1,5 %', f(pbB.pico[0], 0) + ' Hz', perto(pbB.pico[0], 3454, 3454 * 0.015));
  confere('IC3 pino 1: Q pela largura a −3 dB', '6,05 ±8 %', f(3454 / pbB.bw3, 2), perto(3454 / pbB.bw3, 6.05, 6.05 * 0.08));
  const c1 = resposta(new Hp1(1 / (2 * Math.PI * 22e3 * 1e-9), FS), FS);
  confere('acoplamento de entrada do pino 7 (22 kΩ, 1 nF): −3 dB no corte', '−3,0 dB em 7234 Hz ±0,3', f(c1.db(7234), 2) + ' dB', perto(c1.db(7234), -3.01, 0.3));
  const ic5a = resposta(mkHP(8842, 4.4, FS), FS), ic5b = resposta(mkHP(8842, 1.0, FS), FS), q25 = resposta(mkHP(2498, 0.97, FS), FS), ho = resposta(mkHP(7831, 2.51, FS), FS), hc = resposta(mkHP(11746, 2.51, FS), FS);
  confere('IC5 (pinos 3/1), Sallen-Key passa-altas 8842 Hz, Q 4,4: pico', '+12,9 dB ±0,5 perto de 8,96 kHz ±2 % (Parte C, 3.2)', f(ic5a.pico[1], 1) + ' dB em ' + f(ic5a.pico[0], 0) + ' Hz', perto(ic5a.pico[1], 12.9, 0.5) && perto(ic5a.pico[0], 8960, 8960 * 0.02));
  confere('IC5 (pinos 5/7), Q 1,0: ganho em f0', '0 dB ±0,3 (Q = 1)', f(ic5b.db(8842), 2) + ' dB', perto(ic5b.db(8842), 0, 0.3));
  confere('Q25, Sallen-Key passa-altas 2498 Hz, Q 0,97: ganho em f0', '−0,26 dB ±0,3 (Q = 0,97)', f(q25.db(2498), 2) + ' dB', perto(q25.db(2498), 20 * Math.log10(0.97), 0.3));
  confere('passa-altas do OH (7831 Hz, Q 2,51): pico', '+8,2 dB ±0,4 perto de 8,16 kHz ±2 % (Parte C, 3.3)', f(ho.pico[1], 1) + ' dB em ' + f(ho.pico[0], 0) + ' Hz', perto(ho.pico[1], 8.2, 0.4) && perto(ho.pico[0], 8160, 8160 * 0.02));
  confere('passa-altas do CH (11746 Hz, Q 2,51): pico', '+8,2 dB ±0,4 perto de 12,2 kHz ±2 %', f(hc.pico[1], 1) + ' dB em ' + f(hc.pico[0], 0) + ' Hz', perto(hc.pico[1], 8.2, 0.4) && perto(hc.pico[0], 12200, 12200 * 0.02));
}
titulo('prato (CY), hi-hat aberto (OH) e fechado (CH): decay, nível, accent, TONE, choke, mix');
if (D.METAL) {
  const mt = (c, p = {}, ac = false, seg = 3, extra = {}, disp) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, [c]: Object.assign({ level: 1, tone: 0.5, decay: 0.5 }, p) }, extra)); return renderVoz(m, c, seg, disp || [{ t: 0.01, ac }]); };
  const TM = { cy: { T: [350, 800, 1200], v: [3.5, 7], nome: 'prato' }, oh: { T: [90, 450, 600], v: [3.5, 7], nome: 'OH' }, ch: { T: [50, 50, 50], v: [3, 6], nome: 'CH' } };
  for (const c of ['cy', 'oh', 'ch']) {
    const t = TM[c], pontos = c === 'ch' ? [[0.5, 50]] : [[0, t.T[0]], [0.5, t.T[1]], [1, t.T[2]]];
    for (const [d, alvo] of pontos) { const r = mt(c, { decay: d }, false, 4), T = tempoAteRms(r.y, FS, r.t0, 0.1, 0.01) * 1000;   // janela RMS de 10 ms: com 2 ms a batida entre os osciladores derruba o RMS antes da hora
      confere(`${t.nome}: decay a −20 dB${c === 'ch' ? '' : ' (DECAY ' + (d === 0 ? 'mínimo' : d === 1 ? 'máximo' : '12 h') + ')'}`, `${alvo} ms ±15 % (tabela p.14; tol. minha)`, f(T, 0) + ' ms', perto(T, alvo, alvo * 0.15)); }
    const n = mt(c), a = mt(c, {}, true), pn = vpp(n.y), pa = vpp(a.y);
    confere(`${t.nome}: amplitude normal / accent`, t.v.join(' / ') + ' Vpp ±5 % (tabela p.14)', f(pn) + ' / ' + f(pa) + ' Vpp', perto(pn, t.v[0], t.v[0] * 0.05) && perto(pa, t.v[1], t.v[1] * 0.05));
    const bd2 = c === 'ch' ? [[14000, 20000], [8000, 14000]] : [[10000, 16000], [3000, 8000]], hf = r => bandaDb(r, ...bd2[0], 16384) - bandaDb(r, ...bd2[1], 16384), dif = hf(a) - hf(n);   // bandas onde está o som: o CH tem pouca energia abaixo de 8 kHz
    confere(`${t.nome}: accent muda o timbre (energia ${bd2[0][0] / 1000} a ${bd2[0][1] / 1000} kHz contra ${bd2[1][0] / 1000} a ${bd2[1][1] / 1000} kHz)`, '|diferença| ≥ 0,5 dB (tol. minha)', f(dif) + ' dB', Math.abs(dif) >= 0.5);
    const i0 = Math.round(n.t0 * FS), fim = rms(mt(c, { decay: 1 }, false, 8).y, Math.round(7 * FS), Math.round(8 * FS));
    confere(`${t.nome}: silêncio exato antes do disparo e decai a zero`, '0 e < −60 dB', f(pico(n.y, 0, i0 - 1), 12) + ' e ' + f(dB(fim / pico(n.y)), 1) + ' dB', pico(n.y, 0, i0 - 1) === 0 && dB(fim / pico(n.y)) < -60);
    confere(`${t.nome}: LEVEL no mínimo: mudo`, '0 V', f(pico(mt(c, { level: 0 }).y), 9), pico(mt(c, { level: 0 }).y) === 0);
  }
  // TONE do prato: proporção entre as duas saídas do IC5 (VR4 20k B, R125 2,2k, R112 22k, R120 10k; c: sentido horário = mais agudo)
  const gr = th => { const r = tt => bandaDb(tt, 9000, 16000, 16384) - bandaDb(tt, 2000, 8000, 16384); return r(mt('cy', { tone: th }, false, 1)); };
  confere('prato: TONE máximo contra mínimo (energia 9 a 16 kHz contra 2 a 8 kHz)', '> +3 dB (tol. minha; sentido (c))', f(gr(1) - gr(0)) + ' dB', gr(1) - gr(0) > 3);
  // choke: disparar CH corta o decay do OH
  { const sem = mt('oh', { decay: 1 }, false, 1.5), com = mt('oh', { decay: 1 }, false, 1.5, {}, [{ t: 0.01, v: 'oh', ac: false }, { t: 0.1, v: 'ch', ac: false }]);
    const a = Math.round(0.4 * FS), b = Math.round(0.5 * FS), d = dB(rms(com.y, a, b) / rms(sem.y, a, b));
    confere('choke: CH disparado em 100 ms; OH (DECAY máx.) entre 400 e 500 ms contra o OH livre', '< −20 dB (a, p.6: "decay do OH termina")', f(d, 1) + ' dB', d < -20);
    const antes = Math.round(0.09 * FS); confere('choke: antes do CH o OH é igual ao livre', 'diferença = 0', f(pico(Float64Array.from(com.y.slice(0, antes), (v, i) => v - sem.y[i])), 9), pico(Float64Array.from(com.y.slice(0, antes), (v, i) => v - sem.y[i])) < 1e-9); }
  // mix: OH 0,59; CH, CY 0,70 (Parte C, seção 10), disparo alinhado ao bloco de 128 amostras
  for (const [c, g] of [['oh', 0.59], ['ch', 0.70], ['cy', 0.70]]) {
    const T512 = 512 / FS, ref = renderVoz(novo(Motor, FS, { acLevel: 1, [c]: { level: 1, tone: 0.5, decay: 0.5 } }), c, 1, [{ t: T512, ac: false }]);
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, [c]: { level: 1, tone: 0.5, decay: 0.5 } }), 1, [{ t: T512, v: c, ac: false }]), esp = vppMix(ref.y, g);
    confere(`mix: ${c.toUpperCase()} com ganho ${g} (Parte C, seção 10)`, f(esp, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esp, esp * 0.03)); }
}

// ===== 10. cowbell (CB): dois quadrados de 540 e 800 Hz, dois VCAs, filtro, envelope em dois estágios =====
titulo('cowbell: osciladores, filtro, envelope em dois estágios, nível, accent, mix');
if (!D.CB) { fora++; linhas.push(['FORA', 'cowbell: motor ainda não tem a voz CB', 'D.CB', 'ausente']); } else {
  const cb = (p = {}, ac = false, seg = 1, extra = {}, disp) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, cb: Object.assign({ level: 1 }, p) }, extra)); return renderVoz(m, 'cb', seg, disp || [{ t: 0.01, ac }]); };
  const n = cb(), a = cb({}, true), mg = espectro(n.y, Math.round(n.t0 * FS), 8192);
  const [f1, a1] = picoEsp(mg, FS, 480, 600), [f2, a2] = picoEsp(mg, FS, 740, 860);
  confere('oscilador do TM1 (TP-6) no som', '540 Hz ±2 (decaimento alarga a linha; tabela p.14 e Parte C)', f(f1, 1) + ' Hz', perto(f1, 540, 2));
  confere('oscilador do TM2 (TP-7) no som', '800 Hz ±2', f(f2, 1) + ' Hz', perto(f2, 800, 2));
  const H = resposta(D.mkBP(D.CB.bp.f, D.CB.bp.q, FS), FS), teor = H.db(540) - H.db(800);
  confere('nível relativo dos dois (540 / 800 Hz): só o filtro os diferencia (os dois VCAs e divisores são iguais)', f(teor, 1) + ' dB ±1,5 (resposta do filtro (c))', f(dB(a1 / a2), 1) + ' dB', perto(dB(a1 / a2), teor, 1.5));
  // envelope em dois estágios: queda inicial abrupta e depois cauda de τ = R82·C34 = 33 ms (a, sobre os valores lidos)
  const env = (r, t) => rms(r.y, Math.round((r.t0 + t) * FS), Math.round((r.t0 + t + 0.004) * FS));   // janela de 4 ms ≈ 1 período da batida 540/800
  const rate = (t1, t2) => 20 * Math.log10(env(n, t2) / env(n, t1)) / ((t2 - t1) * 1000);   // dB por ms
  const rIni = rate(0.003, 0.013), rCauda = rate(0.035, 0.075), tauCauda = -8.686 / rCauda;   // 8,686 dB = 1 neper
  confere('envelope: queda inicial mais íngreme que a cauda', 'inclinação inicial ≥ 1,5× a da cauda (tol. minha)', f(rIni, 2) + ' contra ' + f(rCauda, 2) + ' dB/ms (' + f(rIni / rCauda, 1) + '×)', rIni / rCauda >= 1.5);
  confere('envelope: constante de tempo da cauda', f(33, 0) + ' ms ±25 % (R82 33k × C34 1 µF = 33 ms, valores lidos; tol. minha)', f(tauCauda, 1) + ' ms', perto(tauCauda, 33, 33 * 0.25));
  const T = tempoAteRms(n.y, FS, n.t0, 0.1, 0.004) * 1000;
  confere('decay a −20 dB', '50 ms ±15 % (tabela p.14; tol. minha)', f(T, 0) + ' ms', perto(T, 50, 7.5));
  const pn = vpp(n.y), pa = vpp(a.y);
  confere('amplitude normal / accent (LEVEL no máximo)', '3,5 / 12 Vpp ±5 % (tabela p.14)', f(pn) + ' / ' + f(pa) + ' Vpp', perto(pn, 3.5, 0.175) && perto(pa, 12, 0.6));
  const q = cb({}, true, 1, { acLevel: 0 }); confere('accent com ACCENT LEVEL no mínimo: trigger de 7 V dos metais (a)', 'mesmo que sem accent: 3,5 Vpp ±5 %', f(vpp(q.y)) + ' Vpp', perto(vpp(q.y), 3.5, 0.175));
  const hf = r => bandaDb(r, 1400, 3500, 8192) - bandaDb(r, 400, 1000, 8192), dif = hf(a) - hf(n);
  confere('accent muda o timbre (energia 1,4 a 3,5 kHz contra 0,4 a 1 kHz)', '|diferença| ≥ 0,5 dB (tol. minha)', f(dif) + ' dB', Math.abs(dif) >= 0.5);
  const i0 = Math.round(n.t0 * FS), fim = rms(cb({}, false, 3).y, Math.round(2 * FS), Math.round(3 * FS));
  confere('silêncio exato antes do disparo (os osciladores rodam livres, o VCA fecha)', '0', f(pico(n.y, 0, i0 - 1), 12), pico(n.y, 0, i0 - 1) === 0);
  confere('decai a zero', '< −80 dB', f(dB(fim / pico(n.y)), 1) + ' dB', dB(fim / pico(n.y)) < -80);
  confere('LEVEL no mínimo: mudo', '0 V', f(pico(cb({ level: 0 }).y), 9), pico(cb({ level: 0 }).y) === 0);
  const T512 = 512 / FS, ref = renderVoz(novo(Motor, FS, { acLevel: 1, cb: { level: 1 } }), 'cb', 1, [{ t: T512, ac: false }]);
  const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, cb: { level: 1 } }), 1, [{ t: T512, v: 'cb', ac: false }]), esp = vppMix(ref.y, D.GANHO_MIX.cb);
  confere('mix: CB com ganho 0,70 (Parte C, seção 10)', f(esp, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esp, esp * 0.03));
  const um = vpp(n.y), r2 = cb({}, false, 1, {}, [{ t: 0.01, ac: false }, { t: 0.04, ac: false }]);
  confere('2 disparos a 30 ms: sem soma de vozes (um circuito só)', 'Vpp ≤ 2× o de um disparo', f(vpp(r2.y) / um) + '×', vpp(r2.y) <= 2 * um);
}

// ===== 11. clap (CP): ruído branco -> passa-banda de 1 kHz -> dois VCAs em paralelo (dente-de-serra de 3 picos + "reverb") =====
titulo('clap: passa-banda, envelope de 3 picos, "reverb", nível pelo mix, accent, mix');
if (!D.CP) { fora++; linhas.push(['FORA', 'clap: motor ainda não tem a voz CP', 'D.CP', 'ausente']); } else {
  const cp = (p = {}, ac = false, seg = 1, extra = {}, disp) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, cp: Object.assign({ level: 1 }, p) }, extra)); return { m, ...renderVoz(m, 'cp', seg, disp || [{ t: 0.01, ac }]) }; };
  // "tom puro": troca a fonte de ruído por uma senoide de 1 kHz (o centro do passa-banda), para o envelope sair sem a aleatoriedade do ruído
  const puro = (mod, ac = false, seg = 0.4, extra = {}) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, cp: { level: 1 } }, extra)); let i = 0; m.fonte.tick = function () { this.wn = Math.SQRT2 * Math.sin(2 * Math.PI * 1000 * (i++) / FS); this.pn = 0; }; if (mod) mod(); return renderVoz(m, 'cp', seg, [{ t: 0.01, ac }]); };
  const envP = (r, t, jan = 0.002) => rms(r.y, Math.round((r.t0 + t) * FS), Math.round((r.t0 + t + jan) * FS));
  const H = resposta(D.mkBP(D.CP.bp.f, D.CP.bp.q, FS), FS);
  confere('passa-banda do clap: centro', '1000 Hz ±1,5 % (diagrama de blocos, p.7)', f(H.pico[0], 0) + ' Hz', perto(H.pico[0], 1000, 15));
  { const r = cp({}, false, 1), N = 16384, ref = 0, bd = (a, b) => dB(Math.sqrt(energiaBanda(espectro(r.y, Math.round(r.t0 * FS), N), FS, a, b) / (b - a)));
    const modelo = fq => H.db(fq);   // o ruído branco de 7,23 kHz é plano abaixo de 3 kHz
    for (const [a, b] of [[200, 300], [500, 700], [1400, 1800], [3000, 4000]]) { const c = Math.sqrt(a * b), med = bd(a, b) - bd(900, 1100), teo = modelo(c) - modelo(1000);
      confere(`espectro do clap em ${a} a ${b} Hz, relativo a 0,9 a 1,1 kHz`, f(teo, 1) + ' dB ±3 (filtro do clap; Q é (c))', f(med, 1) + ' dB', perto(med, teo, 3)); } }
  // envelope dente-de-serra de 3 picos: máximos locais do envelope RMS (tom puro, sem o "reverb")
  { const w0 = D.CP.wR, r = puro(() => { D.CP.wR = 0; }); D.CP.wR = w0; const t = []; const E = []; for (let i = 0; i < 400; i++) E.push(envP(r, i / 10000, 0.001));   // passo de 0,1 ms, janela de 1 período
    for (let i = 0; i < E.length; i++) { let ehMax = true; for (let k = Math.max(0, i - 30); k <= Math.min(E.length - 1, i + 30); k++) if (E[k] > E[i]) ehMax = false; const viz = Math.min(E[Math.max(0, i - 30)], E[Math.min(E.length - 1, i + 30)]); if (ehMax && E[i] > viz * 1.01 && (!t.length || i - t[t.length - 1] > 40)) t.push(i); }   // máximos locais numa janela de ±3 ms (o filtro atrasa todos os picos igualmente)
    const tt = t.map(i => i / 10);
    confere('dente-de-serra: número de picos', '3 (texto p.6; S10)', String(tt.length) + ' (em ' + tt.map(v => f(v, 1)).join(', ') + ' ms)', tt.length === 3);
    confere('dente-de-serra: espaçamento entre picos', '≈ 10 ms ±1 (S10: 3 envelopes de ~10 ms; (c))', tt.length === 3 ? f(tt[1] - tt[0], 1) + ' e ' + f(tt[2] - tt[1], 1) + ' ms' : 'n/d', tt.length === 3 && perto(tt[1] - tt[0], 10, 1) && perto(tt[2] - tt[1], 10, 1));
    const tau = -(0.06 - 0.04) * 1000 / Math.log(envP(r, 0.06) / envP(r, 0.04));
    confere('dente-de-serra: descarga depois do 3º pico (τ)', '38,5 ms ±8 % (R365 82k × C144 0,47 µF; Parte B 3.5)', f(tau, 1) + ' ms', perto(tau, 38.5, 38.5 * 0.08)); }
  { const w0 = D.CP.wS, r = puro(() => { D.CP.wS = 0; }); D.CP.wS = w0; const T = tempoAteRms(r.y, FS, r.t0, 0.1, 0.002) * 1000;
    confere('"reverb" sozinho: decay a −20 dB', '100 ms ±10 % (S10: o envelope de reverb dura 100 ms; (b))', f(T, 0) + ' ms', perto(T, 100, 10)); }
  { const r = cp({}, false, 1), T = tempoAteRms(r.y, FS, r.t0, 0.1, 0.01) * 1000;
    confere('clap completo: decay a −20 dB (RMS de 10 ms)', '100 ms ±25 % (tabela p.14; tol. minha: com ruído e "typical and variable")', f(T, 0) + ' ms', perto(T, 100, 25)); }
  // nível: o 6/2 Vpp da tabela é erro do manual (decisão do usuário); alvo (c) de 2,5 a 3,5 Vpp sem accent (a faixa das outras vozes)
  { const n = cp(), a = cp({}, true), pn = vpp(n.y), pa = vpp(a.y);
    confere('amplitude sem accent (nível pelo mix, não pela tabela)', '2,5 a 3,5 Vpp (faixa das outras vozes; (c), sugestão do tr808.md)', f(pn) + ' Vpp', pn >= 2.5 && pn <= 3.5);
    confere('razão accent/normal no máximo', '2,86 a 3,67 (faixa das vozes não metálicas na tabela p.14; a do CP é inutilizável)', f(pa / pn, 2) + ' (' + f(pa) + ' Vpp)', pa / pn >= 2.85 && pa / pn <= 3.67);
    const q = cp({}, true, 1, { acLevel: 0 }); confere('accent com ACCENT LEVEL no mínimo = normal', 'mesmo Vpp ±5 %', f(vpp(q.y)) + ' Vpp', perto(vpp(q.y), pn, pn * 0.05));
    // timbre: o accent entra no dente-de-serra (D68, C143, R362) e não no "reverb" (Q70): muda o balanço estalos/cauda. Medida em tom puro: energia 0 a 30 ms contra 60 a 120 ms
    const bal = ac => { const r = puro(null, ac, 0.4); const e = (a, b) => 10 * Math.log10(rms(r.y, Math.round((r.t0 + a) * FS), Math.round((r.t0 + b) * FS)) ** 2); return e(0, 0.03) - e(0.06, 0.12); }, dif = bal(true) - bal(false);
    confere('accent muda o balanço entre os 3 estalos e a cauda de "reverb" (0 a 30 ms contra 60 a 120 ms)', '≥ 0,5 dB (tol. minha)', f(dif) + ' dB', dif >= 0.5);
    const i0 = Math.round(n.t0 * FS), fim = rms(cp({}, false, 3).y, Math.round(2 * FS), Math.round(3 * FS));
    confere('silêncio exato antes do disparo e decai a zero', '0 e < −80 dB', f(pico(n.y, 0, i0 - 1), 12) + ' e ' + f(dB(fim / pico(n.y)), 1) + ' dB', pico(n.y, 0, i0 - 1) === 0 && dB(fim / pico(n.y)) < -80);
    confere('LEVEL no mínimo: mudo', '0 V', f(pico(cp({ level: 0 }).y), 9), pico(cp({ level: 0 }).y) === 0);
    const T512 = 512 / FS, ref = renderVoz(novo(Motor, FS, { acLevel: 1, cp: { level: 1 } }), 'cp', 1, [{ t: T512, ac: false }]);
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, cp: { level: 1 } }), 1, [{ t: T512, v: 'cp', ac: false }]), esp = vppMix(ref.y, D.GANHO_MIX.cp);
    confere('mix: CP com ganho 1,0 (Parte C, seção 10)', f(esp, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esp, esp * 0.03)); }
}

// ===== 12. rim shot (RS) e claves (CL): um circuito só (IC20, IC21, Q62), chave SW11 =====
titulo('rim shot e claves: frequências, decay, nível, accent, chave, mix');
if (!D.RS) { fora++; linhas.push(['FORA', 'rim shot e claves: motor ainda não tem a voz RS/CL', 'D.RS', 'ausente']); } else {
  const rs = (modo, p = {}, ac = false, seg = 0.5, extra = {}, disp) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, rs: Object.assign({ level: 1, modo }, p) }, extra)); return renderVoz(m, 'rs', seg, disp || [{ t: 0.01, ac }]); };
  const RS = 0, CL = 1, esp = r => espectro(r.y, Math.round(r.t0 * FS), 8192);
  const cl = rs(CL), rr = rs(RS), mc = esp(cl), mr = esp(rr);
  const [fc] = picoEsp(mc, FS, 2000, 3200), [fr1] = picoEsp(mr, FS, 1400, 2200), [fr2] = picoEsp(mr, FS, 350, 600);
  confere('CL: frequência do IC20 (bridged-T, 2,2 nF + 2,2 nF)', '2526 Hz ±1 % (Parte C, seção 6; c sobre a)', f(fc, 0) + ' Hz', perto(fc, 2526, 25));
  confere('CL: dentro da faixa da tabela p.14 (0,4 ms, resolução 0,1 ms)', '2381 a 2632 Hz', f(fc, 0) + ' Hz', fc >= 2381 && fc <= 2632);
  confere('RS: frequência do IC20 (C118 em paralelo: 2,2 nF + 4,4 nF)', '1786 Hz ±1,5 % (Parte C, seção 6)', f(fr1, 0) + ' Hz', perto(fr1, 1786, 27));
  confere('RS: dentro da faixa da tabela p.14 (0,6 ms)', '1538 a 1818 Hz', f(fr1, 0) + ' Hz', fr1 >= 1538 && fr1 <= 1818);
  confere('RS: frequência do IC21', '452,5 Hz ±3 % (Parte B 3.4; tabela: 455)', f(fr2, 1) + ' Hz', perto(fr2, 452.5, 13.6));
  const Tcl = tempoAteRms(cl.y, FS, cl.t0, 0.1, 0.001) * 1000, Trs = tempoAteRms(rr.y, FS, rr.t0, 0.1, 0.002) * 1000;
  confere('CL: decay a −20 dB', '25 ms ±15 % (tabela p.14; tol. minha)', f(Tcl, 1) + ' ms', perto(Tcl, 25, 3.75));
  confere('RS: decay a −20 dB', '10 ms ±15 % (tabela p.14; tol. minha)', f(Trs, 1) + ' ms', perto(Trs, 10, 1.5));
  for (const [nome, modo, alvo] of [['CL', CL, [2.5, 8]], ['RS', RS, [3, 10]]]) {
    const n = rs(modo), a = rs(modo, {}, true), pn = vpp(n.y), pa = vpp(a.y);
    confere(`${nome}: amplitude normal / accent`, alvo.join(' / ') + ' Vpp ±5 % (tabela p.14)', f(pn) + ' / ' + f(pa) + ' Vpp', perto(pn, alvo[0], alvo[0] * 0.05) && perto(pa, alvo[1], alvo[1] * 0.05));
    const fq = modo === CL ? 2526 : 1786, bd = r => dB(Math.sqrt(energiaBanda(espectro(r.y, Math.round(r.t0 * FS), 1024), FS, 2 * fq, 6 * fq))) - dB(Math.sqrt(energiaBanda(espectro(r.y, Math.round(r.t0 * FS), 1024), FS, 0.5 * fq, 1.5 * fq))), dif = bd(a) - bd(n);
    confere(`${nome}: accent muda o timbre (energia 2 a 6 f0 contra 0,5 a 1,5 f0, 21 ms iniciais)`, '|diferença| ≥ 0,5 dB (tol. minha; texto: o VCA "swing" gera muitos harmônicos)', f(dif) + ' dB', Math.abs(dif) >= 0.5);
    const q = rs(modo, {}, true, 0.5, { acLevel: 0 }); confere(`${nome}: accent com ACCENT LEVEL no mínimo = normal`, f(pn) + ' Vpp ±5 %', f(vpp(q.y)) + ' Vpp', perto(vpp(q.y), pn, pn * 0.05));
    const i0 = Math.round(n.t0 * FS), fim = rms(rs(modo, {}, false, 1.5).y, Math.round(1 * FS), Math.round(1.5 * FS));
    confere(`${nome}: silêncio exato antes do disparo e decai a zero`, '0 e < −80 dB', f(pico(n.y, 0, i0 - 1), 12) + ' e ' + f(dB(fim / pico(n.y)), 1) + ' dB', pico(n.y, 0, i0 - 1) === 0 && dB(fim / pico(n.y)) < -80);
    confere(`${nome}: LEVEL no mínimo: mudo`, '0 V', f(pico(rs(modo, { level: 0 }).y), 9), pico(rs(modo, { level: 0 }).y) === 0);
  }
  // o IC21 só toca no RS: no CL o espectro não tem a linha de 452 Hz (a, p.6: "pode ser ignorada")
  confere('IC21 só no RS: linha de 452 Hz no CL relativa à de 2526 Hz', '< −40 dB', f(dB(picoEsp(mc, FS, 380, 520)[1] / picoEsp(mc, FS, 2000, 3200)[1]), 1) + ' dB', dB(picoEsp(mc, FS, 380, 520)[1] / picoEsp(mc, FS, 2000, 3200)[1]) < -40);
  // chave: o par é um circuito só; o 2º disparo não soma vozes
  { const um = vpp(rr.y), r2 = rs(RS, {}, false, 0.5, {}, [{ t: 0.01, ac: false }, { t: 0.02, ac: false }]); confere('RS/CL: par exclusivo (2º disparo a 10 ms não soma vozes)', 'Vpp ≤ 2× o de um disparo', f(vpp(r2.y) / um) + '×', vpp(r2.y) <= 2 * um); }
  for (const [nome, modo] of [['RS', 0], ['CL', 1]]) { const T512 = 512 / FS, ref = renderVoz(novo(Motor, FS, { acLevel: 1, rs: { level: 1, modo } }), 'rs', 1, [{ t: T512, ac: false }]);
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, rs: { level: 1, modo } }), 1, [{ t: T512, v: 'rs', ac: false }]), e = vppMix(ref.y, D.GANHO_MIX.rs);
    confere(`mix: ${nome} com ganho 1,0 (Parte C, seção 10)`, f(e, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), e, e * 0.03)); }
}

// ===== 13. maracas (MA): ruído branco -> VCA Q65 -> passa-altas 10,6 kHz; par com o clap (chave MA/CP) =====
titulo('maracas: passa-altas, envelope assimétrico, decay 25/35 ms (origem desconhecida), nível, chave MA/CP, mix');
if (!D.MA) { fora++; linhas.push(['FORA', 'maracas: motor ainda não tem a voz MA', 'D.MA', 'ausente']); } else {
  const ma = (p = {}, ac = false, seg = 0.5, extra = {}, disp) => { const m = novo(Motor, FS, Object.assign({ acLevel: 1, cp: Object.assign({ level: 1, modo: 1 }, p) }, extra)); return { m, ...renderVoz(m, 'ma', seg, disp || [{ t: 0.01, ac }]) }; };
  const Hh = resposta(D.mkHP(D.MA.hp.f, D.MA.hp.q, FS), FS);
  confere('passa-altas do Q68 (10,6 kHz, Q 2,27): pico', '+7,3 dB ±0,4 perto de 11,2 kHz ±2 % (Parte C, seção 7)', f(Hh.pico[1], 1) + ' dB em ' + f(Hh.pico[0], 0) + ' Hz', perto(Hh.pico[1], 7.3, 0.4) && perto(Hh.pico[0], 11200, 224));
  { const r = ma({}, false, 1), N = 8192, bd = (a, b) => dB(Math.sqrt(energiaBanda(espectro(r.y, Math.round(r.t0 * FS), N), FS, a, b) / (b - a)));
    const mod = fq => Hh.db(fq) - 10 * Math.log10(1 + (fq / 7230) ** 2);   // passa-altas × polo de 7,23 kHz do ruído branco (Parte C, seção 4)
    for (const [a, b] of [[4000, 5000], [6000, 8000], [14000, 17000], [19000, 22000]]) { const c = Math.sqrt(a * b), med = bd(a, b) - bd(10000, 12000), teo = mod(c) - mod(Math.sqrt(10000 * 12000));
      confere(`espectro em ${a / 1000} a ${b / 1000} kHz, relativo a 10 a 12 kHz`, f(teo, 1) + ' dB ±3 (passa-altas e polo do ruído; o envelope varia no tempo)', f(med, 1) + ' dB', perto(med, teo, 3)); } }
  // envelope: tom puro de 11 kHz no lugar do ruído, para medi-lo sem a aleatoriedade
  const puro = (ac, mod) => { const m = novo(Motor, FS, { acLevel: 1, cp: { level: 1, modo: 1 } }); let i = 0; m.fonte.tick = function () { this.wn = Math.SQRT2 * Math.sin(2 * Math.PI * 11000 * (i++) / FS); this.pn = 0; }; return renderVoz(m, 'ma', 0.2, [{ t: 0.01, ac }]); };
  { const r = puro(false), E = []; for (let i = 0; i < 1000; i++) E.push(rms(r.y, Math.round((r.t0 + i / 20000) * FS), Math.round((r.t0 + i / 20000 + 0.0005) * FS)));
    let kp = 0; for (let i = 1; i < E.length; i++) if (E[i] > E[kp]) kp = i; const tp = kp / 20;
    confere('envelope assimétrico: tempo até o pico (subida lenta; R341 · C134 = 15,5 ms num sentido)', '3 a 12 ms (tol. minha; polaridade do RC não traçada (c))', f(tp, 1) + ' ms', tp >= 3 && tp <= 12); }
  // decay a −20 dB desde o disparo: 25 ms sem accent (c: hipótese); 35 ms com accent (o "longo" da tabela, que não diz a condição)
  { const n = ma(), a = ma({}, true), Tn = tempoAteRms(n.y, FS, n.t0, 0.1, 0.002) * 1000, Ta = tempoAteRms(a.y, FS, a.t0, 0.1, 0.002) * 1000;
    confere('decay a −20 dB sem accent', '25 ms ±15 % (tabela p.14, "curto"; atribuição ao caso sem accent é (c))', f(Tn, 1) + ' ms', perto(Tn, 25, 3.75));
    info('decay a −20 dB com accent (informativo)', '35 ms seria o "longo" da tabela p.14, cuja condição não é dita; a compressão que dá 3 / 5 Vpp não o reproduz', f(Ta, 1) + ' ms');
    confere('accent muda o decay (a forma temporal do som)', 'razão com/sem accent ≥ 1,2 (tol. minha)', f(Ta / Tn, 2) + '×', Ta / Tn >= 1.2);
    const pn = vpp(n.y), pa = vpp(a.y);
    confere('amplitude normal / accent', '3 / 5 Vpp ±5 % (tabela p.14)', f(pn) + ' / ' + f(pa) + ' Vpp', perto(pn, 3, 0.15) && perto(pa, 5, 0.25));
    const q = ma({}, true, 0.5, { acLevel: 0 }); confere('accent com ACCENT LEVEL no mínimo = normal', f(pn) + ' Vpp ±5 %', f(vpp(q.y)) + ' Vpp', perto(vpp(q.y), pn, pn * 0.05));
    const i0 = Math.round(n.t0 * FS), fim = rms(ma({}, false, 1.5).y, Math.round(1 * FS), Math.round(1.5 * FS));
    confere('silêncio exato antes do disparo e decai a zero', '0 e < −80 dB', f(pico(n.y, 0, i0 - 1), 12) + ' e ' + f(dB(fim / pico(n.y)), 1) + ' dB', pico(n.y, 0, i0 - 1) === 0 && dB(fim / pico(n.y)) < -80);
    confere('LEVEL no mínimo: mudo', '0 V', f(pico(ma({ level: 0 }).y), 9), pico(ma({ level: 0 }).y) === 0);
    const T512 = 512 / FS, ref = renderVoz(novo(Motor, FS, { acLevel: 1, cp: { level: 1, modo: 1 } }), 'ma', 1, [{ t: T512, ac: false }]);
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, cp: { level: 1, modo: 1 } }), 1, [{ t: T512, v: 'cp', ac: false }]), e = vppMix(ref.y, D.GANHO_MIX.cp);
    confere('mix: MA com ganho 1,0 (Parte C, seção 10), disparada pelo canal CP/MA', f(e, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), e, e * 0.03)); }
  // chave MA/CP: um circuito só; o disparo vai para a voz escolhida e a outra fica muda
  { const m1 = novo(Motor, FS, { acLevel: 1, cp: { level: 1, modo: 1 } }), r1 = render(m1, 0.5, [{ t: 0.01, v: 'cp', ac: false }]);
    const m0 = novo(Motor, FS, { acLevel: 1, cp: { level: 1, modo: 0 } }), r0 = render(m0, 0.5, [{ t: 0.01, v: 'cp', ac: false }]);
    const hf = x => dB(Math.sqrt(energiaBanda(espectro(x, 512, 8192), FS, 10000, 20000))), lo = x => dB(Math.sqrt(energiaBanda(espectro(x, 512, 8192), FS, 300, 3000)));
    confere('chave em MA: o disparo toca as maracas (energia acima de 10 kHz domina)', 'HF − BF > 0 dB', f(hf(r1) - lo(r1), 1) + ' dB', hf(r1) - lo(r1) > 0);
    confere('chave em CP: o mesmo disparo toca o clap (energia de 300 Hz a 3 kHz domina)', 'HF − BF < −10 dB', f(hf(r0) - lo(r0), 1) + ' dB', hf(r0) - lo(r0) < -10);
    // troca a chave com o aparelho já ligado: dispara em MA, troca para CP, dispara de novo
    const mt = new Motor(FS); mt.msg({ t: 'p', p: { acLevel: 1, cp: { level: 1, modo: 1 } } });
    const proc = n => { const L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i += 128) { mt.process(L.subarray(i, i + 128), R.subarray(i, i + 128), 128); } return L; };
    mt.msg({ t: 'trig', v: 'cp', ac: false }); const a1 = proc(24064); mt.msg({ t: 'p', p: { cp: { modo: 0 } } }); mt.msg({ t: 'trig', v: 'cp', ac: false }); const a2 = proc(24064);
    const d1 = hf(a1) - lo(a1), d2 = hf(a2) - lo(a2);
    confere('trocar a chave de MA para CP com o aparelho ligado: 1º disparo maracas, 2º disparo clap', 'HF − BF > 0 dB e < −10 dB', f(d1, 1) + ' dB e ' + f(d2, 1) + ' dB', d1 > 0 && d2 < -10); }
}

// ===== 14. mixer e master (Parte C, seção 10): somador, MASTER VOLUME, 2º estágio ×1,5, polos em 21,9 kHz, grampeamento, HI e LO, POWER =====
titulo('mixer e master: ganhos dos resistores de mistura, volume, polos, grampeamento, saídas HI e LO');
// ganhos relativos pelos resistores (a): R75 33k sobre o resistor de mistura de cada voz
{ const R = { bd: 22e3, sd: 33e3, lt: 33e3, mt: 33e3, ht: 33e3, rs: 33e3, cp: 33e3, ma: 33e3, oh: 56e3, ch: 47e3, cb: 47e3, cy: 47e3 }; let pior = 0, quem = '';
  for (const v in R) { const g = D.GANHO_MIX[v] === undefined ? (v === 'ma' ? D.GANHO_MIX.cp : NaN) : D.GANHO_MIX[v], teo = 33e3 / R[v], e = Math.abs(g / teo - 1); if (!(e <= pior)) { pior = e; quem = v; } }
  confere('ganhos de mistura das 12 vozes/pares = R75 / R de mistura (BD 1,5; OH 0,59; CH, CB, CY 0,70; demais 1,0)', 'erro ≤ 0,5 % (0,59 e 0,70 são arredondados de 0,589 e 0,702)', f(pior * 100, 2) + ' % (pior: ' + quem + ')', pior <= 0.005); }
if (!D.MASTER) { fora++; linhas.push(['FORA', 'master: motor ainda não tem o estágio master', 'D.MASTER', 'ausente']); } else {
  const M = D.MASTER;
  // polos: 2 × passa-baixas de 1 polo em 21,9 kHz (33 kΩ × 220 pF), um em cada estágio
  const hp = resposta(D.mkMasterPolos(FS), FS), analog = fq => -20 * Math.log10(1 + (fq / 21900) ** 2);   // dois polos: 2 × (−10·log10(1 + x²))
  let pior = 0, em = 0; for (let fq = 100; fq <= 18000; fq *= 1.05) { const e = Math.abs(hp.db(fq) - analog(fq)); if (e > pior) { pior = e; em = fq; } }
  const e20 = hp.db(20000) - analog(20000);
  confere('polos em 21,9 kHz (2 estágios): resposta digital contra a analógica, 100 Hz a 18 kHz', 'erro ≤ 1,2 dB (aproximação: o polo está colado em Nyquist a 48 kHz; (c))', f(pior, 2) + ' dB (em ' + f(em, 0) + ' Hz)', FS !== 48000 || pior <= 1.2);
  info('polos: erro em 20 kHz (fora da banda otimizada)', 'cresce perto de Nyquist; não é critério', f(e20, 2) + ' dB');
  confere('polos: ganho em 1 kHz', '0 dB ±0,05 (−0,004 dB analógico)', f(hp.db(1000), 3) + ' dB', perto(hp.db(1000), 0, 0.05));
  // ganho em DC do master completo: 1,5 do 2º estágio sobre a referência digital de 15 V
  { const ms = new D.Master(FS); let y = 0; for (let i = 0; i < 4000; i++) y = ms.processa(1, 1, false);
    confere('ganho em DC (MASTER VOLUME no máximo, saída HI): ×1,5 do 2º estágio (R76/R77) sobre 15 V = 1,0', f(1.5 / M.vRef, 4) + ' ±0,1 %', f(y, 4), perto(y / (1.5 / M.vRef), 1, 0.001));
    const ys = new D.Master(FS); let y2 = 0; for (let i = 0; i < 4000; i++) y2 = ys.processa(1, 0.5, false);
    confere('MASTER VOLUME a meio curso: −12,04 dB (potenciômetro A, 50 kΩ; lei θ² é (c))', '−12,04 dB ±0,1', f(dB(y2 / y), 2) + ' dB', perto(dB(y2 / y), -12.04, 0.1));
    const yz = new D.Master(FS); let y3 = 1; for (let i = 0; i < 100; i++) y3 = yz.processa(5, 0, false);
    confere('MASTER VOLUME no mínimo: mudo', '0', f(y3, 9), y3 === 0);
    const yl = new D.Master(FS); let y4 = 0; for (let i = 0; i < 4000; i++) y4 = yl.processa(1, 1, true);
    confere('saída LO contra HI: divisor R13 27k / R12 3,3k', '−19,26 dB ±0,1 (−19,3 dB na Parte C, c sobre a)', f(dB(y4 / y), 2) + ' dB', perto(dB(y4 / y), -19.26, 0.1));
    const yc = new D.Master(FS); let y5 = 0; for (let i = 0; i < 4000; i++) y5 = yc.processa(500, 1, false);
    confere('grampeamento (D9/D10 nos trilhos): entrada de 500 V satura', 'exatamente 1,0 (o valor dos trilhos B5 não foi encontrado: (c))', f(y5, 6), y5 === 1);
    const yn = new D.Master(FS); let y6 = 0; for (let i = 0; i < 4000; i++) y6 = yn.processa(-500, 1, false); confere('grampeamento negativo', 'exatamente −1,0', f(y6, 6), y6 === -1);
  }
  // POWER (muting por Q13, Q10 a Q12): desligado, a saída é zero
  { const m = novo(Motor, FS, { acLevel: 1, on: 0 }), r = render(m, 0.3, [{ t: 0.01, v: 'bd', ac: true }]); confere('POWER desligado: saída zero (o motor para de soar)', '0', f(pico(r), 9), pico(r) === 0); }
  // aditividade do mixer: BD e SD disparados juntos = BD sozinho + SD sozinho (mesma realização de ruído)
  { const um = (v) => render(novo(Motor, FS, { master: 1, acLevel: 1 }), 0.3, [{ t: 512 / FS, v, ac: false }]), a = um('bd'), b = um('sd'), ab = render(novo(Motor, FS, { master: 1, acLevel: 1 }), 0.3, [{ t: 512 / FS, v: 'bd', ac: false }, { t: 512 / FS, v: 'sd', ac: false }]);
    let e = 0; for (let i = 0; i < ab.length; i++) e = Math.max(e, Math.abs(ab[i] - a[i] - b[i]));
    confere('somador: BD + SD juntos = BD sozinho + SD sozinho', 'diferença < 1e-6 (linear)', e.toExponential(1), e < 1e-6); }
  // pior caso: todas as 16 vozes com accent no máximo, master no máximo, ao mesmo tempo
  { const todas = ['bd', 'sd', 'lt', 'mt', 'ht', 'cy', 'oh', 'ch', 'cb', 'cp', 'rs'].map(v => ({ t: 512 / FS, v, ac: true })), r = render(novo(Motor, FS, { master: 1, acLevel: 1 }), 1, todas);
    let fin = true; for (const v of r) if (!Number.isFinite(v)) fin = false;
    confere('pior caso: 11 canais com accent no máximo ao mesmo tempo, master no máximo', 'finito, pico ≤ 1,0 (sem estourar o conversor)', f(pico(r), 3) + (fin ? '' : ' (NaN!)'), fin && pico(r) <= 1.0); }
}

// ===== 15. sequenciador: clock, pre-scale, passos, patterns, variações, fill-in, rhythm track =====
titulo('sequenciador: clock de 24 pulsos por semínima, pre-scale, passos, patterns, fill-in, rhythm track');
if (!D.SEQ) { fora++; linhas.push(['FORA', 'sequenciador: motor ainda não tem o sequenciador', 'D.SEQ', 'ausente']); } else {
  const SQ = D.SEQ, T = SQ.trilhas;
  // roda o motor por `seg` segundos em blocos de `bloco` amostras e devolve os eventos {t, n, ...} (n = índice da amostra)
  const roda = (m, seg, bloco = 128, antes) => { const ev = []; m.evento = e => ev.push(e); if (antes) antes(m); const N = Math.round(seg * FS), L = new Float32Array(bloco), R = new Float32Array(bloco);
    for (let i = 0; i < N; i += bloco) m.process(L, R, Math.min(bloco, N - i)); return ev; };
  const novoM = (bpm = 120) => { const m = novo(Motor, FS, { master: 1, acLevel: 1 }); m.msg({ t: 'seq', a: 'bpm', v: bpm }); return m; };
  const S = (m, a, o = {}) => m.msg(Object.assign({ t: 'seq', a }, o));
  const quadrado = (m, trilha, passos, banco = 'A', n = 1) => { S(m, 'basico', { n }); S(m, 'varB', { v: banco }); passos.forEach(p => S(m, 'alterna', { trilha, passo: p })); };
  /** Configura os DOIS bancos (A e B) do pattern básico n ('b') ou INTRO/FILL IN n ('f') com `comp` passos e pre-scale `ps` (curto, para a simulação caber). */
  const cfg = (m, tipo, n, comp = 2, ps = 4) => { for (const b of ['A', 'B']) { S(m, tipo === 'f' ? 'varF' : 'varB', { v: b }); S(m, tipo === 'f' ? 'fill' : 'basico', { n }); S(m, 'tamanho', { n: comp }); S(m, 'prescale', { ps }); } S(m, 'varB', { v: 'A' }); S(m, 'varF', { v: 'A' }); S(m, 'basico', { n: 1 }); };
  // 1) clock: 24 pulsos por semínima
  { const m = novoM(120); quadrado(m, 'bd', [0]); S(m, 'prescale', { ps: 4 }); S(m, 'tamanho', { n: 32 }); S(m, 'start');
    const ev = roda(m, 2.5), pulsos = ev.filter(e => e.t === 'pulso');
    const dif = pulsos.slice(1).map((e, i) => e.n - pulsos[i].n), esp = FS * 60 / (120 * 24);
    confere('clock: pulsos em 2 s a 120 BPM (a partir do 1º)', '96 pulsos (= 4 semínimas × 24 pulsos; a, p.5)', String(pulsos.filter(e => e.n <= pulsos[0].n + 2 * FS - 1).length), pulsos.filter(e => e.n <= pulsos[0].n + 2 * FS - 1).length === 96);
    confere('clock: intervalo entre pulsos a 120 BPM', f(esp, 1) + ' amostras (20,83 ms) ±1', f(Math.min(...dif), 0) + ' a ' + f(Math.max(...dif), 0), Math.min(...dif) >= Math.floor(esp) && Math.max(...dif) <= Math.ceil(esp)); }
  // 2) faixa de andamento: período do pulso entre 8,33 ms (300 BPM) e 62,5 ms (40 BPM); a especificação dá 8,3 a 65 ms
  for (const [bpm, pulso] of [[300, 8.333], [40, 62.5]]) { const m = novoM(bpm); quadrado(m, 'bd', [0]); S(m, 'tamanho', { n: 32 }); S(m, 'prescale', { ps: 4 }); S(m, 'start'); const ev = roda(m, 1.5), p = ev.filter(e => e.t === 'pulso'), d = (p[p.length - 1].n - p[1].n) / (p.length - 2) / FS * 1000;
    confere(`andamento ${bpm} BPM: período do pulso`, `${f(pulso, 2)} ms ±1 % (Parte C: 8,33 a 65 ms entre 300 e ~38,5 BPM)`, f(d, 3) + ' ms', perto(d, pulso, pulso * 0.01)); }
  { const m = novoM(500); confere('andamento limitado a 40–300 BPM (alto)', '300', String(m.seq.bpm), m.seq.bpm === 300); const m2 = novoM(5); confere('andamento limitado a 40–300 BPM (baixo)', '40', String(m2.seq.bpm), m2.seq.bpm === 40); }
  // 3) pre-scale: clocks por passo 8 / 4 / 6 / 3 (c: do remake TR-08); intervalo entre passos a 120 BPM
  for (const [ps, cl] of [[1, 8], [2, 4], [3, 6], [4, 3]]) { const m = novoM(120); quadrado(m, 'bd', [0, 1, 2, 3, 4, 5, 6, 7]); S(m, 'prescale', { ps }); S(m, 'tamanho', { n: 8 }); S(m, 'start'); const ev = roda(m, 1.2), st = ev.filter(e => e.t === 'passo').slice(0, 7), d = st.slice(1).map((e, i) => e.n - st[i].n), esp = cl * FS * 60 / (120 * 24);
    confere(`PRE-SCALE ${ps}: ${cl} clocks por passo (c); intervalo entre passos a 120 BPM`, f(esp / FS * 1000, 2) + ' ms ±1 amostra', f(Math.min(...d) / FS * 1000, 2) + ' a ' + f(Math.max(...d) / FS * 1000, 2) + ' ms', Math.min(...d) >= Math.floor(esp) && Math.max(...d) <= Math.ceil(esp)); }
  // 4) sem swing: todos os passos igualmente espaçados (a: o original não tem swing)
  { const m = novoM(97); quadrado(m, 'bd', [0, 3, 5, 9]); S(m, 'prescale', { ps: 3 }); S(m, 'start'); const ev = roda(m, 4), st = ev.filter(e => e.t === 'passo'), d = st.slice(1).map((e, i) => e.n - st[i].n);
    confere('sem swing: espaçamento dos passos ao longo de 4 s a 97 BPM', 'todos iguais ±1 amostra', f(Math.max(...d) - Math.min(...d), 0) + ' amostra(s) de dispersão', Math.max(...d) - Math.min(...d) <= 1); }
  // 5) 9 ms de preparação ao dar START (a, p.5)
  { const m = novoM(120); quadrado(m, 'bd', [0]); S(m, 'start'); const ev = roda(m, 0.3), p = ev.find(e => e.t === 'pulso');
    confere('START: primeiro pulso depois de 9 ms (mode change preparation time)', '9 ms ±0,1 (a, p.5)', f(p.n / FS * 1000, 2) + ' ms', perto(p.n / FS * 1000, 9, 0.1)); }
  // 6) número de passos por compasso, 1 a 32, e duração do compasso
  for (const n of [1, 5, 7, 11, 16, 32]) { const m = novoM(300); quadrado(m, 'bd', [0]); S(m, 'tamanho', { n }); S(m, 'prescale', { ps: 3 }); S(m, 'start'); const ev = roda(m, n * 0.05 * 3.3 + 0.1), cs = ev.filter(e => e.t === 'compasso'), esp = n * 6 * FS * 60 / (300 * 24);
    const d = cs.length > 2 ? cs[2].n - cs[1].n : NaN; confere(`compasso de ${n} passo(s): duração a 300 BPM, PRE-SCALE 3`, f(esp / FS * 1000, 1) + ' ms ±2 amostras', f(d / FS * 1000, 1) + ' ms', Math.abs(d - esp) <= 2); }
  { const m = novoM(120); S(m, 'tamanho', { n: 99 }); const a = m.seq.alvo().n; S(m, 'tamanho', { n: 0 }); const b = m.seq.alvo().n; confere('limites de passos: 1 a 32', '32 e 1', a + ' e ' + b, a === 32 && b === 1); }
  // 7) disparos: cada passo ligado dispara a voz da trilha; AC dá accent a todas as vozes do passo (a: accent global)
  { const m = novoM(120); quadrado(m, 'bd', [0, 8]); quadrado(m, 'sd', [4, 8]); quadrado(m, 'ac', [8]); S(m, 'tamanho', { n: 16 }); S(m, 'start'); const ev = roda(m, 2.2).filter(e => e.t === 'trig').slice(0, 5), s = ev.map(e => e.v + (e.ac ? '+AC' : '')).join(' ');
    confere('disparos do 1º compasso: BD (passos 1 e 9), SD (5 e 9), AC no 9', 'bd sd bd+AC sd+AC (e bd no compasso seguinte)', s, s === 'bd sd bd+AC sd+AC bd'); }
  { const m = novoM(120); quadrado(m, 'oh', [0]); quadrado(m, 'ch', [0]); S(m, 'start'); const ev = roda(m, 0.2).filter(e => e.t === 'trig').map(e => e.v);
    confere('passo com OH e CH: o CH dispara depois do OH (corta o decay do aberto)', 'oh, ch', ev.slice(0, 2).join(', '), ev[0] === 'oh' && ev[1] === 'ch'); }
  // 8) a troca de pattern acontece na barra de compasso (a, S8)
  { const m = novoM(120); for (const n of [1, 2]) { S(m, 'basico', { n }); S(m, 'tamanho', { n: 4 }); S(m, 'prescale', { ps: 4 }); } quadrado(m, 'bd', [0], 'A', 1); quadrado(m, 'sd', [0], 'A', 2); S(m, 'basico', { n: 1 }); S(m, 'start'); const ev = []; m.evento = e => ev.push(e);   // compasso = 4 passos × 3 clocks = 250 ms a 120 BPM
    const L = new Float32Array(128), R = new Float32Array(128); let pedido = false; for (let i = 0; i < Math.round(2.2 * FS); i += 128) { if (!pedido && i > 0.35 * FS) { S(m, 'basico', { n: 2 }); pedido = true; } m.process(L, R, 128); }
    const cs = ev.filter(e => e.t === 'compasso').map(e => e.pat); confere('troca de pattern pedida aos 0,35 s (meio do 2º compasso de 250 ms) só vale no compasso seguinte', 'compassos: b1A, b1A, b2A, b2A (a, S8: a troca acontece na barra de compasso)', cs.slice(0, 4).join(', '), cs.slice(0, 4).join(',') === 'b1A,b1A,b2A,b2A'); }
  // 9) BASIC VARIATION A / AB / B
  for (const [v, esp] of [['A', 'b1A,b1A,b1A,b1A'], ['B', 'b1B,b1B,b1B,b1B'], ['AB', 'b1A,b1B,b1A,b1B']]) { const m = novoM(240); cfg(m, 'b', 1, 4, 4); S(m, 'varB', { v }); S(m, 'start'); const ev = roda(m, 1.6), cs = ev.filter(e => e.t === 'compasso').map(e => e.pat).slice(0, 4);
    confere(`BASIC VARIATION ${v}`, esp + (v === 'AB' ? ' (alterna A e B a cada compasso)' : ''), cs.join(','), cs.join(',') === esp); }
  // 10) fill-in pelo TAP: o próximo compasso toca o INTRO/FILL IN escolhido, depois volta ao básico
  { const m = novoM(240); cfg(m, 'b', 1, 4, 4); cfg(m, 'f', 3, 4, 4); S(m, 'fill', { n: 3 }); S(m, 'start'); const ev = []; m.evento = e => ev.push(e);
    const L = new Float32Array(128), R = new Float32Array(128); let tocou = false; for (let i = 0; i < Math.round(2 * FS); i += 128) { if (!tocou && i > 0.4 * FS) { S(m, 'tap'); tocou = true; } m.process(L, R, 128); }
    const cs = ev.filter(e => e.t === 'compasso').map(e => e.pat).slice(0, 6); const k = cs.findIndex(c => c[0] === 'f');
    confere('TAP durante o play: o compasso seguinte é o INTRO/FILL IN 3 e depois volta ao básico', 'f3A uma vez e b1A em volta (c: semântica inferida)', cs.join(','), k > 0 && cs[k] === 'f3A' && cs[k + 1] === 'b1A' && cs.filter(c => c[0] === 'f').length === 1); }
  // 11) AUTO FILL IN: a cada N compassos o último do bloco é o fill-in (c)
  for (const N of [2, 4, 8, 12, 16]) { const m = novoM(300); cfg(m, 'b', 1, 2, 4); cfg(m, 'f', 2, 2, 4); S(m, 'fill', { n: 2 }); S(m, 'auto', { v: N }); S(m, 'start'); const ev = roda(m, 2 * N * 0.1 * 4 + 0.2), cs = ev.filter(e => e.t === 'compasso').map(e => e.pat).slice(0, 2 * N);
    const idx = cs.map((c, i) => c[0] === 'f' ? i : -1).filter(i => i >= 0); confere(`AUTO FILL IN ${N}: fill-in nos compassos`, `${N - 1}, ${2 * N - 1} (0-based; o último de cada bloco de ${N}; c)`, idx.join(', '), idx.join(',') === `${N - 1},${2 * N - 1}`); }
  { const m = novoM(300); cfg(m, 'b', 1, 2, 4); S(m, 'auto', { v: 0 }); S(m, 'start'); const ev = roda(m, 3), cs = ev.filter(e => e.t === 'compasso').map(e => e.pat); confere('AUTO FILL IN em MANUAL: nenhum fill-in automático', '0 fill-ins em ' + cs.length + ' compassos', String(cs.filter(c => c[0] === 'f').length), cs.filter(c => c[0] === 'f').length === 0); }
  // 12) INTRO: TAP com o aparelho parado arma o intro; o primeiro compasso depois do START é o INTRO/FILL IN (c)
  { const m = novoM(240); cfg(m, 'b', 1, 4, 4); cfg(m, 'f', 4, 4, 4); S(m, 'fill', { n: 4 }); S(m, 'tap'); S(m, 'start'); const ev = roda(m, 1.5), cs = ev.filter(e => e.t === 'compasso').map(e => e.pat).slice(0, 3);
    confere('INTRO SET (TAP parado) + START: 1º compasso é o INTRO/FILL IN 4, depois o básico', 'f4A, b1A, b1A (c)', cs.join(','), cs.join(',') === 'f4A,b1A,b1A'); }
  // 13) rhythm track: compõe (grava o que toca) e toca de volta; o A/B não é gravado (a, S8)
  { const m = novoM(300); for (const n of [1, 3, 5]) cfg(m, 'b', n, 2, 4); S(m, 'basico', { n: 1 }); S(m, 'songTrilha', { tr: 2 }); S(m, 'modo', { v: 'compose' }); S(m, 'start'); const ev = []; m.evento = e => ev.push(e);
    const L = new Float32Array(128), R = new Float32Array(128); const pede = [[0.25, 3], [0.45, 5], [0.65, 1]]; let k = 0; for (let i = 0; i < Math.round(1.4 * FS); i += 128) { if (k < pede.length && i / FS > pede[k][0]) { S(m, 'basico', { n: pede[k][1] }); k++; } m.process(L, R, 128); }
    S(m, 'stop'); const gravado = m.seq.song[2].filter(e => e).map(e => e.t + e.n).join(',');
    confere('COMPOSE: o que toca é gravado na trilha do rhythm track (compassos de 2 passos)', 'começa em b1 e passa por b3, b5, b1 (o texto do rhythm track tem 12 trilhas de 64 compassos)', gravado.split(',').slice(0, 8).join(','), /^b1(,b1)*,b3(,b3)*,b5(,b5)*,b1/.test(gravado));
    S(m, 'varB', { v: 'B' }); S(m, 'modo', { v: 'play' }); S(m, 'start'); const ev2 = roda(m, 2).filter(e => e.t === 'compasso').map(e => e.pat);
    confere('PLAY do rhythm track: segue a trilha gravada; o A/B vem da chave BASIC VARIATION (não é gravado)', 'todos os compassos no banco B', ev2.slice(0, 6).join(','), ev2.length > 0 && ev2.every(c => c.endsWith('B')));
    const ordem = ev2.map(c => c.slice(0, 2)).filter((c, i, a) => i === 0 || a[i - 1] !== c).join(','); confere('PLAY: a ordem dos patterns é a gravada', 'b1,b3,b5,b1', ordem, ordem.startsWith('b1,b3,b5,b1')); }
  { const m = novoM(300); const T64 = SQ.maxCompassosTrilha, T12 = m.seq.song.length; confere('rhythm track: 12 trilhas de 64 compassos (768 no total)', '12 × 64', T12 + ' × ' + m.seq.song[0].length, T12 === 12 && m.seq.song[0].length === T64); }
  // 14) determinismo: os tempos não dependem do tamanho do bloco de processamento (tempo ao nível da amostra)
  { const tempos = bl => { const m = novoM(133); quadrado(m, 'bd', [0, 2, 3, 6]); S(m, 'tamanho', { n: 8 }); S(m, 'start'); return roda(m, 3, bl).filter(e => e.t === 'trig').map(e => e.n).join(','); };
    const a = tempos(128), b = tempos(1), c = tempos(500); confere('os disparos caem nas mesmas amostras com blocos de 128, 1 e 500', 'idênticos', (a === b && b === c) ? 'idênticos' : 'diferentes', a === b && b === c); }
  // 15) parar e reiniciar; andamento alterado durante o play
  { const m = novoM(120); quadrado(m, 'bd', [0]); S(m, 'start'); const ev = []; m.evento = e => ev.push(e); const L = new Float32Array(128), R = new Float32Array(128);
    for (let i = 0; i < 0.6 * FS; i += 128) m.process(L, R, 128); S(m, 'stop'); const n0 = ev.length; for (let i = 0; i < 0.6 * FS; i += 128) m.process(L, R, 128);
    confere('STOP: nenhum evento depois de parar', '0', String(ev.length - n0), ev.length === n0); }
  { const m = novoM(120); quadrado(m, 'bd', [0, 1, 2, 3]); S(m, 'prescale', { ps: 4 }); S(m, 'tamanho', { n: 4 }); S(m, 'start'); const ev = []; m.evento = e => ev.push(e); const L = new Float32Array(128), R = new Float32Array(128);
    for (let i = 0; i < 1 * FS; i += 128) m.process(L, R, 128); S(m, 'bpm', { v: 240 }); for (let i = 0; i < 1 * FS; i += 128) m.process(L, R, 128);
    const p = ev.filter(e => e.t === 'pulso'), a = p.filter(e => e.n < FS).slice(-4), b = p.filter(e => e.n > 1.2 * FS).slice(0, 4), da = (a[3].n - a[0].n) / 3, db = (b[3].n - b[0].n) / 3;
    confere('mudar o andamento durante o play: o intervalo dos pulsos cai à metade', f(da / 2, 1) + ' amostras ±1', f(db, 1) + ' amostras', perto(db, da / 2, 1)); }
  // 16) exportar / importar (persistência)
  { const m = novoM(120); quadrado(m, 'bd', [0, 4, 8]); quadrado(m, 'ac', [4]); S(m, 'tamanho', { n: 12 }); S(m, 'prescale', { ps: 2 }); const d = JSON.parse(JSON.stringify(m.seq.exporta())), m2 = novoM(120); m2.seq.importa(d);
    confere('exportar e importar: o estado do sequenciador volta idêntico', 'JSON igual', JSON.stringify(m2.seq.exporta()) === JSON.stringify(d) ? 'igual' : 'diferente', JSON.stringify(m2.seq.exporta()) === JSON.stringify(d)); }
  // 16b) ligação com o áudio: o passo de BD produz som na saída logo depois do disparo e o passo vazio, não
  { const m = novoM(120); quadrado(m, 'bd', [4]); S(m, 'tamanho', { n: 8 }); S(m, 'prescale', { ps: 3 }); S(m, 'start'); const ev = []; m.evento = e => ev.push(e); const N = Math.round(1.2 * FS), y = new Float32Array(N), R = new Float32Array(N);
    for (let i = 0; i < N; i += 128) m.process(y.subarray(i, Math.min(N, i + 128)), R.subarray(i, Math.min(N, i + 128)), Math.min(128, N - i));
    const t = ev.find(e => e.t === 'trig').n, antes = pico(y, 0, t), depois = pico(y, t, t + Math.round(0.05 * FS));
    confere('o passo ligado de BD toca o bumbo na saída; antes dele, silêncio exato', 'pico antes = 0; pico depois > 0,05 (BD normal ≈ 0,5 Vpp digital)', f(antes, 9) + ' e ' + f(depois, 3), antes === 0 && depois > 0.05); }
  // 16c) eventos para a interface: uma batida por semínima; "parou" quando o rhythm track termina sozinho
  { const m = novoM(120); quadrado(m, 'bd', [0]); S(m, 'prescale', { ps: 4 }); S(m, 'tamanho', { n: 32 }); S(m, 'start'); const ev = roda(m, 2.1), b = ev.filter(e => e.t === 'batida');
    confere('evento de batida: um por semínima (a cada 24 pulsos)', '5 batidas em 2,1 s a 120 BPM (em 9 ms, 0,509, 1,009, 1,509 e 2,009 s), intervalos de 0,500 s', String(b.length) + ' (intervalos ' + b.slice(1).map((e, i) => f((e.n - b[i].n) / FS, 3)).join(', ') + ' s)', b.length === 5 && b.slice(1).every((e, i) => e.n - b[i].n === FS / 2)); }
  { const m = novoM(300); cfg(m, 'b', 1, 2, 4); S(m, 'songTrilha', { tr: 4 }); m.seq.song[4][0] = { t: 'b', n: 1 }; m.seq.song[4][1] = { t: 'b', n: 1 }; S(m, 'modo', { v: 'play' }); S(m, 'start'); const ev = roda(m, 0.5), parou = ev.filter(e => e.t === 'parou'), cs = ev.filter(e => e.t === 'compasso').length;
    confere('PLAY: ao fim da trilha (2 compassos) o motor para e avisa', '1 evento "parou" depois de 2 compassos; run = false', String(parou.length) + ' depois de ' + cs + ' compassos; run = ' + m.seq.run, parou.length === 1 && cs === 2 && !m.seq.run); }
  // 17) mapa do botão de andamento (c): TEMPO 0 a 1 -> 40 a 300 BPM, exponencial
  { const b = D.bpmDeKnob; confere('mapa do botão TEMPO: extremos e meio', '40 e 300 BPM; meio = média geométrica 109,5 (c: o circuito é antilogarítmico, a lei exata não foi encontrada)', f(b(0, 0.5), 1) + ', ' + f(b(1, 0.5), 1) + ', ' + f(b(0.5, 0.5), 1), perto(b(0, 0.5), 40, 0.1) && perto(b(1, 0.5), 300, 0.1) && perto(b(0.5, 0.5), 109.5, 0.2)); }
}

// ===== relatório =====
const larg = [0, 1, 2].map(k => Math.min(70, Math.max(...linhas.map(l => (l[k + 1] || '').length))));
for (const l of linhas) console.log(l[0] === '' ? '\n' + l[1] : `${l[0]}  ${l[1].padEnd(larg[0])}  esperado: ${l[2].padEnd(larg[1])}  medido: ${l[3]}`);
const total = linhas.filter(l => l[0] === 'ok  ' || l[0] === 'FORA').length;
console.log(`\n${total} medições, ${total - fora} ok, ${fora} fora`);
process.exit(fora ? 1 : 0);
