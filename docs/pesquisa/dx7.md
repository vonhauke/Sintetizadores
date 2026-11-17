# Yamaha DX7 (original, 1983) — documento de pesquisa (Etapa 1)

Preparado em 15/11/2026. Só pesquisa; nenhum código.

## 0. Como ler este documento

Categorias de confiança (seção 6 do documento de estado):

- **(a)** confirmado por fonte primária: manual de operação, documentação técnica oficial da Yamaha, ou os bytes do próprio firmware.
- **(b)** confirmado por fonte secundária: engenharia reversa dos chips, medições publicadas, código de emuladores baseados em medição.
- **(c)** aproximação: ajuste empírico, valor derivado por mim, ou valor sem medição publicada.

Fontes (as siglas aparecem ao lado de cada valor):

| Sigla | Fonte | Tipo | Quanto foi lido |
|---|---|---|---|
| MAN | Yamaha DX7 Operation Manual (edição americana "Authorized Product Manual") — https://www.manualslib.com/manual/196296/Yamaha-Dx7.html e https://manualmachine.com/yamaha/dx7/700085-user-manual | primária | Páginas de controles (11 a 14), notas de instalação e trechos do resto. **A página de especificações não foi lida.** |
| TA | Yamaha, *DX7 Technical Analysis* (documento oficial, 10/1984) — https://archive.org/details/yamaha-dx-7-technical-analysis | primária | Texto completo por OCR; há trechos ilegíveis, marcados abaixo. |
| SM | Yamaha DX7/DX9 Service Manual — https://archive.org/download/synthmanual-yamaha-dx-7-and-dx-9-service-manual/yamahadx-7anddx-9servicemanual.pdf | primária | **Só a descrição de circuito.** Especificações, esquemático do filtro de saída e procedimentos de ajuste não foram lidos. |
| FW | Firmware v1.8 (24-Oct-85) do DX7, desmontagem anotada por ajxs — https://github.com/ajxs/yamaha_dx7_rom_disassembly | bytes = primária; comentários = secundária | Tabelas e rotinas de voz, modulação, LFO, painel. |
| KS1 | Ken Shirriff, engenharia reversa do chip OPS (visão geral) — https://www.righto.com/2021/11/reverse-engineering-yamaha-dx7.html | secundária | Completo |
| KS2 | Shirriff, circuito exponencial — https://www.righto.com/2021/11/reverse-engineering-yamaha-dx7_28.html | secundária | Completo |
| KS3 | Shirriff, ROM de log-seno — https://www.righto.com/2021/12/yamaha-dx7-reverse-engineering-part-iii.html | secundária | Completo |
| KS4 | Shirriff, implementação dos algoritmos — https://www.righto.com/2021/12/yamaha-dx7-chip-reverse-engineering.html | secundária | Completo |
| KS5 | Shirriff, circuito de saída — https://www.righto.com/2022/02/yamaha-dx7-chip-reverse-engineering.html | secundária | Completo. A parte 6 (registradores de controle) **não foi lida**. |
| AJ | ajxs, *Yamaha DX7 Technical Analysis* — https://ajxs.me/blog/Yamaha_DX7_Technical_Analysis.html | secundária | Completo |
| MSFA-E | Raph Levien, wiki do music-synthesizer-for-android, "Dx7Envelope" — https://github.com/google/music-synthesizer-for-android (pasta wiki) | secundária (medição em aparelho real) | Completo |
| MSFA-H | Idem, "Dx7Hardware" | secundária | Completo |
| DEX | Código do Dexed (motor msfa) — https://github.com/asb2m10/dexed, pasta source/msfa | secundária | fm_core, dx7note, env, lfo, pitchenv, porta |
| YALA | Tabela de índice de modulação, citando Chowning e Bristow, *FM Theory & Applications* — https://sites.google.com/site/yalaorg/1-synthesizers-music-audio/synthesis-fm/synthesis-fm-pt2 | secundária | Fórmula e tabela de TL |
| FOTO | Foto anexada (Retro Gear Shop, 1024 px) | — | Serve para posição e cor; a serigrafia continua ilegível. |

Não lidos (e por isso não usados como fonte): as patentes US 4,018,121 (Chowning), US 4,249,447 (realimentação) e US 4,554,857 (número de frequência logarítmico), que AJ aponta como as relevantes; o livro de Chowning e Bristow em si; Sound On Sound; a lista completa das 128 vozes de fábrica.

---

## 1. Identificação e especificações gerais

| Item | Valor | Cat. | Fonte |
|---|---|---|---|
| Teclado | 61 teclas, sensível a velocidade e aftertouch. O aftertouch entra por uma única entrada do conversor A/D (identificador 95H), ou seja, é um valor só para o teclado inteiro, não por tecla | a | MAN, TA |
| Polifonia | 16 notas; a 17ª nota corta a mais antiga | a | MAN |
| Síntese | FM de 6 operadores senoidais, 32 algoritmos | a | MAN, TA |
| Memória interna | 32 vozes, mantidas por bateria | a | MAN |
| Cartuchos | ROM: 64 vozes em dois bancos de 32 (chave mecânica). RAM: 32 vozes. O aparelho vinha com 2 cartuchos ROM (128 vozes) | a | MAN, TA |
| Parâmetros por voz | cerca de 168 (número do manual) | a | MAN |
| Saída | 1 saída mono, P10 não balanceada; nominal −20 dBm (77,5 mV) em 600 Ω ou mais; o máximo é "consideravelmente maior" (sem número) | a | MAN |
| Fone | P10 no painel frontal | a | MAN |
| Entradas de controle | VOLUME e MODULATION (pedais FC-3A), PORTAMENTO e SUSTAIN (FC-4/FC-5), BREATH CONT. (BC-1), MIDI | a | MAN |
| Consumo | 40 W máximo, 120 V (modelo americano) | a | MAN |
| Dimensões e peso | 1018 × 102 × 329 mm, 14,2 kg | b | sites que citam a pág. 27 do manual japonês/geral; não li a página |
| Firmware analisado | v1.8, 24-Oct-85 | a | FW |

---

## 2. Painel

### 2.1 Disposição geral (FOTO + MAN + FW)

Da esquerda para a direita, na faixa de controles acima do teclado:

1. **VOLUME** — slider vertical. (a, MAN)
2. **DATA ENTRY** — slider vertical, e dois botões verdes ao lado/abaixo: **NO / −1 / OFF** e **YES / +1 / ON**. A escala do slider muda conforme o parâmetro (0–3, 0–7, 0–12, 0–99, OFF–ON). (a, MAN)
3. Bloco de 8 botões de modo, em 2 fileiras de 4. Ordem confirmada pela tabela de botões do firmware (índices 32 a 39) e cores pela foto:
   - fileira de cima: **STORE** (salmão), **MEMORY PROTECT – INTERNAL** (verde), **MEMORY PROTECT – CARTRIDGE** (verde), **OPERATOR SELECT** (lilás);
   - fileira de baixo: **EDIT/COMPARE** (lilás; vira CHARACTER ao dar nome), **MEMORY SELECT – INTERNAL** (verde), **MEMORY SELECT – CARTRIDGE** (verde), **FUNCTION** (marrom/laranja).
   (a para nomes e ordem: MAN, FW; cores: FOTO)
4. Mostrador: **LED vermelho de 2 dígitos** (número da voz; ponto decimal aceso = voz editada e não salva; pisca em COMPARE) e **LCD de 16 × 2 caracteres**. (a, MAN)
5. **32 botões verdes de membrana**, 2 fileiras de 16, numerados 1–16 (cima) e 17–32 (baixo). Cada botão tem até 5 legendas: número branco (PLAY), caractere em marrom-escuro invertido (nome da voz), texto violeta **acima** (EDIT), texto marrom-claro **abaixo** (FUNCTION). (a, MAN)
6. À direita: **slot do cartucho**. (a, MAN; posição: FOTO)
7. Faixa superior do painel: diagrama impresso dos **32 algoritmos**; à direita dele, um desenho do EG e outro do keyboard level scaling. (FOTO; conteúdo ilegível nesta resolução)
8. À esquerda do teclado: rodas **PITCH** (com mola, volta ao centro) e **MODULATION**. (a, MAN)

Mensagem de abertura no LCD: `*  YAMAHA DX7  *` / `*  SYNTHESIZER *`. (a, FW)

### 2.2 Botões 1–32 em modo EDIT (legendas violeta)

A numeração vem da tabela de tratamento de botões e da tabela de valores máximos do firmware (FW); os nomes e faixas vêm do manual (MAN). Tudo (a), salvo onde indicado.

| Botão | Grupo impresso | Função | Faixa | Texto no LCD (FW) |
|---|---|---|---|---|
| 1–6 | OPERATOR ON-OFF / EG COPY | Liga/desliga o operador 1–6 (só durante a edição; o LCD mostra seis dígitos 1/0). Com STORE pressionado, copia o EG do operador atual para o operador do botão | on/off | ` EG COPY from OP` / ` to OP?` |
| 7 | — | ALGORITHM | 1–32 | `ALGORITHM SELECT` / `ALG` |
| 8 | — | FEEDBACK | 0–7 | `FEEDBACK` |
| 9 | LFO | WAVE | TRIANGL, SAW DWN, SAW UP, SQUARE, SINE, S/HOLD | `LFO WAVE=` |
| 10 | LFO | SPEED | 0–99 | `LFO SPEED` |
| 11 | LFO | DELAY | 0–99 | `LFO DELAY` |
| 12 | LFO | PMD | 0–99 | `LFO PM DEPTH` |
| 13 | LFO | AMD | 0–99 | `LFO AM DEPTH` |
| 14 | LFO | SYNC | OFF/ON | `LFO KEY SYNC=` |
| 15 | MOD SENSITIVITY | PITCH (vale para a voz inteira) | 0–7 | `P MOD SENS.` |
| 16 | MOD SENSITIVITY | AMPLITUDE (por operador) | 0–3 | `A MOD SENS.` |
| 17 | OSCILLATOR | MODE/SYNC — pressionar de novo alterna entre modo (ratio/fixed) e key sync do oscilador | 2 estados cada | `FREQUENCY(RATIO)` / `FIXED FREQ.(Hz)` / `OSC KEY SYNC=` |
| 18 | OSCILLATOR | FREQUENCY COARSE | 0–31 | `F COARSE=` |
| 19 | OSCILLATOR | FREQUENCY FINE | 0–99 | `F FINE  =` |
| 20 | OSCILLATOR | DETUNE | −7 a +7 (15 posições) | `OSC DETUNE =` |
| 21 | EG | RATE — pressionar repetidamente percorre R1 a R4 | 0–99 | `EG  RATE  ` |
| 22 | EG | LEVEL — idem, L1 a L4 | 0–99 | `EG  LEVEL ` |
| 23 | KEYBOARD LEVEL SCALING | BREAK POINT | 0–99 = A−1 a C8 | `BREAK POINT=` |
| 24 | KEYBOARD LEVEL SCALING | CURVE — alterna lado esquerdo/direito | −LIN, −EXP, +EXP, +LIN | `L KEY SCALE=` / `R KEY SCALE=` |
| 25 | KEYBOARD LEVEL SCALING | DEPTH — alterna esquerdo/direito | 0–99 | `L SCALE DEPTH` / `R SCALE DEPTH` |
| 26 | — | KEYBOARD RATE SCALING | 0–7 | `RATE SCALING ` |
| 27 | OPERATOR | OUTPUT LEVEL | 0–99 | `OUTPUT LEVEL` |
| 28 | OPERATOR | KEY VELOCITY SENSITIVITY | 0–7 | `KEY VELOCITY ` |
| 29 | PITCH EG | RATE (R1–R4) | 0–99 | `P EG RATE  ` |
| 30 | PITCH EG | LEVEL (L1–L4) | 0–99 (50 = sem desvio) | `P EG LEVEL ` |
| 31 | — | KEY TRANSPOSE — não usa DATA ENTRY: a próxima tecla tocada passa a ser a altura do dó central | ±2 oitavas (valor 0–48, 24 = normal) | `MIDDLE C = ` |
| 32 | — | VOICE NAME — 10 caracteres | conjunto: `1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ -. ` | `NAME= ` |

Observações:
- O agrupamento impresso (LFO, MOD SENSITIVITY, OSCILLATOR, EG, KEYBOARD LEVEL SCALING, OPERATOR, PITCH EG) é o do manual; a grafia exata da serigrafia de cada botão não pôde ser conferida pela foto. **Conferir com foto de detalhe.**
- OPERATOR SELECT percorre só os operadores ligados; o operador atual aparece no canto superior direito do LCD. (a, MAN)
- KEY TRANSPOSE: o trecho do manual obtido por OCR diz "2 oitavas" num lugar e "4 oitavas" em outro. O firmware limita a tecla a 36–84 e grava 0–48, isto é, 4 oitavas de faixa total, ±2 em torno do centro. As duas frases dizem a mesma coisa. (a, FW)

### 2.3 Botões 1–32 em modo FUNCTION (legendas marrom-claro)

| Botão | Função | Faixa | Cat. | Fonte |
|---|---|---|---|---|
| 1 | MASTER TUNE ADJ | ±75 cents; só o slider (botões ±1 não atuam) | a | MAN, FW |
| 2 | POLY/MONO | POLY MODE / MONO MODE | a | MAN, FW |
| 3 | PITCH BEND – RANGE | 0–12 semitons; só ajustável com STEP = 0 | a | MAN, FW |
| 4 | PITCH BEND – STEP | 0–12; acima de 0, RANGE fica travado em 12 | a | MAN, FW |
| 5 | PORTAMENTO – MODE | Poly: SUS-KEY P RETAIN / SUS-KEY P FOLLOW. Mono: FINGERED PORTA / FULL TIME PORTA | a | MAN, FW |
| 6 | PORTAMENTO – GLISSANDO | OFF/ON | a | MAN, FW |
| 7 | PORTAMENTO – TIME | 0–99 (0 = sem efeito, 99 = mais lento) | a | MAN, FW |
| 8 | MIDI — pressionar repetidamente: canal (1–16), SYS INFO AVAIL/UNAVAIL, MIDI TRANSMIT ? | — | a | MAN, FW |
| 9 | EDIT RECALL | YES/NO, com "ARE YOU SURE ?" | a | MAN, FW |
| 10 | VOICE INIT | YES/NO, com confirmação | a | MAN, FW |
| 11–13 | Sem parâmetro na tabela do firmware (o 11 só coloca a tela em modo função; 12 e 13 não fazem nada) | — | a | FW |
| 14 | BATTERY CHECK | mostra a tensão; aceitável 2,3 a 3,5 V | a | MAN, FW |
| 15–16 | CARTRIDGE SAVE e LOAD (as 32 vozes de uma vez). **Qual dos dois é o 15 e qual é o 16 não foi confirmado.** | YES/NO | a (função), ordem não encontrada | MAN, FW |
| 17–20 | MODULATION WHEEL: RANGE (0–99), PITCH, AMPLITUDE, EG BIAS (OFF/ON cada) | — | a | MAN, FW |
| 21–24 | FOOT CONTROL: RANGE, PITCH, AMPLITUDE, EG BIAS | — | a | MAN, FW |
| 25–28 | BREATH CONTROL: RANGE, PITCH, AMPLITUDE, EG BIAS | — | a | MAN, FW |
| 29–32 | AFTER TOUCH: RANGE, PITCH, AMPLITUDE, EG BIAS | — | a | MAN, FW |

Não encontrado: em que botão fica **CART FORM** (o manual descreve a função e o firmware tem a mensagem `CARTRIDGE FORM ?`, mas não localizei o botão). Suspeito que seja um segundo toque em um dos botões de cartucho; isso é palpite, não fonte.

VOICE INIT resulta em: algoritmo 1, sem modulação, operador 1 com nível 99 e os demais desligados, envelopes "quadrados", todas as razões de frequência em 1.00. (a, MAN) Nome gravado: `INIT VOICE`. (a, FW)

### 2.4 O que o clone deve reproduzir e o que é só leitura

- Memory protect, store, cartucho e battery check são funções de memória; no clone viram salvar/carregar patch (decisão da Etapa 2, não da pesquisa).
- O ponto em aberto 9.1 do documento de estado (logotipos e nome do modelo) continua sem decisão; este documento só lista os nomes dos controles.

---

## 3. Arquitetura de hardware e de som

### 3.1 Blocos

| Bloco | Valor | Cat. | Fonte |
|---|---|---|---|
| CPU principal | Hitachi 63B03 (família 6800); faz MIDI, LFO, pitch EG, portamento e modulações por software | a | TA |
| Sub-CPU | Hitachi 6805S; varre teclado (ciclo de 500 µs), terminais externos (4,5 ms) e painel (27 ms) | a | TA |
| Conversor A/D | 8 bits, 7 entradas: data entry, pitch bend, mod wheel, foot, breath, aftertouch, bateria | a | TA, SM |
| EGS (YM21290) | Gera, para 96 canais (16 vozes × 6 operadores), envelope de **12 bits** e frequência de **14 bits**, ambos em logaritmo | a | TA |
| OPS (YM21280) | Faz a aritmética de FM; saída de **12 bits** mais linhas de deslocamento SF0–SF3 | a | TA |
| Oscilador mestre | 9,4265 MHz, dividido por 2 → 4,71325 MHz para EGS, OPS e CPU | a | TA |
| Taxa de amostragem | 4,71325 MHz ÷ 96 = **49 096 Hz** por voz. O TA não escreve o número; ele sai do relógio. Shirriff e ajxs dão 49 096 Hz | a (relógio) + b | TA, KS1, AJ |
| Ordem de cálculo | Operador 6 primeiro, operador 1 por último, para as 16 vozes | b | KS1, KS4 |
| LFO | **Um só para o instrumento**, por software, 8 bits; não há hardware de LFO | a | TA, FW |

### 3.2 Operador (oscilador senoidal)

| Item | Valor | Cat. | Fonte |
|---|---|---|---|
| Forma de onda | Só senoide | a | MAN |
| Tabela | ROM de **log-seno**: 1024 entradas de 14 bits cobrindo um quarto de ciclo (4096 pontos por ciclo, **12 bits de fase** na entrada do seno) | b | KS3 |
| Fórmula da ROM | entrada n (0–1023): ω = (n + 0,5)/1024 × π/2; valor = round(−log2(sen ω) × 1024). Shirriff reproduz a ROM com int(y × 1024 + 0,5002) | b | KS3 |
| Simetria | Bit mais alto = sinal; segundo bit = espelhamento | b | KS3 |
| Envelope | Somado no domínio logarítmico ao log-seno (soma em vez de multiplicação) | b | KS1, MSFA-H |
| Exponencial | ROM de 2^x com 10 bits de fração; saída = round(2^frac × 2048), deslocada pela parte inteira (4 bits). Caminho do sinal: 14 bits de saída. Caminho da frequência: 22 bits | b | KS2 |
| Acumulador de fase | Somador de 23 bits (KS1) ou 22 bits (KS4) — os dois artigos divergem; MSFA-H estima 27 bits por medição | b, com divergência | KS1, KS4, MSFA-H |
| OSC KEY SYNC | Ligado: a fase volta ao início a cada nota. Desligado: o oscilador corre livre | a | MAN |

### 3.3 Modulação entre operadores

- É modulação de **fase**: a saída do modulador é somada ao índice de fase antes da consulta ao seno. (b, KS1)
- **Índice de modulação** de um modulador com envelope no máximo, em função do OUTPUT LEVEL:
  I = π × 2^(33/16 − TL/8), com TL = 99 − OL para OL ≥ 20, e para OL de 0 a 19 a tabela
  TL = 127, 122, 118, 114, 110, 107, 104, 102, 100, 98, 96, 94, 92, 90, 88, 86, 85, 84, 82, 81.
  OL 99 dá I ≈ 13,12 rad; cada 8 passos de OL dobram o índice. (b, YALA citando Chowning e Bristow; a tabela de TL bate com a de MSFA-E e com a tabela `TABLE_LOG` do firmware, que é (a))
- O livro de Chowning e Bristow não foi lido diretamente; a fórmula entra como (b).

### 3.4 Os 32 algoritmos

Notação: `2>1` significa "operador 2 modula operador 1". Portadoras são os operadores que vão para a saída. A realimentação é única por algoritmo.

Origem da tabela: decodifiquei a tabela de algoritmos do Dexed (DEX) e conferi com o conteúdo da ROM de algoritmos lido por Shirriff no chip (KS4): o número de portadoras de todos os 32 bate com o campo COM da ROM, e o exemplo que ele descreve por extenso (algoritmo 8) bate com a linha 8. O diagrama impresso no painel é a fonte primária, mas está ilegível na foto. Categoria: **(b)**, a promover a (a) quando houver foto de detalhe do painel.

| Alg | Portadoras | Modulações | Realimentação |
|---|---|---|---|
| 1 | 1, 3 | 2>1, 4>3, 5>4, 6>5 | 6 em si mesmo |
| 2 | 1, 3 | 2>1, 4>3, 5>4, 6>5 | 2 em si mesmo |
| 3 | 1, 4 | 2>1, 3>2, 5>4, 6>5 | 6 em si mesmo |
| 4 | 1, 4 | 2>1, 3>2, 5>4, 6>5 | saída do 4 volta para o 6 (laço 6>5>4>6) |
| 5 | 1, 3, 5 | 2>1, 4>3, 6>5 | 6 em si mesmo |
| 6 | 1, 3, 5 | 2>1, 4>3, 6>5 | saída do 5 volta para o 6 (laço 6>5>6) |
| 7 | 1, 3 | 2>1, 4>3, 5>3, 6>5 | 6 em si mesmo |
| 8 | 1, 3 | 2>1, 4>3, 5>3, 6>5 | 4 em si mesmo |
| 9 | 1, 3 | 2>1, 4>3, 5>3, 6>5 | 2 em si mesmo |
| 10 | 1, 4 | 2>1, 3>2, 5>4, 6>4 | 3 em si mesmo |
| 11 | 1, 4 | 2>1, 3>2, 5>4, 6>4 | 6 em si mesmo |
| 12 | 1, 3 | 2>1, 4>3, 5>3, 6>3 | 2 em si mesmo |
| 13 | 1, 3 | 2>1, 4>3, 5>3, 6>3 | 6 em si mesmo |
| 14 | 1, 3 | 2>1, 4>3, 5>4, 6>4 | 6 em si mesmo |
| 15 | 1, 3 | 2>1, 4>3, 5>4, 6>4 | 2 em si mesmo |
| 16 | 1 | 2>1, 3>1, 5>1, 4>3, 6>5 | 6 em si mesmo |
| 17 | 1 | 2>1, 3>1, 5>1, 4>3, 6>5 | 2 em si mesmo |
| 18 | 1 | 2>1, 3>1, 4>1, 5>4, 6>5 | 3 em si mesmo |
| 19 | 1, 4, 5 | 2>1, 3>2, 6>4, 6>5 | 6 em si mesmo |
| 20 | 1, 2, 4 | 3>1, 3>2, 5>4, 6>4 | 3 em si mesmo |
| 21 | 1, 2, 4, 5 | 3>1, 3>2, 6>4, 6>5 | 3 em si mesmo |
| 22 | 1, 3, 4, 5 | 2>1, 6>3, 6>4, 6>5 | 6 em si mesmo |
| 23 | 1, 2, 4, 5 | 3>2, 6>4, 6>5 | 6 em si mesmo |
| 24 | 1, 2, 3, 4, 5 | 6>3, 6>4, 6>5 | 6 em si mesmo |
| 25 | 1, 2, 3, 4, 5 | 6>4, 6>5 | 6 em si mesmo |
| 26 | 1, 2, 4 | 3>2, 5>4, 6>4 | 6 em si mesmo |
| 27 | 1, 2, 4 | 3>2, 5>4, 6>4 | 3 em si mesmo |
| 28 | 1, 3, 6 | 2>1, 4>3, 5>4 | 5 em si mesmo |
| 29 | 1, 2, 3, 5 | 4>3, 6>5 | 6 em si mesmo |
| 30 | 1, 2, 3, 6 | 4>3, 5>4 | 5 em si mesmo |
| 31 | 1, 2, 3, 4, 5 | 6>5 | 6 em si mesmo |
| 32 | 1, 2, 3, 4, 5, 6 | nenhuma | 6 em si mesmo |

Compensação de nível por número de portadoras (campo COM da ROM, aplicado em logaritmo antes da exponencial): a saída de cada portadora é dividida por um valor próximo do número de portadoras. Os valores gravados são 2^0, 2^1, 2^1,625 (≈3,08), 2^2, 2^2,375 (≈5,19) e 2^2,625 (≈6,17) para 1 a 6 portadoras. (b, KS4; os decimais são conversão minha dos binários 01.101, 10.011 e 10.101)

Consequência para a medição: o nível total de um algoritmo com N portadoras iguais em fase é praticamente o mesmo de uma portadora só, com erro de −0,2 a −0,3 dB para 3, 5 e 6 portadoras. (c, derivado)

### 3.5 Realimentação (FEEDBACK 0–7)

| Item | Valor | Cat. | Fonte |
|---|---|---|---|
| Parâmetro | 3 bits, 8 níveis, gravado junto com o algoritmo no registrador do OPS (algoritmo nos 5 bits altos, feedback nos 3 baixos) | a | TA, FW |
| Filtro "anti-hunting" | O valor realimentado é a **média das duas últimas saídas** do operador | b | KS1, KS4, MSFA-H (por medição) |
| Escala | Deslocamento por potência de 2: cada passo de feedback dobra a quantidade | b | KS1 (deslocador de 0 a 6 bits), DEX |
| Nível 0 | Sem realimentação | a | MAN |
| Profundidade absoluta | No Dexed, pela minha leitura do código, feedback 7 com o operador em nível máximo dá desvio de fase de pico da ordem de ±π rad (meio ciclo), supondo ganho máximo 1,0; cada nível abaixo, metade. **Não encontrei medição publicada em aparelho real que confirme esse valor absoluto.** | c | DEX (leitura minha do código) |
| Efeito | Feedback alto leva a senoide para dente de serra e, no extremo, a ruído | b | AJ |
| Laços de 2 e 3 operadores | Algoritmos 6 e 4: a saída do operador 5 (ou 4) é que volta para o 6 | b | DEX, KS4 |

---

## 4. Frequência e afinação

### 4.1 Representação

- Frequência em logaritmo de base 2, 14 bits: 4 bits de oitava e 10 bits de fração → **1024 passos por oitava, 1,17 cent por passo**. (a para os 14 bits: TA; b para o formato: MSFA-H, KS2; o TA lista os pesos dos bits em cents: 1200, 600, 300, 150, 75, 37,5, 18,8…)
- Dentro da oitava, a frequência real é quantizada em 1/4096 por causa da ROM exponencial. (b, MSFA-H)
- No firmware os valores aparecem deslocados 2 bits à esquerda (4096 unidades por oitava). (a, FW)

### 4.2 Afinação de teclado

- A tabela nota→frequência logarítmica do firmware tem 128 entradas e avança 4/3 de unidade por semitom no byte alto (16 por oitava), ou seja, temperamento igual. (a, FW)
- Referência: lá = 440 Hz com MASTER TUNE no centro. (a, MAN: "Tune the DX7 to A = 440 Hz (slider approximately centered)")
- Dó central do DX7 = **C3** = 262 Hz na nomenclatura Yamaha (MIDI 60). (a, MAN)
- Faixa do teclado: 61 teclas, C1 a C6 na nomenclatura Yamaha (MIDI 36 a 96). (b: a faixa de notas vem da especificação do DX7s e do limite 36–84 do KEY TRANSPOSE no FW; a página de especificações do DX7 não foi lida)

### 4.3 Modo RATIO

frequência do operador = frequência da nota × COARSE × (1 + FINE/100)

- COARSE 0 vale 0,5; COARSE 1 a 31 valem 1 a 31. (a, MAN, FW)
- FINE 0–99 soma até 99 % (máximo 1,99 × o coarse). (a, MAN)
- Conferência com o firmware: a tabela coarse guarda log2(razão) × 4096 (ex.: 3 → 0x195C = 6492 = 1,585 oitava) e a tabela fine guarda log2(1 + FINE/100) × 4096 (FINE 1 → 0x3A = 58). (a, FW; a conta é minha)
- Com COARSE 0, o FINE multiplica 0,5 (0,50 a 0,995). (c, derivado da fórmula; não li confirmação explícita)

### 4.4 Modo FIXED

frequência = 10^(COARSE mod 4) × 10^(FINE/100) Hz

- COARSE mod 4 = 0, 1, 2, 3 → 1, 10, 100, 1000 Hz. (a, MAN, FW)
- FINE 0–99 percorre uma década em passos logarítmicos (o firmware multiplica FINE por 136; 100 × 136 ≈ log2(10) × 4096). Máximo ≈ 9772 Hz. (a, FW; conta minha)
- Em modo fixo o operador não segue teclado, pitch bend por nota nem portamento. (b, DEX; o manual só diz que o teclado não tem efeito)

### 4.5 DETUNE (−7 a +7)

- O firmware só envia ao EGS sinal e magnitude (0–7); a conversão em frequência acontece dentro do chip. (a, FW)
- **Não encontrei o valor em cents por passo em fonte primária nem em medição publicada.**
- O Dexed usa um ajuste empírico em que o desvio relativo diminui nas notas agudas: `0,0209 × exp(−0,396 × logfreq) / 7` por passo, sobre o log da frequência. (c, DEX)

### 4.6 Pitch EG (um para a voz inteira)

- 4 taxas e 4 níveis, 0–99. Nível 50 = sem desvio; 0 = 4 oitavas abaixo; 99 = 4 oitavas acima. (a, MAN)
- Curva dos níveis: tabela de 100 entradas do firmware (0x00 … 0x80 no nível 50 … 0xFF). A região central (níveis ~17 a ~85) é linear, 1 unidade por passo; as pontas são expandidas. (a, FW)
- Escala: no Dexed, 1 unidade da tabela = 1/32 de oitava (37,5 cents), o que dá ±4 oitavas nos extremos e confere com o manual. (b, DEX)
- Curva das taxas: tabela de 100 entradas do firmware, de 1 (taxa 0) a 255 (taxa 99). (a, FW)
- Velocidade real: no Dexed, valor da tabela ÷ 21,3 = oitavas por segundo (constante medida pelos autores). (b, DEX)
- O segmento é linear em oitavas. (b, DEX)

### 4.7 Pitch bend, portamento, master tune

| Item | Valor | Cat. | Fonte |
|---|---|---|---|
| Pitch bend | RANGE 0–12 semitons; STEP 0–12 (com STEP > 0 a roda salta em degraus de STEP semitons e a faixa é 12) | a | MAN |
| Master tune | ±75 cents | a | MAN |
| Portamento TIME | O firmware converte (99 − TIME) pela mesma tabela de taxas do pitch EG; TIME 0 = instantâneo | a | FW |
| Tempo real do portamento | **Não encontrado** em segundos. O Dexed usa 2100 × 2^(−0,062 × t) semitons/s (e 1300 × … com glissando), com t de 0 a 127 | c | DEX |
| Glissando | Mesma trajetória, arredondada para semitons | b | DEX |
| Modos | Ver tabela 2.3, botão 5 | a | MAN |

---

## 5. Amplitude: nível, envelope, sensibilidades

### 5.1 Unidade interna

- Envelope de 12 bits, logarítmico, **256 passos por fator 2**: 1 passo ≈ 0,0235 dB. (a para os 12 bits: TA; b para a escala: MSFA-E, MSFA-H, AJ)
- Faixa teórica: 4096 × 0,0235 ≈ 96 dB (MSFA-H, AJ). A página MSFA-E fala em 72,25 dB no mesmo contexto; as duas páginas do mesmo autor divergem e a conta dá 96 dB. Na medição dele, o nível mínimo é cortado a 3824 passos abaixo do fundo de escala (≈ 89,9 dB). (b)

### 5.2 OUTPUT LEVEL (0–99)

- Valor escalado: para OL ≥ 20, OL' = 28 + OL; para OL de 0 a 19, tabela
  0, 5, 9, 13, 17, 20, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 42, 43, 45, 46. (b, MSFA-E; equivale à `TABLE_LOG` do firmware, que é (a) e guarda 127 − OL')
- Cada unidade de OL' vale 32 passos = **0,7526 dB**. De 20 a 99 a escala é linear em dB: 79 passos × 0,75 = 59,5 dB. (b, MSFA-E; a, TA: "Total Level de 7 bits em passos de 0,75 dB")
- OL 99 → 0 dB; OL 0 → −95,6 dB. (c, derivado)
- "50 soa bem menos que metade": o manual avisa que a escala não é linear. (a, MAN)

### 5.3 Envelope de amplitude (4 taxas, 4 níveis, por operador)

Estrutura (a, MAN):
- Tecla pressionada: L4 → L1 (taxa R1) → L2 (R2) → L3 (R3), e sustenta em L3.
- Tecla solta: vai para L4 com taxa R4.
- Entre dois níveis o segmento sobe ou desce conforme o nível de destino seja maior ou menor.
- R1 maior = ataque mais rápido. (a, SM)

Níveis (b, MSFA-E; o TA confirma 6 bits por nível, (a)):
- nível escalado: 0–5 → 2 × L; 5–16 → 5 + L; 17–20 → 4 + L; 20–99 → 14 + L/2 (inteiro). Faixa 0–63.
- Cada unidade vale 64 passos = **1,505 dB**; logo, na região alta, dois valores vizinhos de L (por exemplo 98 e 99) dão o mesmo nível.
- nível total = 64 × nível escalado + 32 × OL' (mais velocidade e escala de teclado, seção 5.4 e 5.5), normalizado ao fundo de escala.

Taxas:
- qrate = (R × 41) / 64, inteiro, 0–63. O firmware faz R × 164 >> 8, que é a mesma conta. (a, FW; b, MSFA-E)
- Queda: **0,2819 × 2^(qrate/4, parte inteira) × (1 + 0,25 × (qrate mod 4)) dB/s**. Exponencial em amplitude, linear em dB. (b, MSFA-E, medido)
  - R = 0 → 0,28 dB/s (uns 5 a 6 minutos para cair 96 dB). R = 99 → qrate 63 → ≈ 16 165 dB/s. (c, derivado da fórmula)
- No hardware: com qrate 0 o envelope desce 1 passo a cada 4096 amostras; cada +4 em qrate dobra o relógio; os valores intermediários usam os padrões de bits 01010101, 01010111, 01110111, 01111111. (b, MSFA-E)
- Subida (ataque): não é exponencial. O incremento por passo é o da queda multiplicado por 2 + floor((fundo de escala − nível atual) / 256), o que dá uma curva próxima de linear em amplitude. (b, MSFA-E)
- No início do ataque o nível **salta imediatamente** para cerca de 40 dB acima do mínimo. O texto do MSFA-E diz 1700 passos (39,98 dB); o código do Dexed usa 1716. Divergência pequena, registrada. (b)
- Para qrate ≥ 48 o incremento é deslocado à esquerda por (qrate/4) − 11 e aplicado a cada amostra. (b, MSFA-E)
- Segmento entre dois níveis iguais (ou ataque com nível 0): o aparelho espera um tempo que depende da taxa. O Dexed traz uma tabela de 77 durações medidas (em amostras a 44,1 kHz: 1 764 000 para taxa 0 … 441 para taxa 76) e 20 × (99 − taxa) acima disso. (b, DEX; não reproduzi a tabela aqui, está em `env.cc`)

### 5.4 KEY VELOCITY SENSITIVITY (0–7, por operador)

- A velocidade é medida pelo tempo entre os dois contatos da tecla; valor interno de 7 bits em que **01H é o mais forte e 7FH o mais fraco**. (a, TA)
- MIDI de entrada: a tabela `TABLE_MIDI_VEL` (32 entradas; pelo tamanho, o índice deve ser a velocidade MIDI ÷ 4, mas não conferi a rotina) converte para o valor interno:
  6E 64 5A 55 50 4B 46 41 3A 36 32 2E 2A 26 22 1E 1C 1A 18 16 14 12 10 0E 0C 0A 08 06 04 02 01 00 (hex). (a, FW)
- Curva de nível por velocidade: `TABLE_OP_VOLUME_VELOCITY_SCALE` (32 entradas):
  00 04 0C 15 1E 28 2E 34 3A 40 46 4C 52 58 5E 64 67 6A 6D 70 72 74 76 78 7A 7C 7E 80 82 83 84 85 (hex). (a, FW)
- A sensibilidade entra como multiplicador: o firmware converte KVS em um par (KVS × 32, complemento de KVS × 2) e faz `nível = tabela[vel] × (KVS × 32) / 256 + parte alta`, com saturação. (a para o código; b para a leitura, que é dos comentários da desmontagem)
- Versão do Dexed, equivalente por medição: `((KVS × (tab[vel/2] − 239) + 7) / 8) × 16` passos de 0,0235 dB, com tabela própria de 64 entradas. Por ela, com KVS 7: velocidade MIDI 127 ≈ +5,3 dB, velocidade ~100 ≈ 0 dB, velocidade 1 ≈ −79 dB. (b para a fórmula, DEX; c para os dB, que eu derivei)
- "Velocidades acima de 100 podem passar do fundo de escala". (b, MSFA-E)
- KVS 0: a velocidade não altera o nível. (a, MAN)
- Em portadora a velocidade muda o volume; em modulador, o timbre. (a, MAN)

### 5.5 KEYBOARD LEVEL SCALING (por operador)

- BREAK POINT 0–99, de A−1 a C8 (1⅓ oitava abaixo da tecla mais grave até 2 oitavas acima da mais aguda). (a, MAN)
- Uma curva e uma profundidade para cada lado: −LIN, −EXP, +EXP, +LIN; DEPTH 0–99. (a, MAN)
- O teclado é tratado em **grupos de 3 teclas**. (b, DEX; a, FW: curva de 43 bytes indexada pelo byte alto da altura)
- Tabela exponencial do firmware (36 entradas): 0 1 2 3 4 5 6 7 8 9 11 14 16 19 23 28 33 39 47 57 67 80 95 113 134 160 190 224 255 255… (a, FW)
  Atenção: a tabela do Dexed difere um pouco (27, 56, 66, 94, 110, 126, 142… 250). Usar a do firmware. (divergência registrada)
- Tabela linear do firmware: 0, 8, 16, … passo 8 até 248, depois 255 (com um valor 0xB2 = 178 onde o padrão daria 176). (a, FW)
- Escala (Dexed): linear → (grupo × DEPTH × 329) >> 12; exponencial → (tabela[grupo] × DEPTH × 329) >> 15; resultado em unidades de 0,7526 dB, somado a OL' e limitado a 127. (b, DEX)
- O manual diz que −LIN com DEPTH 99 dá **22 dB por oitava**. Pela fórmula do Dexed saem ≈ 23,9 dB/oitava. Diferença de ~2 dB/oitava: medir e decidir. (a para os 22 dB, MAN; c para a conta)
- Para reforçar (+), precisa haver folga: OL 90 só pode subir até 99. (a, MAN)
- Nível mínimo: o firmware limita o resultado para não passar de um piso (valor 4 no registrador). (a, FW)

### 5.6 KEYBOARD RATE SCALING (0–7, por operador)

- Aumenta as taxas do envelope nas notas agudas. (a, MAN)
- Dexed: x = clamp(nota MIDI / 3 − 7, 0, 31); qrate += (sensibilidade × x) >> 3; qrate limitado a 63. Há duas correções de ±1 para sensibilidade 3 e 7 no modo "super preciso". (b, DEX)
- No aparelho a conta é feita dentro do EGS; o firmware só grava o valor 0–7 junto com a sensibilidade de AM. (a, FW)

### 5.7 Operador desligado

Os botões 1–6 só valem durante a edição; para silenciar um operador numa voz salva, OL = 0. (a, MAN)

---

## 6. LFO e controladores

### 6.1 LFO

| Item | Valor | Cat. | Fonte |
|---|---|---|---|
| Ondas | Triângulo, serra descendente, serra ascendente, quadrada, senoide, sample & hold | a | MAN, FW |
| Resolução | Amplitude de 8 bits; acumulador de fase de 16 bits | a | FW |
| Senoide | Tabela de 64 entradas (um quarto de ciclo): 2, 5, 8, 11 … 127 | a | FW |
| Sample & hold | Gerador congruente: x ← (x × 179 + 17) mod 256, um valor novo a cada ciclo | a | FW (o comentário da desmontagem diz "11", mas o byte é 0x11 = 17; o Dexed também usa 17) |
| SPEED 0–99 → Hz | Tabela medida do Dexed: 0 → 0,0625 Hz; 10 → 1,56; 20 → 3,19; 30 → 4,81; 40 → 6,43; 50 → 7,99; 60 → 9,61; 70 → 16,4; 80 → 25,7; 90 → 38,2; 99 → 49,3 Hz. Quase linear até ~63 (≈ 0,16 Hz por passo), depois acelera | b | DEX (`lfo.cc`, 100 valores) |
| Conversão SPEED no firmware | Existe uma rotina própria; não a li em detalhe | — | FW |
| DELAY 0–99 | Contador de 16 bits até estourar, depois um "fade-in" que cresce com o byte alto do incremento | a (estrutura) | FW |
| DELAY em segundos | Dexed: a = 99 − DELAY; incremento = (16 + (a & 15)) << (1 + (a >> 4)). **Não encontrei tabela em segundos.** | b (fórmula) | DEX |
| SYNC | Ligado: o LFO recomeça a cada nota. Desligado: corre livre | a | MAN |
| Taxa de atualização do LFO | **Não encontrada** (é uma interrupção periódica do firmware; não identifiquei o período) | — | — |

### 6.2 Modulação de pitch (vibrato)

- PMD 0–99 → 0–255 (PMD × 165 >> 6). (b, DEX)
- PITCH MOD SENSITIVITY 0–7 → 0, 10, 20, 33, 55, 92, 153, 255. (a, FW)
- A profundidade final é o produto de LFO × PMD (ou do controlador) × sensibilidade, enviado ao EGS em dois registradores de 8 bits. (a, FW)
- **Profundidade em cents com PMS 7 e PMD 99: não encontrada em fonte primária.** Usar o Dexed como referência e medir. (c)

### 6.3 Modulação de amplitude

- AMD 0–99; AMPLITUDE MOD SENSITIVITY 0–3 por operador. (a, MAN)
- O firmware passa o total por `TABLE_AMP_MOD` (256 entradas, curva logarítmica) e grava um único registrador de AM no EGS; a sensibilidade por operador é aplicada dentro do chip. (a, FW)
- Dexed: sensibilidades 0–3 = 0; 0,259; 0,427; 1,0 da profundidade total. (b, DEX)
- O TA tem uma tabela de sensibilidade com valores 24, 12, 6, 3, 1,5, 0,75, 0,375, 0,188 dB (pesos de bit), mas o OCR não permite dizer com segurança a profundidade máxima por nível de sensibilidade. **Não confirmado.**
- Em portadora dá tremolo; em modulador, "wah". (a, MAN)

### 6.4 Controladores

- Quatro fontes: roda de modulação, pedal (foot control), sopro (breath control), aftertouch. Cada uma: RANGE 0–99 e três chaves PITCH, AMPLITUDE, EG BIAS. (a, MAN)
- PITCH e AMPLITUDE controlam a profundidade do LFO naquele destino; o efeito depende também das sensibilidades da voz (com sensibilidade 0, o controlador não faz nada). (a, MAN)
- EG BIAS: desloca o nível dos operadores com AMS > 0, sem LFO. (b, DEX; o manual descreve a função, não li o trecho)
- Sustain e portamento: pedais liga/desliga. (a, MAN)
- Volume por MIDI: só 8 níveis, feitos na tensão de referência do DAC; a tabela do firmware converte os 3 bits altos do valor MIDI. Nível 0 = mudo. (a, FW, TA)

---

## 7. Saída e particularidades do timbre

### 7.1 Cadeia de saída

| Estágio | Valor | Cat. | Fonte |
|---|---|---|---|
| Soma das vozes | **Não há soma digital.** As 16 vozes saem uma por vez para o DAC, a ≈ 786 kHz (16 × 49 096 Hz), e a soma acontece no analógico | b | KS5 |
| Ordem das vozes na saída | 1, 13, 5, 11, 3, 15, 7, 10, 2, 14, 6, 12, 4, 16, 8, 9 | b | KS5 |
| DAC | BA9221, 12 bits, complemento de 2, saída centrada em +7,5 V | a | TA, SM |
| Escala | Divisor analógico por 1, 2, 4 ou 8 (rede R-2R + chave TC4066), comandado por SF0–SF3. Sinais fracos são amplificados 2×, 4× ou 8× antes do DAC e divididos depois | a | TA, SM |
| Resolução efetiva | Formato de ponto flutuante: sinal + 11 bits de mantissa + 2 bits de expoente. "Equivalente a 14–16 bits" (TA); "não chega a 14 bits" (Shirriff); "cerca de 15 bits" (ajxs). As fontes divergem; o fato firme é 12 bits + 4 faixas | a/b | TA, KS5, AJ |
| Sample & hold | Dois circuitos alternados (SH1, SH2) | a | TA, KS5 |
| Filtro passa-baixas | Sallen-Key, corte em torno de **16 kHz** | b | KS5, AJ |
| Ordem e inclinação do filtro | **Não encontradas.** O TA só diz que o filtro remove o componente de amostragem; o esquemático do filtro no SM não foi lido | — | — |
| Volume | Slider no painel e pedal de volume (o pedal atua por fotoacoplador com LDR no caminho do áudio) | b | KS5 |
| Nível | −20 dBm nominal | a | MAN |

### 7.2 O que dá o caráter do som (e o que é aproximação no clone)

| Particularidade | Detalhe | Cat. | Como tratar no clone |
|---|---|---|---|
| Taxa de 49 096 Hz | Aliasing dos espectros de FM dobra em 24,5 kHz, não em 22,05 ou 24 kHz | a/b | Rodar o núcleo a 49 096 Hz e reamostrar, ou aceitar a diferença e marcar como aproximação |
| Seno quantizado | Log-seno de 1024 × 14 bits por quarto de ciclo; 12 bits de fase | b | Reproduzível exatamente pela fórmula da seção 3.2 |
| Exponencial quantizada | Mantissa de 11 bits + bit implícito | b | Reproduzível pela fórmula |
| Saída de 12 bits com 4 faixas | Ruído de quantização que depende do nível; notas fracas ganham resolução | a/b | Reproduzível; por voz, antes da soma |
| Multiplexação das vozes no DAC | Shirriff sugere que a multiplexação mais o filtro criam interação entre notas e contribuem para o som; ele não mede o efeito | b (hipótese do autor) | Aproximação; fora do primeiro corte |
| Envelope em degraus | Passos de 0,0235 dB e padrões de relógio; audível em quedas lentas | b | Reproduzível |
| Salto no ataque | ~40 dB acima do mínimo logo no início | b | Reproduzível |
| Afinação em degraus | 1,17 cent por passo; vibrato, pitch EG e portamento andam nesses degraus | a/b | Reproduzível |
| LFO de 8 bits por software | Degraus em modulações lentas e profundas | a | Reproduzível, mas a taxa de atualização não foi encontrada |
| Um LFO só | Todas as vozes compartilham a fase do LFO | a | Reproduzível |
| Osciladores livres | Com OSC KEY SYNC desligado, a fase inicial varia a cada nota | a | Reproduzível |
| Realimentação com média de 2 amostras | Evita a oscilação parasita; muda o espectro em feedback alto | b | Reproduzível |
| Ruído analógico, zumbido, distorção do estágio de saída | **Nenhum valor encontrado** | — | Não simular, ou simular como aproximação declarada |
| Deriva de afinação | Não há: é tudo digital, travado em cristal | a | Nada a simular |
| Curva do slider DATA ENTRY e do VOLUME | **Não encontrada** | — | Linear, declarado como aproximação |
| Saturação ao tocar muitas notas | **Não encontrado** como o estágio analógico se comporta no limite | — | Medir clipping no clone e deixar folga |

---

## 8. Formato da voz (para salvar e carregar patches)

Ordem dos parâmetros da voz "aberta" de 155 bytes, como usada pelo Dexed (b, DEX). Coincide com o formato SysEx de voz única do DX7, que não li em fonte primária.

Por operador, 21 bytes, na ordem **OP6, OP5, … OP1**:

| Desloc. | Parâmetro | Faixa |
|---|---|---|
| 0–3 | EG R1–R4 | 0–99 |
| 4–7 | EG L1–L4 | 0–99 |
| 8 | Break point | 0–99 |
| 9 / 10 | Depth esquerda / direita | 0–99 |
| 11 / 12 | Curva esquerda / direita | 0–3 (−LIN, −EXP, +EXP, +LIN) |
| 13 | Rate scaling | 0–7 |
| 14 | Amp mod sensitivity | 0–3 |
| 15 | Key velocity sensitivity | 0–7 |
| 16 | Output level | 0–99 |
| 17 | Modo (0 ratio, 1 fixed) | 0–1 |
| 18 | Coarse | 0–31 |
| 19 | Fine | 0–99 |
| 20 | Detune | 0–14 (7 = centro) |

Globais:

| Desloc. | Parâmetro | Faixa |
|---|---|---|
| 126–129 | Pitch EG R1–R4 | 0–99 |
| 130–133 | Pitch EG L1–L4 | 0–99 |
| 134 | Algoritmo | 0–31 |
| 135 | Feedback | 0–7 |
| 136 | Osc key sync | 0–1 |
| 137 | LFO speed | 0–99 |
| 138 | LFO delay | 0–99 |
| 139 | LFO PMD | 0–99 |
| 140 | LFO AMD | 0–99 |
| 141 | LFO sync | 0–1 |
| 142 | LFO wave | 0–5 |
| 143 | Pitch mod sensitivity | 0–7 |
| 144 | Transpose | 0–48 (24 = C3) |
| 145–154 | Nome | 10 caracteres ASCII |

Os deslocamentos 134, 135, 139, 140 e 143 estão explícitos no código lido; 136–138, 141, 142 e 144 seguem a sequência conhecida do formato e os máximos da tabela do firmware, mas **devem ser conferidos com a especificação MIDI do manual antes de implementar importação de SysEx**.

---

## 9. Sons de fábrica e patches para comparação de ouvido

- 128 vozes de fábrica em 2 cartuchos ROM; as 32 internas de fábrica repetem um dos bancos. (a, MAN)
- Vozes citadas nas fontes lidas: **E. PIANO 1** (a que o manual usa nos exercícios e que virou o "DX Rhodes") e **BASS 1**. (a, MAN; b, Wikipedia)
- **A lista completa de nomes e os parâmetros das vozes não foram lidos.** A Yamaha publica o "DX7 Voice Library" na biblioteca de manuais; os bancos ROM1A a ROM4B circulam em SysEx.
- Patches de teste que não dependem de banco (definidos por mim para a Etapa 4, não são de fábrica):
  1. VOICE INIT (senoide pura, algoritmo 1, OP1 = 99).
  2. Par portadora/moduladora 1:1 no algoritmo 1, OP2 de 0 a 99, para conferir o índice de modulação.
  3. OP6 sozinho no algoritmo 32 com feedback 0 a 7.
  4. Algoritmo 32 com 6 portadoras iguais, para conferir a compensação de nível.

---

## 10. Lacunas (o que não encontrei ou não li)

1. Página de especificações do manual do DX7 (dimensões, peso e faixa do teclado entraram por fontes secundárias).
2. Esquemático e valores do filtro passa-baixas de saída: ordem, inclinação, frequência exata. Só tenho "Sallen-Key, ~16 kHz".
3. Detune em cents por passo.
4. Profundidade absoluta da realimentação medida em aparelho real.
5. Profundidade do vibrato em cents (PMS × PMD) e do tremolo em dB (AMS × AMD).
6. Portamento em segundos por valor de TIME.
7. LFO: período de atualização e conversão de DELAY em segundos; a rotina de SPEED do firmware não foi analisada.
8. Posição do CART FORM no painel e ordem SAVE/LOAD nos botões 15 e 16.
9. Serigrafia exata de cada botão e o desenho dos 32 algoritmos no painel (foto ilegível).
10. Patentes: nenhuma foi lida.
11. Parte 6 da série de Shirriff (registradores de controle do OPS, onde está o detalhe do key sync).
12. Lista e parâmetros das 128 vozes de fábrica.
13. Nível máximo de saída em volts e comportamento de saturação do estágio analógico.
14. Largura do acumulador de fase: 22, 23 ou 27 bits conforme a fonte.

---

## 11. Verificação (o que medir na Etapa 4)

Tolerâncias sugeridas entre parênteses. "Ref." indica a seção de onde sai o valor esperado.

### 11.1 Frequência
1. Senoide pura (VOICE INIT): frequência de cada dó de C1 a C6 e do lá 440 (±1,2 cent, que é um passo de quantização). Ref. 4.2
2. Modo RATIO: COARSE 0, 1, 2, 3, 7, 15, 31 com FINE 0; FINE 1, 50, 99 com COARSE 1. Esperado: nota × COARSE × (1 + FINE/100) (±1,2 cent). Ref. 4.3
3. Modo FIXED: COARSE 0–3 com FINE 0 → 1, 10, 100, 1000 Hz; FINE 50 → ×3,162; FINE 99 → ×9,772 (±0,2 %). Conferir que não segue o teclado. Ref. 4.4
4. DETUNE −7, 0, +7 em três oitavas: registrar o desvio em cents. Sem valor de referência primário; comparar com o Dexed e marcar como aproximação. Ref. 4.5
5. KEY TRANSPOSE nos extremos (±24 semitons) e MASTER TUNE nos extremos (±75 cents). Ref. 2.2, 4.7
6. Pitch bend: RANGE 0, 2, 12 nos dois sentidos; STEP 1 e 12 (conferir os degraus). Ref. 4.7
7. Pitch EG: níveis 0, 50, 99 → −4 oitavas, 0, +4 oitavas; níveis 40 e 60 → ∓375 cents (10 × 37,5). Taxa: tempo para percorrer 1 oitava com taxa 50 e 99, contra tabela ÷ 21,3 oitavas/s (±5 %). Ref. 4.6
8. Portamento: tempo de uma oitava com TIME 25, 50, 75, 99; conferir que TIME 0 é instantâneo e que glissando anda em semitons. Aproximação. Ref. 4.7
9. Taxa de amostragem do núcleo: confirmar se é 49 096 Hz ou a do contexto de áudio, e registrar no relatório.

### 11.2 Espectro, algoritmos e realimentação
10. Par 1:1 no algoritmo 1: amplitude das parciais para OP2 = 60, 70, 80, 90, 99, contra funções de Bessel com I = π × 2^(33/16 − (99 − OL)/8) (±1 dB nas 6 primeiras parciais). Ref. 3.3
11. Para cada um dos 32 algoritmos: com todos os moduladores em OL 0, o número de parciais na saída deve ser igual ao número de portadoras (afinando cada operador numa razão diferente). Depois, ligar um modulador por vez e conferir que só a portadora esperada ganha bandas laterais. Ref. 3.4
12. Compensação por número de portadoras: nível RMS dos algoritmos 1 (2 portadoras), 5 (3), 22 (4), 31 (5) e 32 (6) com portadoras idênticas em fase, contra o algoritmo 16 (1 portadora). Esperado: 0 dB para 1, 2 e 4; cerca de −0,2 a −0,3 dB para 3, 5 e 6. Ref. 3.4
13. Realimentação: OP6 sozinho, feedback 0 a 7. Conferir que 0 é senoide pura, que o espectro cresce a cada passo e que em 7 a forma se aproxima de dente de serra sem oscilação na frequência de Nyquist (efeito da média de 2 amostras). Valor absoluto é aproximação. Ref. 3.5
14. Algoritmos 4 e 6: conferir que a realimentação envolve os operadores 4-5-6 e 5-6 (desligar o operador do meio deve eliminar o efeito). Ref. 3.4
15. OSC KEY SYNC: ligado → fase inicial idêntica em notas repetidas; desligado → fase varia. Ref. 3.2

### 11.3 Níveis
16. OUTPUT LEVEL: nível da portadora para OL = 99, 98, 90, 80, 70, 60, 50, 40, 30, 20 → 0,75 dB por passo (±0,2 dB); para OL = 19, 10, 5, 1, 0 → conforme a tabela da seção 5.2. Ref. 5.2
17. Níveis do EG: L = 99, 98, 97, 96, 90, 80, 50, 20, 10 com OL fixo → degraus de 1,5 dB a cada 2 valores acima de 20. Ref. 5.3
18. Velocidade: KVS 0 (nenhuma variação) e KVS 1, 4, 7 com velocidades MIDI 1, 32, 64, 100, 127, contra a fórmula da seção 5.4 (±1 dB). Conferir que KVS 7 com toque fraco fica quase mudo.
19. Keyboard level scaling: para cada uma das 4 curvas, DEPTH 99 e 50, medir o nível a 1, 2 e 3 oitavas do break point, dos dois lados. Registrar se −LIN/99 dá 22 dB/oitava (manual) ou ~24 (fórmula do Dexed) e decidir. Conferir os grupos de 3 teclas e o limite em 99. Ref. 5.5
20. Nível de saída e clipping: 1 nota e 16 notas da voz mais forte (algoritmo 32, tudo em 99, velocidade 127); a saída não pode cortar. Meta de nível do painel inicial conforme o padrão do repositório (−12 a −3 dBFS).
21. Polifonia: 16 notas simultâneas; a 17ª corta a mais antiga. Modo MONO: uma nota. Ref. 1
22. Volume por MIDI: 8 degraus, com 0 = mudo. Ref. 6.4

### 11.4 Envelopes
23. Queda: tempo para cair 20 dB com R = 0, 20, 40, 50, 60, 80, 99, contra 0,2819 × 2^(qrate/4) × (1 + 0,25 × (qrate mod 4)) dB/s (±5 %). Conferir que a queda é reta em dB. Ref. 5.3
24. Ataque: tempo de 10 % a 90 % da amplitude com R1 = 30, 50, 70, 99; conferir o salto inicial (~40 dB acima do mínimo) e a forma quase linear em amplitude. Comparar com o modelo do MSFA-E. Ref. 5.3
25. Sequência dos 4 segmentos com níveis que sobem e descem (por exemplo L = 99, 50, 80, 0): cada segmento vai para o nível certo e o release usa R4 até L4.
26. Rate scaling: mesma medição do item 23 em C1, C3 e C6 com sensibilidade 0, 3 e 7, contra a fórmula da seção 5.6.
27. Degraus do envelope: numa queda lenta (R = 10), conferir passos de 0,0235 dB, se o clone se propuser a reproduzi-los; se não, declarar.
28. Tempo de espera em segmento entre níveis iguais, se implementado. Ref. 5.3

### 11.5 LFO e modulação
29. Frequência do LFO para SPEED 0, 10, 30, 50, 70, 90, 99 contra a tabela da seção 6.1 (±3 %).
30. Forma das 6 ondas (medida no desvio de pitch); S&H muda de valor uma vez por ciclo.
31. DELAY 0, 50, 99: tempo até o início e até a profundidade total. Registrar; referência é o Dexed.
32. Vibrato: desvio de pico em cents para PMS 1, 4, 7 com PMD 99, e PMD 25, 50 com PMS 7. Aproximação.
33. Tremolo: profundidade em dB para AMS 1, 2, 3 com AMD 99. Aproximação.
34. SYNC ligado/desligado: fase do LFO no início da nota.
35. Controladores: roda, pedal, sopro e aftertouch com RANGE 0, 50, 99 em cada destino (PITCH, AMPLITUDE, EG BIAS); conferir que sensibilidade 0 na voz anula o efeito.

### 11.6 Filtro e saída
36. Resposta em frequência da cadeia de saída com senoides de 1 a 24 kHz: ponto de −3 dB (referência ~16 kHz) e inclinação. Como a ordem do filtro original não foi encontrada, a inclinação medida entra no relatório como **escolha de projeto, não como fidelidade**.
37. Espectro de aliasing: nota aguda com índice alto (por exemplo C6, 1:1, OP2 = 99); registrar onde dobram as parciais (24,5 kHz se o núcleo rodar a 49 096 Hz).
38. Ruído de quantização: relação sinal/ruído de uma senoide a 0 dB, −20 dB e −40 dB, se a saída de 12 bits com 4 faixas for implementada.

### 11.7 Painel
39. Comparar o painel final com a foto: posição e cor dos 8 botões de modo, 2 sliders, 2 botões de DATA ENTRY, LED, LCD, 32 botões, slot, rodas.
40. Conferir os 32 rótulos de EDIT e os de FUNCTION contra as tabelas 2.2 e 2.3, e os textos do LCD contra a coluna do firmware.
41. Cada botão que alterna (17, 21, 22, 24, 25, 29, 30 e o 8 em FUNCTION) percorre os estados descritos.
42. Pendências de painel a resolver antes: itens 8 e 9 da seção 10.
