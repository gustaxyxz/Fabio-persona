# Mini Game Design Document (GDD)
## Rota — Fábio na Madrugada

---

## 1. Visão Geral

| Campo | Detalhe |
|---|---|
| **Nome do jogo** | Rota — Fábio na Madrugada |
| **Gênero** | Puzzle / Estratégia de Rotas (Otimização de Caminhos) |
| **Plataforma** | Web Browser (PC e Mobile) — GitHub Pages, sem instalação |
| **Público-alvo** | Estudantes universitários e profissionais de TI (18–35 anos) com acesso a navegador moderno |

**Resumo do jogo:**
Rota — Fábio na Madrugada é um jogo de puzzle 3D em que o jogador assume o papel de Fábio Alves, motorista de van universitária de 52 anos em Engenheiro Beltrão — PR. De madrugada, exausto após um longo turno, ele precisa planejar a rota mais eficiente para buscar todos os alunos espalhados pela cidade 3D e levá-los à universidade. Cada tile percorrido consome combustível limitado, o cansaço progressivo escurece a visão, e no nível avançado alunos podem cancelar ou aparecer de última hora. O desafio é encontrar o menor caminho para economizar combustível e chegar em casa mais cedo para descansar.

Este mini GDD complementa a primeira página do site publicada no GitHub Pages, explicando como o protótipo atende diretamente à persona e aos critérios da Sprint 2.

---

## 2. Como o Jogo Atende a Persona

O jogo foi desenhado diretamente a partir das dores e necessidades da persona **Fábio Alves**, mapeadas na pesquisa de usuário:

| Dor da Persona | Representação no Jogo |
|---|---|
| Esquece o endereço dos alunos de madrugada | Alunos são colunas amarelas espalhadas pela cidade 3D — o jogador precisa identificar e planejar onde estão antes de enviar a van |
| Gasta combustível em rotas ineficientes | Barra de combustível limitada que decresce a cada tile percorrido; rotas longas causam game over |
| Sofre cansaço extremo na madrugada | Barra de energia que diminui com o tempo; a tela vai escurecendo progressivamente com efeito de vinheta |
| Alunos confirmam/cancelam de última hora | Nível 3: eventos aleatórios onde alunos somem ou aparecem inesperadamente durante o planejamento |
| Precisa de sistema que calcule a rota automaticamente | O jogador aprende por tentativa e erro que traçar a rota curta é essencial — vivenciando na prática a necessidade do sistema Rota |

---

## 3. Mecânicas de Jogo

### Objetivo do Jogador
Buscar todos os alunos confirmados na ordem planejada e levá-los à universidade, percorrendo a menor distância total possível com o combustível disponível.

### Principais Mecânicas

**Movimento**
- A van de Fábio não é controlada diretamente pelo teclado
- O jogador traça a rota clicando nos alunos (na ordem desejada) e confirma clicando na universidade
- A van se move automaticamente pelas ruas da cidade 3D usando algoritmo de menor caminho (BFS) entre cada parada

**Interação**
- Clique em um aluno (coluna amarela) → adicionado à rota (fica verde)
- Clique novamente no aluno → removido da rota
- Clique na Universidade (prédio verde) → rota confirmada e van começa a se mover

**Sistema de Progressão**
- 3 níveis com dificuldade crescente: mapas maiores, mais alunos, menos combustível
- Sistema de avaliação por estrelas (1 a 3) baseado em: distância percorrida, combustível restante, tempo gasto e alunos buscados
- Classificação proporcional ao desempenho: ⭐⭐⭐ rota ótima, ⭐⭐ rota razoável, ⭐ rota ineficiente

### Regras Básicas

**Condição de Vitória:** Buscar todos os alunos e chegar à universidade com combustível restante. Avaliação depende do quão eficiente foi a rota.

**Condição de Derrota:** A barra de combustível chegar a zero antes de completar a rota — game over imediato.

---

## 4. Narrativa e Ambientação

### História
**Início:** Fábio inicia mais um turno noturno na garagem da van. São quase 2h da manhã e os alunos confirmaram presença para ir à faculdade. Ele está cansado, mas precisa cumprir o trabalho.

**Conflito:** Os alunos estão em diferentes pontos da cidade. Com o combustível caro e sua memória falhando pelo cansaço, cada quilômetro extra custa dinheiro. Ele precisa montar a rota mais curta possível antes de partir — caso contrário, a van para no meio da estrada.

**Objetivo:** Planejar a sequência de coleta ideal, buscar todos os alunos e chegar à universidade antes que o tanque esvazie ou o cansaço tome conta.

### Ambientação
Cidade do interior do Paraná (Engenheiro Beltrão) em plena madrugada. Vista 3D isométrica aérea. Ruas desertas com postes de luz laranja, prédios escuros com janelas acesas esparsamente, céu estrelado com névoa atmosférica. Estética: 3D minimalista com paleta de cores frias (azul/roxo) e acentos quentes (amarelo dos postes e alunos, verde da universidade).

### Personagens Principais

| Personagem | Descrição | Papel no Jogo |
|---|---|---|
| **Fábio Alves** | 52 anos, motorista cansado e experiente | Protagonista — controlado indiretamente pelo jogador; seu estado (cansaço, combustível) define as restrições do nível |
| **Os Alunos** | Universitários que precisam de transporte noturno | NPCs passivos — representados como colunas amarelas brilhantes; precisam ser coletados na rota |
| **A Universidade** | Destino final da viagem | Objetivo final de cada nível — prédio verde brilhante no canto do mapa |

---

## 5. Gameplay (Experiência do Jogador)

### Loop Principal
```
Receber o mapa 3D com alunos espalhados
       ↓
Analisar posições e planejar a ordem de coleta
       ↓
Clicar nos alunos na ordem desejada (tragar a rota)
       ↓
Confirmar clicando na Universidade
       ↓
Van executa a rota automaticamente pelas ruas
       ↓
Ver resultado: estrelas, distância, combustível restante
       ↓
Ajustar estratégia e tentar novamente (ou avançar)
```

### Nível de Dificuldade

| Nível | Alunos | Mapa | Combustível | Cansaço | Eventos |
|---|---|---|---|---|---|
| 1 — Tutorial | 3 | 9×7 | 100% | Lento | Não |
| 2 — Cidade | 5 | 12×9 | 82% | Médio | Não |
| 3 — Caos Noturno | 7 | 15×11 | 67% | Rápido | Sim (cancelamentos e novos alunos) |

**Fácil** no nível 1, **Progressivo** do 1 ao 3, **Desafiador** no nível 3 com eventos aleatórios.

### Duração Média
- Nível 1: 2–4 minutos por tentativa
- Nível 2: 3–6 minutos por tentativa
- Nível 3: 4–8 minutos por tentativa (eventos estendem)
- Total para 3 estrelas em todos os níveis: aproximadamente 15–25 minutos

---

## 6. Interface (UI/UX)

### Elementos na Tela (HUD em Jogo)

| Elemento | Posição | Descrição |
|---|---|---|
| **Barra de Combustível** | Topo esquerdo | Diminui a cada tile percorrido; fica vermelha abaixo de 20% |
| **Barra de Energia (Cansaço)** | Topo | Diminui com o tempo; abaixo de 25% vira vermelho e a tela escurece |
| **Contador de Alunos** | Topo | Mostra quantos alunos já foram buscados (ex.: "Alunos 2/5") |
| **Distância Percorrida** | Topo | Quilômetros acumulados na viagem atual |
| **Cronômetro** | Topo | Tempo decorrido desde o início do nível |
| **Barra de Instrução** | Rodapé | Orienta o jogador sobre o que fazer no momento atual |
| **Vinheta de Cansaço** | Tela inteira | Escurecimento radial que aumenta conforme a energia cai |

### Telas do Jogo

- **Menu Principal:** Título, 3 botões de nível, "Como Jogar", "Voltar ao Site"
- **Tutorial/Instruções:** 4 passos explicativos com numeração visual
- **Tela de Fim de Nível:** Título (vitória ou derrota), estrelas, 4 estatísticas detalhadas, botões de próximo nível / tentar de novo / menu

### Controles

| Plataforma | Controle | Ação |
|---|---|---|
| Desktop | Mouse — Clique esquerdo | Selecionar aluno / Confirmar rota na universidade |
| Mobile | Toque | Mesma função do clique |

Nenhum teclado ou gamepad necessário — design acessível e de baixo esforço cognitivo, respeitando o perfil da persona.

---

## 7. Arte e Som

### Estilo Visual
**3D Minimalista com Estética Noturna**
- Renderização 3D em WebGL com Three.js
- Geometrias simples (BoxGeometry, CylinderGeometry, SphereGeometry) — sem assets externos
- Paleta noturna: azul escuro (#05050f), cinza asfalto (#1c2135), teal (#00d4aa) para destaques de solução, âmbar (#f0c040) para alunos/postes
- Iluminação: luz direcional azulada (lua), pontos de luz laranja (postes de rua), glow verde da universidade, faróis brancos da van
- Efeito de névoa atmosférica (FogExp2) para profundidade
- Sombras suaves (PCFSoftShadowMap)
- Tone Mapping cinematográfico (ACESFilmic)

### Referências Visuais
- **Mini Metro** (Dinosaur Polo Club) — minimalismo e foco em otimização de rotas
- **Cities: Skylines** — grade urbana vista de cima
- **Estética lo-fi night city** — tons frios, postes de luz quente, janelas acesas

### Áudio
- **Música de fundo:** Lo-fi / Ambient noturna calma (ex.: lo-fi hip hop, synthwave lento)
- **Efeitos sonoros planejados:** Motor da van ligando, "ding" ao buscar aluno, alerta de combustível baixo, fanfarra de vitória
- **Status:** Não implementado no MVP da Sprint 2 — planejado para Sprint 3

---

*Documento elaborado como parte da entrega da 2ª Sprint — Projeto Acadêmico | 2026*
