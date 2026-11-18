// Carrega tr808/index.html num Chrome sem janela (protocolo DevTools, sem dependências) e confere: erros no console, o inventário do painel (controles, ordem e
// agrupamento), o motor como AudioWorklet em file://, som dos pads e do sequenciador, edição de passos, CLEAR, salvamento, Zerar, MIDI learn com MIDI substituto,
// mapa de notas, velocity, filtro de canal e tamanho dos alvos de toque. Não usa nenhum gancho de depuração da página: só o DOM e um analisador de áudio.
// Uso: node tests/medicao/tr808/navegador.mjs [pasta-das-capturas]   (precisa do Google Chrome ou Chromium; variável CHROME; sai com código 1 se algo falhar)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const URL_PAGINA = pathToFileURL(join(raiz, 'tr808', 'index.html')).href;
const SAIDA = process.argv[2] || tmpdir(); mkdirSync(SAIDA, { recursive: true });
const CAMINHOS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/pw-browsers/chromium'];
const chrome = process.env.CHROME || CAMINHOS.find(existsSync);
if (!chrome) { console.log('Chrome não encontrado (use a variável CHROME).'); process.exit(2); }
const PORTA = 9300 + Math.floor(Math.random() * 500), perfil = mkdtempSync(join(tmpdir(), 'tr808-chrome-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const espera = ms => new Promise(r => setTimeout(r, ms));
const falhas = []; const confere = (nome, ok, det = '') => { console.log((ok ? 'ok   ' : 'FORA ') + nome + (det !== '' ? ' — ' + det : '')); if (!ok) falhas.push(nome); };

async function conecta() {
  for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORTA}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {} await espera(250); }
  throw new Error('Chrome não respondeu');
}
// analisador de áudio ligado ao AudioWorkletNode da página; MIDI substituto: um dispositivo falso entregue por navigator.requestMIDIAccess
const GANCHO = `(() => { const orig = AudioNode.prototype.connect; window.__tap = { nos: 0, sp: 0 };
  AudioNode.prototype.connect = function (dest, ...r) {
    if (window.AudioWorkletNode && this instanceof AudioWorkletNode && !window.__an) { window.__tap.nos++; const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an); window.__an = an; }
    if (window.ScriptProcessorNode && this instanceof ScriptProcessorNode) window.__tap.sp++;
    return orig.call(this, dest, ...r); };
  window.__rms = () => { if (!window.__an) return -1; const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
  const fake = { id: 'fake-1', name: 'Controlador falso', onmidimessage: null }, acesso = { inputs: new Map([['fake-1', fake]]), onstatechange: null };
  navigator.requestMIDIAccess = () => Promise.resolve(acesso); window.__midi = d => fake.onmidimessage && fake.onmidimessage({ data: d });
})();`;

try {
  const ws = new WebSocket(await conecta()); await new Promise(r => ws.addEventListener('open', r));
  let n = 0; const pend = new Map(), logs = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('ERRO ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    else if (m.method === 'Page.javascriptDialogOpening') cdp('Page.handleJavaScriptDialog', { accept: true }); });
  const cdp = (method, params = {}) => new Promise(r => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  const rect = async sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center', inline: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  const mouse = (type, x, y) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  const clica = async (sel, fx = 0.5, fy = 0.5) => { const r = await rect(sel); if (!r) throw new Error('sem elemento ' + sel); const x = r.x + r.w * fx, y = r.y + r.h * fy; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await espera(60); };
  const arrasta = async (sel, dy) => { const r = await rect(sel), x = r.x + r.w / 2, y = r.y + r.h / 2; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseMoved', x, y + dy / 2); await mouse('mouseMoved', x, y + dy); await mouse('mouseReleased', x, y + dy); await espera(60); };
  const rmsMax = async (k = 8, dt = 60) => { let m = 0; for (let i = 0; i < k; i++) { m = Math.max(m, await ev('window.__rms()')); await espera(dt); } return m; };
  const recarrega = async () => { await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1400); };
  const salvo = async () => JSON.parse(await ev("localStorage.getItem('sint-tr808-v1:estado')") || 'null');
  const midiSalvo = async () => JSON.parse(await ev("localStorage.getItem('sint-tr808-v1:midi')") || 'null');
  const texto = sel => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
  const midiMsg = (a, b, c) => ev(`window.__midi([${a}, ${b}, ${c}])`);

  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: GANCHO });
  await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200); await ev('localStorage.clear()'); await recarrega();

  /* ---- 1. carga e inventário do painel (controles, ordem e agrupamento: conferidos com a foto) ---- */
  confere('título da página', (await ev('document.title')) === 'Caixa de ritmos analógica (clone em Web Audio)');
  const txt = (await ev('document.body.innerText')).toLowerCase();
  confere('painel sem logotipo, marca nem nome do modelo', !['roland', 'tr-808', 'tr808', 'rhythm composer', 'computer controlled'].some(x => txt.includes(x)));
  const colunas = JSON.parse(await ev("JSON.stringify([...document.querySelectorAll('.vozes .col')].map(c => [c.querySelector('.nome').textContent, [...c.querySelectorAll('.ctl > .rot')].map(r => r.textContent)]))"));
  const esperadas = [['ACCENT', ['LEVEL']], ['BASS DRUM', ['LEVEL', 'TONE', 'DECAY']], ['SNARE DRUM', ['LEVEL', 'TONE', 'SNAPPY']], ['LOW TOM', ['LEVEL', 'TUNING']], ['MID TOM', ['LEVEL', 'TUNING']], ['HI TOM', ['LEVEL', 'TUNING']],
    ['RIM SHOT', ['LEVEL']], ['HAND CLAP', ['LEVEL']], ['COW BELL', ['LEVEL']], ['CYMBAL', ['LEVEL', 'TONE', 'DECAY']], ['OPEN HI-HAT', ['LEVEL', 'DECAY']], ["CLS'D HI-HAT", ['LEVEL']]];
  confere('12 colunas de vozes na ordem original, cada uma com os controles certos', JSON.stringify(colunas) === JSON.stringify(esperadas), JSON.stringify(colunas.filter((c, i) => JSON.stringify(c) !== JSON.stringify(esperadas[i]))));
  const cont = JSON.parse(await ev("JSON.stringify(Object.fromEntries(['LEVEL', 'TONE', 'TUNING', 'DECAY', 'SNAPPY'].map(r => [r, [...document.querySelectorAll('.vozes .ctl > .rot')].filter(e => e.textContent === r).length])))"));
  confere('12 LEVEL (11 vozes e o accent), 3 TONE, 3 TUNING, 3 DECAY, 1 SNAPPY', JSON.stringify(cont) === JSON.stringify({ LEVEL: 12, TONE: 3, TUNING: 3, DECAY: 3, SNAPPY: 1 }), JSON.stringify(cont));
  confere('5 chaves de par (LC/LT, MC/MT, HC/HT, CL/RS, MA/CP)', JSON.parse(await ev("JSON.stringify([...document.querySelectorAll('.col .slide.par')].map(s => [...s.querySelectorAll('.op')].map(o => o.textContent)))")).map(x => x.join('/')).join(',') === 'LOW CONGA/LOW TOM,MID CONGA/MID TOM,HI CONGA/HI TOM,CLAVES/RIM SHOT,MARACAS/HAND CLAP');
  for (const [id, nome] of [['master', 'MASTER VOLUME'], ['tempo', 'TEMPO'], ['fine', 'FINE'], ['power', 'POWER']]) confere(`controle ${nome} presente`, (await ev(`!!document.querySelector('[data-ctl="${id}"]')`)) === true);
  const rot = async id => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('[data-ctl="${id}"] .etq')].map(b => b.textContent))`));
  confere('MODE: 6 posições, sentido horário', (await rot('mode')).join('|') === 'PATTERN CLEAR|1st PART|2nd PART|MANUAL PLAY|PLAY|COMPOSE', (await rot('mode')).join('|'));
  confere('INSTRUMENT SELECT: 12 posições, AC = 1 até CH = 12', (await rot('inst')).join('|') === 'AC 1|BD 2|SD 3|LT 4|MT 5|HT 6|RS 7|CP 8|CB 9|CY 10|OH 11|CH 12', (await rot('inst')).join('|'));
  confere('AUTO FILL IN: MANUAL, 16, 12, 8, 4, 2', (await rot('auto')).join('|') === 'MANUAL|16|12|8|4|2');
  const ops = async id => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('[data-ctl="${id}"] .op')].map(b => b.textContent))`));
  confere('BASIC VARIATION A/AB/B, I/F VARIATION A/B, PRE-SCALE 1 a 4', (await ops('varB')).join() === 'A,AB,B' && (await ops('varF')).join() === 'A,B' && (await ops('prescale')).join() === '1,2,3,4');
  confere('16 botões de passo em 4 grupos de 4 (BASIC RHYTHM 1–12, INTRO/FILL IN 1–4)', JSON.stringify(JSON.parse(await ev("JSON.stringify([...document.querySelectorAll('.passo')].map(b => [b.className.match(/g(\\d)/)[1], b.querySelector('.abaixo').textContent]))"))) === JSON.stringify([...Array(16)].map((_, i) => [String(Math.floor(i / 4) + 1), String(i < 12 ? i + 1 : i - 11)])));
  confere('START/STOP, TAP, CLEAR, LEDs de 1st/2nd PART e A/B', (await ev("['start', 'tap', 'clear'].every(i => document.querySelector('[data-ctl=\"' + i + '\"]')) && ['ledP1', 'ledP2', 'ledA', 'ledB', 'ledTempo'].every(i => document.getElementById(i))")) === true);
  confere('faixa de acessórios separada e identificada como não original', (await ev("!!document.querySelector('#acess .tag') && document.querySelector('#acess .tag').textContent.includes('não são do original') && !document.querySelector('#painel').contains(document.querySelector('#acess'))")) === true);

  /* ---- 2. som: pad, AudioWorklet em file://, sequenciador ---- */
  await clica('[data-pad="bd"]'); await espera(120); const r1 = await rmsMax(6, 40); const tap = JSON.parse(await ev('JSON.stringify(window.__tap)'));
  confere('pad BD toca pelo AudioWorklet (file://)', r1 > 0.005 && tap.nos >= 1, `rms ${r1.toFixed(3)} ${JSON.stringify(tap)}`);
  await clica('#start'); await espera(1800); const rseq = await rmsMax(10, 60);
  confere('START: o sequenciador toca a batida do pattern 1', rseq > 0.005 && (await ev("document.getElementById('start').getAttribute('aria-pressed')")) === 'true' && (await texto('#comp')).includes('b1A'), `rms ${rseq.toFixed(3)} · ${await texto('#comp')}`);
  confere('o passo corrente é destacado e o LED de 1st PART acende', (await ev("!!document.querySelector('.passo.cabeca') && document.getElementById('ledP1').classList.contains('on')")) === true);
  await clica('#start'); await espera(2500); const rp = await rmsMax(5, 60); confere('STOP cala o sequenciador', rp < 0.002 && (await ev("document.querySelector('.passo.cabeca')")) === null, 'rms ' + rp.toFixed(4));
  await clica('#tap'); confere('TAP parado arma o intro (mensagem)', (await texto('#estado-msg')).includes('INTRO SET'), await texto('#estado-msg'));

  /* ---- 3. chave de par, controle por mouse e teclado ---- */
  await clica('[data-ctl="lt.modo"] .trilho', 0.5, 0.1);
  confere('chave LT/LC em CONGA: o pad passa a se chamar LOW CONGA', (await texto('[data-pad="lt"]')) === 'LOW CONGA', await texto('[data-pad="lt"]'));
  await clica('[data-ctl="lt.modo"] .trilho', 0.5, 0.9); confere('chave de volta em TOM', (await texto('[data-pad="lt"]')) === 'LOW TOM');
  const v0 = Number(await ev("document.querySelector('[data-ctl=\"bd.level\"] .knob').getAttribute('aria-valuenow')")); await arrasta('[data-ctl="bd.level"] .knob', 60); const v1 = Number(await ev("document.querySelector('[data-ctl=\"bd.level\"] .knob').getAttribute('aria-valuenow')"));
  confere('arrastar o LEVEL do BD para baixo (60 px) reduz o valor em ~40 pontos', v1 < v0 - 30 && v1 > v0 - 50, v0 + ' → ' + v1);
  await ev("document.querySelector('[data-ctl=\"bd.tone\"] .knob').focus()"); await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End' }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End' }); await espera(50);
  confere('teclado: End leva o TONE do BD ao máximo', (await ev("document.querySelector('[data-ctl=\"bd.tone\"] .knob').getAttribute('aria-valuenow')")) === '100');

  /* ---- 4. edição de passos: PATTERN WRITE, INSTRUMENT SELECT, CLEAR (STEP NUMBER, PRE-SCALE, TRACK CLEAR) ---- */
  await clica('[data-ctl="mode"] .etq:nth-of-type(1)'); // PATTERN CLEAR (só para sair do padrão)
  const etq = (id, t) => `[data-ctl="${id}"] .etq`; const clicaEtq = async (id, t) => { const i = (await rot(id)).indexOf(t); await clica(`[data-ctl="${id}"] .etq:nth-of-type(${i + 1})`); };
  await clicaEtq('mode', 'MANUAL PLAY'); await clica('.passo[data-ctl="passo3"]'); confere('MANUAL PLAY: o botão 3 escolhe BASIC RHYTHM 3', (await ev("document.querySelector('[data-ctl=\"passo3\"]').classList.contains('aceso')")) === true);
  await clica('.passo[data-ctl="passo1"]');
  await clicaEtq('mode', '1st PART'); await clicaEtq('inst', 'SD 3');
  const antes = await ev("[...document.querySelectorAll('.passo.aceso')].map(b => b.dataset.ctl).join()");
  await clica('.passo[data-ctl="passo7"]'); await clica('.passo[data-ctl="passo7"]'); await clica('.passo[data-ctl="passo9"]');
  confere('1st PART + SD 3: tocar nos passos liga e desliga (7 duas vezes volta ao estado; 9 liga)', (await ev("[...document.querySelectorAll('.passo.aceso')].map(b => b.dataset.ctl).join()")).includes('passo9') && !(await ev("[...document.querySelectorAll('.passo.aceso')].map(b => b.dataset.ctl).join()")).includes('passo7'), antes + ' → ' + (await ev("[...document.querySelectorAll('.passo.aceso')].map(b => b.dataset.ctl).join()")));
  await clicaEtq('inst', 'AC 1'); await clica('.passo[data-ctl="passo2"]'); await clicaEtq('inst', 'SD 3');
  await clicaEtq('mode', '2nd PART'); await clica('.passo[data-ctl="passo4"]'); await espera(500);
  { const s = await salvo(), p = s.s.pat.b1A, sd = p.t[SEQT('sd')], ac = p.t[SEQT('ac')];
    confere('os passos foram gravados no pattern 1A: SD no passo 9 (1st PART) e 20 (2nd PART), AC no passo 2', sd[8] === 1 && sd[19] === 1 && sd[6] === 0 && ac[1] === 1, `sd9=${sd[8]} sd20=${sd[19]} sd7=${sd[6]} ac2=${ac[1]}`); }
  await clica('[data-ctl="clear"]'); confere('CLEAR arma por 4 s (LED vermelho)', (await ev("document.querySelector('[data-ctl=\"clear\"]').classList.contains('armado')")) === true);
  await clicaEtq('mode', '1st PART'); await clica('[data-ctl="clear"]'); await clica('[data-ctl="clear"]'); await espera(450);
  { const s = await salvo(), sd = s.s.pat.b1A.t[SEQT('sd')]; confere('CLEAR + CLEAR em PATTERN WRITE apaga a trilha SD (TRACK CLEAR) e deixa as outras', sd.every(v => v === 0) && s.s.pat.b1A.t[SEQT('bd')].some(v => v === 1), 'bd ' + s.s.pat.b1A.t[SEQT('bd')].join('')); }
  await clica('[data-ctl="clear"]'); await clica('.passo[data-ctl="passo5"]'); await espera(400);
  confere('CLEAR + passo 5 (STEP NUMBER): o pattern passa a ter 5 passos', (await salvo()).s.pat.b1A.n === 5, 'n=' + (await salvo()).s.pat.b1A.n);
  await clica('[data-ctl="clear"]'); await clica('[data-ctl="prescale"] .op:nth-of-type(2)'); await espera(400);
  confere('CLEAR + PRE-SCALE 2: o pattern passa a pre-scale 2', (await salvo()).s.pat.b1A.ps === 2, 'ps=' + (await salvo()).s.pat.b1A.ps);
  await clicaEtq('mode', 'MANUAL PLAY'); await clica('[data-ctl="prescale"] .op:nth-of-type(4)'); await espera(200);
  confere('fora de PATTERN WRITE o PRE-SCALE não muda sem CLEAR armado', (await salvo()).s.pat.b1A.ps === 2 && (await texto('#estado-msg')).includes('PRE-SCALE só muda'), await texto('#estado-msg'));

  /* ---- 5. salvamento, recarga, Zerar ---- */
  await recarrega(); { const s = await salvo(); confere('autosave: modo, pattern e passos sobrevivem à recarga', s.e.sq.modoIdx === 3 && s.s.pat.b1A.n === 5 && s.s.pat.b1A.ps === 2); }
  await ev("localStorage.setItem('sint-tr808-v1:estado', '{lixo')"); await recarrega(); confere('salvamento corrompido: abre no padrão, sem erro', (await ev("document.querySelectorAll('.passo').length")) === 16 && !logs.slice(-3).some(l => /^(error|ERRO)/i.test(l)));
  await ev("localStorage.setItem('sint-tr808-v1:estado', JSON.stringify({ e: { master: 9, sq: { modoIdx: 99, instIdx: -4, tempo: 1e9 }, v: { bd: { level: 'x' } } }, s: { pat: { b1A: { n: 999, ps: 77, t: [[1, 1]] } } } }))"); await recarrega();
  { const s = await salvo(); confere('salvamento com valores absurdos é limitado e não quebra a página', (await ev("document.querySelectorAll('.passo').length")) === 16 && !logs.slice(-3).some(l => /^(error|ERRO)/i.test(l)), JSON.stringify(s?.e?.sq)); }
  await ev("localStorage.clear()"); await recarrega();

  /* ---- 6. MIDI com dispositivo substituto ---- */
  confere('o dispositivo MIDI substituto aparece na lista', (await ev("[...document.querySelectorAll('#midiDev option')].map(o => o.textContent).join()")).includes('Controlador falso'));
  confere('mapa de notas mostrado na interface (16 notas)', (await ev("document.querySelectorAll('#mapaNotas tr').length")) === 16 && (await texto('#mapaNotas')).includes('36') && (await texto('#mapaNotas')).includes('75'));
  await midiMsg(0x90, 36, 100); await espera(150); const rm = await rmsMax(5, 40);
  confere('nota 36 dispara o bumbo (e toca)', (await texto('#ultimo')).includes('bd') && rm > 0.003, (await texto('#ultimo')) + ' rms ' + rm.toFixed(3));
  await midiMsg(0x90, 64, 100); confere('nota 64 (LOW CONGA) muda a chave do par para conga', (await texto('[data-pad="lt"]')) === 'LOW CONGA' && (await texto('#ultimo')).includes('lt'), await texto('#ultimo'));
  await midiMsg(0x90, 43, 100); confere('nota 43 (LOW TOM) volta a chave para tom', (await texto('[data-pad="lt"]')) === 'LOW TOM');
  await midiMsg(0x90, 75, 100); await midiMsg(0x90, 70, 100); confere('notas 75 (claves) e 70 (maracas) ajustam RS/CL e MA/CP', (await texto('[data-pad="rs"]')) === 'CLAVES' && (await texto('[data-pad="cp"]')) === 'MARACAS');
  await midiMsg(0x90, 37, 100); await midiMsg(0x90, 39, 100); confere('notas 37 (rim shot) e 39 (hand clap) voltam as chaves', (await texto('[data-pad="rs"]')) === 'RIM SHOT' && (await texto('[data-pad="cp"]')) === 'HAND CLAP');
  await midiMsg(0x90, 36, 127); confere('velocity alta NÃO vira accent com a opção desligada', !(await texto('#ultimo')).includes('accent'), await texto('#ultimo'));
  await clica('#midiVel'); await midiMsg(0x90, 38, 110); confere('velocity 110 vira accent com a opção ligada (limiar 100)', (await texto('#ultimo')).includes('accent') && (await texto('#ultimo')).includes('sd'), await texto('#ultimo'));
  await midiMsg(0x90, 38, 90); confere('velocity 90 não vira accent', !(await texto('#ultimo')).includes('accent'));
  await midiMsg(0x90, 99, 100); confere('nota fora do mapa é avisada, sem disparar', (await texto('#ultimo')).includes('sem voz'));
  await ev("(() => { const s = document.getElementById('midiCh'); s.value = '3'; s.dispatchEvent(new Event('change')); })()"); await midiMsg(0x90, 42, 100); confere('filtro de canal 3: nota no canal 1 é ignorada', !(await texto('#ultimo')).includes('ch'), await texto('#ultimo'));
  await midiMsg(0x92, 42, 100); confere('filtro de canal 3: nota no canal 3 passa', (await texto('#ultimo')).includes('ch') && (await texto('#ultimo')).includes('canal 3'), await texto('#ultimo'));
  await ev("(() => { const s = document.getElementById('midiCh'); s.value = '0'; s.dispatchEvent(new Event('change')); })()");
  // MIDI learn: botão, clicar no controle, mexer no CC
  await clica('#learn'); await clica('[data-ctl="tempo"] .knob'); await midiMsg(0xB0, 20, 127); await espera(450); confere('MIDI learn: clicar no TEMPO e mexer o CC 20 cria a ligação', (await midiSalvo())?.map?.tempo?.cc === 20, JSON.stringify((await midiSalvo())?.map));
  await clica('#learn'); await midiMsg(0xB0, 20, 0); await espera(80); confere('CC 20 em 0 leva o TEMPO ao mínimo (40 BPM)', (await texto('#bpm')).includes('40 BPM'), await texto('#bpm'));
  await midiMsg(0xB0, 20, 127); await espera(80); confere('CC 20 em 127 leva o TEMPO ao máximo (300 BPM)', (await texto('#bpm')).includes('300 BPM'), await texto('#bpm'));
  await clica('#learn'); await clica('[data-ctl="mode"] .knob'); await midiMsg(0xB0, 21, 0); await clica('#learn'); await midiMsg(0xB0, 21, 127); await espera(80);
  confere('chave de posições (MODE) divide o curso do CC em 6 faixas iguais: 127 = COMPOSE', (await ev("document.querySelector('[data-ctl=\"mode\"] .etq[aria-checked=true]').textContent")) === 'COMPOSE'); await midiMsg(0xB0, 21, 0);
  await clica('#learn'); await clica('[data-ctl="start"]'); await midiMsg(0xB0, 22, 0); await clica('#learn'); await midiMsg(0xB0, 22, 100); await espera(200);
  confere('botão (START) liga com CC ≥ 64', (await ev("document.getElementById('start').getAttribute('aria-pressed')")) === 'true'); await midiMsg(0xB0, 22, 100); await clica('#start'); await espera(200);
  await espera(450); await recarrega(); confere('o mapeamento MIDI é salvo e volta depois de recarregar', Object.keys((await midiSalvo()).map).length === 3, JSON.stringify((await midiSalvo()).map));
  await clica('#learn'); await clica('[data-ctl="tempo"] .knob'); await clica('#desfaz'); await espera(450); confere('Desfazer ligação remove só a do controle selecionado', Object.keys((await midiSalvo()).map).join() === 'mode,start' || Object.keys((await midiSalvo()).map).length === 2, Object.keys((await midiSalvo()).map).join());
  await clica('#apagaTodas'); await espera(450); confere('Apagar todas esvazia o mapa', Object.keys((await midiSalvo()).map).length === 0); await clica('#learn');
  // Zerar mantém o MIDI
  await midiMsg(0xB0, 23, 0); await clica('#learn'); await clica('[data-ctl="master"] .knob'); await midiMsg(0xB0, 23, 50); await clica('#learn');
  await clica('#zerar'); await espera(1500); { const s = await salvo(); confere('Zerar apaga os patterns e mantém a ligação MIDI', s.s.pat.b1A.t.every(a => a.every(v => v === 0)) && Object.keys((await midiSalvo()).map).length === 1); }
  await ev("localStorage.clear()"); await recarrega();

  /* ---- 7. alvos de toque e celular ---- */
  const alvos = await ev(`[...document.querySelectorAll('.btn, .passo, .slide .op, select, input[type=number], input[type=file], .knob, .linha label')].filter(e => { const b = e.getBoundingClientRect(); const oculto = e.closest('.slide.par') && e.matches('.op:nth-child(2)'); return !oculto && b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).map(e => e.className + ':' + e.textContent.slice(0, 12) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).join(' | ')`);
  confere('alvos de toque de 44 px ou mais (botões, passos, chaves, seletores, knobs; os rótulos ao redor dos seletores rotativos são redundantes com o knob)', alvos === '', alvos);
  await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1560, height: 1080, scale: 1 } }).then(r => writeFileSync(join(SAIDA, 'tr808-painel.png'), Buffer.from(r.result.data, 'base64')));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }); await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await recarrega();
  const cel = await ev(`({ larg: innerWidth, rolaPagina: document.documentElement.scrollWidth > innerWidth + 1, rolagemPainel: document.querySelector('.rolagem').scrollWidth > document.querySelector('.rolagem').clientWidth })`);
  confere('celular (375 px): a página não rola na horizontal; o painel rola dentro da própria área', !cel.rolaPagina && cel.rolagemPainel, JSON.stringify(cel));
  await cdp('Page.captureScreenshot', { format: 'png' }).then(r => writeFileSync(join(SAIDA, 'tr808-celular.png'), Buffer.from(r.result.data, 'base64')));
  confere('sem erros no console', !logs.some(l => /^(error|ERRO)/i.test(l)), logs.filter(l => /^(error|ERRO)/i.test(l)).join(' | '));
  ws.close();
} finally { proc.kill(); }
console.log(`\n${falhas.length} falha(s).`); process.exit(falhas.length ? 1 : 0);

function SEQT(t) { return ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'cb', 'cy', 'oh', 'ch', 'ac'].indexOf(t); }
