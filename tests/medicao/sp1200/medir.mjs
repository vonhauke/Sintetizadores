// Mede o motor de sp1200/index.html fora do navegador e compara com docs/pesquisa/sp1200.md.
// Uso: node tests/medicao/sp1200/medir.mjs   (sai com código 1 se algo ficar fora da tolerância)
import { carregaMotor, novo, poe, seno12, render, rms, pico, dB, amp, espectro, picoEsp, ataques, FS } from './motor.mjs';

const Motor = carregaMotor(), D = Motor.dados, FA = D.FA;
let fora = 0; const linhas = [];
const f = (v, c = 2) => typeof v === 'number' ? v.toFixed(c).replace('.', ',') : String(v);
function confere(nome, esperado, medido, ok) { if (!ok) fora++; linhas.push([ok ? 'ok  ' : 'FORA', nome, esperado, medido]); }
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
const titulo = t => linhas.push(['', '— ' + t + ' —', '', '']);

// ===== 1. conversão de entrada =====
titulo('conversão de entrada (12 bits, 26,04 kHz, 2,5 s)');
{
  const fs = 48000, x = new Float32Array(fs); for (let i = 0; i < fs; i++) x[i] = 0.9 * Math.sin(2 * Math.PI * 997 * i / fs);
  const d = D.converte(x, fs);
  confere('nº de amostras de 1 s a 48 kHz', '26040', String(d.length), perto(d.length, 26040, 1));
  let c = 0, s = 0; const n = d.length - 200; for (let i = 100; i < d.length - 100; i++) { const ph = 2 * Math.PI * 997 * i / FA; c += d[i] * Math.cos(ph); s += d[i] * Math.sin(ph); } c *= 2 / n; s *= 2 / n;
  let r = 0; for (let i = 100; i < d.length - 100; i++) { const ph = 2 * Math.PI * 997 * i / FA, e = d[i] - c * Math.cos(ph) - s * Math.sin(ph); r += e * e; }
  const a = Math.hypot(c, s), snr = dB(a / Math.SQRT2 / Math.sqrt(r / n)), bits = (snr - 1.76 - dB(0.9)) / 6.02;
  confere('amplitude de 0,9 do fundo de escala', f(0.9 * 2047, 0), f(a, 1), perto(a, 0.9 * 2047, 6));
  confere('relação sinal/ruído de quantização', '73,1 dB (12 bits) ±2', f(snr, 1) + ' dB', perto(snr, 73.1, 2));
  confere('resolução efetiva', '12 bits ±0,3', f(bits) + ' bits', perto(bits, 12, 0.3));
  confere('valores inteiros entre −2048 e 2047', 'sim', d.every(v => Number.isInteger(v) && v >= -2048 && v <= 2047) ? 'sim' : 'não', d.every(v => v >= -2048 && v <= 2047));
  const longo = new Float32Array(fs * 4).fill(0.5), dl = D.converte(longo, fs);
  confere('arquivo de 4 s é cortado em 2,5 s', D.ZONA + ' amostras', String(dl.length), dl.length === D.ZONA && D.ZONA === 65100);
  const dc = D.converte(x, fs, 10); let sat = 0; for (const v of dc) if (v === 2047 || v === -2048) sat++;
  confere('ganho +20 dB satura no fundo de escala', '> 80 % no limite', f(100 * sat / dc.length, 0) + ' %', sat / dc.length > 0.8);
  for (const [fq, lim] of [[5000, null], [14000, null], [16000, -40], [20000, -60]]) {
    for (let i = 0; i < fs; i++) x[i] = 0.9 * Math.sin(2 * Math.PI * fq * i / fs);
    const y = Float32Array.from(D.converte(x, fs)), fo = fq < FA / 2 ? fq : FA - fq, lv = dB(amp(y, fo, FA, 500, y.length - 500) / (0.9 * 2047));
    if (lim == null && fq < 13000) confere(`entrada: ${fq} Hz passa`, '0 dB ±0,5', f(lv) + ' dB', perto(lv, 0, 0.5));
    else if (lim == null) confere(`entrada: ${fq} Hz rebate em ${f(fo, 0)} Hz (informativo; filtro real não encontrado)`, '—', f(lv, 1) + ' dB', true);
    else confere(`entrada: ${fq} Hz rebatido em ${f(fo, 0)} Hz`, '< ' + lim + ' dB', f(lv, 1) + ' dB', lv < lim);
  }
}

// ===== 2. taxa e resolução na saída =====
titulo('saída do conversor (canal 8, sem filtro)');
{
  const m = novo(Motor, 96000); poe(m, 0, seno12(D, 1000, 2)); m.msg({ t: 'toca', i: 0 });
  const y = render(m, 1.2), mag = espectro(y, 9600, 65536), [f1] = picoEsp(mag, 96000, 900, 1100), [f2] = picoEsp(mag, 96000, 24000, 26000), [f3] = picoEsp(mag, 96000, 26500, 27500);
  const a1 = amp(y, 1000, 96000, 9600, 105600), a2 = amp(y, FA - 1000, 96000, 9600, 105600), a3 = amp(y, FA + 1000, 96000, 9600, 105600);
  confere('seno de 1 kHz no pitch original', '1000 Hz ±1', f(f1, 1) + ' Hz', perto(f1, 1000, 1));
  confere('taxa de amostragem efetiva (imagem inferior + fundamental)', f(FA, 1) + ' Hz ±10', f(f1 + f2, 1) + ' Hz', perto(f1 + f2, FA, 10));
  confere('taxa pela imagem superior (− fundamental)', f(FA, 1) + ' Hz ±10', f(f3 - f1, 1) + ' Hz', perto(f3 - f1, FA, 10));
  const e2 = dB(sinc((FA - 1000) / FA) / sinc(1000 / FA) * sinc((FA - 1000) / 192000)), e3 = dB(Math.abs(sinc((FA + 1000) / FA)) / sinc(1000 / FA) * sinc((FA + 1000) / 192000));
  confere('imagem em 25,04 kHz (sem filtro de reconstrução)', f(e2, 1) + ' dB ±1 (sinc do degrau)', f(dB(a2 / a1), 1) + ' dB', perto(dB(a2 / a1), e2, 1));
  confere('imagem em 27,04 kHz', f(e3, 1) + ' dB ±1', f(dB(a3 / a1), 1) + ' dB', perto(dB(a3 / a1), e3, 1));
  const esp = 0.9 * 2047 / 2048 * D.GANHO_MIX * sinc(1000 / FA);
  confere('nível de um som a fundo de escala no MIX (volume 10)', f(dB(esp), 1) + ' dBFS ±0,3', f(dB(a1), 1) + ' dBFS', perto(dB(a1), dB(esp), 0.3));
  // passo de quantização: rampa de 10 valores, cada um repetido 400 vezes
  const ra = new Int16Array(4000); for (let i = 0; i < 4000; i++) ra[i] = Math.floor(i / 400);
  const m2 = novo(Motor, FS); poe(m2, 0, ra); m2.msg({ t: 'toca', i: 0 }); const z = render(m2, 0.2), pl = [];
  for (let k = 0; k < 10; k++) { const c = Math.round((k * 400 + 200) / FA * FS) + 47; pl.push(rms(z, c - 60, c + 60) * Math.sign(z[c] || 1)); }
  const passos = pl.slice(1).map((v, i) => v - pl[i]), pm = passos.reduce((a, b) => a + b) / 9, pe = D.GANHO_MIX / 2048;
  confere('passo de quantização na saída (1 LSB de 12 bits)', (pe * 1e6).toFixed(1) + ' µ ±1 %', (pm * 1e6).toFixed(1) + ' µ', perto(pm / pe, 1, 0.01) && passos.every(p => perto(p / pe, 1, 0.03)));
  const m3 = novo(Motor, FS); poe(m3, 0, seno12(D, 1000, 2)); m3.msg({ t: 'toca', i: 0 }); const w = render(m3, 1.2), mg = espectro(w, 4800, 32768);
  confere('a 48 kHz (navegador) a imagem de 25 kHz não cabe: resíduo rebatido em 22,96 kHz (informativo)', '—', f(dB(picoEsp(mg, FS, 22500, 23500)[1] / picoEsp(mg, FS, 900, 1100)[1]), 1) + ' dB', true);
}

// ===== 3. pitch por drop-sample =====
titulo('pitch (drop-sample, sem interpolação)');
{
  let pior = 0;
  for (let v = 0; v <= 31; v++) { const m = novo(Motor); poe(m, 0, seno12(D, 1000, 2.4), { val: v }); m.msg({ t: 'toca', i: 0 }); const y = render(m, 0.9), [fq] = picoEsp(espectro(y, 2400, 32768), FS, 300, 2600);
    pior = Math.max(pior, Math.abs(fq / (1000 * D.razao(v)) - 1)); }
  confere('32 afinações: 1 kHz × 2^((v−16)/12), v = 0…31', 'erro < 0,2 %', f(pior * 100, 3) + ' %', pior < 0.002);
  confere('extremos do slider (centro 16): v = 8 e v = 23', '630 Hz e 1498 Hz (SP-12 medido: ≈650 e ≈1500)', f(1000 * D.razao(8), 0) + ' e ' + f(1000 * D.razao(23), 0) + ' Hz', perto(D.razao(23), 1.498, 0.001) && perto(D.razao(8), 0.63, 0.001));
  // aliasing ao transpor para baixo: v = 11 (−5 semitons)
  const r = D.razao(11), m = novo(Motor); poe(m, 0, seno12(D, 1000, 2.4), { val: 11 }); m.msg({ t: 'toca', i: 0 });
  const y = render(m, 1.6), mag = espectro(y, 4800, 65536), fe = FA - (FA - 1000) * r, [ff] = picoEsp(mag, FS, 700, 800), [fs_] = picoEsp(mag, FS, fe - 200, fe + 200), af = amp(y, 1000 * r, FS, 4800, 72000), as = amp(y, fe, FS, 4800, 72000);
  const esp = dB(sinc((FA - 1000) / FA) / sinc(1000 / FA) * sinc(fe / FA) / sinc(1000 * r / FA));
  confere('seno de 1 kHz em −5 semitons: fundamental', f(1000 * r, 1) + ' Hz ±1', f(ff, 1) + ' Hz', perto(ff, 1000 * r, 1));
  confere('componente de aliasing (repetição de amostras)', f(fe, 0) + ' Hz ±5', f(fs_, 0) + ' Hz', perto(fs_, fe, 5));
  confere('nível desse aliasing em relação à fundamental', f(esp, 1) + ' dB ±1,5 (teoria do degrau)', f(dB(as / af), 1) + ' dB', perto(dB(as / af), esp, 1.5));
  // referência: a mesma transposição com interpolação linear (o que o aparelho NÃO faz)
  const d = seno12(D, 1000, 2.4), n = 40000, yl = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * r, k = Math.floor(p), fr = p - k; yl[i] = (d[k] * (1 - fr) + d[k + 1] * fr) / 2048; }
  const ml = espectro(yl, 1000, 32768), il = dB(picoEsp(ml, FA, fe - 200, fe + 200)[1] / picoEsp(ml, FA, 700, 800)[1]);
  confere('mesma transposição com interpolação linear (referência)', 'pelo menos 15 dB mais limpa', f(il, 1) + ' dB', il < dB(as / af) - 15);
  // aliasing ao transpor para cima: 9 kHz em +7 semitons passa de 13 kHz e rebate
  const r2 = D.razao(23), m2 = novo(Motor); poe(m2, 0, seno12(D, 9000, 2.4), { val: 23 }); m2.msg({ t: 'toca', i: 0 });
  const [fa] = picoEsp(espectro(render(m2, 1.2), 2400, 32768), FS, 11000, 13020);
  confere('seno de 9 kHz em +7 semitons rebate (pula amostras)', f(FA - 9000 * r2, 0) + ' Hz ±10', f(fa, 0) + ' Hz', perto(fa, FA - 9000 * r2, 10));
}

// ===== 4. filtros por canal =====
titulo('filtros por canal (MIX OUT, em relação ao canal 8)');
{
  const nivel = (canal, fq, cru = 0) => { const m = novo(Motor, FS, { cru }); poe(m, 0, seno12(D, fq, 1), { canal }); m.msg({ t: 'toca', i: 0 }); return amp(render(m, 0.6), fq, FS, 9600, 28800); };
  for (const [canal, fc] of [[2, D.FILTRO.fixoA], [3, D.FILTRO.fixoA], [4, D.FILTRO.fixoB], [5, D.FILTRO.fixoB]]) {
    const med = [], espd = []; for (const fq of [1000, fc, 2 * fc > 12500 ? 12000 : 2 * fc]) { med.push(dB(nivel(canal, fq) / nivel(7, fq))); espd.push(-10 * Math.log10(1 + Math.pow(fq / fc, 4))); }
    confere(`canal ${canal + 1}: passa-baixas fixo de 2 polos em ${fc / 1000} kHz (1 kHz, corte, acima)`, espd.map(v => f(v, 1)).join(' / ') + ' dB ±1', med.map(v => f(v, 1)).join(' / ') + ' dB', med.every((v, i) => perto(v, espd[i], 1)));
  }
  for (const canal of [6, 7]) { const v = dB(nivel(canal, 9000) / nivel(7, 9000)); confere(`canal ${canal + 1}: sem filtro`, '0 dB', f(v) + ' dB', perto(v, 0, 0.05)); }
  const H = (fq, fc) => { const w = fq / fc, k = D.FILTRO.res; let re = 1, im = 0; for (let i = 0; i < 4; i++) { const a = re - im * w, b = re * w + im; re = a; im = b; } return dB((1 + k) / Math.hypot(re + k, im)); };
  const fcEm = t => D.FILTRO.base + (D.FILTRO.pico - D.FILTRO.base) * Math.exp(-t / D.FILTRO.tau);
  for (const canal of [0, 1]) {
    const m = novo(Motor); poe(m, 0, seno12(D, 2000, 2.4), { canal }); poe(m, 1, seno12(D, 2000, 2.4)); m.msg({ t: 'toca', i: 0 }); const y = render(m, 2);
    const m8 = novo(Motor); poe(m8, 0, seno12(D, 2000, 2.4)); m8.msg({ t: 'toca', i: 0 }); const y8 = render(m8, 2);
    const med = [], espd = []; for (const t of [0.015, 0.3, 1.5]) { const a = Math.round((t - 0.01) * FS), b = Math.round((t + 0.01) * FS); med.push(dB(amp(y, 2000, FS, a, b) / amp(y8, 2000, FS, a, b))); espd.push(H(2000, fcEm(t))); }
    confere(`canal ${canal + 1}: filtro dinâmico de 4 polos, 2 kHz aos 15 ms / 0,3 s / 1,5 s`, espd.map(v => f(v, 1)).join(' / ') + ' dB ±1,5', med.map(v => f(v, 1)).join(' / ') + ' dB', med.every((v, i) => perto(v, espd[i], 1.5)));
  }
  { // inclinação do filtro dinâmico já assentado em 700 Hz: de 2,8 para 5,6 kHz
    const lv = fq => { const m = novo(Motor); poe(m, 0, seno12(D, fq, 2.4), { canal: 0 }); m.msg({ t: 'toca', i: 0 }); const y = render(m, 2); return dB(amp(y, fq, FS, 72000, 91200)); };
    const incl = lv(5600) - lv(2800); confere('canal 1: inclinação acima do corte', '−24 dB/oitava ±2', f(incl, 1) + ' dB/oitava', perto(incl, -24, 2));
  }
  const cru = dB(nivel(2, 9000, 1) / nivel(7, 9000)); confere('saída "sem filtro" (ponta do jack) do canal 3', '0 dB', f(cru) + ' dB', perto(cru, 0, 0.05));
  const m = novo(Motor, FS, { solo: 3 }); poe(m, 0, seno12(D, 1000, 1)); m.msg({ t: 'toca', i: 0 }); const s = pico(render(m, 0.3));
  confere('saída individual: monitorar o canal 4 cala um som do canal 8', 'silêncio', f(dB(s), 0) + ' dB', s < 1e-6);
  // imagens: o filtro do canal as corta
  const im = canal => { const mm = novo(Motor, 96000); poe(mm, 0, seno12(D, 1000, 2), { canal }); mm.msg({ t: 'toca', i: 0 }); const g = render(mm, 1.2); return dB(amp(g, FA - 1000, 96000, 9600, 105600) / amp(g, 1000, 96000, 9600, 105600)); };
  const i8 = im(7), i3 = im(2), i5 = im(4);
  confere('imagem de 25 kHz por canal: 8 (cru) / 5 (9 kHz) / 3 (5 kHz)', 'cai com o corte do canal', [i8, i5, i3].map(v => f(v, 1)).join(' / ') + ' dB', i3 < i5 - 5 && i5 < i8 - 10);
}

// ===== 5. nível e decay =====
titulo('nível (Mix) e decay, em 8 bits');
{
  const dc = new Int16Array(D.ZONA).fill(2000), base = 2000 / 2048 * D.GANHO_MIX;
  const niv = n => { const m = novo(Motor); poe(m, 0, dc, { nivel: n }); m.msg({ t: 'toca', i: 0 }); const y = render(m, 0.1); return rms(y, 2400, 4800) / base; };
  const ns = Array.from({ length: 32 }, (_, n) => niv(n)); let mono = true; for (let n = 1; n < 32; n++) if (ns[n] <= ns[n - 1]) mono = false;
  confere('slider Mix: 32 níveis crescentes, 0 = mudo, 31 = cheio', '0 … 1', f(ns[0], 3) + ' … ' + f(ns[31], 3), mono && ns[0] < 1e-6 && perto(ns[31], 1, 0.002));
  confere('nível 16 de 31, arredondado a 8 bits', f(Math.round(255 * 16 / 31) / 255, 4), f(ns[16], 4), perto(ns[16], Math.round(255 * 16 / 31) / 255, 0.001));
  const mv = novo(Motor); poe(mv, 0, dc); mv.msg({ t: 'toca', i: 0, vel: 16 }); const v16 = rms(render(mv, 0.1), 2400, 4800) / base;
  confere('força do pad (Dynamic Buttons) 16 de 31', f(Math.round(255 * 16 / 31) / 255, 4), f(v16, 4), perto(v16, Math.round(255 * 16 / 31) / 255, 0.001));
  for (const v of [0, 10, 20]) {
    const T = D.decaySeg(v), m = novo(Motor); poe(m, 0, dc, { modo: 1, val: v }); m.msg({ t: 'toca', i: 0 }); const y = render(m, T + 0.2);
    let fim = y.length; for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i]) > 0.004 * base) { fim = i; break; }
    const meio = y[Math.round(T / 2 * FS) + 47] / base;
    confere(`decay ${v}: rampa até zero`, f(T * 1000, 0) + ' ms ±2 %', f(fim / FS * 1000, 0) + ' ms', perto(fim / FS / T, 1, 0.02));
    confere(`decay ${v}: metade do tempo, metade do nível (rampa linear)`, '0,50 ±0,02', f(meio), perto(meio, 0.5, 0.02));
    if (v === 20) { const q = new Set(); for (let i = 60; i < fim; i++) q.add(Math.round(y[i] / base * 255)); confere('degraus do envelope (8 bits)', '256 ±4 níveis distintos', String(q.size), perto(q.size, 256, 4)); }
  }
  const s1 = seno12(D, 1000, 2.4);
  const md = novo(Motor); poe(md, 0, s1, { modo: 1, val: 23 }); md.msg({ t: 'toca', i: 0 }); const [fd] = picoEsp(espectro(render(md, 0.5), 480, 16384), FS, 300, 2600);
  confere('som em modo Decay não muda de pitch (tune e decay são alternativos)', '1000 Hz', f(fd, 0) + ' Hz', perto(fd, 1000, 3));
  const mt = novo(Motor); poe(mt, 0, s1, { modo: 0, val: 8 }); mt.msg({ t: 'toca', i: 0 }); const yt = render(mt, 3), q = amp(yt, 1000 * D.razao(8), FS, 139200, 144000) / amp(yt, 1000 * D.razao(8), FS, 4800, 9600);
  confere('som em modo Tune não tem decay (toca até o fim da amostra)', 'mesmo nível no fim', f(dB(q)) + ' dB', perto(dB(q), 0, 0.2));
}

// ===== 6. canais = vozes =====
titulo('canais e vozes');
{
  const a = seno12(D, 500, 1), b = seno12(D, 3000, 1);
  const t = (aloc, cb) => { const m = novo(Motor, FS, { aloc }); poe(m, 0, a, { canal: 6 }); poe(m, 1, b, { canal: cb }); m.msg({ t: 'toca', i: 0 }); render(m, 0.2); m.msg({ t: 'toca', i: 1 }); const y = render(m, 0.3); return [amp(y, 500, FS, 4800, 14400), amp(y, 3000, FS, 4800, 14400)]; };
  const [a1, b1] = t(0, 6), [a2, b2] = t(0, 7), [a3, b3] = t(1, 6);
  confere('dois sons no mesmo canal: o segundo corta o primeiro', '1º calado, 2º soando', `${f(dB(a1), 0)} / ${f(dB(b1), 0)} dB`, a1 < 1e-4 && b1 > 0.1);
  confere('dois sons em canais diferentes soam juntos', 'os dois soando', `${f(dB(a2), 0)} / ${f(dB(b2), 0)} dB`, a2 > 0.1 && b2 > 0.1);
  confere('Dynamic Allocation: canal ocupado manda o som ao canal parceiro', 'os dois soando', `${f(dB(a3), 0)} / ${f(dB(b3), 0)} dB`, a3 > 0.1 && b3 > 0.1);
  const m = novo(Motor); const q = new Int16Array(26040); for (let i = 0; i < q.length; i++) q[i] = i % 260 < 130 ? 2047 : -2048;
  for (let i = 0; i < 8; i++) { poe(m, i, q, { canal: i }); m.msg({ t: 'toca', i }); } const y = render(m, 0.5), p = pico(y);
  confere('pior caso: 8 canais a fundo de escala em fase, volume 10', 'pico < 1 (sem clipping)', f(p, 3), p < 1);
  const mh = novo(Motor, FS, { mixVol: 0.5 }), m1 = novo(Motor); for (const mm of [mh, m1]) { poe(mm, 0, seno12(D, 1000, 1, 0.3)); mm.msg({ t: 'toca', i: 0 }); }
  const dv = dB(amp(render(mh, 0.3), 1000, FS, 4800, 14400) / amp(render(m1, 0.3), 1000, FS, 4800, 14400));
  confere('Mix Volume em 5 em relação a 10', '−6,0 dB', f(dv, 1) + ' dB', perto(dv, -6.02, 0.1));
}

// ===== 7. sequenciador =====
titulo('sequenciador (24 pulsos por semínima)');
{
  const tique = new Int16Array(60).fill(2047);
  const prep = (g = {}) => { const m = novo(Motor, FS, g); poe(m, 0, tique); poe(m, 1, tique, { canal: 6 }); m.msg({ t: 'g', p: { cru: 1 } }); return m; };
  const seg = (evs, o = {}) => Object.assign({ t: 'seg', evs, total: 192, swing: 12, tpc: 96 }, o);
  const semis = Array.from({ length: 32 }, (_, k) => [k * 6, 0, 31, -1]);
  for (const bpm of [120, 94, 240, 40]) {
    const m = prep({ bpm }); m.msg(seg(semis)); m.msg({ t: 'run', on: 1 }); const passo = FS * 60 / bpm / 4, y = render(m, 33 * passo / FS), t = ataques(y, 0.02, Math.min(400, passo / 2)).slice(0, 33);
    let pior = 0; for (let k = 0; k < t.length; k++) pior = Math.max(pior, Math.abs(t[k] - t[0] - k * passo));
    confere(`${bpm} bpm: 33 semicolcheias (inclui a volta do segmento)`, f(passo / FS * 1000, 2) + ' ms cada; erro < 0,1 ms', `${t.length} ataques; pior erro ${f(pior / FS * 1000, 3)} ms`, t.length === 33 && pior <= 4.8);
  }
  const colch = []; for (let b = 0; b < 8; b++) colch.push([b * 24, 0, 31, -1], [b * 24 + 12, 0, 31, -1]);
  D.SWING_TICKS.forEach((s, k) => { const m = prep(); m.msg(seg(colch, { swing: s })); m.msg({ t: 'run', on: 1 }); const t = ataques(render(m, 3.9), 0.02, 400); let pior = 0, prop = 0;
    for (let b = 0; b < 7; b++) { const p = (t[2 * b + 1] - t[2 * b]) / (t[2 * b + 2] - t[2 * b]); prop += p / 7; pior = Math.max(pior, Math.abs(p - s / 24)); }
    confere(`swing ${D.SWING_NOMES[k]} %: posição da 2ª colcheia dentro da semínima`, f(100 * s / 24, 1) + ' % ±0,2', f(100 * prop, 1) + ' %', pior < 0.002 && Math.round(100 * s / 24) === D.SWING_NOMES[k]); });
  { const m = prep(); m.msg(seg(semis, { swing: 16 })); m.msg({ t: 'run', on: 1 }); const t = ataques(render(m, 0.6), 0.02, 400).slice(0, 5).map(v => Math.round((v - 0) / 1000));
    confere('swing 67 % nas semicolcheias (pulsos tocados na 1ª semínima)', '0, 8, 16, 20, 24', t.map(v => v - t[0]).join(', '), t.map(v => v - t[0]).join() === '0,8,16,20,24'); }
  // gravação com Auto Correct
  for (const [ac, nome, esp] of [[6, '1/16', [6, 12]], [12, '1/8', [12, 12]], [1, 'HiRes', [7, 11]]]) {
    const m = prep({ ac }); m.msg(seg([])); m.msg({ t: 'run', on: 1, rec: 1 }); render(m, 7400 / FS); m.msg({ t: 'toca', i: 0, rec: true }); render(m, 3200 / FS); m.msg({ t: 'toca', i: 1, rec: true });
    const y = render(m, (192000 - 10600) / FS + 0.4); m.msg({ t: 'run', on: 0 }); const evs = (m.msgs.filter(x => x.t === 'evs').pop() || { evs: [] }).evs.map(e => e[0]);
    const t2 = ataques(y, 0.02, 300), volta = 192000 - 10600;
    confere(`gravar em 7,4 e 10,6 pulsos com Auto Correct ${nome}`, 'pulsos ' + esp.join(' e '), 'pulsos ' + evs.join(' e '), evs.join() === esp.join());
    if (ac === 6) confere('nota quantizada para adiante não toca duas vezes; na volta toca na grade', 'ataques em 6,0 e 12,0 pulsos da 2ª passada', t2.map(v => f((v - volta) / 1000, 1)).join(' / '), t2.length === 3 && Math.abs(t2[0]) < 100 && perto(t2[1] - volta, 6000, 60) && perto(t2[2] - volta, 12000, 60));
  }
  { const m = prep(); m.msg(seg(semis.slice(0, 16))); m.msg({ t: 'run', on: 1, rec: 1 }); render(m, 0.02); m.msg({ t: 'apg', i: 0, on: 1 }); render(m, 1.8); m.msg({ t: 'apg', i: 0, on: 0 }); render(m, 0.1); m.msg({ t: 'run', on: 0 });
    const evs = m.msgs.filter(x => x.t === 'evs').pop().evs.map(e => e[0]).sort((a, b) => a - b);
    confere('Erase segurado enquanto grava apaga as notas que passam (pulsos 6 a 84)', 'restam 0, 90', evs.join(', '), evs.join() === '0,90'); }
  { const m = prep({ ac: 12 }); m.msg(seg([])); m.msg({ t: 'run', on: 1 }); m.msg({ t: 'rep', i: 0, on: 1 }); const t = ataques(render(m, 1.01), 0.02, 400);
    confere('Tap/Repeat segurado repete na taxa do Auto Correct (1/8 a 120 bpm)', '250 ms', f((t[t.length - 1] - t[0]) / (t.length - 1) / FS * 1000, 1) + ' ms', t.length === 5 && perto((t[4] - t[0]) / 4, 12000, 3)); }
  { const m = novo(Motor, FS, { metro: 24 }); m.msg(seg([])); m.msg({ t: 'run', on: 1, rec: 1 }); const y = render(m, 2.2), t = ataques(y, 0.004, 4000);
    const m0 = novo(Motor, FS, { metro: 24, metVol: 0 }); m0.msg(seg([])); m0.msg({ t: 'run', on: 1, rec: 1 }); const z = pico(render(m0, 1));
    const m1 = novo(Motor, FS, { metro: 24 }); m1.msg(seg([])); m1.msg({ t: 'run', on: 1 }); const z1 = pico(render(m1, 1));
    confere('metrônomo em 1/4 durante a gravação', 'clique a cada 500 ms', `${t.length} cliques, ${f((t[4] - t[0]) / 4 / FS * 1000, 1)} ms`, t.length === 5 && perto((t[4] - t[0]) / 4, 24000, 30));
    confere('Metronome Volume em 0 cala o clique; sem gravar não há clique', 'silêncio / silêncio', f(dB(z), 0) + ' / ' + f(dB(z1), 0) + ' dB', z < 1e-6 && z1 < 1e-6); }
  { const m = prep(); m.msg(seg([[0, 0, 31, -1]], { total: 96 })); m.msg({ t: 'run', on: 1 }); m.msg({ t: 'prox', seg: { evs: [[48, 0, 31, -1]], total: 96, swing: 12, tpc: 96 } }); render(m, 0.1); const y1 = render(m, 2.0);
    m.msg({ t: 'prox', para: true }); const y2 = render(m, 2.5), t = ataques(y1, 0.02, 400).concat(ataques(y2, 0.02, 400).map(v => v + 96000));
    confere('song: encadeia o segmento seguinte na virada e para no fim', 'ataque em 3,0 s, depois "parou"', t.map(v => f((v + 4800) / FS, 2) + ' s').join(', ') + (m.msgs.some(x => x.t === 'parou') ? ', parou' : ''), t.length === 1 && perto(t[0] + 4800, 144000, 60) && m.msgs.some(x => x.t === 'parou') && !m.rod); }
  { const m = prep(); m.msg(seg([], { livres: 1 })); m.msg({ t: 'run', on: 1, rec: 1 }); render(m, 0.1); m.msg({ t: 'toca', i: 0, rec: true }); render(m, 0.2); m.msg({ t: 'toca', i: 1, rec: true }); render(m, 0.1);
    confere('memória de notas cheia recusa gravar', 'aviso "cheio", 1 nota', (m.msgs.some(x => x.t === 'cheio') ? 'aviso, ' : 'sem aviso, ') + m.seg.evs.length + ' nota(s)', m.msgs.some(x => x.t === 'cheio') && m.seg.evs.length === 1 && D.MAX_NOTAS === 5000); }
}

// ===== 8. kit de exemplo e nível do padrão inicial =====
titulo('kit sintetizado e nível de saída do padrão inicial');
{
  const kit = D.kitSintetico(), conv = kit.map(k => D.converte(k.x, k.fs)); const totA = conv.slice(0, 8).reduce((a, d) => a + d.length, 0);
  confere('kit: 9 sons, todos com sinal', 'pico ≥ 30 % do fundo de escala', conv.map(d => Math.round(100 * d.reduce((a, v) => Math.max(a, Math.abs(v)), 0) / 2047)).join(' ') + ' %', conv.length === 9 && conv.every(d => d.reduce((a, v) => Math.max(a, Math.abs(v)), 0) > 0.3 * 2047));
  confere('kit: banco A cabe em 2,5 s', '≤ 65100 amostras', String(totA), totA <= D.ZONA);
  const m = novo(Motor, FS, { bpm: 94, mixVol: 0.8 }); conv.forEach((d, i) => poe(m, i, d, { modo: kit[i].modo, val: kit[i].val, canal: kit[i].canal, nivel: 24 }));
  const evs = [], p = (som, passos, vel = 31) => passos.forEach(x => evs.push([x * 6, som, vel, -1]));   // o mesmo segmento de exemplo da página
  p(0, [0, 7, 10, 16, 23, 26]); p(1, [4, 12, 20, 28]); p(2, [0, 2, 4, 6, 8, 10, 12, 16, 18, 20, 22, 24, 26, 28]); p(3, [14, 30]); p(2, [11, 27], 14);
  m.msg({ t: 'seg', evs, total: 192, swing: 12, tpc: 96 }); m.msg({ t: 'run', on: 1 }); const y = render(m, 10.3), pk = dB(pico(y));
  confere('padrão inicial (volume 8, níveis 24): pico', 'entre −12 e −3 dBFS', f(pk, 1) + ' dBFS', pk >= -12 && pk <= -3);
  confere('padrão inicial: valor eficaz (informativo)', '—', f(dB(rms(y)), 1) + ' dBFS', true);
}

const w = [4, Math.max(...linhas.map(l => l[1].length)), Math.max(...linhas.map(l => l[2].length))];
for (const l of linhas) console.log(l[0].padEnd(w[0]) + '  ' + l[1].padEnd(w[1]) + '  ' + l[2].padEnd(w[2]) + '  ' + l[3]);
console.log(fora ? `\n${fora} medida(s) FORA da tolerância` : '\nTodas as medidas dentro da tolerância');
process.exit(fora ? 1 : 0);
