# Plano de Estrutura - Rota Certa com execucao estilo runner

## 1. Direcao certa

Nao copiar o Earn to Die 2 literalmente. O ideal e aproveitar o ritmo dele:

- tela de inicio forte
- partida curta e intensa
- van avancando pela fase
- recursos acabando durante o trajeto
- sensacao de progresso a cada fase

Para continuar fiel ao GDD, o jogo precisa manter o planejamento da rota antes da saida.

Formula final:

1. planejar no mapa
2. confirmar a rota
3. executar a viagem em uma fase estilo runner
4. avaliar distancia, combustivel, tempo e sono

Assim o jogo continua sendo sobre decisao de rota, mas ganha apresentacao e animacao.

## 2. Loop principal

Estado do jogo:

1. menu inicial
2. briefing da noite
3. planejamento da rota
4. contagem regressiva
5. execucao da viagem
6. tela de resultado
7. proxima fase

Descricao de cada etapa:

### Menu inicial

- titulo do jogo
- botao iniciar jogo
- som curto de van ligando ao iniciar
- subtitulo com a historia: Fabio precisa buscar os alunos e chegar a faculdade com a menor rota possivel

### Briefing da noite

- mostrar quais alunos vao embarcar
- mostrar bairros ativos da fase
- mostrar objetivo da rodada

### Planejamento da rota

- mapa simples com garagem, bairros e faculdade
- jogador clica nos bairros na ordem que deseja visitar
- HUD mostra km previstos, combustivel previsto e risco de sono
- botao confirmar rota
- botao limpar rota

### Contagem regressiva

- transicao curta de 3, 2, 1
- som de motor e farol acendendo

### Execucao da viagem

- camera lateral ou pseudo lateral
- van segue pela rota ja escolhida
- jogador controla aceleracao e resposta ao sono
- alunos aparecem como pontos de parada no caminho

### Resultado

- km total
- combustivel gasto
- quantos alunos foram pegos
- quantas vezes Fabio cochilou
- comparacao com a rota otima
- medalha: excelente, boa, ruim

## 3. Como pegar os alunos no caminho

Essa parte precisa ser simples e clara.

Regra recomendada:

- cada bairro escolhido vira um trecho da corrida
- no final de cada trecho existe uma parada de embarque
- quando a van chega na zona da parada, ela reduz um pouco e coleta o aluno automaticamente
- aparece animacao curta: porta abrindo, icone do aluno entrando, nome na tela e contador de passageiros

Exemplo:

- jogador escolheu Centro -> Vila Nova -> Faculdade
- a corrida tera:
  - trecho garagem -> centro
  - parada Ana
  - trecho centro -> vila nova
  - parada Carla
  - trecho vila nova -> faculdade

Isso resolve dois problemas:

- o aluno realmente entra no caminho
- a ordem planejada afeta diretamente a fase

## 4. Como o combustivel funciona

O combustivel nao deve ser aleatorio. Ele precisa mostrar por que uma rota ruim prejudica a partida.

Regra recomendada:

- cada fase tem um tanque base
- a distancia planejada define o tamanho da viagem
- quanto maior o caminho, mais combustivel sera consumido
- acelerar muito gasta um pouco mais

Modelo simples:

- combustivelMax = valor fixo da fase
- combustivelAtual comeca cheio
- consumo por frame = consumoBase + velocidade * fator
- cada trecho longo aumenta o tempo de exposicao e drena mais combustivel

Comportamento esperado:

- rota boa: chega com sobra pequena
- rota media: chega no limite
- rota ruim: combustivel acaba antes da faculdade

Falha por combustivel:

- a van para
- luzes piscam
- aparece mensagem: combustivel acabou antes do destino

## 5. Como o sono funciona

O sono precisa ser legivel e ligado a narcolepsia, nao parecer injustica pura.

Melhor sistema:

- criar uma barra de sono ou fadiga
- ela aumenta com o tempo
- aumenta mais rapido se a rota for longa ou se Fabio estiver ha muito tempo dirigindo
- quando enche, Fabio cochila

Durante o cochilo:

- a tela escurece levemente
- a van perde velocidade
- o motor falha ou a resposta do acelerador cai
- aparece comando grande: clique, toque ou espaco para acordar Fabio

Para acordar:

- jogador clica rapido algumas vezes
- a barra de sono volta para baixo
- a viagem continua

Vantagem desse modelo:

- o jogador entende o perigo antes do evento
- o sono vira mecanica, nao punicao aleatoria
- fica facil de apresentar para a banca

## 6. HUD ideal

Durante a execucao, o HUD deve ter so o necessario:

- fase atual
- passageiros coletados
- combustivel
- barra de sono
- km restantes ou progresso da rota
- tempo restante

Durante o planejamento, o HUD muda para:

- sequencia escolhida
- km previstos
- combustivel estimado
- botao confirmar

## 7. Estados tecnicos do codigo

Estrutura recomendada no JavaScript:

- MENU
- BRIEFING
- PLANNING
- COUNTDOWN
- DRIVING
- PICKUP
- RESULT

Sistemas separados:

- routeSystem: monta a ordem e calcula distancia
- driveSystem: movimenta a van na fase
- fuelSystem: drena e valida falha por combustivel
- sleepSystem: enche barra e dispara cochilo
- pickupSystem: detecta parada de aluno
- resultSystem: calcula nota final

## 8. Como isso encaixa na rubrica

### Personagens

- Fabio como protagonista
- alunos com nomes, cores e identidade visual
- van como elemento central e funcional

### Elementos do jogo

- menu
- mapa
- bairros
- van
- passageiros
- combustivel
- sono
- resultado

### Utilizacao de logica em JavaScript

- estado de telas
- ordem da rota
- calculo de distancia
- consumo de combustivel
- enchimento da barra de sono
- coleta de alunos
- condicoes de vitoria e derrota

### Criatividade

- mistura de puzzle de rota com execucao estilo runner
- problema real da persona transformado em gameplay
- narcolepsia virando mecanica clara e apresentavel

### Cenario e animacoes

- cidade noturna
- farois da van
- rodas girando
- pickup de aluno
- alerta de combustivel baixo
- tela escurecendo no cochilo

### Historia do jogo

- Fabio inicia mais uma noite de trabalho
- precisa planejar a melhor rota antes de sair
- durante a viagem lida com combustivel e sono
- objetivo final e chegar com todos os alunos a faculdade

## 9. MVP certo para implementar primeiro

Fazer nesta ordem:

1. menu inicial com start
2. tela de planejamento funcionando
3. corrida simples com a van atravessando trechos
4. pickups automaticos nos pontos
5. combustivel acabando
6. barra de sono e evento de cochilo
7. tela de resultado

Nao comecar por:

- loja de upgrades
- fisica complexa
- muitos obstaculos
- mapa grande demais

## 10. Decisao pratica para este projeto

O melhor caminho para este repositorio e manter o planejamento do mapa como a primeira metade da fase e transformar a execucao em uma corrida curta e estilizada.

Assim voces conseguem:

- defender o jogo pela rubrica
- manter fidelidade ao GDD
- deixar o jogo mais bonito e mais divertido
- evitar um escopo impossivel