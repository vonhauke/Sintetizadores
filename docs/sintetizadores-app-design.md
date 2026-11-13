# Aplicativo Sintetizadores: desenho

Data: 2026-11-12. Repositório: https://github.com/vonhauke/Sintetizadores

## Intenção
Pedro tem 9 páginas web (Web Audio) com sintetizadores e drum machines. Quer usá-las como programa instalado no computador, em Windows e Mac, e também como PWA. Um único aplicativo, com menu para escolher o instrumento.

## O que existe hoje (verificado)
- Páginas independentes: `101`, `106`, `303`, `606`, `808`, `909`, `bumbo-808`, `caixa-808` e a bateria da raiz (`index.html`: 808, 909, 606 e 707 juntas).
- Só Web Audio, sem bibliotecas e sem MIDI.
- Única dependência de internet: Google Fonts (Barlow, Barlow Condensed, Michroma).
- O `index.html` da raiz NÃO é um menu.

## Objetivos
- Instalador tradicional: `.exe` (Windows), `.dmg` (Mac Apple Silicon e Intel).
- PWA instalável (Chrome/Edge/Safari), funcionando offline.
- Tudo offline, inclusive fontes.
- Um menu inicial com os instrumentos; cada instrumento pode abrir em janela própria.

## Não objetivos
- Plugin VST/AU, ou saída MIDI/áudio para DAW.
- Mudar o som ou o visual dos instrumentos.
- Um instalador por instrumento.
- Loja de apps (Microsoft Store, Mac App Store).

## Abordagens consideradas
1. **Um app com menu (escolhida por Pedro).** Um instalador por sistema, um PWA, manutenção única.
2. Um app por instrumento: 9 instaladores e 9 PWAs. Descartada, manutenção multiplicada.
3. Um app com menu mais instalação individual no PWA. Oferecida, Pedro preferiu a 1.

## Decisões
- **Estrutura (minha decisão):** tudo no mesmo repositório. A bateria da raiz vai para `bateria/index.html`, e a raiz passa a ser o menu. Não há URL pública hoje (Pages desligado), então nada quebra.
- **Menu (minha decisão):** grade de cartões, um por instrumento, no mesmo estilo visual das páginas (fontes e cores já usadas).
- **Fontes (minha decisão):** baixar os arquivos das três famílias para uma pasta `fonts/` e trocar o `<link>` do Google por `@font-face` local em todas as páginas.
- **Instalável (minha decisão):** Electron + electron-builder. Cada instrumento abre em sua própria janela, a partir do menu. Ícone próprio, gerado por mim (simples, ajustável depois).
- **Build (minha decisão):** GitHub Actions gera `.exe` e `.dmg` (arm64 e x64) e anexa a uma Release, como no projeto SnapYou.
- **PWA (minha decisão):** `manifest.webmanifest` + service worker com cache de todas as páginas e fontes, publicado no GitHub Pages deste repositório.
- **Nome do app (minha decisão):** "Sintetizadores". Fácil de trocar.

## Restrições e riscos
- **Sem assinatura de código:** o Windows mostra o aviso do SmartScreen e o Mac bloqueia o app na primeira abertura (Gatekeeper). Funciona, mas o usuário precisa clicar em "Executar mesmo assim" (Windows) ou abrir com botão direito → Abrir (Mac). Assinar exige certificado pago (Apple Developer, cerca de US$ 99/ano). Fica fora do escopo, a menos que Pedro peça.
- O PWA no Safari/iOS tem limites de áudio em segundo plano; no desktop funciona normalmente.
- Não consigo testar o `.exe` nem o Mac Intel aqui; o Mac atual e o build do Actions são o que dá para verificar.

## Deixado para quem for construir
Estrutura exata de pastas do Electron, versões das dependências, layout fino do menu, desenho do ícone, configuração do cache do service worker.
