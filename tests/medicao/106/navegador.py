"""Carrega 106/index.html num Chrome sem janela e confere: erros no console, som saindo do AudioWorklet,
memória de patches, digitação de valor, sequenciador, Zerar, Hold e tamanho dos alvos de toque.
Uso: python3 tests/medicao/106/navegador.py [pasta-das-capturas]   (precisa de playwright e do Google Chrome)"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
URL = 'file://' + os.path.join(RAIZ, '106', 'index.html')
SAIDA = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
GANCHO = """
(() => { const orig = AudioNode.prototype.connect; window.__tap = { nos: 0, sp: 0 };
  AudioNode.prototype.connect = function (dest, ...r) {
    if (window.AudioWorkletNode && this instanceof AudioWorkletNode && !window.__an) { window.__tap.nos++; const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an); window.__an = an; }
    if (window.ScriptProcessorNode && this instanceof ScriptProcessorNode) window.__tap.sp++;
    return orig.call(this, dest, ...r); };
  window.__rms = () => { if (!window.__an) return -1; const b = new Float32Array(2048); window.__an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
})();
"""
falhas = []
def confere(nome, ok, detalhe=''):
    print(('ok   ' if ok else 'FORA ') + nome + (' — ' + str(detalhe) if detalhe != '' else ''))
    if not ok: falhas.append(nome)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---- computador ----
        ctx = await b.new_context(viewport={'width': 1600, 'height': 1000})
        await ctx.add_init_script(GANCHO)
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('ERRO: ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        await pg.screenshot(path=os.path.join(SAIDA, '106-computador.png'), full_page=True)
        confere('título da página', await pg.title() == 'Clone do Juno-106')
        txt = await pg.evaluate("document.querySelector('.gabinete').innerText")
        confere('painel sem marca nem nome de modelo', not any(x in txt.lower() for x in ('juno', 'roland', '106')))
        tecla = pg.locator('#tecl .br[data-n="60"]'); cx = await tecla.bounding_box()
        await pg.mouse.move(cx['x'] + 10, cx['y'] + 150); await pg.mouse.down(); await pg.wait_for_timeout(700)
        r1 = await pg.evaluate('window.__rms()'); tap = await pg.evaluate('window.__tap')
        await pg.mouse.up(); await pg.wait_for_timeout(1500); r2 = await pg.evaluate('window.__rms()')
        confere('motor carregado como AudioWorklet em file:// (sem cair na reserva)', tap['nos'] == 1 and tap['sp'] == 0, tap)
        confere('tecla da tela produz som', r1 > 0.003, round(r1, 4)); confere('som para depois de soltar', r2 < r1 * 0.2, round(r2, 5))
        await pg.keyboard.down('KeyA'); await pg.wait_for_timeout(400); r3 = await pg.evaluate('window.__rms()'); await pg.keyboard.up('KeyA')
        confere('teclado do computador produz som', r3 > 0.003, round(r3, 4))
        # memória: escolher B / banco 3 / patch 2, editar, gravar em A / banco 8 / patch 8
        await pg.click('button[title="GROUP B"]'); await pg.click('button[title="BANK 3"]'); await pg.click('button[title="PATCH NUMBER 2"]')
        confere('mostrador após escolher B32', (await pg.inner_text('.visor')).replace('\n', '').replace(' ', '') == '32', await pg.inner_text('.etiqueta'))
        val = pg.locator('section[aria-label="VCF"] .ctl').first.locator('.val')
        await val.click(); await pg.keyboard.type('77'); await pg.keyboard.press('Enter')
        confere('digitar o valor de um controle', await val.inner_text() == '77'); confere('pontos de "editado" acendem', await pg.evaluate("document.querySelector('.visor').classList.contains('editado')"))
        await pg.click('button[title="GROUP A"]'); await pg.click('button[title^="WRITE"]')
        # o GROUP A recarregou o patch A32; refaz a edição e grava em A88
        await pg.click('button[title^="WRITE"]'); await val.click(); await pg.keyboard.type('77'); await pg.keyboard.press('Enter')
        await pg.click('button[title^="WRITE"]'); await pg.click('button[title="BANK 8"]'); await pg.click('button[title="PATCH NUMBER 8"]')
        mem = await pg.evaluate("JSON.parse(localStorage.getItem('sint-106-v2:patches'))[63].substr(10, 2)")
        confere('WRITE grava em A88 no localStorage', mem == '4d', mem)
        # sequenciador, aleatório, hold, zerar
        antes = await pg.evaluate("[...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')")
        await pg.click('#seq-aleat'); depois = await pg.evaluate("[...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')")
        confere('Aleatório muda a sequência', antes != depois, depois)
        await pg.click('#seq-play'); await pg.wait_for_timeout(1200)
        m = 0
        for _ in range(10):
            m = max(m, await pg.evaluate('window.__rms()')); await pg.wait_for_timeout(60)
        ag = await pg.evaluate("document.querySelectorAll('.passo.agora').length")
        confere('sequenciador toca e marca o passo', m > 0.002 and ag == 1, round(m, 4))
        await pg.click('#seq-play'); await pg.wait_for_timeout(1500); confere('Stop silencia', await pg.evaluate('window.__rms()') < 0.002)
        await pg.click('button[title="BANK 1"]'); await pg.click('button[title="PATCH NUMBER 1"]')
        await pg.click('#hold'); await tecla.click(); await pg.wait_for_timeout(600); rh = await pg.evaluate('window.__rms()')
        await pg.click('#hold'); await pg.wait_for_timeout(1500); rs = await pg.evaluate('window.__rms()')
        confere('Hold mantém a nota e, desligado, solta', rh > 0.003 and rs < rh * 0.2, (round(rh, 4), round(rs, 5)))
        await pg.click('#zerar'); await pg.click('#zerar'); await pg.wait_for_timeout(500)
        z = await pg.evaluate("[document.querySelector('.etiqueta').textContent, [...document.querySelectorAll('.passo .nota')].map(e => e.textContent).join(' ')]")
        confere('Zerar (com confirmação) volta painel e sequência ao padrão', z[0].startswith('A11') and z[1] == antes, z[0])
        est = json.loads(await pg.evaluate("localStorage.getItem('sint-106-v2:estado')"))
        confere('salvamento automático da última configuração', est['mem']['b'] == 0 and len(est['p']) == 36)
        await pg.reload(); await pg.wait_for_timeout(400)
        confere('patch gravado continua depois de recarregar', await pg.evaluate("JSON.parse(localStorage.getItem('sint-106-v2:patches'))[63].substr(10, 2)") == '4d')
        confere('sem erros nem avisos no console', not logs, logs); await ctx.close()
        # ---- tela de iPhone (emulada; não substitui o aparelho real) ----
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        await ctx.add_init_script(GANCHO)
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('ERRO: ' + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        confere('aviso "Som desligado, toque para ativar" visível antes do primeiro toque', await pg.is_visible('#audio-bar'), await pg.inner_text('#audio-bar'))
        await pg.screenshot(path=os.path.join(SAIDA, '106-celular.png'), full_page=True)
        peq = await pg.evaluate("[...document.querySelectorAll('button, .fader, .botao-giro, .alavanca')].filter(e => e.offsetParent && !e.hidden).map(e => { const r = e.getBoundingClientRect(); return [e.className + ':' + (e.title || e.textContent || '').slice(0, 20), Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 44 || x[2] < 44)")
        confere('alvos de toque com pelo menos 44 px (exceto o número clicável dos controles)', all('val' in x[0] for x in peq), [x for x in peq if 'val' not in x[0]][:6])
        await pg.tap('#audio-bar'); await pg.wait_for_timeout(600)
        confere('aviso some depois do toque', not await pg.is_visible('#audio-bar'))
        await pg.tap('#tecl .br[data-n="60"]'); 
        await pg.dispatch_event('#tecl', 'pointerdown', {'pointerId': 5, 'clientX': 60, 'clientY': (await pg.locator('#tecl').bounding_box())['y'] + 120, 'bubbles': True}); await pg.wait_for_timeout(500)
        confere('toque no teclado produz som', await pg.evaluate('window.__rms()') > 0.003)
        larg = await pg.evaluate("[document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.documentElement).touchAction]")
        confere('página não estoura a largura da tela; touch-action: manipulation', larg[0] <= larg[1] + 1 and larg[2] == 'manipulation', larg)
        confere('sem erros nem avisos no console (tela estreita)', not logs, logs)
        await ctx.close(); await b.close()
    print(f"\n{len(falhas)} verificação(ões) fora do esperado."); sys.exit(1 if falhas else 0)
asyncio.run(main())
