// Botão "Menu" nas páginas dos instrumentos, só no PWA instalado (celular).
// No app desktop (file://) e em abas normais do navegador, cada instrumento já
// abre em sua própria janela/aba, então nada é adicionado.
(function () {
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
  if (!standalone || !location.protocol.startsWith('http')) return;

  var a = document.createElement('a');
  a.href = '../index.html';
  a.textContent = '‹ Menu';
  a.setAttribute('aria-label', 'Voltar ao menu de instrumentos');
  a.style.cssText = 'position:fixed;z-index:2147483647;' +
    'top:calc(env(safe-area-inset-top,0px) + 6px);left:calc(env(safe-area-inset-left,0px) + 6px);' +
    'padding:8px 14px;border-radius:999px;background:rgba(27,29,32,.85);color:#fff;' +
    'font:600 14px/1 system-ui,sans-serif;text-decoration:none;border:1px solid rgba(255,255,255,.25);' +
    '-webkit-tap-highlight-color:transparent;touch-action:manipulation';
  document.body.appendChild(a);
})();
