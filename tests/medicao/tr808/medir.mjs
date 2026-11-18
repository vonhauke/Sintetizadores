// Mede o motor de tr808/index.html fora do navegador e compara com docs/pesquisa/tr808.md.
// Uso: node tests/medicao/tr808/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
// Tolerâncias: marcadas "(tol. minha)" quando a fonte não dá tolerância. Valores esperados vêm do tr808.md.
import { carregaMotor, novo, renderVoz, render, vpp, dB, pico, rms, espectro, picoEsp, energiaBanda, cruzamentos, tempoAte, FS } from './motor.mjs';

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

// ===== relatório =====
const larg = [0, 1, 2].map(k => Math.min(70, Math.max(...linhas.map(l => (l[k + 1] || '').length))));
for (const l of linhas) console.log(l[0] === '' ? '\n' + l[1] : `${l[0]}  ${l[1].padEnd(larg[0])}  esperado: ${l[2].padEnd(larg[1])}  medido: ${l[3]}`);
const total = linhas.filter(l => l[0]).length;
console.log(`\n${total} medições, ${total - fora} ok, ${fora} fora`);
process.exit(fora ? 1 : 0);
