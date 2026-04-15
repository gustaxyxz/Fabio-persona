APRESENTAÇÃO — Rota (notas rápidas para defesa)

Slides/ordem (6–8 minutos)

1) Título + Pitch
- "Rota — gestão inteligente de embarques". Objetivo em 1 frase: reduzir tempo e custo organizando confirmações e otimizando ordem de coleta.

2) Persona
- Apresente "Fábio Alves": motorista universitário, problema: perde tempo e combustível com rotas erradas. (ver [projeto final/index.html](projeto final/index.html)).

3) Problema & Solução
- Problema: confirmações dispersas e roteirização manual.
- Solução: centralizar confirmações, normalizar endereços e calcular ordem ótima (demonstre o mini game).

4) Demo (passos curtos)
- Limpar storage e recarregar (console): `localStorage.clear(); location.reload();`
- Preencher nome → Confirmar → Validar idade (aparece `prompt()`).
- Mostrar que o preview/mapa está borrado/desbloqueado (`updatePreviewVisibility()`).
- Clicar "Usar Ferramenta Rota" → linha verde aparece → Clicar "Partir" → observar van, paradas, HUD e overlay de resultado.

5) Mapeamento técnico rápido (onde olhar no código)
- Dados estáticos / constantes: [projeto final/script.js](projeto final/script.js) (SITE_NAME, PERSONA_NAME, GAME_RELEASE_YEAR, DEFAULT_LEG_WAYPOINTS, etc.).
- `prompt()` + validação: `validateAge()` — required pelo Tech Forge (entrada via prompt + alert).
- Blur / visibilidade dinâmica: `updatePreviewVisibility()` altera `filter: blur(...)` em `#map-blur-target`.
- Captura de nome e saudação: `#welcomeForm` → `showPersonalizedMessage()` grava `rota-user-name` no localStorage.
- Alternância de tema: `toggleTheme()` e `updateThemeButtonLabel()` (botão `#themeToggle` no topo).
- Lógica de roteirização: `shortestPath()`, `bestOrderForPoints()` / `bestOrderForSelection()` e `expandRouteNodes()` em [projeto final/script.js](projeto final/script.js).
- Movimento/animação da van: `setVanPose()`, `densifySegment()`, `startRoute()` (coleta em `collectStudent()`).
- Desenho da rota (SVG): `_getOrCreateRouteSvg()` e `_redrawRouteSvg()`.

6) Pontos da rubrica (resposta pronta)
- Experiência do Usuário: persona na home, CTAs claros, HUD compacto e instruções no jogo.
- Lógica e Low Code: >5 constantes e manipulação DOM implementadas (ver trecho de constantes). Uso de `if/else` para validar idade e `alert` para feedback.
- Cenário/Animações: van animada e pausas de pickup demonstrando sincronização e UX.
- Tech Forge: todos os subitens (prompt, if/else+alert, blur via DOM, input de texto, toggle tema, checagem de ano) implementados — aponte para `script.js` ao explicar.

7) Perguntas esperadas e respostas curtas
- Onde está o iframe que embute o jogo? — Não existe iframe. O mini game é a página `jogo.html`. Para embutir, use `<iframe src="jogo.html" title="Mini game Rota" style="width:100%;height:700px;border:0"></iframe>` (ver seção abaixo).
- Posso alterar os waypoints no editor? — Sim; existe um editor (`route-waypoints-editor`) but ele está desativado por padrão para apresentação. Reative definindo `ENABLE_WAYPOINT_EDITOR = true` em [projeto final/script.js](projeto final/script.js).
- Por que o combustível acaba? — O consumo é controlado por `FUEL_PER_UNIT`; rotas não-ótimas gastam mais. Para mostrar vantagem, ative a ferramenta Rota e compare.
- Como reverter alterações? — Todas as mudanças são reversíveis editando a flag e os valores em `script.js`.

8) Como embutir o jogo (iframe) — snippet recomendado
```html
<iframe src="jogo.html" title="Mini game Rota" style="width:100%;height:680px;border:0;display:block;" allow="fullscreen"></iframe>
```
Dicas: garantir que a página esteja servida por um servidor HTTP (não usar file://) para evitar bloqueios; para demonstração local, rode um servidor simples:

```bash
# no diretório do projeto
python -m http.server 8000
# depois acesse http://localhost:8000/
```

Se preferir Node:
```bash
npx http-server -p 8000
```

Observações de integração do iframe
- Mesmo domínio (src="jogo.html"): scripts e localStorage funcionam normalmente.
- Se embutir em domínio diferente: CORS e políticas de segurança podem afetar features; evite `sandbox` no iframe se quiser permitir scripts.
- Responsividade: ajuste `height` ou use CSS com `min-height:70vh`.

Notas finais rápidas para falar (30s cada tópico)
- Persona: explicar por que escolheu o Fábio e qual dor é resolvida.
- MVP e limitações: editor de waypoints existe para calibração, mas está desativado por padrão.
- Tech: JavaScript puro, DOM, SVG para rota; localStorage para persistência simples.

Arquivo criado: [projeto final/APRESENTACAO.md](projeto final/APRESENTACAO.md)

Boa apresentação — se quiser, eu adapto o conteúdo para slides (Google Slides/PowerPoint) com textos prontos para cada slide.