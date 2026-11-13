# Aplicativo Sintetizadores: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empacotar as 9 páginas Web Audio do repositório `vonhauke/Sintetizadores` num único app com menu, como instalador (Windows/Mac) e como PWA offline.

**Architecture:** As páginas continuam estáticas e independentes. Uma lista única de instrumentos (`instruments.json`) alimenta o menu, o service worker e o Electron. O Electron abre o menu e cria uma janela por instrumento. O PWA é publicado no GitHub Pages a partir de uma pasta `dist-web/` montada por script.

**Tech Stack:** HTML/JS estático, Node 20+ (`node:test`, sem framework), Electron + electron-builder, sharp (só para gerar ícones), GitHub Actions.

**Spec:** `sintetizadores-app-design.md` (mesma pasta deste plano).

## Global Constraints

- Nome do app: "Sintetizadores". appId: `com.vonhauke.sintetizadores`.
- Alvos: `.exe` NSIS x64 (Windows); `.dmg` arm64 e x64 (Mac). Sem assinatura de código, sem loja.
- Nada pode depender de internet em runtime: zero `http(s)://` em `src`/`href`/`url()` nas páginas.
- Todos os caminhos são relativos (o PWA roda em `/Sintetizadores/`, subcaminho do GitHub Pages).
- Fontes locais: Barlow (300, 400, 500, 600), Barlow Condensed (500, 600, 700), Michroma (400), subconjuntos latin e latin-ext, woff2.
- O som e o visual dos instrumentos não mudam; a única edição nas páginas é trocar o `<link>` do Google Fonts.
- Instrumentos: `101`, `106`, `303`, `606`, `808`, `909`, `bumbo-808`, `caixa-808`, `bateria` (a antiga raiz, com 808/909/606/707).
- Trabalho num clone em `Sintetizadores/` dentro da pasta de trabalho, branch `feat/app`. Nada é enviado ao GitHub (push, PR, tag, Pages) sem o OK do Pedro.

## Review Focus

1. PWA sob subcaminho: qualquer `href`/`src` começando com `/` quebra no GitHub Pages. Teste varre todas as páginas.
2. Links do menu para pasta (`101/`) não abrem em `file://` no Electron. Têm de apontar para `.../index.html`.
3. Áudio mudo até haver gesto do usuário. Electron precisa de `autoplayPolicy: 'no-user-gesture-required'`.
4. Instalação offline falha inteira se um arquivo do pré-cache não existir; e o cache antigo não pode servir versão velha. Teste confere existência e versão por hash.
5. Mac: fechar todas as janelas não encerra o app; clicar no Dock reabre o menu. Abrir o mesmo instrumento duas vezes reaproveita a janela.

---

### Task 1: Clone, reestruturação e fontes offline

**Files:**
- Create: `scripts/vendor-fonts.mjs`, `fonts/fonts.css`, `fonts/*.woff2`, `tests/offline.test.mjs`, `package.json` (só `"type": "module"`, `"scripts": {"test": "node --test tests/"}`)
- Move: `index.html` → `bateria/index.html`
- Modify: o `<head>` de cada página de instrumento

**Interfaces:**
- Produces: `fonts/fonts.css` (relativo a si mesmo, `url(./arquivo.woff2)`); páginas apontam `../fonts/fonts.css`.

- [ ] **Step 1:** Clonar `https://github.com/vonhauke/Sintetizadores.git` em `Sintetizadores/` na pasta de trabalho, criar a branch `feat/app`, mover a raiz com `git mv index.html bateria/index.html` (criar a pasta antes).
- [ ] **Step 2: Escrever o teste que falha** em `tests/offline.test.mjs`: para cada instrumento, `external URLs` = nenhuma ocorrência de `/(src|href)="https?:|url\(https?:|@import[^;]*https?:/`; `fonts.css` existe e todo `url(...)` dele aponta para arquivo existente em `fonts/`; nenhum `href`/`src` começa com `/` (Review Focus 1). Lista de instrumentos lida de `instruments.json` (criado na Task 2; aqui usar a lista fixa dos 9 e trocar na Task 2).
- [ ] **Step 3:** Rodar `npm test`. Esperado: FALHA (links do Google em todas as páginas).
- [ ] **Step 4: Implementar `scripts/vendor-fonts.mjs`** (`node scripts/vendor-fonts.mjs`): baixa o CSS da API do Google Fonts com User-Agent de Chrome moderno para as três famílias e pesos acima, mantém só os blocos `latin` e `latin-ext`, baixa cada woff2 para `fonts/`, reescreve `url()` para `./nome.woff2`, grava `fonts/fonts.css`. Rodar uma vez e commitar o resultado (o script é só para reproduzir).
- [ ] **Step 5:** Em cada página, remover os `<link>` de `fonts.googleapis.com`/`fonts.gstatic.com` e inserir `<link rel="stylesheet" href="../fonts/fonts.css">` (use `sed`/script, não edição manual de 9 arquivos).
- [ ] **Step 6:** `npm test`. Esperado: PASSA. Abrir `bateria/index.html` e `303/index.html` no navegador com a rede desligada e comparar a aparência com a versão original (fontes iguais, som tocando).
- [ ] **Step 7:** Commit `feat: fontes locais e bateria movida para bateria/`.

### Task 2: Menu inicial

**Files:**
- Create: `instruments.json`, `index.html` (menu novo), `menu.css`, `tests/menu.test.mjs`

**Interfaces:**
- Produces: `instruments.json` = lista de `{ "id": string, "name": string, "description": string, "path": string }`, com `path` sempre `"<id>/index.html"`. Consumido por: teste offline (trocar a lista fixa), `scripts/build-web.mjs` (Task 3), `electron/main.js` (Task 4).

- [ ] **Step 1: Teste que falha** `tests/menu.test.mjs`: (a) `instruments.json` tem 9 entradas, ids únicos, cada `path` existe e termina em `/index.html`; (b) `index.html` contém um `<a href="…" target="_blank">` para cada `path` (Review Focus 2); (c) não existe link terminando em `/`.
- [ ] **Step 2:** Rodar. Esperado: FALHA (arquivos não existem).
- [ ] **Step 3:** Criar `instruments.json` com nomes e descrições curtas em português (ex.: "TB-303, baixo ácido"). Escrever o menu: grade responsiva de cartões, `<a>` por instrumento, estilo escuro com as fontes locais (Michroma nos títulos, Barlow no texto), tag `<title>Sintetizadores</title>`. Os cartões são gerados por script inline a partir de `instruments.json` com `fetch`? **Não**: em `file://` o `fetch` falha. Gerar os `<a>` estaticamente no HTML por `scripts/build-menu.mjs`, que lê o JSON e reescreve a seção entre marcadores `<!-- cards -->`; o teste (b) valida o resultado.
- [ ] **Step 4:** `npm test`. Esperado: PASSA. Abrir `index.html` por `file://` e clicar em cada cartão: todos abrem.
- [ ] **Step 5:** Commit `feat: menu inicial`.

### Task 3: PWA (ícones, manifest, service worker, publicação)

**Files:**
- Create: `assets/icon.svg`, `scripts/make-icons.mjs`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `build/icon.png` (1024), `manifest.webmanifest`, `scripts/build-web.mjs`, `sw.js` (modelo), `.github/workflows/pages.yml`, `tests/pwa.test.mjs`
- Modify: `index.html` (link do manifest, registro do SW), `package.json` (devDependency `sharp`, script `build:web`)

**Interfaces:**
- Produces: `scripts/build-web.mjs` exporta `webFiles(): string[]` (caminhos relativos de tudo que o app web precisa: `index.html`, `menu.css`, `manifest.webmanifest`, `sw.js`, `instruments.json`, páginas, `fonts/**`, `icons/**`) e, ao rodar, copia esses arquivos para `dist-web/` substituindo em `dist-web/sw.js` a constante `PRECACHE` pela lista e `VERSION` por um hash do conteúdo. Consumido por `pages.yml` e pelo Electron (`files` do builder).

- [ ] **Step 1: Teste que falha** `tests/pwa.test.mjs`: depois de `build-web`, (a) todo caminho de `PRECACHE` em `dist-web/sw.js` existe em `dist-web/` (Review Focus 4); (b) `VERSION` muda quando um arquivo muda (rodar duas vezes com um byte alterado numa cópia temporária); (c) manifest tem `start_url: "./"`, `scope: "./"`, `display: "standalone"`, nome "Sintetizadores" e os 3 ícones, e cada ícone existe com as dimensões declaradas (192, 512, 512); (d) o `index.html` registra `./sw.js` com caminho relativo.
- [ ] **Step 2:** Rodar. Esperado: FALHA.
- [ ] **Step 3:** `assets/icon.svg`: ícone simples e legível em 16 px (pad de drum machine/onda sobre fundo escuro; meu desenho, ajustável depois). `make-icons.mjs` renderiza os PNGs com `sharp` (maskable com margem de segurança de 20%).
- [ ] **Step 4:** `sw.js`: no `install`, `cache.addAll(PRECACHE)` num cache chamado `sint-<VERSION>` e `skipWaiting`; no `activate`, apaga caches de outras versões e `clients.claim`; no `fetch`, cache-first com fallback à rede. `build-web.mjs` como na interface acima.
- [ ] **Step 5:** `pages.yml`: em push na `main`, roda `npm ci && npm run build:web` e publica `dist-web/` com `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [ ] **Step 6:** `npm test`. Esperado: PASSA. Servir `dist-web/` num subcaminho (`npx http-server` com prefixo `/Sintetizadores/` ou equivalente), abrir no Chrome, conferir o botão de instalar, instalar, desligar a rede e reabrir: o menu e dois instrumentos funcionam offline.
- [ ] **Step 7:** Commit `feat: pwa offline`.

### Task 4: App Electron

**Files:**
- Create: `electron/main.js`, `electron/windows.js`, `tests/windows.test.mjs`
- Modify: `package.json` (`main`, devDependencies `electron`, `electron-builder`, scripts `start`, `pack`, `dist`, bloco `build`)

**Interfaces:**
- Produces: `electron/windows.js` exporta `isInternalUrl(url: string, appRoot: string): boolean` (verdadeiro só para `file://` dentro de `appRoot`) e `windowKey(url: string): string` (caminho normalizado do instrumento, usado para reaproveitar janela). `main.js` consome ambos.

- [ ] **Step 1: Teste que falha** `tests/windows.test.mjs`: `isInternalUrl` aceita `file:///app/101/index.html` com root `/app`, recusa `https://example.com`, `file:///outra/x.html` e `file:///app/../etc/x`; `windowKey` dá a mesma chave para `.../101/index.html` e `.../101/index.html#x`.
- [ ] **Step 2:** Rodar. Esperado: FALHA.
- [ ] **Step 3:** Implementar `windows.js`.
- [ ] **Step 4: `electron/main.js`:** trava de instância única; abre o menu (`index.html`, 960×700); `webPreferences: { autoplayPolicy: 'no-user-gesture-required', contextIsolation: true, nodeIntegration: false }`; `setWindowOpenHandler`: URL interna → cria `BrowserWindow` do instrumento (ou foca a já aberta, via `windowKey`) e nega o popup padrão; URL externa → negada. `window-all-closed`: encerra só fora do Mac; `activate`: reabre o menu se não houver janelas (Review Focus 5). Barra de menu padrão com Recarregar e DevTools só em desenvolvimento.
- [ ] **Step 5: `package.json > build`:** `appId`, `productName`, `files` = `webFiles()` + `electron/**` (usar a lista da Task 3 gerada num `files` explícito via script `prebuild`), `directories.buildResources: "build"`, `win.target: nsis x64`, `mac.target: dmg arm64 e x64`, `mac.identity: null`. Se o app arm64 não abrir sem assinatura, adicionar um hook `afterPack` com assinatura ad-hoc (`codesign --force --deep -s -`); verificar no passo 6.
- [ ] **Step 6:** `npm test` (PASSA). `npm run pack` (gera o app sem instalador). Abrir o `.app` no Mac: menu aparece; clicar em "808" abre outra janela; clicar de novo foca a mesma; o som toca sem clique prévio no menu (Review Focus 3); fechar todas as janelas e clicar no Dock reabre o menu.
- [ ] **Step 7:** Commit `feat: app electron`.

### Task 5: CI de build, Release e README

**Files:**
- Create: `.github/workflows/build.yml`
- Modify: `README.md`

- [ ] **Step 1:** `build.yml`: gatilho em tag `v*` e `workflow_dispatch`; job `windows-latest` roda `npm ci && npm run dist -- --win` ; job `macos-latest` roda `npm ci && npm run dist -- --mac --arm64 --x64`; cada um envia os instaladores como artefato; um job final (só em tag) cria a Release com `softprops/action-gh-release` anexando `.exe` e os dois `.dmg`.
- [ ] **Step 2:** README em português: o que é, link do PWA (`https://vonhauke.github.io/Sintetizadores/`), onde baixar os instaladores, e o passo a passo da primeira abertura sem assinatura (Windows: "Mais informações" → "Executar assim mesmo"; Mac: botão direito → Abrir, ou `xattr -dr com.apple.quarantine /Applications/Sintetizadores.app`).
- [ ] **Step 3:** Commit `ci: build e release`. **Parar e pedir o OK do Pedro** para: fazer push da branch, abrir PR, ativar o GitHub Pages (Settings → Pages → Source: GitHub Actions) e criar a tag de teste `v0.1.0`.
- [ ] **Step 4 (após o OK):** disparar o workflow e conferir: a Release lista exatamente 3 arquivos (um `.exe`, dois `.dmg`); baixar o `.dmg` correto e instalar no Mac; abrir a URL do PWA publicado e instalar. O `.exe` não pode ser testado aqui: dizer isso ao Pedro e pedir que teste no Windows.
