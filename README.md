# Sintetizadores

Drum machines (808, 909, 606, 707) e sintetizadores (TB-303, SH-101, Juno-106, Minimoog) em Web Audio, reunidos num único aplicativo com menu. Tudo funciona offline.

## Como usar

- **No navegador (PWA):** https://vonhauke.github.io/Sintetizadores/ — no Chrome ou no Edge, use o botão de instalar na barra de endereço para ter o app como programa.
- **Instalador para o computador:** baixe o arquivo da versão mais recente em [Releases](https://github.com/vonhauke/Sintetizadores/releases): `.exe` para Windows, `.dmg` para Mac (escolha arm64 para chips Apple Silicon, x64 para Intel).

## Primeira abertura (os instaladores não são assinados)

- **Windows:** ao abrir o instalador aparece "O Windows protegeu o computador". Clique em **Mais informações** e depois em **Executar assim mesmo**.
- **Mac:** arraste o app para Aplicativos, clique com o botão direito em Sintetizadores e escolha **Abrir**. Se ainda assim for bloqueado, rode no Terminal:
  ```
  xattr -dr com.apple.quarantine /Applications/Sintetizadores.app
  ```

## Desenvolvimento

```
npm install
npm test            # testes
npm start           # abre o app (Electron)
npm run build:web   # monta dist-web/ (PWA)
npm run pack        # empacota sem instalador
npm run dist        # gera o instalador do seu sistema
```

A lista de instrumentos fica em `instruments.json`. Depois de editá-la, rode `node scripts/build-menu.mjs` para regenerar o menu.
