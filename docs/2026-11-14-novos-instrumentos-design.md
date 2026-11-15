# Novos instrumentos: desenho

Data: 2026-11-14. Repositório: https://github.com/vonhauke/Sintetizadores

## Intenção
Refazer o clone do Juno-106 (o atual não ficou bom) e criar seis instrumentos novos em Web Audio, com som fiel ao que a documentação dos aparelhos descreve. A pesquisa vem antes do código de cada instrumento.

## Instrumentos e ordem
1. Juno-106 (piloto, completo, avaliado por Pedro antes dos demais)
2. Korg MS-20 (referência visual de layout: MS-20 mini)
3. E-mu SP-1200
4. ARP 2600 (de fábrica, sem módulos de terceiros)
5. Yamaha DX7, Roland Jupiter-8, Casio CZ-101 (ordem indiferente)

## Objetivos
- Um documento de pesquisa por instrumento em `docs/pesquisa/<id>.md`, com fonte para cada fato e três categorias: (a) fonte primária, (b) fonte secundária, (c) aproximação. Valor não encontrado é dito como não encontrado.
- Uma página HTML autossuficiente por instrumento, em pasta própria, no padrão do repositório.
- Todos os controles originais: mesmo nome, tipo, faixa, posição, ordem e seções. Clicar no valor permite digitar.
- DSP em AudioWorklet onde o BiquadFilterNode não basta.
- Teclado na tela com oitavas, teclado do computador, Web MIDI.
- Salvamento automático; patches onde o original tem memória; no SP-1200, padrões e samples.
- iPhone: desbloqueio no fim do toque, aviso de som desligado, sessão de áudio "playback", sem zoom por toque duplo, alvos de 44 px.
- Verificação por medição offline, comparada com a pesquisa.

## Faixa de acessórios (em todos, separada do painel, marcada como não original)
- Sequenciador de 16 passos, uma nota por passo, pausa e ligadura, andamento, Play/Stop.
- Aleatório: gera sequência numa escala escolhida.
- Zerar: painel e sequência voltam ao padrão, com confirmação.
- Hold: mantém as notas depois de soltar as teclas.
- SP-1200: o sequenciador é o de padrões do aparelho; Aleatório e Zerar atuam nele; sem Hold.

## Não objetivos
- Réplica visual do aparelho: sem logotipo, marca ou nome de modelo no painel; cores, tipografia e grafismo são desenho próprio com aspecto de hardware.
- Arpejador ou sequenciador "original" onde a pesquisa não confirmar que existia.
- Instalador por instrumento. Continua o app único com menu; `.exe` e `.dmg` saem do workflow existente.
- Alterar as páginas antigas (101, 303, 606, 808, 909, bateria, minimoog).

## Abordagens consideradas
1. **Piloto com o Juno-106 e depois seis em paralelo (escolhida).** Um erro de padrão é corrigido uma vez.
2. Sete em paralelo desde o início. Descartada: erro de padrão custa sete vezes.
3. Um Electron por instrumento. Descartada por Pedro: o app único já existe.

## Limites conhecidos
- Sem teste em iPhone real e sem gerar `.dmg` neste ambiente.
- Sem o aparelho para medir, não linearidades, deriva e ruído são aproximações (categoria c).
