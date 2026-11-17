# Roland Jupiter-8 (JP-8) — documento de pesquisa (Etapa 1)

Preparado em 15/11/2026. Só pesquisa; nenhum código foi escrito.

## 0. Como ler este documento

**Categorias de confiança** (seção 6 do documento de estado):

- **(a)** confirmado por fonte primária (manual do proprietário, Service Notes, página de especificações da Roland);
- **(b)** confirmado por fontes secundárias (análises de circuito, fóruns técnicos, documentação Roland de produtos posteriores);
- **(c)** aproximação ou inferência minha. Sempre dito no texto.
- **NE** = não encontrado. Não preenchi com número plausível.

**Limite importante do método.** O manual do proprietário e as Service Notes foram lidos pelo texto OCR do Internet Archive, por meio de uma ferramenta que devolve extração parafraseada, não a imagem da página. Consequências:

1. Os esquemáticos (que são imagens) **não foram lidos**. Valores de componentes do VCO, do VCF e do VCA não estão aqui.
2. O OCR está truncado em vários pontos. Onde um número veio de trecho duvidoso, está marcado **(a, OCR duvidoso)**.
3. As figuras das Service Notes (formas de onda de referência) não aparecem no OCR.

Antes de fechar a implementação, vale abrir o PDF das Service Notes e conferir os itens marcados como OCR duvidoso (lista na seção 12).

**Versão de referência.** O instrumento existiu em várias revisões (seção 9). A foto anexada não permite identificar a revisão. Sugestão **(c)**: modelar a versão com DAC de 14 bits (nº de série 171700 em diante), que é a mais comum e a de afinação estável.

---

## 1. Resumo da arquitetura

| Item | Valor | Cat. | Fonte |
|---|---|---|---|
| Polifonia | 8 vozes, 2 VCOs por voz (16 osciladores) | a | OM, RS |
| Timbres | 2 (Upper e Lower), 4 vozes cada em Split/Dual | a | OM |
| Teclado | 61 teclas, 5 oitavas, Dó a Dó, sem velocidade e sem aftertouch | a/b | OM, SN, SM |
| Cadeia de sinal por voz | VCO-1 + VCO-2 → Source Mix → HPF → VCF → VCA | a | OM |
| Filtro passa-baixas | IR3109, 4 polos, saída comutável −12 / −24 dB/oitava, ressonante | a/b | OM, SN (lista de peças), ED1 |
| Filtro passa-altas | 1 polo (−6 dB/oitava), não ressonante, por voz, controlado por tensão | a/b | OM, ED2 |
| Envelopes | 2 ADSR por voz, chip IR3R01 | a/b | OM, SN, AM3 |
| VCA | baseado em BA662 | b | WP, PN, GS1 |
| LFO | 1 por seção (Upper e Lower), 4 formas de onda | a | OM, SN |
| Efeitos | nenhum (não há chorus) | a | OM (nenhum controle no painel), SM |
| Memória | 64 patches (11–88) + 8 patch presets (A–H) | a | OM, RS |
| Arpejador | **sim, original**, 4 modos, 1–4 oitavas | a | OM, RS |
| Sequenciador | não há | a | OM, SM |
| MIDI | não há de fábrica; DCB a partir do nº 282880 | a/b | SN, GY |
| CPU | µPD780C-1 (compatível com Z80) a 4 MHz | a | SN |

O ponto 9.3 do documento de estado fica respondido: **o Jupiter-8 tem arpejador original**, que deve entrar no painel. Não tem sequenciador.

---

## 2. Painel completo

Conferido com a foto anexada. Nomes em maiúsculas são a serigrafia. Sliders têm escala 0–10 **(a, OM)**.

### 2.1 Fileira superior, da esquerda para a direita

**Bloco sem título (à esquerda, sob o logotipo)**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| VOLUME | knob | volume geral | a |
| BALANCE | knob | LOWER ↔ UPPER; só atua em Dual e Split | a |
| ARPEGGIO RATE | slider | 1 a 20 Hz | a (RS, SN) |
| INT / EXT | chave 2 posições | relógio do arpejador interno ou externo | a |

**LFO** (dois LEDs de velocidade no cabeçalho: LOWER e UPPER)

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| RATE | slider | 0,05 a 40 Hz | a (RS, SN) |
| DELAY TIME | slider | 0 a 4 s | a (RS, SN) |
| WAVE FORM | seletor rotativo, 4 posições | senoide, dente de serra, quadrada, RANDOM | a (OM + foto) |

**VCO MODULATOR**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| FREQ MOD — LFO MOD | slider | profundidade do LFO na afinação | a |
| FREQ MOD — ENV MOD | slider | profundidade do ENV-1 na afinação | a |
| (destino) | chave 3 posições | VCO-1 / BOTH / VCO-2 | a |
| PULSE WIDTH MOD | slider | largura (em MANUAL) ou profundidade | a |
| (fonte do PWM) | chave 3 posições | LFO / MANUAL / ENV-1 | a |

Etiquetas laranja abaixo dos sliders indicam a fonte: LFO e ENV-1.

**VCO-1**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| CROSS MOD | slider | 0–10; etiqueta laranja "VCO-2" (fonte) | a |
| RANGE | seletor rotativo, 4 posições | 16', 8', 4', 2' | a |
| WAVEFORM | seletor rotativo, 4 posições | triangular, dente de serra, pulso variável, quadrada | a |

**VCO-2**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| SYNC | chave | OFF / ON; etiqueta laranja "VCO-1" (fonte) | a |
| RANGE (chave) | chave | NORMAL / LOW FREQ | a |
| RANGE (knob) | knob com passos | 16' a 2' em semitons, com marcas em 16', 8', 4', 2' | a |
| FINE TUNE | knob | −/+ 50 cents | a |
| WAVEFORM | seletor rotativo, 4 posições | senoide, dente de serra, pulso variável, NOISE | a |

**Mixer** (cabeçalho com as etiquetas VCO-1 e VCO-2)

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| SOURCE MIX | knob | todo à esquerda só VCO-1; centro mistura igual; todo à direita só VCO-2 | a |

**HPF**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| CUT OFF FREQ | slider | embaixo (LOW) o sinal passa inteiro; subindo, corta os graves | a |

**VCF**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| CUT OFF FREQ | slider | em cima (HIGH) aberto; embaixo (LOW) fecha até o silêncio | a |
| RES | slider | 0–10 | a |
| SLOPE | chave 2 posições | −12 dB/OCT / −24 dB/OCT | a |
| ENV MOD | slider | 0–10 | a |
| (fonte do ENV MOD) | chave 2 posições | ENV-1 / ENV-2 | a |
| LFO MOD | slider | 0–10 | a |
| KEY FOLLOW | slider | 0 a 120 % | a |

Etiquetas laranja: LFO e KYBD.

**VCA**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| LEVEL | slider | quanto o ENV-2 abre o VCA (nível do patch) | a |
| LFO MOD | chave 4 posições | 0, 1, 2, 3 | a |

Etiquetas laranja: ENV-2 e LFO.

**ENV-1**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| A, D, S, R | 4 sliders | ver seção 6 | a |
| KEY FOLLOW | chave | OFF / ON | a |
| POLARITY | chave | normal / invertida | a |

**ENV-2**

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| A, D, S, R | 4 sliders | mesmas faixas do ENV-1 | a |
| KEY FOLLOW | chave | OFF / ON | a |

### 2.2 Fileira inferior (botões), da esquerda para a direita

Cores lidas na foto **(c: cor aproximada pela foto)**.

| Grupo | Controles | Cor na foto | Cat. |
|---|---|---|---|
| (sem título) | MASTER TUNE (knob, ±50 cents); TUNE (botão) | botão vermelho | a |
| ARPEGGIO — RANGE | 1, 2, 3, 4 | laranja | a |
| ARPEGGIO — MODE | UP, DOWN, U&D, RANDOM | amarelo | a |
| ASSIGN MODE | SOLO, UNISON, POLY 1, POLY 2 | creme | a |
| HOLD | LOWER, UPPER | verde | a |
| KEY MODE | DUAL, SPLIT, WHOLE | verde-azulado | a |
| PANEL MODE | LOWER, UPPER | azul | a |
| Visor | LED de 7 segmentos, 4 dígitos: 2 para LOWER e 2 para UPPER; legenda PATCH NUMBER | vermelho | a |
| PATCH NUMBER 11–88 | 1 a 8 | creme | a |
| (ao lado) | MANUAL | verde | a |
| PATCH PRESET | A a H | A–D amarelo, E–H laranja | a |
| (ao lado) | LED MEMORY PROTECT; WRITE | botão vermelho | a |
| TAPE MEMORY | SAVE, VERIFY, LOAD; LED DATA CHECK | verde-azulado | a |

Abaixo do painel há uma seta (▼) que marca o ponto de split padrão **(a, OM + foto)**.

### 2.3 Seção de performance (à esquerda do teclado)

| Controle | Tipo | Posições / faixa | Cat. |
|---|---|---|---|
| VCO-1 BEND, VCO-2 BEND, VCF BEND | 3 chaves | OFF / ON | a |
| VCO MOD, VCF MOD | 2 chaves | OFF / ON | a |
| BEND — VCO, VCF | 2 sliders | sensibilidade do bender | a |
| LFO MOD — VCO, VCF | 2 sliders | profundidade da modulação de performance | a |
| LFO MOD RISE TIME | knob | 0 imediato; 10 mais lento. Tempo em segundos: **NE** | a |
| PORTAMENTO | knob | 0 instantâneo; tempo máximo: **NE** | a |
| (modo do portamento) | chave 3 posições | UPPER ONLY / OFF / ON | a |
| LFO MODULATION | botão grande | aciona a modulação de performance enquanto pressionado | a |
| BENDER | alavanca com mola | esquerda/direita, centro sem efeito | a |

### 2.4 Painel traseiro (para registro; pouco entra no clone)

Saídas UPPER e LOWER balanceadas (600 Ω, 0 dBm) e UPPER, MIX, LOWER não balanceadas (1 kΩ, 0 ou −20 dBm); fones estéreo com nível LOW/MEDIUM/HIGH; entradas de controle HOLD, PORTAMENTO, VCF, VCA; entrada de clock do arpejador (1 passo por pulso) e conector DIN com seletor de divisão (colcheias, tercinas de colcheia, semicolcheias); saída CV da nota mais aguda (0–5 V, 1 V/oitava) e GATE (0 / +15 V); TAPE MEMORY; chave MEMORY PROTECT **(a, RS, OM, SN)**.

### 2.5 Observações para o desenho do painel

- No original já existe HOLD (LOWER/UPPER) e arpejador. A faixa de acessórios do projeto (seção 5 do documento de estado) duplicaria o Hold. Sugestão **(c)**: no Jupiter-8, a faixa de acessórios fica só com o sequenciador de 16 passos, Aleatório e Zerar. Decisão do usuário.
- Textos de marca visíveis na foto: logotipo do fabricante, "JP-8" e o nome do modelo. A decisão sobre reproduzi-los é o ponto 9.1 do documento de estado e continua em aberto.
- O Roland Cloud JUPITER-8 (software) acrescenta controles que **não existem** no aparelho (forma de onda triangular no LFO, KEY TRIG, VEL SENS, TONE, mais formas de onda nos VCOs, faixas 64' e 32'). Não usar o manual do software como referência de painel **(b, RC)**.

---

## 3. Osciladores

### 3.1 Circuito

| Fato | Cat. | Fonte |
|---|---|---|
| VCOs discretos (não usam chip de VCO) | b | WP, AM1, GS1 |
| Projeto derivado do VCO do SH-2 / System 100M, com par casado CA3046 no conversor exponencial e amp-ops TL080 | b | AM1 |
| CA3046, TL080 e multiplexadores 4052 constam na lista de peças | a (OCR duvidoso no CA3046) | SN |
| Forma de onda escolhida por multiplexador 4052 comandado pela CPU | b | GS1 |
| Nível na saída dos VCOs (ponto de teste TP-4): 10 V pico a pico por oscilador | a | SN (ajuste VCO LEVEL) |
| Núcleo (dente de serra ou triangular), capacitor do integrador, circuito dos conformadores de onda | **NE** | esquemático não lido |
| Polaridade da rampa do dente de serra (sobe ou desce) | **NE** | — |

### 3.2 Afinação e faixas

| Parâmetro | Valor | Cat. | Fonte |
|---|---|---|---|
| Faixas do VCO-1 | 16', 8', 4', 2' | a | OM, RS |
| Faixa do VCO-2 | 16' a 2', knob em passos de semitom | a | OM |
| Número de passos do knob do VCO-2 | 37 (0 a 36 semitons) | c | inferência: 3 oitavas entre 16' e 2' |
| FINE TUNE do VCO-2 | ±50 cents | a | OM, RS, SN |
| MASTER TUNE | ±50 cents; centro próximo de Lá = 442 Hz | a | OM, RS |
| Escala do DAC | 1 V/oitava; Dó mais grave = 0,000 V, Dó mais agudo = 5,000 V, ±2 mV | a | SN (ajuste do DAC) |
| Frequências de calibração | tecla A1 ≈ 221 Hz, tecla A3 ≈ 884 Hz; em 2', tecla A3 = 3536 Hz | a (OCR duvidoso no 221) | SN (ajuste VCO TUNE) |

Leitura dos números de calibração **(c, inferência)**: as três frequências só fecham se 221 e 884 Hz forem medidos em 8'. Na numeração da Roland (Dó mais grave = C0), isso dá, em 8':

| Tecla (numeração Roland) | Frequência em 8' com Lá = 442 Hz |
|---|---|
| C0 (mais grave) | 65,7 Hz |
| A1 | 221 Hz |
| C2 | 262,8 Hz |
| A2 | 442 Hz |
| A3 | 884 Hz |
| C5 (mais aguda) | 2102,5 Hz |

16' é uma oitava abaixo; 4' e 2' uma e duas oitavas acima. Para o clone, usar Lá = 440 Hz como padrão com MASTER TUNE no centro é uma decisão de projeto, não o comportamento original **(c)**.

### 3.3 Formas de onda

- VCO-1: triangular, dente de serra, pulso variável, quadrada **(a)**.
- VCO-2: senoide, dente de serra, pulso variável, ruído **(a)**.
- Só uma forma de onda por oscilador de cada vez **(a/b, OM, WP)**.
- A largura de pulso é comum aos dois VCOs e só age no oscilador que estiver em pulso variável **(a, OM)**.
- PWM em MANUAL: slider em 0 dá onda quadrada (50 %); subindo, o pulso estreita **(a, OM)**. Largura mínima em 10: **NE**. As Service Notes dão um alvo de "30 ms de largura de espaço" com a tecla C2, que não bate com o período da nota e não pôde ser interpretado **(a, OCR duvidoso)**.
- PWM em LFO: a largura varre em torno da quadrada; em ENV-1: um movimento por nota **(a, OM)**.
- Conteúdo harmônico exato de cada onda (pureza da senoide, arredondamento do dente de serra): **NE**.

### 3.4 Sync

- A chave SYNC força o **VCO-2 a seguir o VCO-1** (VCO-1 mestre, VCO-2 escravo), sync rígido **(a, OM; b, ED3, RC)**. A etiqueta "VCO-1" abaixo da chave, na foto, indica a fonte.
- Atenção: um guia da Roland para o Model Expansion (ZEN-Core) descreve o sentido contrário. Vale o aparelho original **(a)**.
- O uso típico é VCO-2 afinado acima do VCO-1, com a afinação do VCO-2 varrida por LFO, ENV-1 ou bender **(a, OM)**.

### 3.5 Cross Mod

- O VCO-2 modula a frequência do VCO-1 **(a, OM)**.
- É FM **exponencial**: o sinal entra na entrada de 1 V/oitava do VCO-1; não há FM linear **(b, ED3, AT1)**.
- O sinal sai do VCO-2 **depois** do seletor de forma de onda (vale a onda selecionada, inclusive ruído) e passa por um BA662 que faz o papel de atenuador comandado pelo slider **(b, AT1)**.
- Profundidade: com CROSS MOD em 5 e o VCO-2 em onda quadrada, o VCO-1 desloca 3 oitavas **(a, SN, ajuste XMOD LEVEL)**. Curva do slider entre 0 e 10: **NE**.
- A profundidade é fixa pelo slider; não há controle por envelope **(b, ED3)**.

### 3.6 LOW FREQ do VCO-2

- Em LOW FREQ o VCO-2 gera frequências subsônicas e **não segue o teclado** **(a, OM; b, VS)**.
- Serve como segundo LFO por voz via CROSS MOD **(a, OM)**.
- Faixa de frequência em LOW FREQ e efeito do knob RANGE nesse modo: **NE** no manual original. O software da Roland usa o knob de semitons para ajustar a frequência nesse modo **(b, RC)**.

### 3.7 Modulação da afinação

| Parâmetro | Valor | Cat. | Fonte |
|---|---|---|---|
| ENV MOD em 10 (ENV-1, sustain 10) | desloca 3 oitavas | a | SN (ajuste VCO ENV MOD DEPTH) |
| LFO MOD em 10 | pico chega ao dobro da frequência (figura de Lissajous 2:1) | a (OCR duvidoso) | SN |
| Bender, sensibilidade VCO no máximo | 1 oitava para cada lado | c | inferência do ajuste BENDER LEVEL (tecla A3 com alavanca à esquerda e A1 com alavanca à direita igualam A2) |
| Bender no VCF, faixa | **NE** | — | — |
| Modulação de performance (LFO MOD), profundidade máxima | **NE** | — | — |

### 3.8 Ruído

- É a 4ª forma de onda do VCO-2; não há controle de nível separado **(a, OM)**.
- O gerador fica na placa Module Controller, comum às vozes e não um por voz, ajustado para cerca de 5 V pico a pico **(a, SN)**. Se há um gerador por seção (Upper e Lower) ou um só para o instrumento: **NE**.
- A partir do nº 202100 o gerador passou a usar BA662 com controle automático de ganho, e há seleção entre ruído branco e rosa ligada à chave LOW FREQ; o OCR não deixa claro o destino exato **(a, OCR duvidoso)**.

---

## 4. Filtros

### 4.1 HPF

| Fato | Cat. | Fonte |
|---|---|---|
| 1 polo, −6 dB/oitava, não ressonante | a | OM |
| Um por voz, antes do VCF | a/b | OM, ED2 |
| Circuito: OTA BA662 com buffer a FET | b | ED2 |
| Controle contínuo por tensão, memorizado no patch | b | ED2 |
| Frequência de corte mínima e máxima | **NE** | nem OM, nem SN, nem ED2 dão valores |
| Curva do slider | **NE** | — |

### 4.2 VCF

| Fato | Cat. | Fonte |
|---|---|---|
| Chip IR3109 (4 estágios OTA com buffers) | a/b | SN (lista de peças), ED1, SD |
| −24 dB/oitava na saída do 4º estágio; −12 dB/oitava na saída do 2º estágio | b | ED1 |
| Ressonância por realimentação externa ao chip, com BA662 | b | ED1, MW (resumo), AM2 |
| Compensação de volume com a ressonância (o Jupiter-8 acrescentou isso em relação ao Jupiter-4) | b | AM2 |
| Mesmo desenho básico do Juno-6, que não tem a saída de 12 dB | b | ED1 |
| Capacitores e resistores do núcleo | **NE** | ED1 dá só os do Juno-6 (240 pF, 68 kΩ) |
| KEY FOLLOW 0 a 120 % | a | RS, SN |
| KEY FOLLOW centrado no Dó central: acima abre, abaixo fecha | a | OM |
| ENV MOD em 10: corte sobe 64 vezes (6 oitavas) | c | cálculo meu a partir das bases de tempo do ajuste VCF ENV MOD (1 ciclo a 0,2 ms/div → 16 ciclos a 50 µs/div) |
| Excursão do slider CUT OFF FREQ: cerca de 1000 vezes (≈10 oitavas) nas primeiras unidades e 500 vezes (≈9 oitavas) nas posteriores | c | cálculo meu a partir do ajuste VCF WIDTH; interpretação incerta |
| Corte em 442 Hz com o slider em 5 (em 4 nas unidades posteriores) | a (OCR duvidoso) | SN, ajuste VCF TUNE; a tecla usada não é dita |
| Frequência de corte mínima e máxima em Hz | **NE** | — |
| LFO MOD: ajuste de fábrica para "50 % de modulação" | a (sem definição) | SN |

**Auto-oscilação.** O manual do proprietário não menciona auto-oscilação **(a)**. Nas Service Notes, o filtro é posto a oscilar girando o trimmer de ressonância (VR14) ao máximo só para calibrar a afinação; depois o trimmer é reajustado para um nível mostrado numa figura **(a, figura ausente do OCR)**. Fontes secundárias dizem que, calibrado de fábrica, o filtro **não** auto-oscila com RES em 10 **(b, AM2, MR)**. Conclusão para o clone: RES em 10 deve ficar logo abaixo da auto-oscilação. Quão abaixo (ganho de malha exato): **NE**, será aproximação **(c)**.

**Caráter.** A diferença entre 12 e 24 dB é descrita como pouco dramática; o modo de 12 dB é o mais associado a pads e cordas **(b, AM2)**. A limitação da ressonância vem do recorte suave dos OTAs **(b, ED1, dito para o Juno-6, mesmo desenho)**.

---

## 5. VCA

| Fato | Cat. | Fonte |
|---|---|---|
| Controlado pelo ENV-2 (fixo) | a | OM |
| LEVEL define o nível do patch | a | OM |
| LFO MOD em 4 passos (0–3); profundidade de cada passo | passos (a); profundidades **NE** | OM |
| Baseado em BA662 (dois por VCA, segundo um construtor de clone) | b | WP, PN, GS1 |
| Nível de calibração: 3 V pico a pico no ponto de teste com a tecla C2 | a | SN (ajuste VCA LEVEL) |
| Entradas externas de pedal para VCF e VCA | a | RS |
| Saturação do VCA | **NE** | — |

Saída: UPPER e LOWER separadas mais MIX. Em WHOLE as duas saídas levam o mesmo sinal **(a, OM)**. Não há panorama por voz.

---

## 6. Envelopes

| Parâmetro | Valor | Cat. | Fonte |
|---|---|---|---|
| Attack | 1 ms a 5 s | a | RS, SN (especificação) |
| Decay | 1 ms a 10 s | a | RS, SN |
| Sustain | 0 a 100 % | a | RS, SN |
| Release | 1 ms a 10 s | a | RS, SN |
| Attack máximo calibrado em fábrica | 6 s | a | SN (ajuste ENVELOPE TOTAL TIME) |
| Chip | IR3R01, um por envelope (dois por voz) | a/b | SN, AM3, GS3 |
| Capacitor de tempo | 68 nF | b | AM3 |
| Tensão de referência | +10 V; saída de 0 a +10 V | b | AM3 |
| Tensões de controle | A, D, R de 0 a +5 V; S de 0 a +10 V | b | AM3 |
| Sliders A, D, R não lineares (resistor de 4,7 kΩ dá curva exponencial invertida) | b | AM3 |
| Forma das curvas (attack, decay, release) | **NE** em fonte primária | AM3 diz não ter confirmado |

Há divergência entre a especificação (5 s) e o ajuste de fábrica (6 s); a AMSynths também nota isso. Um site lista 1,5 ms / 6 s / 12 s sem citar fonte **(c, PN)**. Sugestão: usar a especificação oficial como meta e registrar 6 s como tolerância superior do attack.

**Curvas.** O envelope é analógico (carga e descarga de capacitor). O esperado é attack exponencial truncado e decay/release exponenciais, mas isso **não foi confirmado** por medição publicada **(c)**.

**KEY FOLLOW dos envelopes.** Com a chave ligada, A, D e R encurtam nas notas agudas e alongam nas graves **(a, OM)**. Só o IR3R01 do Jupiter-8 usa o pino de modulação para isso; um 555 gera um dente de serra de 28 kHz comparado com a tensão do teclado **(b, AM3)**. Quanto os tempos mudam por oitava: **NE**.

**Roteamento.**

- ENV-1: afinação dos VCOs (VCO MODULATOR), largura de pulso, e corte do VCF se a chave do ENV MOD estiver em ENV-1. Tem POLARITY (normal ou invertido) **(a)**.
- ENV-2: VCA (fixo) e corte do VCF se a chave estiver em ENV-2 **(a)**.
- A POLARITY inverte o ENV-1 para todos os destinos dele **(a, OM, descrita como imagem espelhada)**.

**Rapidez.** O attack mínimo de 1 ms, gerado em hardware, é citado como traço do timbre, em contraste com os envelopes por software do Jupiter-6 e do Juno-106 **(b, WP)**.

---

## 7. LFO e modulação de performance

| Parâmetro | Valor | Cat. | Fonte |
|---|---|---|---|
| Formas de onda, na ordem do seletor | senoide, dente de serra, quadrada, random (sample & hold) | a | OM + foto |
| Sentido do dente de serra | o manual chama de dente de serra invertido; entendo como rampa descendente, a conferir pelo ícone do painel (c) | a (OCR) | OM |
| RATE | 0,05 a 40 Hz | a | RS, SN |
| DELAY TIME | 0 a 4 s (ajustado em fábrica para cerca de 4 s no máximo) | a | RS, SN |
| Quantidade | um LFO para Upper e outro para Lower, comuns às 4 vozes de cada seção | a | OM (LEDs independentes), SN (circuitos U e L) |
| Destinos | afinação dos VCOs, largura de pulso, corte do VCF, nível do VCA | a | OM |
| DELAY | com DELAY acima de 0, o LFO entra depois de a tecla ser pressionada | a | OM |
| Regra de rearme do DELAY (a cada nota ou só após soltar todas) | **NE** | — |
| Curva de entrada (fade) do DELAY | **NE** | — |
| Sincronismo do LFO com a tecla | **NE** (não há controle no painel) | — |
| A "senoide" é senoide real ou triangular arredondada | **NE** | SN fala em ajustar a retidão das rampas, o que sugere núcleo triangular (c) |
| Curva do slider RATE | **NE** | — |

Divergência menor: Wikipedia e um site listam a primeira forma como triangular; o manual original e a serigrafia mostram senoide. Vale o manual **(a)**.

**Modulação de performance (botão LFO MODULATION).** Usa o mesmo LFO do patch (forma e velocidade do painel), não um LFO separado **(a, OM)**. O botão é momentâneo; RISE TIME define a entrada gradual; as chaves VCO MOD e VCF MOD e os dois sliders definem destino e profundidade **(a, OM)**. Uma resenha de 1982 diz que o vibrato de performance não tem entrada gradual, o que contradiz o RISE TIME do manual **(b, OT)**; vale o manual.

---

## 8. Modos de teclado, alocação de vozes, Hold e portamento

### 8.1 KEY MODE

| Modo | Comportamento | Cat. |
|---|---|---|
| WHOLE | um patch, 8 vozes no teclado todo. BALANCE não atua. É o modo ao ligar. | a |
| SPLIT | Lower (2 oitavas graves) e Upper (3 oitavas agudas), 4 vozes cada, patches independentes | a |
| DUAL | dois patches em camada em todas as teclas, 4 notas de polifonia; BALANCE mistura | a |

- Ponto de split padrão: 24 teclas a partir do grave, marcado pela seta **(a, OM; b, OT)**.
- Ponto de split ajustável: segurar SPLIT e tocar uma tecla, que passa a ser a mais grave do Upper **(a, OM)**. Só nas ROMs 2.x/3.x; as primeiras unidades (ROM 0.7/1.0) têm split fixo **(a, SN)**.
- PANEL MODE (LOWER/UPPER) escolhe qual patch o painel edita. Em WHOLE vale o Upper **(a, OM)**.
- Placas de voz: A–D são Upper, E–H são Lower **(a, SN)**.

### 8.2 ASSIGN MODE

| Modo | Comportamento | Cat. |
|---|---|---|
| POLY 1 | uma voz por tecla; cada nota cumpre o release inteiro. Modo padrão. | a |
| POLY 2 | uma voz por tecla; só a última nota (ou o último grupo tocado junto) cumpre o release; as anteriores são cortadas na hora, como um abafador | a |
| SOLO | monofônico, uma voz por seção, prioridade para a nota mais grave | a |
| UNISON | todas as vozes numa tecla; com 2 teclas, 4 vozes cada; e assim até 8 teclas com 1 voz cada. O nível de saída fica constante. | a |

- POLY 1, POLY 2 e UNISON: prioridade da primeira nota. Com todas as vozes presas, uma nota nova **não soa** até que alguma tecla seja solta (não há roubo de voz) **(a, OM)**.
- Vozes liberadas são reutilizadas na ordem em que foram tocadas, mesmo que o release não tenha terminado **(a, OM)**.
- Em modo de teste, POLY 1 distribui as vozes A a H em sequência quando a mesma tecla é repetida, ou seja, alocação rotativa **(a, SN)**.
- Não há controle de desafinação no UNISON; a espessura vem das diferenças naturais entre VCOs **(a por ausência no painel; quantidade de desafinação c)**.
- Regra exata de redistribuição do UNISON para 3, 5, 6 e 7 teclas: **NE** (o manual só dá 1, 2 e 8).
- Em SOLO, se o envelope redispara ao ligar notas: **NE** no manual original.
- Os quatro modos funcionam em qualquer KEY MODE **(a, OM)**.

Um texto do blog da Roland Austrália diz que SOLO empilha os 16 osciladores numa nota; isso contradiz o manual (uma voz por seção) e descreve o UNISON. Vale o manual **(a)**.

### 8.3 HOLD

- HOLD LOWER e HOLD UPPER sustentam as notas indefinidamente. Em WHOLE e DUAL, qualquer um dos dois segura o teclado inteiro; em SPLIT, cada um segura a sua seção **(a, OM)**.
- As notas presas continuam até desligar o HOLD ou até serem tocadas mais notas do que há vozes **(a, OM)**.
- Pedal no conector HOLD: em SPLIT atua só no Lower **(a, OM)**.

### 8.4 Portamento

- Knob de tempo; 0 é instantâneo **(a)**. Tempo máximo: **NE**. Tempo constante ou taxa constante: **NE**.
- Chave: UPPER ONLY (só a seção Upper em SPLIT), OFF, ON (teclado inteiro) **(a, OM)**.
- É polifônico **(b, OT)**.

### 8.5 Afinação automática (TUNE)

- Ao ligar, a CPU mede cada VCO em duas notas e calcula a escala e o desvio de cada um; o botão TUNE refaz uma medição por VCO **(a, SN)**. Resenha de época: 5 a 6 s ao ligar, cerca de 2 s depois **(b, OT)**.
- Para o clone, TUNE pode zerar a deriva simulada das vozes **(c, decisão de projeto)**.

---

## 9. Arpejador (original)

| Parâmetro | Valor | Cat. | Fonte |
|---|---|---|---|
| Modos | UP, DOWN, U&D, RANDOM | a | OM, RS |
| RANGE | 1 a 4 oitavas | a | OM, RS |
| RATE | 1 a 20 Hz (slider no bloco esquerdo do painel) | a | RS, SN |
| Relógio | INT ou EXT (1 passo por pulso; DIN com 3 divisões) | a | OM, RS |
| Área do teclado | WHOLE e DUAL: teclado inteiro; SPLIT: só Lower | a | OM |
| Ao selecionar um modo | entra automaticamente em RANGE 4 e POLY 2 (ambos podem ser alterados depois) | a | OM |
| Último RANGE | lembrado durante o uso; volta a 4 ao desligar | a | OM |

**Ordem das notas.** Este é o ponto menos óbvio. O manual diz que o arpejador toca as notas **na ordem em que foram tocadas**, e não ordenadas por altura; memoriza uma sequência de até 8 notas **(a, OM)**. Uma discussão técnica com donos do aparelho confirma: em UP com 1 oitava, a sequência tocada simplesmente se repete; UP, DOWN e U&D definem a direção em que essa sequência é percorrida e transposta **(b, KV)**. A resenha de 1982 fala em ordem "ascendente/descendente" **(b, OT)**, o que é a descrição simplificada.

- RANGE 2–4: a sequência se repete transposta uma oitava a cada volta; a direção da transposição segue o modo **(a, OM)**.
- RANDOM: sorteia entre as notas tocadas, espalhadas pela faixa de RANGE **(a, OM)**.
- U&D: se as notas das pontas são repetidas na virada: **NE**.
- Como desligar o arpejador (provavelmente apertando de novo o botão de modo aceso): **NE**.
- Comportamento com SOLO e UNISON: **NE**.
- Duração do gate de cada passo: **NE**.
- Não transpõe um acorde gravado para outra tonalidade **(b, OT)**.

Um site lista RATE até 25 Hz sem citar fonte; vale 20 Hz **(a)**.

---

## 10. Memória e controle digital

| Fato | Cat. | Fonte |
|---|---|---|
| 64 patches numerados 11–18 … 81–88 (dois dígitos de 1 a 8) | a | OM |
| 8 patch presets (A–H): par de patches Lower/Upper mais o KEY MODE | a | OM |
| O patch também guarda split, arpejo, hold, portamento, modulação de performance e assign mode | b | RA |
| MANUAL: o som passa a seguir a posição física dos controles | a | OM |
| WRITE + número (ou letra) grava; MEMORY PROTECT no painel traseiro | a | OM |
| Edição permanente: mexer num controle altera o som sem alterar a memória; dois pontos decimais acendem no visor | b | OT |
| Fita cassete: SAVE, VERIFY, LOAD | a | OM |
| DAC: 12 bits (Am6012) nas primeiras; 14 bits a partir do nº 171700; saída 0–10 V; passo de cerca de 0,6 mV (≈0,7 cent) em 14 bits | a | SN |
| 12 bits: cerca de 3 cents por passo | b | AT2 |
| Varredura das chaves a cada 25 ms; interrupção a cada 1 ms | a | SN |
| Resolução da leitura dos sliders (bits do conversor A/D do painel) e dos valores guardados | **NE** | — |

**Revisões por número de série (a, SN):**

| Série | Mudança |
|---|---|
| abaixo de 171700 | DAC de 12 bits; split fixo nas ROMs 0.7/1.0 |
| 171700 | DAC de 14 bits |
| 181900 | ROM 3.2 |
| 202100 | circuito de modulação revisto para igualar Upper e Lower; mudanças no ruído e no LFO |
| 242750 e 272850 | LEDs mais brilhantes |
| 282880 | DCB de série |

---

## 11. Particularidades do timbre

O que as fontes sustentam, e o que é aproximação.

| Aspecto | O que se sabe | Cat. |
|---|---|---|
| VCOs discretos, estáveis para a época | descrição recorrente; um teste diz que raramente desafina | b (WP, GY) |
| Deriva entre vozes | existe, mas a quantidade em cents: **NE** | c |
| Erro residual da afinação automática | **NE**; em 14 bits o passo é de ≈0,7 cent | a para o passo |
| Nível alto na entrada do filtro (10 V p-p por VCO antes de um divisor) | o divisor e a saturação resultante: **NE** | a para o nível; c para a saturação |
| Não linearidade do filtro | recorte suave dos OTAs (tanh) | b (ED1) |
| Ressonância sem auto-oscilação | ver 4.2 | b |
| Envelopes rápidos em hardware | attack de 1 ms | a/b |
| Cross mod exponencial | timbres inarmônicos que mudam com a tecla | b |
| Som descrito como limpo, nítido, "plinky"; forte em sinos, órgãos e metais; cordas menos quentes que as do Prophet-5 | resenha de 1982 | b (OT) |
| Ruído de fundo, hum, diafonia | **NE** | — |
| Curvas (taper) dos sliders de corte, ressonância, níveis e modulação | **NE** (só os sliders A/D/R têm indicação) | — |
| Resposta de frequência da saída | **NE** | — |

Tudo o que for deriva, saturação, taper e ruído será aproximação marcada como tal na Etapa 2, conforme o ponto 9.6 do documento de estado.

---

## 12. Lacunas e itens a conferir

**Não encontrado (NE), em ordem de impacto no som:**

1. Faixa em Hz do corte do VCF e do HPF, e curva dos sliders.
2. Ganho de ressonância em RES = 10 (quão perto da auto-oscilação).
3. Forma exata das curvas dos envelopes e curva dos sliders A/D/R.
4. Largura mínima do pulso e profundidade do PWM por LFO e ENV-1.
5. Profundidades de: LFO MOD do VCA (passos 1–3), LFO MOD do VCF, modulação de performance, bender no VCF.
6. Faixa do VCO-2 em LOW FREQ.
7. Tempos do PORTAMENTO, do RISE TIME e regra de rearme do DELAY do LFO.
8. Quantidade de KEY FOLLOW dos envelopes.
9. Detalhes do arpejador: virada do U&D, gate, como desligar.
10. Distribuição do UNISON com 3, 5, 6 e 7 teclas.

**Conferir no PDF das Service Notes (OCR duvidoso):** valor de 221 Hz na afinação; alvo do PWM ("30 ms"); posição do slider no VCF TUNE (5 ou 4) e a tecla usada; figura do ajuste RESONANCE LEVEL; Lissajous 2:1 do LFO MOD; trecho sobre ruído branco/rosa; presença do CA3046.

**Não lido:**

- Esquemáticos das Service Notes (imagens).
- Folhas de patch de fábrica (PDF no SynthMania): dão as posições dos controles dos 64 sons e servem para comparação de ouvido e para testar o painel.
- Dois tópicos do ModWiggler sobre o VCO e sobre um clone fiel (a página não abriu). Provável fonte para núcleo do VCO, conformadores de onda e contagem de BA662.
- Página "Roland Filters" de Florian Anwander (não localizada).

---

## 13. Sons de fábrica (para comparação de ouvido)

Os 64 patches originais, com demonstrações em áudio no SynthMania **(b, SM, GS4)**:

| Banco | Patches |
|---|---|
| 1 | 11 NEG SYNC, 12 NEG PLUCK, 13 JUICY FUNK, 14 SYNC SWEEP, 15 CARS SYNC, 16 SYNC LEAD, 17 HAMMER LEAD, 18 DUKE LEAD |
| 2 | 21 CLAV, 22 HARPSICHORD, 23 ECHO PIANO, 24 MELLOW RHODES, 25 HONKY TONK, 26 XYLO, 27 SITAR, 28 HARP |
| 3 | 31 LO STRINGS, 32 MID STRINGS, 33 HI STRINGS, 34 MELLOW STRINGS, 35 LO BRASS, 36 HI BRASS, 37 S-H BRASS, 38 SYNTH BRASS |
| 4 | 41 CHORUS ORGAN, 42 BELL ORGAN, 43 COMBO ORGAN, 44 CHIFF ORGAN, 45 PIPE ORGAN, 46 ORGAN BASS PEDALS, 47 DRAWBAR ORGAN, 48 HARMONIC PERCUSSION |
| 5 | 51 TRAIN CHUG, 52 TRAIN HORN, 53 JUNGLE BEASTS, 54 BIRDS, 55 SOLO VOICE, 56 CHOIR VOICES, 57 TOMITA CHIME, 58 GONG |
| 6 | 61 STARTING UP, 62 POLY RHYTHMS, 63 KLINGONS, 64 MUSIC OF THE SPHERES, 65 ECHO, 66 SOLAR WINDS, 67 RHYTHM & SYNC, 68 HANDCLAPS |
| 7 | 71 FAT FIFTHS, 72 FUZZY FIFTHS, 73 UP FOURTH, 74 DOWN FOURTH, 75 HORN FIFTH, 76 HORN TRITONE, 77 MELLOW BLIP, 78 HARD BLIP |
| 8 | 81 CLARINET, 82 FLUTE, 83 WHISTLE, 84 CELLO, 85 VIOLIN, 86 CHIME, 87 UPRIGHT BASS, 88 HARMONICA |

Bons candidatos para teste de ouvido, por exercitarem partes diferentes do motor: 16 SYNC LEAD (sync), 12 NEG PLUCK (ENV-1 invertido), 34 MELLOW STRINGS (filtro em 12 dB, PWM), 36 HI BRASS (envelope no filtro), 37 S-H BRASS (LFO random), 57 TOMITA CHIME (cross mod), 78 HARD BLIP (ENV MOD na afinação). A escolha é minha, pelos nomes e pelos comentários da Roland reproduzidos no site **(c)**.

Os valores dos controles de cada patch estão no PDF das folhas de patch, **não lido** nesta etapa.

---

## 14. Verificação: o que medir depois (Etapa 4)

Seguir o padrão do projeto: `tests/medicao/jp8/motor.mjs` e `medir.mjs`, tomando como modelo os de `pronto/tests/medicao/106/`. As tolerâncias abaixo são sugestões minhas **(c)**; os alvos têm a categoria indicada.

### 14.1 Osciladores (frequência)

| # | Medição | Alvo | Cat. do alvo | Tolerância |
|---|---|---|---|---|
| O1 | VCO-1 em 8', teclas C0, A1, A2, A3, C5 (numeração Roland), MASTER TUNE no centro | 65,7 / 221 / 442 / 884 / 2102,5 Hz se Lá = 442; ou os equivalentes em Lá = 440 se essa for a decisão | a + c | ±2 cents |
| O2 | RANGE 16', 4', 2' na tecla A2 | 221 / 884 / 1768 Hz (Lá = 442) | a | ±2 cents |
| O3 | VCO-2 RANGE: cada um dos 37 passos | semitons exatos, 16' = VCO-1 em 16' | a (semitons), c (37) | ±2 cents |
| O4 | FINE TUNE nos extremos | −50 e +50 cents | a | ±3 cents |
| O5 | MASTER TUNE nos extremos | −50 e +50 cents | a | ±3 cents |
| O6 | VCO-2 em LOW FREQ, teclas C0 e C5 | mesma frequência nas duas (não segue o teclado) | a | igualdade |
| O7 | ENV MOD = 10, ENV-1 com sustain 10, destino VCO-1 | +3 oitavas no patamar | a | ±50 cents |
| O8 | ENV MOD com POLARITY invertida | −3 oitavas | a (simetria: c) | ±50 cents |
| O9 | LFO MOD (VCO) = 10 | pico em +1 oitava | a (OCR duvidoso) | ±100 cents |
| O10 | Bender no extremo, sensibilidade VCO = 10 | ±1 oitava | c | ±50 cents |
| O11 | Chaves VCO-1 BEND / VCO-2 BEND e VCO-1/BOTH/VCO-2 | modulação só no destino selecionado | a | 0 cent no outro |

### 14.2 Osciladores (forma de onda e espectro)

| # | Medição | Alvo | Cat. |
|---|---|---|---|
| W1 | Dente de serra: harmônicos | queda de 1/n (6 dB/oitava) | c |
| W2 | Quadrada (VCO-1) e pulso com PWM manual = 0 | só harmônicos ímpares, ciclo de 50 % | a |
| W3 | Pulso com PWM manual = 10 | ciclo estreito; valor a definir após conferir as Service Notes | NE |
| W4 | Triangular (VCO-1) e senoide (VCO-2) | triangular com ímpares em 1/n²; senoide com THD baixa (limite a definir) | c |
| W5 | PWM por LFO | ciclo oscila em torno de 50 %, na frequência do LFO | a |
| W6 | Ruído (VCO-2) | espectro plano na faixa de áudio (branco) | b/c |
| W7 | Sync ligado, VCO-2 uma quinta acima | fundamental na frequência do VCO-1 | a |
| W8 | CROSS MOD = 5, VCO-2 quadrado em LOW FREQ | VCO-1 alterna entre duas frequências separadas por 3 oitavas | a |
| W9 | CROSS MOD = 0 | nenhuma banda lateral | a |
| W10 | Aliasing com dente de serra em 2' na tecla C5 (8,4 kHz) | componentes espúrios abaixo de um limite a fixar (sugestão: −60 dB) | c |

### 14.3 Filtros

| # | Medição | Alvo | Cat. |
|---|---|---|---|
| F1 | VCF −24 dB, RES = 0: inclinação uma e duas oitavas acima do corte | −24 dB/oitava | a |
| F2 | VCF −12 dB, RES = 0 | −12 dB/oitava | a |
| F3 | HPF: inclinação abaixo do corte | −6 dB/oitava | a |
| F4 | HPF com slider em LOW | resposta plana até o grave (sem corte audível) | a |
| F5 | VCF CUT OFF em LOW | silêncio (atenuação a fixar; sugestão: abaixo de −60 dB em 100 Hz) | a (silêncio), c (limite) |
| F6 | RES = 10, sem entrada | **não** sustenta oscilação: o sinal decai | b |
| F7 | RES = 10, com entrada: pico na frequência de corte | pico pronunciado; valor em dB a definir | NE |
| F8 | Nível da banda passante com RES 0 e RES 10 | queda pequena (há compensação); valor a definir | b |
| F9 | KEY FOLLOW = 0 | corte igual em todas as teclas | a |
| F10 | KEY FOLLOW no ponto de 100 % | corte dobra a cada oitava | a |
| F11 | KEY FOLLOW = 10 | 120 %: 1,2 oitava de corte por oitava de teclado | a |
| F12 | ENV MOD = 10, envelope no patamar | corte sobe 6 oitavas | c |
| F13 | Chave ENV-1 / ENV-2 do VCF | o corte segue o envelope selecionado | a |
| F14 | Frequência de ressonância pela posição do slider | 442 Hz em 5 (ou 4), após conferir as Service Notes | a (OCR duvidoso) |
| F15 | Saturação: resposta com entrada em nível máximo (dois VCOs) e RES alta | sem clipping digital; distorção suave | c |

### 14.4 Envelopes

| # | Medição | Alvo | Cat. |
|---|---|---|---|
| E1 | Attack mínimo (slider 0), 0 a 100 % | 1 ms | a |
| E2 | Attack máximo (slider 10) | 5 s (aceitar até 6 s) | a |
| E3 | Decay e Release mínimos | 1 ms | a |
| E4 | Decay e Release máximos | 10 s | a |
| E5 | Sustain em 0, 5, 10 | 0 %, proporcional, 100 % | a (extremos), c (meio) |
| E6 | Forma das curvas | exponencial em decay e release; attack a definir | c |
| E7 | KEY FOLLOW ligado: tempos em C0 e C5 | mais longos em C0, mais curtos em C5; razão a definir | a (sentido), NE (razão) |
| E8 | POLARITY invertida no ENV-1 | saída espelhada | a |
| E9 | Critério de medição do tempo | definir e documentar (por exemplo, 10–90 % ou até 99 %), porque a fonte não diz | c |

### 14.5 LFO

| # | Medição | Alvo | Cat. |
|---|---|---|---|
| L1 | RATE mínimo e máximo | 0,05 e 40 Hz | a |
| L2 | DELAY TIME máximo | cerca de 4 s até a modulação aparecer | a |
| L3 | DELAY TIME = 0 | modulação presente desde o início da nota | a |
| L4 | Quatro formas de onda | senoide, dente de serra invertido (sentido a conferir), quadrada, degraus aleatórios à taxa do LFO | a |
| L5 | Upper e Lower em SPLIT/DUAL | velocidades independentes | a |
| L6 | VCA LFO MOD 0–3 | 0 sem tremolo; profundidade crescente em 1, 2, 3 | a (ordem), NE (valores) |
| L7 | Botão LFO MODULATION com RISE TIME 0 e 10 | entrada imediata e gradual | a |

### 14.6 Níveis e clipping

| # | Medição | Alvo | Cat. |
|---|---|---|---|
| N1 | Patch inicial, uma nota | pico entre −12 e −3 dBFS (mesma meta usada no MS-20) | c |
| N2 | 8 notas, dois VCOs em dente de serra, filtro aberto | sem clipping na saída | c |
| N3 | SOURCE MIX nos extremos e no centro | só VCO-1, mistura igual, só VCO-2 | a |
| N4 | VCA LEVEL de 0 a 10 | 0 em silêncio; nível crescente | a |
| N5 | UNISON com 1, 2 e 8 teclas | nível de saída constante | a |
| N6 | BALANCE em DUAL | extremos isolam Lower e Upper; não atua em WHOLE | a |
| N7 | VOLUME | 0 em silêncio | a |

### 14.7 Polifonia, modos e arpejador

| # | Verificação | Alvo | Cat. |
|---|---|---|---|
| P1 | WHOLE + POLY 1: 8 notas presas e uma 9ª | a 9ª não soa | a |
| P2 | POLY 1: repetir a mesma tecla 8 vezes | vozes A a H em sequência | a |
| P3 | POLY 1 x POLY 2 com release longo | em POLY 2 o release das notas anteriores é cortado | a |
| P4 | SOLO: duas teclas presas | soa a mais grave | a |
| P5 | UNISON: 1, 2 e 8 teclas | 8, 4 e 1 voz por tecla | a |
| P6 | SPLIT: 5 notas no Lower | a 5ª não soa (4 vozes por seção) | a |
| P7 | SPLIT: ponto padrão e redefinição com SPLIT + tecla | 24ª tecla; novo ponto vale até desligar | a |
| P8 | DUAL | cada tecla soa com os dois patches; 4 notas | a |
| P9 | HOLD LOWER/UPPER em SPLIT | cada um segura só a sua seção | a |
| P10 | PORTAMENTO: UPPER ONLY / OFF / ON em SPLIT | só Upper / nenhum / ambos | a |
| A1 | Arpejo UP, RANGE 1, teclas tocadas em C, G, D, E | toca C, G, D, E e repete (ordem tocada) | a/b |
| A2 | Arpejo UP, RANGE 2–4 | a sequência se repete uma oitava acima a cada volta | a |
| A3 | Arpejo DOWN | mesmo procedimento em direção descendente | a |
| A4 | Arpejo RANDOM | só notas tocadas, dentro da faixa de RANGE | a |
| A5 | RATE mínimo e máximo | 1 e 20 passos por segundo | a |
| A6 | Selecionar um modo de arpejo | passa a RANGE 4 e POLY 2 | a |
| A7 | Arpejo em SPLIT | só o Lower arpeja | a |
| A8 | Mais de 8 notas | limite de 8 na sequência | a |
| M1 | Gravar e recuperar patch; MANUAL; patch preset | valores voltam iguais; preset restaura par e KEY MODE | a |

### 14.8 Painel

Comparar o painel final com a foto anexada, item por item, pela seção 2: ordem dos blocos, nomes, número de posições de cada chave e seletor, cores dos grupos de botões, etiquetas laranja de fonte de modulação, seta do split.

---

## 15. Fontes

**Primárias**

- **OM** — Roland JP-8 Owner's Manual, texto OCR. https://archive.org/stream/synthmanual-roland-jp-8-owners-manual/rolandjp-8ownersmanual_djvu.txt
- **SN** — Roland JP-8 Service Notes, 2ª edição, dezembro de 1982, texto OCR. https://archive.org/stream/synthmanual-roland-jp-8-service-notes/rolandjp-8servicenotes_djvu.txt (cópia da primeira página: https://www.manualslib.com/manual/3677608/Roland-Jp-8.html)
- **RS** — Roland, "Jupiter-8 Technical Specifications". https://support.roland.com/hc/en-us/articles/201945109-Jupiter-8-Technical-Specifications

**Secundárias**

- **ED1** — Electric Druid, "Roland filter designs with the IR3109 or AS3109". https://electricdruid.net/?p=97905
- **ED2** — Electric Druid, "Highpass filters in synths". https://electricdruid.net/highpass-filters-in-synths/
- **ED3** — Electric Druid, "Roland 'Cross Mod' and 'Metal Sync'". https://electricdruid.net/?p=10375
- **AT1** — atosynth, "Cross modulation on JP8, JP6 and JX-8P". https://atosynth.blogspot.com/2020/03/cross-modulation-on-jp8-jp6-and-jx-8p.html
- **AT2** — atosynth, notas sobre DAC e autotune. https://atosynth.blogspot.com/search/label/jupiter%208
- **AM1** — AMSynths, "AM8120 JP-8 VCO". https://amsynths.co.uk/home/products/oscillators/am8120-jp-8-vco/
- **AM2** — AMSynths, "AM8109 JP-8 Filter" e "AM8109SE". https://amsynths.co.uk/home/products/filters/am8109-jp8-filter/ e https://www.amsynthstore.co.uk/product/am8109se-jp-8-filters
- **AM3** — AMSynths, "Roland IR3R01 Design & Replica". https://amsynths.co.uk/2019/05/09/roland-ir3r01-clone/
- **GS1** — Gearspace, clone DIY e placa de VCO (lidos só pelos trechos do resultado de busca). https://gearspace.com/board/electronic-music-instruments-and-electronic-music-production/1018034-jupiter-8-diy-hardware-clone-progress.html
- **GS3** — Gearspace, falha de envelope (trecho de busca). https://gearspace.com/board/electronic-music-instruments-and-electronic-music-production/1130759-roland-jupiter-8-env-mod-issues.html
- **GS4** — Gearspace, folhas de patch (trecho de busca). https://gearspace.com/board/electronic-music-instruments-and-electronic-music-production/455694-jupiter-8-patch-sheets-thank-you-submodern.html
- **MW** — ModWiggler, "The (real) Jupiter 8 Clone" (só trecho de busca; a página não abriu). https://www.modwiggler.com/forum/viewtopic.php?t=222400
- **KV** — KVR, discussão sobre o arpejador (trecho de busca). https://www.kvraudio.com/forum/viewtopic.php?p=8039129
- **RC** — Roland Cloud, manual do JUPITER-8 PLUG-OUT (software). https://www.rolandcloud.com/getmedia/3d552dc5-46ca-415b-b121-a6c2474e28a4/JUPITER-8-Manual-E.pdf?ext=.pdf
- **RA** — Roland Austrália, "Roland Icon Series: The Jupiter-8". https://rolandcorp.com.au/blog/roland-icon-series-the-jupiter-8-synthesizer
- **OT** — One Two Testing, novembro de 1982, resenha. https://www.muzines.co.uk/articles/roland-jupiter-8/4613
- **GY** — GreatSynthesizers, teste (origem da foto). https://greatsynthesizers.com/en/test/roland-jupiter-8-the-great-master-of-synth-pop/
- **SM** — SynthMania, patches de fábrica e áudio. https://www.synthmania.com/jupiter-8.htm
- **SD** — Synth DIY Wiki, IR3109. https://sdiy.info/wiki/IR3109
- **VS** — Vintage Synth Explorer, fórum (LOW FREQ). https://forum.vintagesynth.com/viewtopic.php?t=43555
- **MR** — MusicRadar, resenha do Jupiter-8V (filtro não auto-oscila). https://musicradar.com/reviews/tech/arturia-jupiter-8v-22923
- **WP** — Wikipedia, "Roland Jupiter-8". https://en.wikipedia.org/wiki/Roland_Jupiter-8
- **PN** — Polynominal, "Roland Jupiter 8" (valores sem fonte citada; usado só para apontar divergências). https://www.polynominal.com/roland-jupiter8/
