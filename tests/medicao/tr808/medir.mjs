// Mede o motor de tr808/index.html fora do navegador e compara com docs/pesquisa/tr808.md.
// Uso: node tests/medicao/tr808/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
// Tolerâncias: marcadas "(tol. minha)" quando a fonte não dá tolerância. Valores esperados vêm do tr808.md.
import { carregaMotor, novo, renderVoz, render, vpp, dB, pico, rms, espectro, picoEsp, energiaBanda, cruzamentos, tempoAte, tempoAteRms, ampDecai, resposta, FS } from './motor.mjs';

const Motor = carregaMotor(), D = Motor.dados;
let fora = 0; const linhas = [];
const f = (v, c = 2) => typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v)) : String(v);
function confere(nome, esperado, medido, ok) { if (!ok) fora++; linhas.push([ok ? 'ok  ' : 'FORA', nome, esperado, medido]); }
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const titulo = t => linhas.push(['', '— ' + t + ' —', '', '']);
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
  const m = novo(Motor, FS, { master: 1, acLevel: 1, bd: { level: 1, tone: 0.5, decay: 0.5 } }), v = vpp(renderVoz(novo(Motor, FS, { acLevel: 1, bd: { level: 1, tone: 0.5, decay: 0.5 } }), 'bd', 1).y);
  const d2 = render(m, 1, [{ t: 0.01, v: 'bd', ac: false }]), esperado = v * D.GANHO_MIX.bd * D.V_POR_UNIDADE;
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
  const m = novo(Motor, FS, { master: 1, acLevel: 1, sd: { level: 1, tone: 0.5, snappy: 0.5 } }), d2 = render(m, 1, [{ t: T512, v: 'sd', ac: false }]), esp = vpp(ref.y) * D.GANHO_MIX.sd * D.V_POR_UNIDADE;
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
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, [c]: { level: 1, tuning: 0.5, modo: 0 } }), 1, [{ t: T512, v: c, ac: false }]), esp = vpp(ref.y) * D.GANHO_MIX[c] * D.V_POR_UNIDADE;
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
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, [c]: { level: 1, tone: 0.5, decay: 0.5 } }), 1, [{ t: T512, v: c, ac: false }]), esp = vpp(ref.y) * g * D.V_POR_UNIDADE;
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
  const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, cb: { level: 1 } }), 1, [{ t: T512, v: 'cb', ac: false }]), esp = vpp(ref.y) * D.GANHO_MIX.cb * D.V_POR_UNIDADE;
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
    const d2 = render(novo(Motor, FS, { master: 1, acLevel: 1, cp: { level: 1 } }), 1, [{ t: T512, v: 'cp', ac: false }]), esp = vpp(ref.y) * D.GANHO_MIX.cp * D.V_POR_UNIDADE;
    confere('mix: CP com ganho 1,0 (Parte C, seção 10)', f(esp, 3) + ' Vpp digital ±3 %', f(vpp(d2), 3), perto(vpp(d2), esp, esp * 0.03)); }
}

// ===== relatório =====
const larg = [0, 1, 2].map(k => Math.min(70, Math.max(...linhas.map(l => (l[k + 1] || '').length))));
for (const l of linhas) console.log(l[0] === '' ? '\n' + l[1] : `${l[0]}  ${l[1].padEnd(larg[0])}  esperado: ${l[2].padEnd(larg[1])}  medido: ${l[3]}`);
const total = linhas.filter(l => l[0]).length;
console.log(`\n${total} medições, ${total - fora} ok, ${fora} fora`);
process.exit(fora ? 1 : 0);
