# Perguntas e Respostas da Apresentação

Este arquivo é para você decorar respostas curtas e seguras.

## Perguntas sobre o projeto

### Qual problema vocês resolveram?

Nós partimos da persona Fábio Alves, motorista de van universitária no turno da noite. O problema central é organizar rotas com cansaço, evitar desperdício de combustível e lidar com a coleta de alunos de forma eficiente.

### Por que o nome do projeto é Rota?

Porque o foco da solução é planejamento de rota. O nome foi simplificado para ficar direto e fácil de memorizar na apresentação.

### Como o site atende a persona?

O site apresenta a dor da persona, explica a solução e leva para o protótipo jogável. Não é só visual: ele organiza a narrativa da entrega e conecta com o mini GDD.

## Perguntas sobre o jogo

### O que acontece no jogo?

O jogador controla a van, coleta alunos e precisa chegar na universidade antes de falhar por combustível ou cansaço.

### Quais mecânicas principais vocês implementaram?

Movimento da van, coleta de alunos por proximidade, barra de combustível, barra de energia, condição de vitória ao chegar na universidade e condição de derrota quando combustível ou energia chegam a zero.

### Tem níveis?

Sim. Há dois níveis configurados: fácil e normal, com diferença de tamanho do mapa, quantidade de alunos, combustível inicial e taxa de desgaste de energia.

### Como vocês controlam dificuldade?

A dificuldade é ajustada por parâmetros de configuração: mais alunos, menos combustível e energia drenando mais rápido no nível normal.

### Como o jogador vence?

Coleta todos os alunos e encosta na universidade.

### Como o jogador perde?

Se o combustível zerar durante o movimento ou se a energia zerar com o tempo.

## Perguntas técnicas sobre a implementação

### Qual tecnologia foi usada?

Site em HTML, CSS e JavaScript. O protótipo em 3D usa Three.js no arquivo game.html.

### Onde estão os dados de configuração do jogo?

No objeto LEVELS dentro de game.html. Lá ficam colunas, linhas, alunos, combustível e desgaste de energia.

### Como o HUD atualiza?

A função updateHUD atualiza as barras e os números de combustível, energia, alunos coletados e tempo.

### Como vocês detectam coleta de aluno?

Durante o loop do jogo, a posição da van é comparada com a posição dos alunos. Quando a distância fica pequena, o aluno é marcado como coletado.

### Como vocês detectam vitória?

Depois de coletar todos os alunos, o jogo verifica a distância da van até a universidade. Se estiver perto o suficiente, finaliza com vitória.

## Perguntas de organização da entrega

### Onde está a Sprint 1?

Na pasta sprint-1, com o arquivo da persona.

### Onde está a Sprint 2?

Na pasta sprint-2, com o mini GDD.

### Onde está a entrega final?

Na pasta projeto-final, com o guia, o texto de apresentação e o ZIP.

### Por que o site está na raiz?

Para o GitHub Pages funcionar corretamente com deploy da branch main em root.

## Respostas curtas para emergência

- Problema: rota, combustível e cansaço.
- Solução: site explicativo + protótipo jogável.
- Vitória: coletar alunos e chegar na universidade.
- Derrota: zerar combustível ou energia.
- Organização: Sprint 1 em sprint-1, Sprint 2 em sprint-2, final em projeto-final.