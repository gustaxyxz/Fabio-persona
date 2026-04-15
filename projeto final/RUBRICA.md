Rota — Mapeamento rápido da Rubrica

Resumo das implementações e onde encontrar (para apresentação)

- Experiência do Usuário
  - Persona e justificativa: descrito na página inicial — [projeto final/index.html](projeto final/index.html)
  - Consistência visual / padrões: estilos em [projeto final/style.css](projeto final/style.css)
  - Indicação de elementos interativos (botões): topo e controles em [projeto final/jogo.html](projeto final/jogo.html)
  - Direção da ação principal: botão "Abrir mini game" (home) e "Partir" (jogo) — veja [projeto final/index.html](projeto final/index.html) e [projeto final/jogo.html](projeto final/jogo.html)

- Lógica e Desenvolvimento (Mini game)
  - Personagens / elementos: `STUDENT_NAMES` e marcadores em [projeto final/jogo.html](projeto final/jogo.html) + `script.js` (DOM)
  - Animação e cenário: movimento da van e transform/transition em `setVanPose`, `startRoute` — [projeto final/script.js](projeto final/script.js)
  - Uso de lógica em JS: cálculo de caminhos, permutações e decisão de ordem (`bestOrderForPoints`, `shortestPath`) — [projeto final/script.js](projeto final/script.js)
  - História e narrativa: copy e persona na home e sobre — [projeto final/index.html](projeto final/index.html) e [projeto final/sobre.html](projeto final/sobre.html)

- Desenvolvimento Web
  - Estrutura de páginas: `index.html`, `jogo.html`, `sobre.html`, `contato.html` — cada uma em [projeto final/](projeto final/)
  - Responsividade: rotas desenhadas com % no SVG e layout adaptável (ver `route-draw-canvas` em `script.js`)
  - Código: HTML e CSS organizados; use `style.css` e `script.js` (já limpei duplicatas neste último)

- Tech Forge (requisitos técnicos específicos)
  - Manipulação de dados estáticos: constantes em `script.js` — por exemplo `SITE_NAME`, `PERSONA_NAME`, `GAME_NAME`, `GAME_RELEASE_YEAR`, `DEFAULT_LEG_WAYPOINTS` (mais de 5 declaradas) — [projeto final/script.js](projeto final/script.js)
  - Entrada de dados via `prompt`: implementado em `validateAge()` — [projeto final/script.js](projeto final/script.js)
  - Lógica de decisão e feedback (`if/else` + `alert`): dentro de `validateAge()` — [projeto final/script.js](projeto final/script.js)
  - Manipulação de visibilidade / blur via DOM: `updatePreviewVisibility()` altera `filter: blur(...)` em `#map-blur-target` e cards do preview — [projeto final/script.js](projeto final/script.js)
  - Interatividade com input de texto: formulário `#welcomeForm` e função `showPersonalizedMessage()` que grava `rota-user-name` no `localStorage` e atualiza a UI — [projeto final/jogo.html](projeto final/jogo.html) + [projeto final/script.js](projeto final/script.js)
  - Alternância de tema: `toggleTheme()` e `updateThemeButtonLabel()` ligadas ao botão `#themeToggle` no topo — [projeto final/script.js](projeto final/script.js)
  - Verificação automática de lançamento: `checkLaunchYear()` compara `GAME_RELEASE_YEAR` com `new Date().getFullYear()` e dispara `alert` — [projeto final/script.js](projeto final/script.js)

Observações técnicas que fiz (limpeza segura)
- Removi duplicatas e código de debug em `script.js` (funções repetidas `pointDistance`, `getLegKey`, `legDistance`, `routeDistanceForOrder` duplicada, utilitário `copiarCoordenadasNomesAlunos`, `console.log` de debug e função vazia `toggleManualDraw`).
- Essas remoções mantêm todas as funcionalidades e reduzem ruído para apresentação.

Onde está o iframe?
- Não existe iframe no projeto. O mini game é uma página separada (`jogo.html`) aberta via link em [projeto final/index.html](projeto final/index.html) (botão "Abrir mini game").

Como demonstrar (passo a passo rápido)
1. Abra `projeto final/jogo.html` no navegador.
2. Limpe `localStorage` (Ferramentas do DevTools → Application → Local Storage) ou rode no console: `localStorage.clear()`.
3. Recarregue a página.
4. Preencha o nome no formulário, clique em "Confirmar nome" e depois em "Validar minha idade agora" (ou clique no overlay). O prompt aparecerá — digite uma idade >= 5 e confirme para liberar o conteúdo.
5. Use "Usar Ferramenta Rota" para aplicar a rota otimizada e clique em "Partir" para rodar a simulação.

Próximos passos que eu recomendo (posso aplicar agora se autorizar)
- Remover comentários longos ou arquivos temporários (`tmp_script.js`, `tmp_script_utf8.js`) se não forem necessários.
- Remover o editor de waypoints (`route-waypoints-editor`) se não for exigido pela entrega (reduz complexidade).
- Gerar um arquivo `APRESENTACAO.md` com 1–2 frases por slide para você falar durante a apresentação.

Se quiser, já aplico as remoções extras e crio o `APRESENTACAO.md` com notas sucintas para cada item da rubrica.
