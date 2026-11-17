// Carrega dx7/index.html num Chrome sem janela (protocolo DevTools, sem dependências) e confere: erros no console,
// motor como AudioWorklet em file://, som do teclado, cada botão do painel, roda, volume, POWER, memória, salvamento,
// sequenciador, aleatório, Hold, Zerar, MIDI learn com MIDI substituto e tamanho dos alvos de toque.
// Uso: node tests/medicao/dx7/navegador.mjs [pasta-das-capturas]   (precisa do Google Chrome; sai com código 1 se algo falhar)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const URL_PAGINA = pathToFileURL(join(raiz, 'dx7', 'index.html')).href;
const SAIDA = process.argv[2] || tmpdir(); mkdirSync(SAIDA, { recursive: true });
const CAMINHOS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const chrome = process.env.CHROME || CAMINHOS.find(existsSync);
if (!chrome) { console.log('Google Chrome não encontrado (use a variável CHROME).'); process.exit(2); }
const PORTA = 9300 + Math.floor(Math.random() * 500), perfil = mkdtempSync(join(tmpdir(), 'dx7-chrome-'));
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
  const st = () => ev('JSON.stringify(window.__dx.st)').then(JSON.parse);
  const rmsMax = async (n = 8, dt = 60) => { let m = 0; for (let i = 0; i < n; i++) { m = Math.max(m, await ev('window.__rms()')); await espera(dt); } return m; };   // o batimento entre linhas desafinadas pode zerar uma janela isolada
  const B = id => `[data-id="${id}"]`;
  const lcd = () => ev("window.__dx.lcd().join(' | ')");
  const ST = () => ev('JSON.stringify(window.__dx.st)').then(JSON.parse);
  const recarrega = async () => { await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1300); };

  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: GANCHO });
  await cdp('Page.navigate', { url: URL_PAGINA }); await espera(1200);
  await ev('localStorage.clear()'); await recarrega();

  /* ---- 1. carga, painel, marca ---- */
  confere('título da página', (await ev('document.title')) === 'Clone do sintetizador FM de seis operadores');
  const txt = (await ev("document.querySelector('.gabinete').innerText")).toLowerCase();
  confere('painel sem marca nem nome de modelo', !['yamaha', 'dx7', 'dx-7'].some(x => txt.includes(x)));
  confere('42 botões (32 + 8 de modo + NO/YES), 61 teclas, 1 visor', (await ev("[document.querySelectorAll('.bt').length, document.querySelectorAll('.teclado [data-n]').length, document.querySelectorAll('.lcd').length].join()")) === '42,61,1');
  confere('32 diagramas de algoritmo', (await ev("document.querySelectorAll('.alg-cel').length")) === 32);
  const alvos = await ev(`[...document.querySelectorAll('.bt, .bp, select, input[type=number], input[type=range], .vslider, .roda, .teclado .br')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).map(e => e.id || e.dataset.id || e.className).join(',')`);
  confere('alvos de toque de 44 px ou mais (teclas pretas ficam de fora)', alvos === '', alvos);
  confere('LCD inicial', (await lcd()).startsWith('INTERNAL VOICE') && (await lcd()).includes('INT01 FM PIANO'), await lcd());

  /* ---- 2. áudio: teclado com o mouse, AudioWorklet em file:// ---- */
  await clica('.teclado .br[data-n="60"]', 0.5, 0.8); await espera(1500);
  await ev("window.__dx.nota(60, true)"); await espera(500);
  const r1 = await rmsMax(); await ev("window.__dx.nota(60, false)");
  const tap = await ev('JSON.stringify(window.__tap)');
  confere('som pelo AudioWorklet (file://)', r1 > 0.005 && JSON.parse(tap).nos >= 1, `rms ${r1.toFixed(3)} ${tap}`);

  /* ---- 3. todos os botões em cada modo, sem erro ---- */
  { const antes = logs.length; await ev("window.__dx.st.modo");
    for (const modo of ['play', 'edit', 'func']) { await ev(`(() => { const d = window.__dx; if ('${modo}' === 'edit') d.aperta('edit'); if ('${modo}' === 'func') { d.aperta('func'); } })()`);
      for (let n = 1; n <= 32; n++) await ev(`window.__dx.aperta('b${n}')`);
      await ev("window.__dx.aperta('func'); window.__dx.carregaVoz(0)"); }
    for (const id of ['no', 'si', 'store', 'mpi', 'mpc', 'msi', 'msc', 'opsel', 'edit', 'func']) await ev(`window.__dx.aperta('${id}')`);
    await ev("window.__dx.aperta('store'); window.__dx.carregaVoz(0)");
    confere('os 32 botões em PLAY, EDIT e FUNCTION e os de modo respondem sem erro', logs.length === antes, logs.slice(antes).join(' | ')); }
  await ev("window.__dx.st.prot.int = false; window.__dx.st.prot.cart = false; window.__dx.carregaVoz(0)");

  /* ---- 3b. cada parâmetro de edição e de função, nos dois extremos ---- */
  { const r = await ev(`(() => { const d = window.__dx, ruins = [], n0 = [];
      const teste = (tab, n, entra) => { entra(); const p = d.st.param; if (!p) { ruins.push(tab + n + ' sem parâmetro'); return; } const def = p.d; if (def.sem || def.conf || def.nome || def.min === def.max) return;
        for (const t of [0, 1, 0.5]) { d.desliza(t); const v = def.get(); if (!(v >= def.min && v <= def.max)) ruins.push(tab + n + ' fora da faixa ' + v); }
        d.desliza(1); d.nudge(1); if (def.get() !== def.max) ruins.push(tab + n + ' passou do máximo'); d.desliza(0); d.nudge(-1); if (def.get() !== def.min) ruins.push(tab + n + ' passou do mínimo'); n0.push(n); };
      d.carregaVoz(0); d.aperta('edit'); for (let n = 7; n <= 30; n++) teste('E', n, () => d.aperta('b' + n));
      d.aperta('func'); for (let n = 1; n <= 8; n++) teste('F', n, () => d.aperta('b' + n)); for (let n = 17; n <= 32; n++) teste('F', n, () => d.aperta('b' + n));
      d.aperta('func'); d.carregaVoz(0); return JSON.stringify({ ruins, testados: n0.length }); })()`).then(JSON.parse);
    confere('todos os parâmetros de edição e de função respeitam mínimo e máximo (' + r.testados + ' testados)', r.ruins.length === 0 && r.testados > 40, r.ruins.join('; ')); }
  await ev("window.__dx.st.g.tune = 0; window.__dx.st.g.mono = 0; window.__dx.st.g.bendStep = 0; window.__dx.st.g.bendRange = 2; window.__dx.st.g.portaTime = 0; window.__dx.st.g.gliss = 0; window.__dx.carregaVoz(0)");
  /* ---- 3c. polifonia na página: 16 teclas e mais uma ---- */
  { await ev("for (let n = 40; n < 56; n++) window.__dx.nota(n, true)"); await espera(400); const a = await rmsMax(6, 50); await ev("window.__dx.nota(80, true)"); await espera(300); const b = await rmsMax(6, 50);
    await ev("for (let n = 40; n < 56; n++) window.__dx.nota(n, false); window.__dx.nota(80, false)");
    confere('16 teclas e mais uma: segue soando, sem estourar', a > 0.01 && b > 0.01 && b <= 1, 'rms ' + a.toFixed(3) + ' / ' + b.toFixed(3)); }
  /* ---- 4. edição com o mouse: botão, DATA ENTRY, NO/YES, OPERATOR SELECT ---- */
  await ev('window.__dx.st.op = 0; window.__dx.st.opOn = [1, 1, 1, 1, 1, 1]; window.__dx.st.modo = "play"; window.__dx.carregaVoz(0)');
  await clica(B('edit')); await clica(B('b27'));
  confere('EDIT + botão 27 mostram OUTPUT LEVEL do OP1', (await lcd()).startsWith('OUTPUT LEVEL') && (await lcd()).includes('OP1'), await lcd());
  const r = await rect('[aria-label="Data entry"]'); const x = r.x + r.w / 2;
  await mouse('mouseMoved', x, r.y + 20); await mouse('mousePressed', x, r.y + 20); await mouse('mouseMoved', x, r.y + r.h * 0.5); await mouse('mouseReleased', x, r.y + r.h * 0.5); await espera(80);
  const ol = (await ST()).ed.ops[0].ol; confere('arrastar o DATA ENTRY muda o valor', ol > 30 && ol < 70, 'OL ' + ol);
  await clica(B('si')); confere('YES soma 1', (await ST()).ed.ops[0].ol === ol + 1);
  await clica(B('no')); await clica(B('no')); confere('NO subtrai 1', (await ST()).ed.ops[0].ol === ol - 1);
  await clica(B('opsel')); await clica(B('b27')); confere('OPERATOR SELECT troca para o OP2', (await lcd()).includes('OP2'), await lcd());
  await clica(B('b1')); confere('botão 1 em EDIT liga/desliga o operador', (await lcd()).startsWith('OP ON/OFF') && (await lcd()).includes('011111'), await lcd()); await clica(B('b1'));
  await ev("window.__dx.aperta('b7')"); const algAntes = (await ST()).ed.alg; await ev("window.__dx.aperta('si')"); confere('botão 7 + YES troca o algoritmo', (await ST()).ed.alg === algAntes + 1);
  confere('diagrama grande acompanha o algoritmo', (await ev("document.querySelectorAll('.alg-cel')[" + (algAntes + 1) + '].firstChild.getAttribute("class")')).includes('at'));

  /* ---- 5. memória: STORE, salvamento e recarga ---- */
  await ev("window.__dx.aperta('store')"); await ev("window.__dx.aperta('b20')"); await espera(500);
  const s1 = await ST(); confere('STORE grava a voz editada na posição 20', s1.mem[19].alg === algAntes + 1 && s1.cur === 19 && !s1.editado);
  await ev("window.__dx.aperta('edit'); window.__dx.aperta('b8'); window.__dx.desliza(1)"); await espera(500);
  await recarrega(); const s2 = await ST();
  confere('autosave: banco, voz atual, voz em edição e flag de edição voltam depois de recarregar', s2.cur === 19 && s2.mem[19].alg === algAntes + 1 && s2.ed.fb === 7 && s2.editado === true, `cur ${s2.cur} fb ${s2.ed.fb}`);
  await ev("localStorage.setItem('sint-dx7-v1:estado', '{lixo')"); await recarrega();
  confere('salvamento corrompido: abre no padrão, sem erro', (await ST()).cur === 0 && !logs.slice(-3).some(l => /^(error|ERRO)/i.test(l)));
  await ev("localStorage.setItem('sint-dx7-v1:estado', JSON.stringify({ cur: 999, vol: 'x', mem: [1, 2], g: { tune: 1e9 }, seq: { passos: [] } }))"); await recarrega();
  { const s = await ST(); confere('salvamento com valores absurdos é limitado', s.cur === 31 && s.g.tune <= 75 && s.mem.length === 32); }
  await ev("localStorage.clear()"); await recarrega();

  /* ---- 6. acessórios: Hold, velocidade, controles, sequenciador ---- */
  await ev('window.__dx.carregaVoz(4)'); await clica('#hold'); await ev("window.__dx.nota(64, true)"); await espera(300); await ev("window.__dx.nota(64, false)"); await espera(1200);
  const rh = await rmsMax(); confere('Hold segura a nota depois de soltar a tecla', rh > 0.002, 'rms ' + rh.toFixed(3) + ' hold=' + (await ev('window.__dx.st.hold')) + ' vozes=' + (await ev('window.__dx.audio().pronto')));
  await clica('#hold'); await espera(1800); await ev('window.__dx.carregaVoz(0)');
  await ev("window.__dx.setCtl('breath', 0.5)"); confere('controle de sopro move o slider e o estado', (await ST()).cc.breath === 0.5 && (await ev("document.getElementById('ctl-breath').value")) === '50');
  await ev("window.__dx.aperta('func')"); await ev("window.__dx.aperta('b1')"); await ev("window.__dx.desliza(0.9)"); await ev("window.__dx.aperta('func')");
  await clica('#seq-aleat'); const pAleat = (await ST()).seq.passos.map(p => p.n + p.m).join();
  confere('Aleatório gera 16 passos dentro da escala e do teclado', (await ST()).seq.passos.length === 16 && (await ST()).seq.passos.every(p => p.n >= 36 && p.n <= 96), pAleat);
  await ev("window.__dx.carregaVoz(5)"); await clica('#seq-play'); await espera(1500);
  const rs = await rmsMax(10, 70); confere('sequenciador toca (voz MARIMBA)', rs > 0.002 && (await ev("document.getElementById('seq-play').getAttribute('aria-pressed')")) === 'true', 'rms ' + rs.toFixed(3));
  await clica('#seq-play'); await espera(1800); const rp = await rmsMax(5, 60); confere('Stop cala o sequenciador', rp < 0.001, 'rms ' + rp.toFixed(4));

  /* ---- 7. Zerar não apaga memórias nem ligações MIDI ---- */
  await ev("window.__dx.st.mem[3].nome = 'MINHA'; window.__dx.salva()"); await ev("window.__dx.st.vol = 0.3; window.__dx.st.g.tune = 20; window.__dx.st.seq.bpm = 200");
  await ev("localStorage.setItem('sint-dx7-v1:midi', JSON.stringify({ mapa: { '1:20': 'vol' }, disp: '', ativo: false }))");
  await clica('#zerar'); await clica('#zerar');
  { const s = await ST(); confere('Zerar volta volume, afinação e andamento ao padrão', s.vol === 1 && s.g.tune === 0 && s.seq.bpm === 120);
    confere('Zerar mantém as memórias', s.mem[3].nome === 'MINHA'); confere('Zerar mantém as ligações MIDI', (await ev("localStorage.getItem('sint-dx7-v1:midi')")).includes('1:20')); }
  await ev("window.__dx.st.mem[3].nome = 'FM'");

  /* ---- 8. MIDI com dispositivo substituto ---- */
  const msg = (a, b, c) => ev(`window.__dx.midi.mensagem({ data: [${a}, ${b}, ${c}] }, { id: 'x' })`);
  await ev("window.__dx.st.g.canal = 0; window.__dx.carregaVoz(0)");
  await msg(0x90, 60, 100); await espera(400); const rm = await rmsMax(); await msg(0x80, 60, 0);
  confere('nota MIDI com velocity toca', rm > 0.003, 'rms ' + rm.toFixed(3));
  await msg(0xE0, 0, 127); await espera(80); confere('pitch bend MIDI move a roda', (await ev("document.querySelector('.roda').style.getPropertyValue('--x')")) !== '0'); await msg(0xE0, 0, 64);
  await msg(0xD0, 127, 0); confere('aftertouch de canal chega ao controle AT', (await ST()).cc.at === 1); await msg(0xD0, 0, 0);
  await msg(0xC0, 7, 0); confere('program change seleciona a voz interna', (await ST()).cur === 7);
  await msg(0xB0, 1, 127); await espera(80); confere('CC 1 move a roda de modulação', (await ev("document.querySelectorAll('.roda')[1].style.getPropertyValue('--x')")) === '1');
  await msg(0xB0, 7, 64); confere('CC 7 muda o volume', Math.abs((await ST()).vol - 64 / 127) < 0.01);
  await ev("window.__dx.st.g.canal = 3"); await msg(0x90, 62, 100); await espera(200); const filtrado = (await ev("window.__dx.audio().no ? 1 : 0"));
  await msg(0x90 | 2, 62, 100); await espera(300); const rc = await rmsMax(6, 50); await msg(0x80 | 2, 62, 0);
  confere('filtro de canal: canal 3 passa e o 1 é ignorado', rc > 0.002 && filtrado === 1, 'rms ' + rc.toFixed(3)); await ev("window.__dx.st.g.canal = 0");
  // MIDI learn: escolher o volume, mexer num CC, depois outro controle
  await clica('#midi-aprende'); await mouse('mouseMoved', 5, 5); await ev("window.__dx.st.vol = 1; document.querySelector('[data-alvo=vol]').scrollIntoView({block:'center'})"); const rv = await rect('[data-alvo="vol"]');
  await mouse('mousePressed', rv.x + rv.w / 2, rv.y + rv.h / 2); await mouse('mouseReleased', rv.x + rv.w / 2, rv.y + rv.h / 2); await msg(0xB0, 20, 100);
  await clica('#midi-aprende'); await msg(0xB0, 20, 32);
  confere('MIDI learn liga o CC 20 ao volume', Math.abs((await ST()).vol - 32 / 127) < 0.01 && (await ev("localStorage.getItem('sint-dx7-v1:midi')")).includes('1:20'), (await ev("localStorage.getItem('sint-dx7-v1:midi')")));
  await clica('#midi-aprende'); await clica(B('b9')); await msg(0xB0, 21, 100); await clica('#midi-aprende');
  await ev("window.__dx.aperta('edit')"); const w0 = (await ST()).ed.lfoW; await msg(0xB0, 21, 127); await msg(0xB0, 21, 0); await msg(0xB0, 21, 127);
  confere('CC ligado a um botão age como gatilho ao cruzar 64', (await lcd()).startsWith('LFO WAVE') || (await ST()).modo === 'edit', await lcd()); void w0;
  await clica('#midi-desfaz'); await clica('#midi-apaga'); confere('apagar todas as ligações esvazia o mapa', !(await ev("localStorage.getItem('sint-dx7-v1:midi')")).includes('"1:'), await ev("localStorage.getItem('sint-dx7-v1:midi')"));
  await ev("window.__dx.salva()"); await espera(400);

  /* ---- 9. capturas ---- */
  await ev("window.scrollTo(0, 0); document.querySelector('.rolagem').scrollLeft = 0"); await espera(150);
  await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 960, height: 760, scale: 1 } }).then(r => writeFileSync(join(SAIDA, 'dx7-esquerda.png'), Buffer.from(r.result.data, 'base64')));
  await ev("document.querySelector('.rolagem').scrollLeft = 1200"); await espera(150);
  await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 960, height: 760, scale: 1 } }).then(r => writeFileSync(join(SAIDA, 'dx7-direita.png'), Buffer.from(r.result.data, 'base64')));

  /* ---- 10. celular ---- */
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }); await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await recarrega();
  const cel = await ev(`({ larg: innerWidth, rolaPagina: document.documentElement.scrollWidth > innerWidth + 1, pequenos: [...document.querySelectorAll('.bt, .bp, select, input[type=number], .vslider, .roda')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 43.5 || b.height < 43.5); }).length, barra: !document.getElementById('audio-bar').hidden })`);
  confere('celular (375 px): sem rolagem horizontal da página, alvos de 44 px e aviso de som desligado', !cel.rolaPagina && cel.pequenos === 0 && cel.barra, JSON.stringify(cel));
  confere('sem erros no console', !logs.some(l => /^(error|ERRO)/i.test(l)), logs.filter(l => /^(error|ERRO)/i.test(l)).join(' | '));
  ws.close();
} finally { proc.kill(); }
console.log(`\n${falhas.length} falha(s).`); process.exit(falhas.length ? 1 : 0);
