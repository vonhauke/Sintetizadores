// Carrega cz101/index.html num Chrome sem janela (protocolo DevTools, sem dependências) e confere: erros no console,
// motor como AudioWorklet em file://, som do teclado, cada botão do painel, roda, volume, POWER, memória, salvamento,
// sequenciador, aleatório, Hold, Zerar, MIDI learn com MIDI substituto e tamanho dos alvos de toque.
// Uso: node tests/medicao/cz101/navegador.mjs [pasta-das-capturas]   (precisa do Google Chrome; sai com código 1 se algo falhar)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const URL_PAGINA = pathToFileURL(join(raiz, 'cz101', 'index.html')).href;
const SAIDA = process.argv[2] || tmpdir(); mkdirSync(SAIDA, { recursive: true });
const CAMINHOS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const chrome = process.env.CHROME || CAMINHOS.find(existsSync);
if (!chrome) { console.log('Google Chrome não encontrado (use a variável CHROME).'); process.exit(2); }
const PORTA = 9300 + Math.floor(Math.random() * 500), perfil = mkdtempSync(join(tmpdir(), 'cz101-chrome-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const espera = ms => new Promise(r => setTimeout(r, ms));
const falhas = []; const confere = (nome, ok, det = '') => { console.log((ok ? 'ok   ' : 'FORA ') + nome + (det !== '' ? ' — ' + det : '')); if (!ok) falhas.push(nome); };

async function conecta() {
  for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORTA}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {} await espera(250); }
  throw new Error('Chrome não respondeu');
}
const GANCHO = `(() => { const orig = AudioNode.prototype.connect; window.__tap = { nos: 0, sp: 0 };
  AudioNode.prototype.connect = function (dest, ...r) {
    if (window.AudioWorkletNode && this instanceof AudioWorkletNode && !window.__an) { window.__tap.nos++; const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an); window.__an = an; }
    if (window.ScriptProcessorNode && this instanceof ScriptProcessorNode) window.__tap.sp++;
    return orig.call(this, dest, ...r); };
  window.__rms = () => { if (!window.__an) return -1; const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
})();`;

try {
  const ws = new WebSocket(await conecta()); await new Promise(r => ws.addEventListener('open', r));
  let n = 0; const pend = new Map(), eventos = [], logs = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) { eventos.push(m); if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ')); if (m.method === 'Runtime.exceptionThrown') logs.push('ERRO: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); } });
  const cdp = (method, params = {}) => new Promise(r => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erro em evaluate'); return r.result.result.value; };
  const rect = async sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  const mouse = (type, x, y) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  const clica = async (sel, fx = 0.5, fy = 0.5) => { const r = await rect(sel); if (!r) throw new Error('sem elemento ' + sel); const x = r.x + r.w * fx, y = r.y + r.h * fy; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await espera(40); };
  const st = () => ev('JSON.stringify(window.__cz.st)').then(JSON.parse);
  const rmsMax = async (n = 8, dt = 60) => { let m = 0; for (let i = 0; i < n; i++) { m = Math.max(m, await ev('window.__rms()')); await espera(dt); } return m; };   // o batimento entre linhas desafinadas pode zerar uma janela isolada
  const B = id => `[data-id="${id}"]`;
  const lcd = () => ev("document.getElementById('lcd').innerText.replace(/\\n/g,' | ')");

  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: GANCHO });
  await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200);
  await ev("localStorage.clear()"); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200);

  /* ---- 1. carga, painel, marca ---- */
  confere('título da página', (await ev('document.title')) === 'Clone do Casio CZ-101');
  const txt = (await ev("document.querySelector('.gabinete').innerText")).toLowerCase();
  confere('painel sem marca nem nome de modelo', !['casio', 'cz-101', 'cz101'].some(x => txt.includes(x)));
  confere('51 botões, 49 teclas, 1 visor', (await ev("[document.querySelectorAll('.bt').length, document.querySelectorAll('#teclado [data-n]').length, document.querySelectorAll('#lcd').length].join()")) === '51,49,1');
  const alvos = await ev(`[...document.querySelectorAll('.bt, .bp, select, input[type=number], .power')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).map(e => e.id || e.dataset.id || e.className)`);
  confere('alvos de toque de 44 px ou mais', alvos.length === 0, alvos.join(','));
  confere('sem URLs externas na página', !/(https?:)?\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}\//i.test(await ev("document.documentElement.outerHTML.replace(/<script type=\"text\\/plain\" id=\"dsp\">[\\s\\S]*?<\\/script>/, '').replace(/https?:\\/\\/www\\.w3\\.org[^\"']*/g, '')")));

  /* ---- 2. som: tecla da tela, teclado do computador ---- */
  await clica('#teclado [data-n="60"]', 0.5, 0.85);   // o clique já é um gesto: desbloqueia o áudio
  for (let i = 0; i < 40 && !(await ev("window.__cz.audio.pronto")); i++) await espera(150);   // o motor carrega depois do primeiro gesto
  await espera(300);
  const k = await rect('#teclado [data-n="60"]'); await mouse('mousePressed', k.x + k.w / 2, k.y + k.h * 0.85); await espera(700);
    const r1 = await rmsMax(), tap = await ev('window.__tap'); await mouse('mouseReleased', k.x + k.w / 2, k.y + k.h * 0.85); await espera(2200); const r2 = await ev('window.__rms()');
  confere('motor carregado como AudioWorklet em file:// (sem cair na reserva)', tap.nos === 1 && tap.sp === 0, JSON.stringify(tap));
  confere('tecla da tela produz som', r1 > 0.003, r1.toFixed(4)); confere('som para depois de soltar', r2 < r1 * 0.2, r2.toFixed(5));
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', text: 'a' }); const r3 = await rmsMax(); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA' });
  confere('teclado do computador produz som', r3 > 0.003, r3.toFixed(4));
  await espera(1800);
  /* polifonia: 8 notas juntas, o som continua finito e sem estourar */
  await ev("for (const n of [48, 52, 55, 60, 64, 67, 72, 76]) window.__cz.nota(n, true)"); await espera(600);
  const rp = await ev(`(() => { const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let p = 0; for (const v of b) p = Math.max(p, Math.abs(v)); return p; })()`);
  confere('8 notas juntas: som presente, finito e dentro de ±1', rp > 0.01 && rp <= 1 && isFinite(rp), rp.toFixed(3));
  await ev("for (const n of [48, 52, 55, 60, 64, 67, 72, 76]) window.__cz.nota(n, false)"); await espera(300);

  /* ---- 3. cada botão, um a um (cliques reais) ---- */
  let s = await st();
  const cada = async (id, esperado, descr, antes) => { if (antes) await antes(); const bef = await st(); await clica(B(id)); const aft = await st(); const v = await esperado(bef, aft); confere(`botão ${id}: ${descr}`, v === true, v === true ? '' : String(v)); };
  await cada('internal', (a, d) => d.banco === 'int', 'escolhe o banco INTERNAL'); await cada('cart', (a, d) => d.banco === 'car', 'escolhe o banco CARTRIDGE'); await cada('preset', (a, d) => d.banco === 'pre', 'escolhe o banco PRESET');
  for (let i = 1; i <= 8; i++) await cada('n' + i, (a, d) => d.slot === i - 1, `escolhe o timbre ${i}`);
  await cada('select', (a, d) => d.meia === 1 && a.meia === 0, 'alterna 1–8 e 9–16'); await cada('n3', (a, d) => d.slot === 10, 'escolhe o timbre 11 na segunda metade'); await cada('select', (a, d) => d.meia === 0, 'volta à primeira metade'); await clica(B('n1'));
  await cada('vib', (a, d) => d.tela.id === 'vib', 'abre a tela do vibrato');
  await cada('valUp', (a, d) => d.tom.vib.w === a.tom.vib.w + 1, 'VALUE △ aumenta o campo'); await cada('valDn', (a, d) => d.tom.vib.w === a.tom.vib.w - 1, 'VALUE ▽ diminui o campo');
  await cada('curR', (a, d) => d.campo === 1, 'CURSOR ▷ vai ao campo seguinte'); await cada('curL', (a, d) => d.campo === 0, 'CURSOR ◁ volta ao campo anterior');
  await cada('compare', (a, d) => a.mod === true && d.cmp === true, 'COMPARE/RECALL mostra o original', async () => { await clica(B('valUp')); }); await cada('compare', (a, d) => d.cmp === false, 'COMPARE/RECALL volta ao editado');
  await cada('oct', (a, d) => d.tela.id === 'octave', 'abre a tela OCTAVE'); await cada('valUp', (a, d) => d.tom.oct === 1, 'OCTAVE +1');
  await cada('detune', (a, d) => d.tela.id === 'detune', 'abre a tela DETUNE'); await cada('curR', (a, d) => d.campo === 1, 'CURSOR no campo OCT do DETUNE'); await cada('valUp', (a, d) => d.tom.det.o === 1, 'DETUNE OCT +1');
  for (const l of [1, 2]) {
    await cada(`dco${l}w`, (a, d) => d.tela.id === 'wave' && d.linha === l - 1, `DCO ${l} WAVE FORM abre a tela de forma de onda da linha ${l}`); await cada('valUp', (a, d) => d.tom.lines[l - 1].w[0] === Math.min(8, a.tom.lines[l - 1].w[0] + 1) || a.tom.lines[l - 1].w[0] === 8, 'VALUE muda a forma de onda');
    for (const [k, nome] of [['dco', 'pitch'], ['dcw', 'wave'], ['dca', 'amp']]) await cada(`${k}${l}e`, (a, d) => d.tela.id === 'env' && d.tela.kind === k && d.linha === l - 1, `${k.toUpperCase()} ${l} ENV abre o envelope de ${nome}`);
    await cada(`dcw${l}k`, (a, d) => d.tela.id === 'kf' && d.tela.kind === 'dcw', `DCW ${l} KEY FOLLOW`); await cada(`dca${l}k`, (a, d) => d.tela.id === 'kf' && d.tela.kind === 'dca', `DCA ${l} KEY FOLLOW`);
  }
  await clica(B('dcw1e')); await cada('envUp', (a, d) => d.passo === a.passo + 1, 'ENV STEP △ avança o passo'); await cada('envDn', (a, d) => d.passo === a.passo - 1, 'ENV STEP ▽ volta o passo');
  await cada('sus', (a, d) => d.tom.lines[0].dcw.sus === a.passo || d.tom.lines[0].dcw.sus === -1, 'SUSTAIN marca o ponto de sustain', async () => { await clica(B('envUp')); await clica(B('envDn')); });
  await cada('fim', (a, d) => d.tom.lines[0].dcw.fim === a.passo, 'END marca o fim do envelope');
  await cada('init', (a, d) => d.tom.lines[0].dcw.fim === 1 && d.tom.lines[0].dcw.p[0][0] === 99, 'INITIALIZE restaura o envelope');
  await cada('linesel', (a, d) => d.tom.lineSel === (a.tom.lineSel + 1) % 4, 'LINE SELECT passa à próxima combinação');
  await clica(B('linesel')); await clica(B('linesel')); s = await st(); if (s.tom.lineSel < 2) { await clica(B('linesel')); await clica(B('linesel')); }
  await cada('ring', (a, d) => d.tom.ring === 1 && d.tom.noise === 0, 'RING liga (com duas linhas)', async () => { let q = await st(); while (q.tom.lineSel < 2) { await clica(B('linesel')); q = await st(); } });
  await cada('noise', (a, d) => d.tom.noise === 1 && d.tom.ring === 0, 'NOISE liga e desliga o RING');
  await cada('solo', (a, d) => d.g.solo === 1, 'SOLO liga'); await cada('mix', (a, d) => d.g.mix === 1 && d.g.solo === 0, 'TONE MIX liga e desliga o SOLO'); await cada('mix', (a, d) => d.g.mix === 0, 'TONE MIX desliga');
  await cada('portOn', (a, d) => d.g.portOn === 1, 'PORTAMENTO ON/OFF liga'); await cada('portT', (a, d) => d.tela.id === 'port', 'PORTAMENTO TIME abre a tela'); await cada('valUp', (a, d) => d.g.portTime === a.g.portTime + 1, 'portamento TIME +1');
  await cada('bend', (a, d) => d.tela.id === 'bend', 'BEND RANGE abre a tela'); await cada('valUp', (a, d) => d.g.bendRange === a.g.bendRange + 1, 'BEND RANGE +1');
  await cada('transp', (a, d) => d.tela.id === 'transp', 'KEY TRANSPOSE abre a tela'); await cada('valUp', (a, d) => d.g.transp === a.g.transp + 1, 'KEY TRANSPOSE +1');
  await cada('midi', (a, d) => d.tela.id === 'midi', 'MIDI abre a tela'); await cada('curR', (a, d) => d.campo === 1, 'CURSOR vai ao Program Change'); await cada('valUp', (a, d) => d.midi.pc !== a.midi.pc, 'Program Change ENA/DIS alterna');
  await cada('vibOn', (a, d) => d.g.vibOn !== a.g.vibOn, 'VIBRATO ON/OFF alterna');
  await cada('mUp', (a, d) => d.g.master === a.g.master + 5, 'MASTER TUNE △ +5 cents'); await cada('mDn', (a, d) => d.g.master === a.g.master - 5, 'MASTER TUNE ▽ −5 cents');
  await clica(B('internal')); await clica(B('n5'));
  await cada('write', (a, d) => d.escreve === true, 'WRITE arma a gravação'); await cada('n7', (a, d) => d.mem.int[6].nome === a.tom.nome, 'WRITE + 7 grava no INTERNAL 7');
  await cada('write', (a, d) => d.escreve === true, 'WRITE arma de novo'); await cada('valDn', (a, d) => d.mem.car[0].nome === d.mem.int[0].nome, 'WRITE + ▽ (SAVE) copia o banco interno para o cartucho');

  /* ---- 4. roda, volume, POWER ---- */
  const rv = await rect('#vol'); await mouse('mousePressed', rv.x + rv.w / 2, rv.y + rv.h * 0.5); await mouse('mouseMoved', rv.x + rv.w / 2, rv.y + rv.h * 0.2); await mouse('mouseReleased', rv.x + rv.w / 2, rv.y + rv.h * 0.2);
  s = await st(); confere('slider VOLUME acompanha o arrasto', s.vol > 0.6 && s.vol < 0.95, s.vol);
  const rr = await rect('#roda'); await mouse('mousePressed', rr.x + rr.w / 2, rr.y + rr.h * 0.5); await mouse('mouseMoved', rr.x + rr.w / 2, rr.y + rr.h * 0.1); s = await st(); const alto = s.bend; await mouse('mouseReleased', rr.x + rr.w / 2, rr.y + rr.h * 0.1); await espera(30); s = await st();
  confere('roda de pitch bend sobe e volta ao centro ao soltar', alto > 0.5 && s.bend === 0, `${alto} → ${s.bend}`);
  await clica('#power'); s = await st(); confere('POWER desliga e apaga o visor', s.ligado === false && (await ev("document.getElementById('lcd').classList.contains('apagado')")));
  await clica('#power'); s = await st(); confere('POWER liga de novo', s.ligado === true);

  /* ---- 5. salvamento: recarrega e confere ---- */
  await espera(500); const antes = await st(); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200); const depois = await st();
  confere('salvamento automático: memórias, parâmetros e volume voltam depois de recarregar', depois.mem.int[6].nome === antes.mem.int[6].nome && depois.g.transp === antes.g.transp && depois.vol === antes.vol && depois.banco === antes.banco, `${depois.banco} ${depois.vol}`);

  /* ---- 6. acessórios ---- */
  const a0 = await ev("[...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')"); await clica('#seq-aleat'); const a1 = await ev("[...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')");
  confere('Aleatório muda a sequência', a0 !== a1, a1);
  await clica('#seq-play'); await espera(800); const r4 = await rmsMax(12, 60); const acesos = await ev("document.querySelectorAll('.passo.agora').length");
  confere('Play: o sequenciador toca e acende um passo', r4 > 0.002 && acesos === 1, `${r4.toFixed(4)}, ${acesos} passo(s)`); await clica('#seq-play'); await espera(2500);
  confere('Stop silencia', (await ev('window.__rms()')) < 0.0015);
  await clica(B('preset')); await clica(B('n1')); await clica('#hold'); await ev("window.__cz.nota(60, true); window.__cz.nota(60, false)"); await espera(300); const rh = await rmsMax(); await clica('#hold'); await espera(2500); const rh2 = await ev('window.__rms()');
  confere('Hold mantém o som depois de soltar e solta ao desligar', rh > 0.003 && rh2 < rh * 0.2, `${rh.toFixed(4)} → ${rh2.toFixed(5)}`);
  await clica('#zerar'); await clica('#zerar'); s = await st(); confere('Zerar (dois toques) volta ao padrão e mantém as memórias', s.g.transp === 0 && s.banco === 'pre' && s.mem.int[6].nome === antes.mem.int[6].nome);

  /* ---- 7. MIDI learn com MIDI substituto ---- */
  await ev(`(() => { const mk = (id, name) => ({ id, name, onmidimessage: null }); const i1 = mk('a', 'Controlador'); const acc = { inputs: new Map([['a', i1]]), onstatechange: null }; window.__i1 = i1; navigator.requestMIDIAccess = () => Promise.resolve(acc); })()`);
  await clica('#midi-ativar'); await espera(150); const sel = await ev("document.getElementById('midi-entrada').options.length"); confere('MIDI substituto: entrada listada', sel === 2, sel);
  await clica('#midi-aprende'); await clica('#vol'); await ev("window.__i1.onmidimessage({ data: [0xB0, 74, 20] })"); await clica('#midi-aprende');
  await ev("window.__i1.onmidimessage({ data: [0xB0, 74, 127] })"); s = await st(); confere('MIDI learn: o CC ligado move o volume na faixa inteira', s.vol === 1, s.vol);
  await ev("window.__i1.onmidimessage({ data: [0x90, 64, 100] })"); await espera(150); const rm = await rmsMax(); await ev("window.__i1.onmidimessage({ data: [0x80, 64, 0] })");
  confere('nota MIDI soa', rm > 0.003, rm.toFixed(4)); await espera(2000);
  await ev("window.scrollTo(0, 0); document.querySelector('.rolagem').scrollLeft = 0"); await espera(150);
  await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 960, height: 700, scale: 1 } }).then(r => writeFileSync(join(SAIDA, 'cz101-esquerda.png'), Buffer.from(r.result.data, 'base64')));
  await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 900, y: 0, width: 1020, height: 700, scale: 1 } }).then(r => writeFileSync(join(SAIDA, 'cz101-direita.png'), Buffer.from(r.result.data, 'base64')));

  /* ---- 8. celular ---- */
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }); await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1000);
  const cel = await ev(`({ larg: innerWidth, rolaPagina: document.documentElement.scrollWidth > innerWidth + 1, pequenos: [...document.querySelectorAll('.bt, .bp, select, input[type=number], .power')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).length, barra: !document.getElementById('audio-bar').hidden })`);
  confere('celular (375 px): sem rolagem horizontal da página, alvos de 44 px e aviso de som desligado', !cel.rolaPagina && cel.pequenos === 0 && cel.barra, JSON.stringify(cel));
  confere('sem erros no console', !logs.some(l => /^(error|ERRO)/i.test(l)), logs.filter(l => /^(error|ERRO)/i.test(l)).join(' | '));
  ws.close();
} finally { proc.kill(); }
console.log(`\n${falhas.length} falha(s).`); process.exit(falhas.length ? 1 : 0);
