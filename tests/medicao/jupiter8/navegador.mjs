// Carrega jupiter8/index.html num Chrome sem janela (protocolo DevTools, sem dependências) e confere: erros no console,
// motor como AudioWorklet em file://, som, controles com mouse de verdade (slider, knob, seletor, chave, bender), botões, modos de teclado,
// memória de patches, fita (arquivo), salvamento, sequenciador, aleatório, Zerar, MIDI learn com MIDI substituto e tamanho dos alvos de toque.
// Uso: node tests/medicao/jupiter8/navegador.mjs [pasta-das-capturas]   (precisa do Google Chrome; sai com código 1 se algo falhar)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const URL_PAGINA = pathToFileURL(join(raiz, 'jupiter8', 'index.html')).href;
const SAIDA = process.argv[2] || tmpdir(); mkdirSync(SAIDA, { recursive: true });
const CAMINHOS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const chrome = process.env.CHROME || CAMINHOS.find(existsSync);
if (!chrome) { console.log('Google Chrome não encontrado (use a variável CHROME).'); process.exit(2); }
const PORTA = 9300 + Math.floor(Math.random() * 500), perfil = mkdtempSync(join(tmpdir(), 'j8-chrome-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const espera = ms => new Promise(r => setTimeout(r, ms));
const falhas = []; const confere = (nome, ok, det = '') => { console.log((ok ? 'ok   ' : 'FORA ') + nome + (det !== '' ? ' — ' + det : '')); if (!ok) falhas.push(nome); };
async function conecta() { for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORTA}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {} await espera(250); } throw new Error('Chrome não respondeu'); }
const GANCHO = `(() => { const orig = AudioNode.prototype.connect; window.__tap = { nos: 0, sp: 0 };
  AudioNode.prototype.connect = function (dest, ...r) {
    if (window.AudioWorkletNode && this instanceof AudioWorkletNode && !window.__an) { window.__tap.nos++; const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an); window.__an = an; }
    if (window.ScriptProcessorNode && this instanceof ScriptProcessorNode) window.__tap.sp++;
    return orig.call(this, dest, ...r); };
  window.__rms = () => { if (!window.__an) return -1; const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
})();`;

try {
  const ws = new WebSocket(await conecta()); await new Promise(r => ws.addEventListener('open', r));
  let n = 0; const pend = new Map(), logs = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled') { if (m.params.type === 'error') logs.push('error: ' + m.params.args.map(a => a.value ?? a.description).join(' ')); } else if (m.method === 'Runtime.exceptionThrown') logs.push('ERRO: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); });
  const cdp = (method, params = {}) => new Promise(r => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erro em evaluate'); return r.result.result.value; };
  const rect = async sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  const mouse = (type, x, y) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  const clica = async (sel, fx = 0.5, fy = 0.5) => { const r = await rect(sel); if (!r) throw new Error('sem elemento ' + sel); const x = r.x + r.w * fx, y = r.y + r.h * fy; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await espera(40); };
  const arrasta = async (sel, dx, dy, solta = true) => { const r = await rect(sel), x = r.x + r.w / 2, y = r.y + r.h / 2; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + dx * i / 8, y + dy * i / 8); if (solta) await mouse('mouseReleased', x + dx, y + dy); await espera(40); return { x: x + dx, y: y + dy }; };
  const st = () => ev('JSON.stringify(window.__j8.st)').then(JSON.parse);
  const rmsMax = async (k = 8, dt = 60) => { let m = 0; for (let i = 0; i < k; i++) { m = Math.max(m, await ev('window.__rms()')); await espera(dt); } return m; };
  const B = id => `[data-id="${id}"]`, C = id => `[data-ctl="${id}"]`;
  const pronto = async () => { for (let i = 0; i < 60 && !(await ev('window.__j8.audio.pronto')); i++) await espera(150); await espera(1200); };

  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('DOM.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 2700, height: 1500, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: GANCHO });
  await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200); await ev('localStorage.clear()'); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200);

  /* ---- 1. carga, painel, marca ---- */
  confere('título da página', (await ev('document.title')) === 'Clone do Roland Jupiter-8');
  const txt = (await ev("document.querySelector('.gabinete').innerText")).toLowerCase();
  confere('painel sem marca nem nome de modelo', !['roland', 'jupiter', 'jp-8', 'jp8'].some(x => txt.includes(x)));
  confere('26 sliders, 8 knobs + 4 seletores, 17 chaves, 42 botões, 61 teclas, 1 visor de 4 dígitos', (await ev("[document.querySelectorAll('.sl').length, document.querySelectorAll('.kn').length, document.querySelectorAll('.sw').length, document.querySelectorAll('.bt').length, document.querySelectorAll('#teclado [data-n]').length, document.querySelectorAll('#visor svg').length].join()")) === '26,12,17,42,61,4');
  const peq = await ev(`[...document.querySelectorAll('.bt, .bp, select, input[type=number], .power')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).map(e => e.id || e.dataset.id || e.className)`);
  confere('botões e campos com 44 px ou mais (tamanho real)', peq.length === 0, peq.join(','));
  confere('sem URLs externas na página', !/(https?:)?\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}\//i.test(await ev("document.documentElement.outerHTML.replace(/<script type=\"text\\/plain\" id=\"dsp\">[\\s\\S]*?<\\/script>/, '').replace(/https?:\\/\\/www\\.w3\\.org[^\"']*/g, '')")));

  /* ---- 2. som ---- */
  await ev("document.getElementById('zoom-cheio').click()"); await clica('#teclado [data-n="60"]', 0.5, 0.85); await pronto();
  const tap = await ev('window.__tap'); confere('motor carregado como AudioWorklet em file:// (sem cair na reserva)', tap.nos === 1 && tap.sp === 0, JSON.stringify(tap));
  { const k = await rect('#teclado [data-n="60"]'); await mouse('mousePressed', k.x + k.w / 2, k.y + k.h * 0.85); const r1 = await rmsMax(); await mouse('mouseReleased', k.x + k.w / 2, k.y + k.h * 0.85); await espera(2000); const r2 = await ev('window.__rms()');
    confere('tecla da tela produz som e o som para depois de soltar', r1 > 0.003 && r2 < r1 * 0.2, `${r1.toFixed(4)} → ${r2.toFixed(5)}`); }
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', text: 'a' }); const r3 = await rmsMax(); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA' }); confere('teclado do computador produz som', r3 > 0.003, r3.toFixed(4)); await espera(1500);
  await ev("for (const n of [48, 52, 55, 60, 64, 67, 72, 76]) window.__j8.nota(n, true)"); const rp = await ev(`(async () => { await new Promise(r => setTimeout(r, 600)); const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let p = 0; for (const v of b) p = Math.max(p, Math.abs(v)); return p; })()`);
  confere('8 notas juntas: som presente, finito e dentro de ±1', rp > 0.01 && rp <= 1 && isFinite(rp), rp.toFixed(3)); await ev("for (const n of [48, 52, 55, 60, 64, 67, 72, 76]) window.__j8.nota(n, false)"); await espera(800);

  /* ---- 3. controles com o mouse de verdade ---- */
  let s = await st(); const v0 = s.pat[0].cut;
  await arrasta(C('cut'), 0, -50); s = await st(); confere('slider (VCF CUT OFF) sobe ao arrastar para cima e a barra de valor mostra o controle', s.pat[0].cut > v0 + 1 && (await ev("document.getElementById('rv-nome').textContent")).includes('CUT OFF'), `${v0} → ${s.pat[0].cut.toFixed(2)}`);
  await ev("document.getElementById('rv-in').focus()"); await ev("(() => { const i = document.getElementById('rv-in'); i.value = '3,5'; i.dispatchEvent(new Event('change')); })()"); s = await st(); confere('digitar o valor na barra de valor', Math.abs(s.pat[0].cut - 3.5) < 0.01, s.pat[0].cut);
  const vm = (await st()).g.volume; await arrasta(C('volume'), 0, -45); s = await st(); confere('knob (VOLUME) responde ao arrasto', s.g.volume > vm + 1, `${vm} → ${s.g.volume.toFixed(2)}`);
  const w0 = (await st()).pat[0].lfoWave; await clica(C('lfoWave')); s = await st(); confere('seletor rotativo (LFO WAVE FORM): um toque avança uma posição', s.pat[0].lfoWave === (w0 + 1) % 4, `${w0} → ${s.pat[0].lfoWave}`);
  const a0 = (await st()).pat[0].v2Low; await clica(C('v2Low')); s = await st(); confere('chave de 2 posições (VCO-2 RANGE normal/LOW FREQ) alterna', s.pat[0].v2Low === 1 - a0);
  { const r = await rect(C('fmDest')); const d0 = (await st()).pat[0].fmDest; await clica(C('fmDest'), 0.5, 0.9); s = await st(); confere('chave de 3 posições (FREQ MOD destino): toque na posição de baixo escolhe VCO-2', s.pat[0].fmDest === 2 && d0 !== 2, `${d0} → ${s.pat[0].fmDest}`); void r; }
  { const r = await rect('#bender'); const x = r.x + r.w / 2, y = r.y + r.h / 2; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseMoved', x + r.w * 0.4, y); await espera(60); const alto = (await st()).g.bend; await mouse('mouseReleased', x + r.w * 0.4, y); await espera(60); const ap = (await st()).g.bend;
    confere('bender: vai ao extremo e volta ao centro ao soltar', alto > 0.6 && ap === 0, `${alto} → ${ap}`); }

  /* ---- 3b. todos os controles de valor, um a um, com o mouse ---- */
  { const ids = await ev('Object.keys(window.__j8.ctrls)'), parados = [], porTipo = { sl: 0, kn: 0, rot: 0, sw: 0 };
    const val = id => ev(`(() => { const c = window.__j8.ctrls[${JSON.stringify(id)}], s = window.__j8.st; return c.g ? s.g[c.k] : s.pat[0][c.k]; })()`);
    for (const id of ids) {
      const cls = await ev(`window.__j8.ctrls[${JSON.stringify(id)}].el.className`), v0 = await val(id), d = await ev(`(() => { const c = window.__j8.ctrls[${JSON.stringify(id)}]; return { min: c.min, max: c.max }; })()`), meio = (d.min + d.max) / 2;
      if (cls.includes('sl')) { await arrasta(C(id), 0, v0 > meio ? 40 : -40); porTipo.sl++; }
      else if (cls.includes('rot')) { await clica(C(id)); porTipo.rot++; }
      else if (cls.includes('kn')) { await arrasta(C(id), 0, v0 > meio ? 40 : -40); porTipo.kn++; }
      else { const alto = (d.max - d.min) + 1; await clica(C(id), 0.5, v0 === d.max ? 0.1 : 0.9); porTipo.sw++; void alto; }
      if ((await val(id)) === v0) parados.push(id);
    }
    confere(`os ${ids.length} controles de valor respondem ao mouse (${porTipo.sl} sliders, ${porTipo.kn} knobs, ${porTipo.rot} seletores, ${porTipo.sw} chaves)`, parados.length === 0 && ids.length === 55, parados.length ? 'sem efeito: ' + parados.join(',') : ids.length + ' ok'); }
  /* ---- 3c. todos os botões, um a um (cada clique sem erro; os efeitos estão nas conferências abaixo) ---- */
  { const ids = await ev('Object.keys(window.__j8.BTS)'), antesErros = logs.length;
    for (const id of ids) { if (id === 'write') continue; await clica(B(id)); }
    await clica(B('write')); await clica(B('write'));
    confere(`os ${ids.length} botões aceitam o clique sem erro`, ids.length === 42 && logs.length === antesErros, `${ids.length} botões`); }
  await ev('localStorage.clear()'); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1300); await ev("document.getElementById('zoom-cheio').click()");

  /* ---- 4. botões e modos ---- */
  const bt = async (id, f, d) => { await clica(B(id)); const t = await st(); const v = f(t); confere(`botão ${id}: ${d}`, v === true, v === true ? '' : String(v)); };
  await bt('km1', t => t.g.keyMode === 1, 'SPLIT'); await bt('pl', t => t.edit === 1, 'PANEL MODE LOWER edita o Lower'); await arrasta(C('res'), 0, -40);
  s = await st(); confere('em PANEL MODE LOWER o slider edita só o patch Lower', s.pat[1].res > s.pat[0].res + 1, `${s.pat[1].res.toFixed(1)} / ${s.pat[0].res.toFixed(1)}`);
  await bt('pu', t => t.edit === 0, 'PANEL MODE UPPER'); await bt('km2', t => t.g.keyMode === 2, 'DUAL'); await bt('km0', t => t.g.keyMode === 0 && t.edit === 0, 'WHOLE (força o Upper)');
  for (const [id, v] of [['as0', 2], ['as1', 3], ['as2', 0], ['as3', 1]]) await bt(id, t => t.pat[0].assign === v, `ASSIGN ${['SOLO', 'UNISON', 'POLY 1', 'POLY 2'][+id[2]]}`);
  await bt('holdL', t => t.g.holdL === 1, 'HOLD LOWER liga'); await clica(B('holdL')); await bt('holdU', t => t.g.holdU === 1, 'HOLD UPPER liga'); await clica(B('holdU'));
  await bt('am3', t => t.g.arpMode === 3 && t.g.arpRange === 4 && t.pat[0].assign === 1, 'arpejo U&D liga em RANGE 4 e POLY 2'); await bt('ar2', t => t.g.arpRange === 2, 'RANGE 2');
  await ev("window.__j8.nota(60, true); window.__j8.nota(64, true)"); const ra = await rmsMax(14, 80); await ev("window.__j8.nota(60, false); window.__j8.nota(64, false)"); confere('arpejo toca', ra > 0.003, ra.toFixed(4)); await bt('am3', t => t.g.arpMode === 0, 'apertar de novo desliga o arpejo'); await espera(1500);
  await bt('tuneBt', () => true, 'TUNE'); await bt('lfoBt', () => true, 'LFO MODULATION (pressionado)');

  /* ---- 5. memória: patches, WRITE, MANUAL, presets, fita ---- */
  await ev("window.__j8.setV(window.__j8.ctrls.cut, 9)"); await clica(B('write')); await clica(B('n3')); await clica(B('n5'));
  s = await st(); confere('WRITE + 3 + 5 grava no patch 35', s.mem[20].cut === 9 && s.num.u === 20 && !s.escreve, `índice ${s.num.u}`);
  await clica(B('n1')); await clica(B('n6')); s = await st(); confere('número 16 carrega o patch recriado SYNC LEAD (sync ligado)', s.num.u === 5 && s.pat[0].sync === 1 && (await ev("document.getElementById('rv-patch').textContent")).includes('SYNC LEAD'));
  await clica(B('manual')); s = await st(); confere('MANUAL devolve os controles', s.manual[0] === true && s.pat[0].sync === 0);
  await clica(B('pA')); s = await st(); confere('preset A carrega o par de patches e o KEY MODE (SPLIT)', s.num.u === 5 && s.num.l === 19 && s.g.keyMode === 1); await clica(B('km0'));
  await ev("window.__bl = null; HTMLAnchorElement.prototype.click = function () { if (this.download) fetch(this.href).then(r => r.text()).then(t => { window.__bl = t; }); }"); await clica(B('save')); await espera(300);
  const arq = await ev('window.__bl'); const fitaPath = join(SAIDA, 'jupiter8-memoria-teste.json'); writeFileSync(fitaPath, arq || '{}');
  confere('SAVE gera o arquivo com os 64 patches e os 8 presets', !!arq && JSON.parse(arq).mem.length === 64 && JSON.parse(arq).pre.length === 8 && JSON.parse(arq).mem[20].cut === 9);
  const dom = await cdp('DOM.getDocument'); const no = (await cdp('DOM.querySelector', { nodeId: dom.result.root.nodeId, selector: '#fita-arq' })).result.nodeId;
  await clica(B('verify')); await cdp('DOM.setFileInputFiles', { nodeId: no, files: [fitaPath] }); await espera(400); confere('VERIFY com o mesmo arquivo confere (DATA CHECK apagado)', (await ev("document.getElementById('estado').textContent")).includes('confere') && !(await ev("document.querySelectorAll('.led.sol')[1].classList.contains('on')")));
  await ev("window.__j8.st.mem[20].cut = 2"); await clica(B('verify')); await cdp('DOM.setFileInputFiles', { nodeId: no, files: [fitaPath] }); await espera(400); confere('VERIFY com a memória alterada acusa diferença (DATA CHECK aceso)', (await ev("document.getElementById('estado').textContent")).includes('diferem') && await ev("document.querySelectorAll('.led.sol')[1].classList.contains('on')"));
  await clica(B('load')); await cdp('DOM.setFileInputFiles', { nodeId: no, files: [fitaPath] }); await espera(400); s = await st(); confere('LOAD restaura a memória do arquivo', s.mem[20].cut === 9 && (await ev("document.getElementById('estado').textContent")).includes('LOAD'));
  writeFileSync(fitaPath, '{lixo'); await clica(B('load')); await cdp('DOM.setFileInputFiles', { nodeId: no, files: [fitaPath] }); await espera(400); confere('arquivo inválido: DATA CHECK acende e a memória fica como estava', await ev("document.querySelectorAll('.led.sol')[1].classList.contains('on')") && (await st()).mem[20].cut === 9);
  /* ---- 6. salvamento: recarrega e confere ---- */
  await ev("window.__j8.setV(window.__j8.ctrls.hpf, 6.5)"); await ev("window.__j8.setV(window.__j8.ctrls.volume, 6)"); await espera(600); const antes = await st(); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1300); const depois = await st();
  confere('salvamento automático: patches, memória, controles e volume voltam depois de recarregar', depois.mem[20].cut === 9 && Math.abs(depois.pat[0].hpf - 6.5) < 0.01 && depois.g.volume === 6 && JSON.stringify(depois.pre) === JSON.stringify(antes.pre), `hpf ${depois.pat[0].hpf}, volume ${depois.g.volume}`);
  await ev("localStorage.setItem('sint-jupiter8-v1:estado', '{lixo')"); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1300); const lixo = await st(); confere('armazenamento corrompido: abre com o padrão e sem erro', lixo.g.volume === 8 && lixo.mem.length === 64);

  /* ---- 7. acessórios ---- */
  await ev("document.getElementById('zoom-cheio').click()");
  const q0 = await ev("[...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')"); await clica('#seq-aleat'); const q1 = await ev("[...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')"); confere('Aleatório muda a sequência', q0 !== q1, q1);
  await ev("document.getElementById('seq-tonica').value = '2'; document.getElementById('seq-tonica').dispatchEvent(new Event('change')); document.getElementById('seq-escala').value = 'pentamenor'; document.getElementById('seq-escala').dispatchEvent(new Event('change'))");
  { let fora = 0; for (let k = 0; k < 30; k++) { await ev("document.getElementById('seq-aleat').click()"); const p = (await st()).seq.passos; for (const x of p) { const g = ((x.n - 36 - 2) % 12 + 12) % 12; if (![0, 3, 5, 7, 10].includes(g) || x.n < 36 || x.n > 96) fora++; } } confere('Aleatório só usa notas da escala (Ré pentatônica menor) e do teclado', fora === 0, `${fora} fora de 480`); }
  await clica('#seq-play'); await espera(900); const rs = await rmsMax(14, 60); const acesos = await ev("document.querySelectorAll('.passo.agora').length"); confere('Play: o sequenciador toca e acende um passo', rs > 0.002 && acesos === 1, `${rs.toFixed(4)}, ${acesos} passo(s)`);
  await clica('#seq-play'); await espera(3000); confere('Stop silencia', (await ev('window.__rms()')) < 0.002);
  await ev("document.querySelectorAll('.passo .nota')[3].click(); window.__j8.nota(55, true); window.__j8.nota(55, false)"); confere('passo selecionado grava a nota tocada', (await st()).seq.passos[3].n === 55);
  await ev("window.__j8.setV(window.__j8.ctrls.cut, 2); window.__j8.st.seq.bpm = 77; window.__j8.st.mem[20].cut = 9"); await clica('#zerar'); confere('Zerar pede confirmação', await ev("document.getElementById('zerar-nao').hidden === false")); await clica('#zerar-nao'); await clica('#zerar'); await clica('#zerar'); s = await st();
  confere('Zerar (dois toques): painel e sequência no padrão, memória mantida', s.pat[0].cut === 7 && s.seq.bpm === 120 && s.mem[20].cut === 9);

  /* ---- 8. MIDI learn com MIDI substituto ---- */
  await ev(`(() => { const i1 = { id: 'a', name: 'Controlador', onmidimessage: null }, i2 = { id: 'b', name: 'Teclado', onmidimessage: null }; const acc = { inputs: new Map([['a', i1], ['b', i2]]), onstatechange: null }; window.__i1 = i1; window.__i2 = i2; window.__acc = acc; navigator.requestMIDIAccess = () => Promise.resolve(acc); })()`);
  await clica('#midi-ativar'); await espera(200); confere('MIDI substituto: entradas listadas', (await ev("document.getElementById('midi-entrada').options.length")) === 3);
  const msg = d => ev(`window.__i1.onmidimessage({ data: ${JSON.stringify(d)} })`);
  await msg([0x90, 64, 100]); await espera(300); const rm = await rmsMax(); await msg([0x80, 64, 0]); confere('nota MIDI soa', rm > 0.003, rm.toFixed(4)); await espera(1500);
  await msg([0xE0, 127, 127]); confere('pitch bend MIDI no máximo', (await st()).g.bend > 0.99); await msg([0xE0, 0, 64]);
  await msg([0xC0, 5]); s = await st(); confere('Program Change 5 carrega o patch 16', s.num.u === 5); await msg([0xC0, 66]); s = await st(); confere('Program Change 66 carrega o preset C', s.num.u === s.pre[2].u);
  await ev("document.getElementById('midi-canal').value = '3'; document.getElementById('midi-canal').dispatchEvent(new Event('change'))"); await msg([0xE0, 127, 127]); confere('canal 3: mensagem do canal 1 ignorada', (await st()).g.bend === 0); await msg([0xE2, 127, 127]); confere('canal 3: mensagem do canal 3 aceita', (await st()).g.bend > 0.99); await msg([0xE2, 0, 64]);
  await ev("document.getElementById('midi-canal').value = '0'; document.getElementById('midi-canal').dispatchEvent(new Event('change'))");
  await clica('#midi-aprende'); const tocaAlvo = sel => ev(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))`);
  await tocaAlvo(C('cut')); await msg([0xB0, 74, 5]); await tocaAlvo(C('lfoWave')); await msg([0xB0, 75, 5]); await tocaAlvo(B('km2')); await msg([0xB0, 76, 5]); await tocaAlvo(B('holdL')); await msg([0xB0, 77, 5]); await tocaAlvo('#bender'); await msg([0xB0, 78, 5]);
  const mapa = await ev('JSON.stringify(window.__j8.midi.mapa)'); confere('MIDI learn: 5 controles ligados (slider, seletor, botão, botão de estado, bender)', Object.keys(JSON.parse(mapa)).length === 5, mapa);
  await clica('#midi-aprende');
  await msg([0xB0, 74, 127]); s = await st(); confere('slider: CC 127 = máximo da faixa', s.pat[0].cut === 10); await msg([0xB0, 74, 0]); s = await st(); confere('slider: CC 0 = mínimo', s.pat[0].cut === 0); await msg([0xB0, 74, 64]); s = await st(); confere('slider: CC 64 ≈ meio', Math.abs(s.pat[0].cut - 5) < 0.1, s.pat[0].cut);
  for (const [v, esp] of [[0, 0], [40, 1], [90, 2], [127, 3]]) { await msg([0xB0, 75, v]); s = await st(); confere(`seletor de 4 posições: CC ${v} = posição ${esp}`, s.pat[0].lfoWave === esp, s.pat[0].lfoWave); }
  await msg([0xB0, 76, 127]); s = await st(); confere('botão DUAL: CC >= 64 age', s.g.keyMode === 2); await msg([0xB0, 76, 0]); await clica(B('km0'));
  await msg([0xB0, 77, 127]); s = await st(); confere('HOLD LOWER liga com CC >= 64', s.g.holdL === 1); await msg([0xB0, 77, 0]); s = await st(); confere('HOLD LOWER desliga com CC < 64', s.g.holdL === 0);
  await msg([0xB0, 78, 127]); s = await st(); confere('bender: CC 127 = +1', s.g.bend === 1); await msg([0xB0, 78, 0]); s = await st(); confere('bender: CC 0 = −1', s.g.bend === -1); await msg([0xB0, 78, 64]);
  await msg([0xB0, 64, 127]); s = await st(); confere('CC 64 (pedal) liga o HOLD em WHOLE', s.g.holdL === 1 && s.g.holdU === 1); await msg([0xB0, 64, 0]); s = await st(); confere('CC 64 solto devolve o HOLD', s.g.holdL === 0 && s.g.holdU === 0);
  await clica('#midi-aprende'); await tocaAlvo(C('cut')); await clica('#midi-desfaz'); await clica('#midi-aprende'); confere('desfazer a ligação de um controle', !JSON.parse(await ev('JSON.stringify(window.__j8.midi.mapa)'))['1:74']);
  await espera(400); confere('mapa salvo no localStorage', Object.keys(JSON.parse(await ev("localStorage.getItem('sint-jupiter8-v1:midi')")).mapa).length === 4);
  await clica('#midi-apaga'); confere('apagar todas as ligações', Object.keys(JSON.parse(await ev('JSON.stringify(window.__j8.midi.mapa)'))).length === 0);

  /* ---- 9. captura do painel e celular ---- */
  await ev("window.scrollTo(0, 0); document.getElementById('zoom-cheio').click(); document.getElementById('rolagem').scrollLeft = 0"); await espera(200);
  const pr = await ev("(() => { const b = document.getElementById('painel').getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }; })()");
  for (let k = 0, x = 0; x < pr.w; x += 850, k++) { const c = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: pr.x + x, y: pr.y, width: Math.min(850, pr.w - x), height: pr.h, scale: 1 } }); writeFileSync(join(SAIDA, `jupiter8-${k}.png`), Buffer.from(c.result.data, 'base64')); }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }); await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200);
  const cel = await ev(`({ larg: innerWidth, rolaPagina: document.documentElement.scrollWidth > innerWidth + 1, pequenos: [...document.querySelectorAll('.bt, .bp, select, input[type=number]')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).length, barra: !document.getElementById('audio-bar').hidden, cheio: document.getElementById('zoom-cheio').getAttribute('aria-pressed') })`);
  confere('celular (375 px): painel em tamanho real, sem rolagem horizontal da página, alvos de 44 px e aviso de som desligado', !cel.rolaPagina && cel.pequenos === 0 && cel.barra && cel.cheio === 'true', JSON.stringify(cel));
  confere('sem erros no console', !logs.some(l => /^(error|ERRO)/i.test(l)), logs.filter(l => /^(error|ERRO)/i.test(l)).join(' | '));
  ws.close();
} finally { proc.kill(); }
console.log(`\n${falhas.length} falha(s).`); process.exit(falhas.length ? 1 : 0);
