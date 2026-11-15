# Briefing comum dos novos instrumentos

Você vai criar um clone em Web Audio de um instrumento clássico, dentro do repositório em /home/claude/vonhauke/sintetizadores. Não faça commit nem push. Escreva tudo (documentos, comentários, interface) em português do Brasil, direto, sem linguagem inflada, honesto sobre limitações.

Outros agentes trabalham em paralelo em outros instrumentos. Mexa SOMENTE em: `<id>/index.html`, `docs/pesquisa/<id>.md` e `tests/medicao/<id>/`. Não altere README.md, instruments.json, package.json, sw.js, scripts/, tests/*.test.mjs nem pastas de outros instrumentos (a sessão principal faz a integração). Não rode `npm install`.

## Leia primeiro
- `docs/2026-11-14-novos-instrumentos-design.md` (desenho aprovado pelo dono, Pedro).
- `106/index.html`, `docs/pesquisa/106.md` e `tests/medicao/106/` — o piloto já aprovado por Pedro ("ficou muito bom"). É o PADRÃO a copiar: estrutura do arquivo, carregamento do worklet, shim de medição, faixa de acessórios, armazenamento, aviso de áudio no iPhone, teclado, MIDI, digitação de valores.

## Ordem obrigatória
pesquisa → documento de pesquisa gravado em disco → código → verificação. Não escreva código do instrumento antes de `docs/pesquisa/<id>.md` existir. Grave o documento cedo e vá atualizando, para nada se perder se você for interrompido.

## Etapa 1: pesquisa (a mais importante)
Use WebSearch e WebFetch e leia as fontes de fato; não escreva de memória. Prioridade: manual do proprietário e service manual oficiais, esquemáticos e documentação de circuito/chips, patentes, análises técnicas de engenheiros e da comunidade (fóruns de DIY, Sound On Sound, textos e código aberto de quem reproduziu o circuito ou o firmware), e só depois divulgação. Levante:
- Painel completo: todos os controles originais, nome exato, tipo (slider, knob, chave, botão, pad, jack), faixa, posições, ordem e agrupamento. Confira com a foto de referência indicada na sua tarefa (use a ferramenta Read no arquivo de imagem) para ordem e posição dos controles.
- Arquitetura de som: osciladores, filtros (tipo, dB/oitava, ressonância, circuito), envelopes (curvas reais), LFO, VCA, efeitos, portamento, modulação, polifonia e alocação de vozes.
- Particularidades de timbre: não linearidades, saturação, ruído, deriva, resolução de parâmetros, curvas de potenciômetros.
- Patches/sons de fábrica ou típicos, quando existirem dados confiáveis.
- Se o original tem arpejador ou sequenciador próprio. Só implemente no painel o que a pesquisa confirmar.
Para cada fato ou número: fonte (URL) e categoria (a) fonte primária, (b) fontes secundárias, (c) aproximação sua. Valor não encontrado: escreva "não encontrado". Nunca preencha lacuna com número plausível sem marcar (c). Parafraseie; não copie trechos longos. Use números e descrições de projetos de código aberto, não o código deles.

## Etapa 2: implementação
Um único arquivo `<id>/index.html`, autossuficiente, offline, funcionando em http(s) e em file:// (Electron). Referencie `../fonts/fonts.css` e `../voltar.js` como o 106.
- Motor em AudioWorklet no padrão do 106: bloco `<script type="text/plain" id="dsp">` com uma classe `Motor(fs)` sem nada do navegador (`msg()`, `process(L, R, n)`), carregado por Blob, com reserva em URL `data:` (o Chromium recusa Blob em file://) e por último ScriptProcessor.
- Som fiel à pesquisa, incluindo as particularidades documentadas. Cada controle tem de afetar o som de forma audível e na faixa correta.
- Painel: TODOS os controles originais, com o mesmo nome, tipo, faixa, posição, ordem e seções do aparelho, com aspecto e comportamento de hardware. RESTRIÇÃO DE VISUAL: não reproduza a identidade visual do aparelho. Nada de logotipo, nome de marca ou de modelo no painel; não copie o esquema de cores, a tipografia nem os grafismos do original. Crie paleta e acabamento próprios de hardware, DIFERENTES dos do 106 (cada instrumento com sua cara), nunca uma interface web genérica. No `<title>` e num rodapé discreto pode constar "Clone do <modelo>".
- Valor de cada controle clicável para digitar. Arrasto relativo.
- Teclado na tela com rolagem de oitavas (se o instrumento tem teclado), teclado do computador, Web MIDI.
- Salvamento automático da última configuração (chaves `sint-<id>-v1:estado` etc.). Memória de patches se o original tiver.
- Faixa "Acessórios (não fazem parte do instrumento original)", separada do painel, como no 106: sequenciador de 16 passos (uma nota por passo, pausa, ligadura, andamento, Play/Stop, agendado pelo relógio do AudioContext), Aleatório (numa escala escolhida), Zerar (painel e sequência ao padrão, confirmação em dois toques, sem window.confirm) e Hold. Exceções na sua tarefa, se houver.
- Nível de saída: o padrão inicial deve soar em volume comparável ao dos patches de fábrica do 106 (pico de um acorde entre −12 e −3 dBFS), sem clipping no pior caso.
- iPhone: desbloqueio no touchend/pointerup, aviso "Som desligado, toque para ativar", `navigator.audioSession.type = 'playback'`, `touch-action: manipulation`, alvos de 44 px, utilizável em 390 px de largura (rolagem horizontal do painel é aceitável).
- Sem alert/confirm/prompt.

## Etapa 3: verificação por medição
Não confie só na leitura do código. Em `tests/medicao/<id>/`, no padrão do 106: `motor.mjs` (extrai o motor e roda em Node), `medir.mjs` (tabela esperado × medido, código de saída 1 se algo ficar fora da tolerância) e `navegador.py` (Playwright/Chromium sem janela: console sem erros, worklet rodando em file://, som pelo teclado, acessórios, salvamento, tela de 390 px; grave capturas em /tmp/shots/<id>-computador.png e <id>-celular.png). Meça: frequência dos osciladores, inclinação e corte dos filtros, auto-oscilação, curvas e tempos dos envelopes, LFO, nível de saída por controle, clipping, aliasing, polifonia, e cada controle um a um (mudou o som, no sentido certo). Compare com a pesquisa, corrija e meça de novo. Olhe a captura de tela (Read) e compare a ordem e posição dos controles com a foto de referência; corrija divergências.

## Entrega (sua mensagem final)
Relatório em português: arquivos criados; o que está confirmado por fonte e o que é aproximação; tabela resumida esperado × medido; o que NÃO foi verificado; fontes principais; o que ficou de fora; problemas em aberto. Não declare nada como funcionando sem ter rodado a verificação correspondente.
