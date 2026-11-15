"""Carrega sp1200/index.html num Chrome sem janela e confere: erros no console, AudioWorklet em file://, pads (mouse e teclado),
sequenciador do painel (Run/Stop, gravação, Step Program), digitação de valor, acessórios (Aleatório, Zerar), carga de sample
(arquivo WAV gerado aqui, com truncagem), salvamento (localStorage + IndexedDB) e tela de 390 px.
Uso: python3 tests/medicao/sp1200/navegador.py [pasta-das-capturas]   (precisa de playwright e do Google Chrome)"""
import asyncio, math, os, struct, sys, tempfile
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
URL = 'file://' + os.path.join(RAIZ, 'sp1200', 'index.html')
SAIDA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
os.makedirs(SAIDA, exist_ok=True)
GANCHO = """
(() => { const orig = AudioNode.prototype.connect; window.__tap = { nos: 0, sp: 0 };
  AudioNode.prototype.connect = function (dest, ...r) {
    if (window.AudioWorkletNode && this instanceof AudioWorkletNode && !window.__an) { window.__tap.nos++; const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an); window.__an = an; }
    if (window.ScriptProcessorNode && this instanceof ScriptProcessorNode) window.__tap.sp++;
    return orig.call(this, dest, ...r); };
  window.__rms = () => { if (!window.__an) return -1; const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
  window.__pico = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, window.__rms()); await new Promise(r => setTimeout(r, 15)); } return p; };
})();
"""
falhas = []
def confere(nome, ok, detalhe=''):
    print(('ok   ' if ok else 'FORA ') + nome + (' — ' + str(detalhe) if detalhe != '' else ''))
    if not ok: falhas.append(nome)

def wav(caminho, seg, f=220.0, fs=44100):
    n = int(seg * fs); dados = b''.join(struct.pack('<h', int(20000 * math.sin(2 * math.pi * f * i / fs))) for i in range(n))
    with open(caminho, 'wb') as a:
        a.write(b'RIFF' + struct.pack('<I', 36 + len(dados)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, fs, fs * 2, 2, 16) + b'data' + struct.pack('<I', len(dados)) + dados)

async def main():
    tmp = tempfile.mkdtemp(); curto = os.path.join(tmp, 'curto.wav'); longo = os.path.join(tmp, 'longo.wav'); wav(curto, 0.3); wav(longo, 4.0)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1300, 'height': 1000})
        await ctx.add_init_script(GANCHO)
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('ERRO: ' + str(e)))
        lcd = lambda: pg.inner_text('#lcd')
        E = pg.evaluate
        await pg.goto(URL); await pg.wait_for_timeout(900)
        await pg.screenshot(path=os.path.join(SAIDA, 'sp1200-computador.png'), full_page=True)
        confere('título da página', await pg.title() == 'Clone do SP-1200')
        txt = (await E("document.querySelector('.gabinete').innerText")).lower()
        confere('painel sem marca nem nome de modelo', not any(x in txt for x in ('e-mu', 'emu ', 'sp-12', 'sp 12', 'sp12', '1200')))
        confere('kit sintetizado carregado em A1–A8 e B1', await E("window.__sp1200.st.sons.filter(s => s.n).length") == 9)
        confere('2,5 s por banco respeitados', await E("[0,1,2,3].every(b => window.__sp1200.st.sons.slice(b*8, b*8+8).reduce((a, s) => a + s.n, 0) <= 65100)"))
        # pads: mouse e teclado
        pad = pg.locator('.pad').first; cx = await pad.bounding_box()
        await pg.mouse.move(cx['x'] + 20, cx['y'] + 20); await pg.mouse.down(); r1 = await E('window.__pico(250)'); await pg.mouse.up()
        tap = await E('window.__tap')
        confere('motor carregado como AudioWorklet em file:// (sem cair na reserva)', tap['nos'] == 1 and tap['sp'] == 0, tap)
        confere('pad pelo mouse produz som', r1 > 0.003, round(r1, 4))
        await pg.wait_for_timeout(700); r0 = await E('window.__rms()'); confere('silêncio depois do som', r0 < 0.001, round(r0, 5))
        await pg.keyboard.down('KeyS'); r2 = await E('window.__pico(250)'); await pg.keyboard.up('KeyS')
        confere('pad pelo teclado do computador produz som', r2 > 0.003, round(r2, 4))
        # sequenciador
        confere('mostrador parado', 'Seg 00' in await lcd() and '94.0' in await lcd(), repr(await lcd()))
        await pg.click('button[title="Run/Stop"]'); r3 = await E('window.__pico(1500)')
        confere('Run/Stop toca o segmento', r3 > 0.01 and await E('window.__sp1200.rodando'), round(r3, 4)); confere('mostrador tocando', 'Toca' in await lcd(), repr(await lcd()))
        await pg.click('button[title="Run/Stop"]'); await pg.wait_for_timeout(900); r4 = await E('window.__rms()')
        confere('Run/Stop para', r4 < 0.002 and not await E('window.__sp1200.rodando'), round(r4, 5))
        # tempo digitado
        await pg.click('button[title="Tempo"]'); await pg.keyboard.type('1200'); await pg.keyboard.press('Escape')
        confere('Tempo pelo teclado numérico (1200 = 120,0 bpm)', await E('window.__sp1200.st.bpm') == 120)
        # gravação em tempo real: segmento 05 vazio, Record + Run, toca pad 1
        await pg.keyboard.type('05'); confere('seleciona segmento 05', 'Seg 05' in await lcd(), repr(await lcd()))
        await pg.click('button[title="Record/Edit"]'); await pg.click('button[title="Run/Stop"]'); await pg.wait_for_timeout(600)
        confere('gravando', await E('window.__sp1200.gravando') and 'Grav' in await lcd(), repr(await lcd()))
        await pg.keyboard.down('KeyA'); await pg.keyboard.up('KeyA'); await pg.wait_for_timeout(500); await pg.keyboard.down('KeyS'); await pg.keyboard.up('KeyS'); await pg.wait_for_timeout(300)
        await pg.click('button[title="Run/Stop"]'); await pg.wait_for_timeout(300)
        evs = await E('window.__sp1200.st.segs[5].evs'); confere('notas gravadas e quantizadas em 1/16 (múltiplos de 6 pulsos)', len(evs) == 2 and all(e[0] % 6 == 0 for e in evs), evs)
        # Step Program
        await pg.click('button[title="Mix Change / Step Program"]'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.down('KeyD'); await pg.keyboard.up('KeyD')
        tela = await lcd(); await pg.keyboard.press('Enter')
        evs = await E('window.__sp1200.st.segs[5].evs'); confere('Step Program grava no passo 3 (pulso 12)', [12, 2, 31, -1] in evs, repr(tela))
        # Swing e Auto Correct pela lista
        await pg.click('button[title="Repeat / Swing"]'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Enter')
        confere('Swing 58 % no segmento', await E('window.__sp1200.st.segs[5].swing') == 2)
        # Set-up 18: pad 1 passa a DECAYED; Set-up 17: canal 7
        await pg.click('button[title="Set-up"]'); await pg.keyboard.type('18'); await pg.keyboard.down('KeyA'); await pg.keyboard.up('KeyA'); await pg.keyboard.type('2')
        confere('Set-up 18 troca Tune por Decay', await E('window.__sp1200.st.sons[0].modo') == 1)
        await pg.click('button[title="Set-up"]'); await pg.keyboard.type('17'); await pg.keyboard.down('KeyA'); await pg.keyboard.up('KeyA'); await pg.keyboard.type('7')
        confere('Set-up 17 muda o canal de saída', await E('window.__sp1200.st.sons[0].canal') == 6)
        # sliders: modo e digitação
        await pg.click('#bt-modo'); v = pg.locator('#faders .val').nth(1); await v.click(); await pg.keyboard.type('20'); await pg.keyboard.press('Enter')
        confere('digitar o valor do slider 2 em Tune/Decay', await E('window.__sp1200.st.sons[1].val') == 20 and await v.inner_text() == '20')
        await pg.click('#bt-modo'); v = pg.locator('#faders .val').nth(1); await v.click(); await pg.keyboard.type('12'); await pg.keyboard.press('Enter')
        confere('digitar o valor do slider 2 em Mix', await E('window.__sp1200.st.sons[1].nivel') == 12)
        # carregar sample: curto em B2, longo pede truncagem
        await pg.click('#bt-banco'); await pg.keyboard.down('KeyS'); await pg.keyboard.up('KeyS')
        await pg.set_input_files('#arq-audio', curto); await pg.wait_for_timeout(700)
        n = await E('window.__sp1200.st.sons[9].n'); confere('WAV de 0,3 s convertido para 26,04 kHz (≈ 7812 amostras)', abs(n - 7812) <= 2, n)
        confere('amostras em 12 bits (−2048 a 2047)', await E('window.__sp1200.audio[9].every(v => v >= -2048 && v <= 2047) && Math.max(...window.__sp1200.audio[9]) > 1000'))
        await pg.keyboard.down('KeyD'); await pg.keyboard.up('KeyD'); await pg.set_input_files('#arq-audio', longo); await pg.wait_for_timeout(900)
        confere('arquivo de 4 s: a página oferece truncar', await pg.is_visible('#trunca'), await pg.inner_text('#trunca-txt'))
        await pg.click('#trunca-sim'); await pg.wait_for_timeout(900)
        tot = await E('window.__sp1200.st.sons.slice(8, 16).reduce((a, s) => a + s.n, 0)'); confere('truncado ao que cabe no banco (2,5 s = 65100 amostras)', tot == 65100 and await E('window.__sp1200.st.sons[10].n') > 30000, tot)
        # recarregar: estado e áudio voltam
        await pg.wait_for_timeout(600); await pg.reload(); await pg.wait_for_timeout(900)
        confere('recarregar mantém segmento, andamento e parâmetros (localStorage)', await E('window.__sp1200.st.seg === 5 && window.__sp1200.st.bpm === 120 && window.__sp1200.st.segs[5].evs.length === 3 && window.__sp1200.st.sons[0].modo === 1'))
        confere('recarregar mantém o áudio dos samples (IndexedDB)', await E('window.__sp1200.audio[10] instanceof Int16Array && window.__sp1200.audio[10].length === window.__sp1200.st.sons[10].n && window.__sp1200.audio[0].length > 1000'))
        # acessórios
        await pg.click('#bt-banco'); await pg.click('#bt-banco'); await pg.click('#bt-banco')   # volta ao banco A (B estava salvo)
        await pg.click('#aleat'); n = await E('window.__sp1200.st.segs[5].evs.length'); confere('Aleatório gera notas no segmento atual', n > 8, n)
        await pg.click('#zerar'); confere('Zerar pede confirmação', await E('window.__sp1200.st.seg') == 5 and await pg.is_visible('#zerar-nao'))
        await pg.click('#zerar'); await pg.wait_for_timeout(500)
        confere('Zerar volta ao padrão', await E('window.__sp1200.st.seg === 0 && window.__sp1200.st.bpm === 94 && !window.__sp1200.st.segs[5] && window.__sp1200.st.sons[10].n === 0 && window.__sp1200.st.sons[0].modo === 0'))
        await pg.click('button[title="Run/Stop"]'); r5 = await E('window.__pico(1200)'); await pg.click('button[title="Run/Stop"]')
        confere('toca depois do Zerar', r5 > 0.01, round(r5, 4))
        ruins = [l for l in logs if l.startswith(('error', 'ERRO', 'warning'))]
        confere('console sem erros', not ruins, ruins[:4])
        await ctx.close()
        # ---- celular ----
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        await ctx.add_init_script(GANCHO); pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('ERRO: ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(900)
        confere('aviso "Som desligado" aparece em tela de toque', await pg.is_visible('#audio-bar'))
        await pg.screenshot(path=os.path.join(SAIDA, 'sp1200-celular.png'), full_page=True)
        confere('página não estoura a largura de 390 px', await pg.evaluate('document.documentElement.scrollWidth') <= 390, await pg.evaluate('document.documentElement.scrollWidth'))
        peq = await pg.evaluate("[...document.querySelectorAll('button:not([hidden]), .fader, .giro')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44) && !e.classList.contains('val'); }).map(e => (e.title || e.id || e.className) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))")
        confere('alvos de toque com 44 px ou mais (fora as caixas de valor)', not peq, peq[:5])
        await pg.locator('.pad').first.tap(); await pg.wait_for_timeout(400)
        confere('toque liga o áudio e o aviso some', not await pg.is_visible('#audio-bar') and (await pg.evaluate('window.__tap'))['nos'] == 1)
        await pg.locator('.pad').first.tap(); r = await pg.evaluate('window.__pico(250)'); confere('pad por toque produz som', r > 0.003, round(r, 4))
        ruins = [l for l in logs if l.startswith(('error', 'ERRO', 'warning'))]; confere('console sem erros (celular)', not ruins, ruins[:4])
        await b.close()
    print('\n' + ('TUDO OK' if not falhas else str(len(falhas)) + ' FORA: ' + '; '.join(falhas))); sys.exit(1 if falhas else 0)
asyncio.run(main())
