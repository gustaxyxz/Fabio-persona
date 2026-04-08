/* game.js — Mini Game Rota */

(function () {

  // ─── Mapa de nós ──────────────────────────────────────────────
  var NODES = {
    garagem:  { id: "garagem",  label: "Garagem",        x: 8,  y: 50, type: "start" },
    centro:   { id: "centro",   label: "Centro",         x: 30, y: 18, type: "stop"  },
    pgrande:  { id: "pgrande",  label: "Paulo Grande",   x: 32, y: 80, type: "stop"  },
    vnova:    { id: "vnova",    label: "Vila Nova",      x: 60, y: 28, type: "stop"  },
    jamerica: { id: "jamerica", label: "Jardim América", x: 62, y: 72, type: "stop"  },
    facul:    { id: "facul",    label: "Faculdade",      x: 92, y: 50, type: "end"   },
  };

  // ─── Tabela de distâncias (km) ─────────────────────────────────
  var DIST = {
    "garagem-centro":    8,
    "garagem-pgrande":  12,
    "garagem-vnova":    15,
    "garagem-jamerica": 18,
    "garagem-facul":    25,
    "centro-pgrande":    6,
    "centro-vnova":      9,
    "centro-jamerica":  14,
    "centro-facul":     17,
    "pgrande-vnova":    11,
    "pgrande-jamerica":  7,
    "pgrande-facul":    15,
    "vnova-jamerica":    6,
    "vnova-facul":      11,
    "jamerica-facul":    9,
  };

  function getDist(a, b) {
    return DIST[a + "-" + b] || DIST[b + "-" + a] || 0;
  }

  // ─── Fases ────────────────────────────────────────────────────
  var PHASES = [
    {
      id: 1,
      title: "Fase 1 — Noite tranquila",
      desc: "2 alunos confirmados. Clique nos pontos na ordem de coleta e confirme a rota.",
      students: ["centro", "pgrande"],
      optimal: 29,
      optimalRoute: "Garagem → Centro → Paulo Grande → Faculdade",
    },
    {
      id: 2,
      title: "Fase 2 — Rota completa",
      desc: "3 alunos confirmados. Planeje bem para economizar combustível.",
      students: ["centro", "pgrande", "vnova"],
      optimal: 36,
      optimalRoute: "Garagem → Centro → Paulo Grande → Vila Nova → Faculdade",
    },
    {
      id: 3,
      title: "Fase 3 — Madrugada cheia",
      desc: "4 alunos. Máxima atenção na ordem de coleta.",
      students: ["centro", "pgrande", "vnova", "jamerica"],
      optimal: 38,
      optimalRoute: "Garagem → Centro → Paulo Grande → Jardim América → Vila Nova → Faculdade",
    },
  ];

  // ─── Estado ────────────────────────────────────────────────────
  var state = {
    phaseIndex: 0,
    route: [],
    confirmed: false,
  };

  // ─── Helpers ───────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  // ─── Init ──────────────────────────────────────────────────────
  function initGame() {
    var container = el("game-container");
    if (!container) return;

    container.innerHTML = [
      '<div id="game-wrap">',
        '<div id="game-header">',
          '<div id="phase-info">',
            '<span id="phase-title"></span>',
            '<p id="phase-desc"></p>',
          '</div>',
          '<div id="phase-badges">',
            PHASES.map(function (p, i) {
              return '<span class="phase-badge" id="badge-' + i + '">' + p.id + '</span>';
            }).join(""),
          '</div>',
        '</div>',
        '<div id="game-map-wrap">',
          '<svg id="game-lines" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;"></svg>',
          '<div id="game-nodes"></div>',
        '</div>',
        '<div id="game-route-bar">',
          '<span id="route-display">Clique nos pontos de coleta na ordem desejada</span>',
          '<div id="game-actions">',
            '<button id="btn-confirm" class="button button-main" disabled>Confirmar rota</button>',
            '<button id="btn-reset" class="button button-ghost">Reiniciar</button>',
          '</div>',
        '</div>',
        '<div id="game-result" hidden></div>',
      '</div>',
    ].join("");

    el("btn-confirm").addEventListener("click", confirmRoute);
    el("btn-reset").addEventListener("click", resetPhase);

    renderPhase();
  }

  // ─── Renderizar fase ───────────────────────────────────────────
  function renderPhase() {
    var phase = PHASES[state.phaseIndex];
    state.route = [];
    state.confirmed = false;

    el("phase-title").textContent = phase.title;
    el("phase-desc").textContent = phase.desc;

    PHASES.forEach(function (_, i) {
      var badge = el("badge-" + i);
      if (i === state.phaseIndex) badge.className = "phase-badge active";
      else if (i < state.phaseIndex) badge.className = "phase-badge done";
      else badge.className = "phase-badge";
    });

    renderNodes(phase);
    renderLines([]);
    updateRouteDisplay();

    el("game-result").hidden = true;
    el("btn-confirm").disabled = true;
    el("btn-confirm").style.display = "";
    el("btn-reset").style.display = "";
  }

  // ─── Nós do mapa ───────────────────────────────────────────────
  function renderNodes(phase) {
    var wrap = el("game-nodes");
    wrap.innerHTML = "";

    Object.keys(NODES).forEach(function (key) {
      var node = NODES[key];
      var isStudent = phase.students.indexOf(node.id) !== -1;
      var isStart = node.type === "start";
      var isEnd = node.type === "end";
      var isActive = isStudent || isStart || isEnd;

      var div = document.createElement("div");
      div.className = "game-node" +
        (isStart ? " node-start" : "") +
        (isEnd   ? " node-end"   : "") +
        (isStudent ? " node-stop" : "") +
        (!isActive ? " node-inactive" : "");
      div.style.left = node.x + "%";
      div.style.top  = node.y + "%";
      div.dataset.id = node.id;

      var dot = document.createElement("div");
      dot.className = "node-dot";

      var orderBadge = document.createElement("span");
      orderBadge.className = "node-order";
      orderBadge.style.display = "none";
      dot.appendChild(orderBadge);

      var label = document.createElement("span");
      label.className = "node-label";
      label.textContent = node.label;

      div.appendChild(dot);
      div.appendChild(label);

      if (isStudent) {
        div.style.cursor = "pointer";
        div.addEventListener("click", function () { toggleStop(node.id); });
      }

      wrap.appendChild(div);
    });
  }

  // ─── Linhas SVG ────────────────────────────────────────────────
  function renderLines(route, solid, color) {
    var svg = el("game-lines");
    var wrap = el("game-map-wrap");
    var W = wrap.offsetWidth  || 600;
    var H = wrap.offsetHeight || 300;
    svg.innerHTML = "";

    if (!route || route.length === 0) return;

    var full = ["garagem"].concat(route).concat(["facul"]);
    for (var i = 0; i < full.length - 1; i++) {
      var a = NODES[full[i]];
      var b = NODES[full[i + 1]];
      var x1 = a.x / 100 * W;
      var y1 = a.y / 100 * H;
      var x2 = b.x / 100 * W;
      var y2 = b.y / 100 * H;
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1); line.setAttribute("y1", y1);
      line.setAttribute("x2", x2); line.setAttribute("y2", y2);
      line.setAttribute("stroke", color || "var(--accent)");
      line.setAttribute("stroke-width", solid ? "3" : "2.5");
      if (!solid) line.setAttribute("stroke-dasharray", "6 3");
      line.setAttribute("opacity", "0.85");
      svg.appendChild(line);
    }
  }

  // ─── Interação: selecionar parada ──────────────────────────────
  function toggleStop(id) {
    if (state.confirmed) return;
    var phase = PHASES[state.phaseIndex];
    var idx = state.route.indexOf(id);
    if (idx === -1) {
      state.route.push(id);
    } else {
      state.route.splice(idx, 1);
    }
    updateNodeSelection(phase);
    renderLines(state.route, false);
    updateRouteDisplay();
    el("btn-confirm").disabled = state.route.length !== phase.students.length;
  }

  function updateNodeSelection(phase) {
    phase.students.forEach(function (sid) {
      var nodeEl = el("game-nodes").querySelector('[data-id="' + sid + '"]');
      if (!nodeEl) return;
      var order = state.route.indexOf(sid);
      nodeEl.classList.toggle("node-selected", order !== -1);
      var badge = nodeEl.querySelector(".node-order");
      if (badge) {
        badge.textContent = order !== -1 ? (order + 1) : "";
        badge.style.display = order !== -1 ? "flex" : "none";
      }
    });
  }

  function updateRouteDisplay() {
    var disp = el("route-display");
    if (state.route.length === 0) {
      disp.textContent = "Clique nos pontos de coleta na ordem desejada";
      return;
    }
    var labels = ["Garagem"].concat(
      state.route.map(function (id) { return NODES[id].label; })
    ).concat(["Faculdade"]);
    disp.textContent = labels.join(" → ");
  }

  // ─── Confirmar rota ────────────────────────────────────────────
  function confirmRoute() {
    var phase = PHASES[state.phaseIndex];
    state.confirmed = true;

    var full = ["garagem"].concat(state.route).concat(["facul"]);
    var totalDist = 0;
    for (var i = 0; i < full.length - 1; i++) {
      totalDist += getDist(full[i], full[i + 1]);
    }

    var fuel = (totalDist * 0.1).toFixed(1);
    var diff = totalDist - phase.optimal;
    var pct  = Math.round((diff / phase.optimal) * 100);
    var isWin = diff <= Math.ceil(phase.optimal * 0.10);
    var isOk  = !isWin && diff <= Math.ceil(phase.optimal * 0.30);

    renderLines(state.route, true, isWin ? "var(--accent-2)" : "var(--accent)");
    el("btn-confirm").style.display = "none";

    var nextAvail = state.phaseIndex < PHASES.length - 1;

    var actionsHTML = "";
    if (nextAvail && (isWin || isOk)) {
      actionsHTML += '<button class="button button-main" id="btn-next">Próxima fase →</button>';
    }
    actionsHTML += '<button class="button button-ghost" id="btn-retry">Tentar novamente</button>';
    if (!isWin) {
      actionsHTML += '<details class="hint-details"><summary>Ver rota ótima</summary><p>' +
        phase.optimalRoute + ' (' + phase.optimal + ' km)</p></details>';
    }

    var result = el("game-result");
    result.hidden = false;
    result.innerHTML = [
      '<div class="result-icon">' + (isWin ? "🏆" : isOk ? "👍" : "😓") + '</div>',
      '<div class="result-text">' + (
        isWin ? "<strong>Rota ótima!</strong> Fábio chegou rápido e economizou combustível." :
        isOk  ? "<strong>Rota razoável.</strong> Dá pra melhorar, mas Fábio chegou." :
                "<strong>Rota longa.</strong> Fábio gastou muito combustível à toa."
      ) + '</div>',
      '<div class="result-stats">',
        '<div class="result-stat"><span>Distância percorrida</span><strong>' + totalDist + ' km</strong></div>',
        '<div class="result-stat"><span>Combustível estimado</span><strong>' + fuel + ' L</strong></div>',
        '<div class="result-stat"><span>Rota ótima</span><strong>' + phase.optimal + ' km</strong></div>',
        '<div class="result-stat ' + (diff > 0 ? "stat-bad" : "stat-good") + '">',
          '<span>Diferença</span>',
          '<strong>' + (diff > 0 ? "+" : "") + diff + ' km (' + (diff > 0 ? "+" : "") + pct + '%)</strong>',
        '</div>',
      '</div>',
      '<div class="result-actions">' + actionsHTML + '</div>',
    ].join("");

    var btnNext  = el("btn-next");
    var btnRetry = el("btn-retry");
    if (btnNext)  btnNext.addEventListener("click",  nextPhaseAction);
    if (btnRetry) btnRetry.addEventListener("click", resetPhase);
  }

  function resetPhase() { renderPhase(); }

  function nextPhaseAction() {
    state.phaseIndex = Math.min(state.phaseIndex + 1, PHASES.length - 1);
    renderPhase();
  }

  // ─── Integração com age gate do script.js ─────────────────────
  // Observa data-preview-state no previewGrid para iniciar o jogo
  function watchAgeGate() {
    var previewGrid = document.getElementById("previewGrid");
    if (!previewGrid) return;

    var observer = new MutationObserver(function () {
      var unlocked = previewGrid.getAttribute("data-preview-state") === "unlocked";
      var container = el("game-container");
      if (unlocked && container && container.innerHTML.trim() === "") {
        initGame();
      }
    });

    observer.observe(previewGrid, { attributes: true });
  }

  document.addEventListener("DOMContentLoaded", watchAgeGate);

})();
