/* game.js - Rota Certa: Puzzle de Rota por Clique */
(function () {
  'use strict';

  var VW = 800, VH = 450;
  var NODE_R = 32;

  var NODES = {
    garagem:  { x:  78, y: 225, label: 'Garagem',    emoji: '\uD83C\uDFE0', color: '#4ade80' },
    centro:   { x: 205, y:  95, label: 'Centro',     emoji: '\uD83C\uDFD9', color: '#f472b6' },
    pgrande:  { x: 205, y: 355, label: 'P. Grande',  emoji: '\uD83C\uDFD9', color: '#fb923c' },
    vnova:    { x: 505, y:  95, label: 'Vila Nova',   emoji: '\uD83C\uDFD9', color: '#a78bfa' },
    jamerica: { x: 505, y: 355, label: 'J. America', emoji: '\uD83C\uDFD9', color: '#34d399' },
    facul:    { x: 722, y: 225, label: 'Faculdade',  emoji: '\uD83C\uDF93', color: '#fbbf24' },
  };

  var KM = {
    'garagem-centro': 8,   'garagem-pgrande': 9,
    'garagem-vnova': 18,   'garagem-jamerica': 17, 'garagem-facul': 24,
    'centro-pgrande': 12,  'centro-vnova': 9,   'centro-jamerica': 15, 'centro-facul': 14,
    'pgrande-vnova': 16,   'pgrande-jamerica': 8,  'pgrande-facul': 14,
    'vnova-jamerica': 11,  'vnova-facul': 9,
    'jamerica-facul': 8,
  };

  function segKm(a, b) { return KM[a + '-' + b] || KM[b + '-' + a] || 0; }
  function routeKm(stops) {
    var total = 0;
    for (var i = 0; i < stops.length - 1; i++) total += segKm(stops[i], stops[i + 1]);
    return total;
  }

  var PHASES = [
    {
      id: 1, students: ['centro', 'pgrande'],
      optimal: 34,
      optimalHint: 'Garagem > Centro (8 km) > P. Grande (12 km) > Faculdade (14 km) = 34 km',
      desc: 'Dois alunos confirmados. Toque neles para definir a sequencia de embarque.',
    },
    {
      id: 2, students: ['centro', 'pgrande', 'vnova'],
      optimal: 39,
      optimalHint: 'Garagem > P. Grande (9) > Centro (12) > Vila Nova (9) > Faculdade (9) = 39 km',
      desc: 'Tres alunos esta noite. Quem buscar primeiro economiza mais combustivel?',
    },
    {
      id: 3, students: ['centro', 'pgrande', 'vnova', 'jamerica'],
      optimal: 48,
      optimalHint: 'Garagem > Centro (8) > P. Grande (12) > J. America (8) > Vila Nova (11) > Faculdade (9) = 48 km',
      desc: 'Quatro alunos. Planeje bem para encontrar a rota minima.',
    },
  ];

  var STUDENT_CFG = {
    centro:   { skin: '#d4a87a', hair: '#1f2937', shirt: '#dc2626', name: 'Ana'   },
    pgrande:  { skin: '#c08b57', hair: '#292524', shirt: '#16a34a', name: 'Bruno' },
    vnova:    { skin: '#e8c49a', hair: '#78350f', shirt: '#7c3aed', name: 'Carla' },
    jamerica: { skin: '#be8a5e', hair: '#111827', shirt: '#ea580c', name: 'Diego' },
  };

  var ROADS = [
    ['garagem', 'centro'], ['garagem', 'pgrande'],
    ['centro', 'pgrande'], ['centro', 'vnova'],
    ['pgrande', 'jamerica'], ['vnova', 'jamerica'],
    ['vnova', 'facul'], ['jamerica', 'facul'],
    ['centro', 'jamerica'], ['pgrande', 'vnova'],
  ];

  var SCREEN = 'intro';
  var phaseIdx = 0;
  var selectedRoute = [];
  var hovered = null;
  var pulseT = 0;
  var animId = null;
  var lastTs = 0;

  var canvas, ctx, wrap;
  function el(id) { return document.getElementById(id); }
  function cx(v) { return v / VW * canvas.width; }
  function cy(v) { return v / VH * canvas.height; }
  function cs(v) { return v / VW * canvas.width; }

  function initGame() {
    var c = el('game-container');
    if (!c) return;
    c.innerHTML = [
      '<div id="g-wrap">',
        '<div id="g-intro">',
          '<div class="g-icard">',
            '<div class="g-iart"><canvas id="g-char" width="110" height="148"></canvas></div>',
            '<div class="g-icopy">',
              '<div class="g-ititle">Rota Certa</div>',
              '<p class="g-isub">Sao 2h da manha. Fabio Alves precisa buscar os alunos confirmados',
              ' e levar todos a Faculdade pelo <strong>menor caminho possivel</strong>.</p>',
              '<p class="g-isub">Toque nos alunos no mapa para definir a sequencia de embarque.',
              ' A ordem certa economiza combustivel.</p>',
              '<button id="g-btn-start" class="button button-main">Iniciar Fase 1 \u25BA</button>',
            '</div>',
          '</div>',
        '</div>',
        '<div id="g-game" hidden>',
          '<div id="g-hud">',
            '<span id="g-hud-l">Fase 1/3</span>',
            '<span id="g-hud-m"></span>',
            '<span id="g-hud-r">--</span>',
          '</div>',
          '<div id="g-map"><canvas id="g-canvas"></canvas></div>',
          '<div id="g-ctrl-bar">',
            '<span id="g-inst">Toque nos alunos para definir a ordem de embarque</span>',
            '<div class="g-ctrl-btns">',
              '<button id="g-undo" class="button button-ghost" disabled>\u21A9 Desfazer</button>',
              '<button id="g-confirm" class="button button-main" disabled>Confirmar Rota \u2713</button>',
            '</div>',
          '</div>',
        '</div>',
        '<div id="g-result" hidden></div>',
      '</div>',
    ].join('');
    canvas = el('g-canvas');
    wrap   = el('g-map');
    ctx    = canvas.getContext('2d');
    drawFabioBig(el('g-char').getContext('2d'), 55, 120, 1);
    el('g-btn-start').addEventListener('click', startGame);
    el('g-confirm').addEventListener('click', function () {
      if (SCREEN === 'playing' && selectedRoute.length === PHASES[phaseIdx].students.length) showResult();
    });
    el('g-undo').addEventListener('click', function () {
      if (SCREEN !== 'playing' || selectedRoute.length === 0) return;
      selectedRoute.pop();
      updateCtrl();
    });
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasHover);
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (!e.touches.length) return;
      var t = e.touches[0], r = canvas.getBoundingClientRect();
      handleCoord(
        (t.clientX - r.left) / r.width * VW,
        (t.clientY - r.top)  / r.height * VH
      );
    }, { passive: false });
  }

  function onCanvasClick(e) {
    if (SCREEN !== 'playing') return;
    var r = canvas.getBoundingClientRect();
    handleCoord((e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH);
  }

  function onCanvasHover(e) {
    if (SCREEN !== 'playing') return;
    var r = canvas.getBoundingClientRect();
    var vx = (e.clientX - r.left) / r.width * VW;
    var vy = (e.clientY - r.top)  / r.height * VH;
    var ph = PHASES[phaseIdx], found = null;
    ph.students.forEach(function (k) {
      if (selectedRoute.indexOf(k) !== -1) return;
      var n = NODES[k];
      if (Math.sqrt(Math.pow(vx - n.x, 2) + Math.pow(vy - n.y, 2)) < NODE_R + 10) found = k;
    });
    if (hovered !== found) { hovered = found; canvas.style.cursor = found ? 'pointer' : 'default'; }
  }

  function handleCoord(vx, vy) {
    var ph = PHASES[phaseIdx];
    ph.students.forEach(function (k) {
      if (selectedRoute.indexOf(k) !== -1) return;
      var n = NODES[k];
      if (Math.sqrt(Math.pow(vx - n.x, 2) + Math.pow(vy - n.y, 2)) < NODE_R + 10) {
        selectedRoute.push(k);
        hovered = null;
        updateCtrl();
      }
    });
  }

  function startGame() { phaseIdx = 0; startPhase(); }

  function startPhase() {
    var ph = PHASES[phaseIdx];
    selectedRoute = []; hovered = null; pulseT = 0; lastTs = 0;
    SCREEN = 'playing';
    el('g-intro').hidden  = true;
    el('g-game').hidden   = false;
    el('g-result').hidden = true;
    el('g-hud-l').textContent = 'Fase ' + ph.id + ' / ' + PHASES.length;
    el('g-hud-r').textContent = '--';
    el('g-inst').textContent  = ph.desc;
    updateCtrl();
    resizeCanvas();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function getFullRoute() { return ['garagem'].concat(selectedRoute).concat(['facul']); }

  function updateCtrl() {
    var ph   = PHASES[phaseIdx];
    var done = selectedRoute.length === ph.students.length;
    el('g-confirm').disabled = !done;
    el('g-undo').disabled    = selectedRoute.length === 0;
    var rem = ph.students.length - selectedRoute.length;
    el('g-inst').textContent = done
      ? 'Rota completa! Confirme para ver o resultado.'
      : 'Falt' + (rem === 1 ? 'a 1 aluno' : 'am ' + rem + ' alunos');
    var full = getFullRoute();
    el('g-hud-r').textContent = full.length >= 2 ? routeKm(full) + ' km est.' : '--';
  }

  function loop(ts) {
    if (SCREEN !== 'playing') return;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts; pulseT += dt;
    resizeCanvas();
    render();
    animId = requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    var W = wrap.offsetWidth || 800;
    if (canvas.width === W) return;
    canvas.width  = W;
    canvas.height = Math.round(W * VH / VW);
    wrap.style.height = canvas.height + 'px';
  }

  function render() {
    ctx.fillStyle = '#060c1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCityGrid();
    drawRoadNet();
    drawRouteLines();
    drawAllNodes();
  }

  function drawCityGrid() {
    ctx.strokeStyle = 'rgba(30,60,120,0.18)';
    ctx.lineWidth = 1;
    var step = cs(38);
    for (var x = 0; x < canvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (var y = 0; y < canvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  function drawRoadNet() {
    ROADS.forEach(function (r) {
      var a = NODES[r[0]], b = NODES[r[1]];
      var ax = cx(a.x), ay = cy(a.y), bx = cx(b.x), by = cy(b.y);
      ctx.strokeStyle = 'rgba(12,28,60,0.95)';
      ctx.lineWidth = cs(7); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = 'rgba(22,48,100,0.7)';
      ctx.lineWidth = cs(4.5);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      var d = segKm(r[0], r[1]);
      if (d > 0) {
        var mx = cx((a.x + b.x) / 2), my = cy((a.y + b.y) / 2);
        ctx.font = cs(6.8) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(70,110,170,0.5)';
        ctx.fillText(d + ' km', mx, my);
      }
    });
  }

  function drawRouteLines() {
    var ph   = PHASES[phaseIdx];
    var full = ['garagem'].concat(selectedRoute);
    if (selectedRoute.length === ph.students.length) full.push('facul');
    if (full.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = cs(18);
    ctx.strokeStyle = 'rgba(96,165,250,0.18)';
    ctx.lineWidth = cs(11);
    ctx.beginPath();
    ctx.moveTo(cx(NODES[full[0]].x), cy(NODES[full[0]].y));
    for (var i = 1; i < full.length; i++) ctx.lineTo(cx(NODES[full[i]].x), cy(NODES[full[i]].y));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = cs(3);
    ctx.setLineDash([cs(8), cs(5)]);
    ctx.lineDashOffset = -(Date.now() / 40) % cs(13);
    ctx.beginPath();
    ctx.moveTo(cx(NODES[full[0]].x), cy(NODES[full[0]].y));
    for (var j = 1; j < full.length; j++) ctx.lineTo(cx(NODES[full[j]].x), cy(NODES[full[j]].y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (var k = 0; k < full.length - 1; k++) {
      var na = NODES[full[k]], nb = NODES[full[k + 1]];
      var mx = cx((na.x + nb.x) / 2), my = cy((na.y + nb.y) / 2);
      var d = segKm(full[k], full[k + 1]);
      ctx.fillStyle = 'rgba(6,12,26,0.88)';
      ctx.fillRect(mx - cs(12), my - cs(6), cs(24), cs(12));
      ctx.font = 'bold ' + cs(8) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(d + ' km', mx, my);
    }
  }

  function drawAllNodes() {
    var ph  = PHASES[phaseIdx];
    var now = Date.now();
    drawSpecialNode('garagem', true);
    ph.students.forEach(function (k) {
      drawStudentNode(k, selectedRoute.indexOf(k), hovered === k, now);
    });
    drawSpecialNode('facul', selectedRoute.length === ph.students.length);
  }

  function drawSpecialNode(key, active) {
    var n  = NODES[key], px = cx(n.x), py = cy(n.y), r = cs(NODE_R * 0.88);
    if (active) { ctx.shadowColor = n.color; ctx.shadowBlur = cs(20); }
    ctx.fillStyle = 'rgba(8,16,36,0.92)';
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = active ? n.color : 'rgba(60,90,140,0.5)';
    ctx.lineWidth = cs(active ? 2.5 : 1.5);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = cs(16) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.emoji, px, py);
    ctx.font = 'bold ' + cs(8) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = active ? n.color : 'rgba(120,150,190,0.75)';
    ctx.fillText(n.label, px, py + r + cs(4));
  }

  function drawStudentNode(key, orderIdx, isHover, now) {
    var n   = NODES[key], cfg = STUDENT_CFG[key];
    var px  = cx(n.x), py = cy(n.y);
    var sel = orderIdx !== -1;
    var base = cs(NODE_R);
    var pulse = sel ? 1 : (1 + 0.055 * Math.sin(pulseT * 3.2 + n.x * 0.05));
    var r   = base * (isHover && !sel ? 1.1 : pulse);
    ctx.shadowColor = sel ? '#4ade80' : (isHover ? cfg.shirt : 'transparent');
    ctx.shadowBlur  = (sel || isHover) ? cs(14) : 0;
    ctx.fillStyle   = sel ? 'rgba(5,30,12,0.95)' : 'rgba(6,12,34,0.92)';
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = sel ? '#4ade80' : cfg.shirt;
    ctx.lineWidth   = cs(sel ? 2.5 : 2);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath(); ctx.arc(0, 0, r - cs(1.5), 0, Math.PI * 2); ctx.clip();
    drawStudent(ctx, 0, cs(4), cs(1.05), cfg);
    ctx.restore();
    if (sel) {
      var bx = px + r * 0.62, by = py - r * 0.62, br = cs(8);
      ctx.fillStyle = '#0a1424';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = cs(1.5);
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
      ctx.font = 'bold ' + cs(9) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(String(orderIdx + 1), bx, by);
    }
    ctx.font = 'bold ' + cs(8.5) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = sel ? '#4ade80' : cfg.shirt;
    ctx.fillText(cfg.name + (sel ? ' \u2713' : ''), px, py + r + cs(3));
  }

  /* ══════════════════ SPRITE ALUNO ═══════════════════════════ */
  function drawStudent(c2, x, y, s, cfg) {
    c2.save(); c2.translate(x, y);
    c2.fillStyle = 'rgba(0,0,0,0.28)';
    c2.beginPath(); c2.ellipse(0, s * 16.5, s * 7, s * 2.5, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#1e293b';
    c2.fillRect(-s * 5.5, s * 3, s * 4.5, s * 12); c2.fillRect(s * 1, s * 3, s * 4.5, s * 12);
    c2.fillStyle = '#f1f5f9';
    c2.fillRect(-s * 7, s * 13.5, s * 6.5, s * 2.8); c2.fillRect(s * 0.5, s * 13.5, s * 6.5, s * 2.8);
    c2.fillStyle = '#94a3b8';
    c2.fillRect(-s * 7, s * 15.3, s * 6.5, s * 1); c2.fillRect(s * 0.5, s * 15.3, s * 6.5, s * 1);
    c2.fillStyle = cfg.shirt;
    c2.beginPath();
    c2.moveTo(-s * 9, s * 3); c2.lineTo(-s * 9, -s * 8.5);
    c2.lineTo(-s * 5, -s * 11); c2.lineTo(s * 5, -s * 11);
    c2.lineTo(s * 9, -s * 8.5); c2.lineTo(s * 9, s * 3);
    c2.closePath(); c2.fill();
    c2.fillStyle = 'rgba(255,255,255,0.13)';
    c2.fillRect(-s * 9, -s * 1.5, s * 18, s * 2.5);
    c2.fillStyle = cfg.skin; c2.fillRect(-s * 3.5, -s * 13, s * 7, s * 4);
    c2.fillStyle = cfg.shirt;
    c2.fillRect(-s * 13.5, -s * 8.5, s * 4.5, s * 10);
    c2.fillRect(s * 9, -s * 8.5, s * 4.5, s * 10);
    c2.fillStyle = cfg.skin;
    c2.beginPath(); c2.ellipse(-s * 11.5, s * 3, s * 3, s * 2.3, 0, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.ellipse(s * 11.5, s * 3, s * 3, s * 2.3, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#334155';
    c2.fillRect(s * 7.5, -s * 10, s * 6.5, s * 13);
    c2.fillStyle = '#475569'; c2.fillRect(s * 8.5, -s * 7, s * 4.5, s * 4.5);
    c2.strokeStyle = '#64748b'; c2.lineWidth = s * 1.5; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(s * 8.5, -s * 9); c2.lineTo(s * 6.5, -s * 3); c2.stroke();
    c2.fillStyle = cfg.skin;
    c2.beginPath(); c2.ellipse(0, -s * 19.5, s * 9.5, s * 10, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = cfg.hair;
    c2.beginPath(); c2.ellipse(0, -s * 25, s * 9.5, s * 7, 0, Math.PI, 0, true); c2.fill();
    c2.fillRect(-s * 9.5, -s * 26, s * 19, s * 4.5);
    c2.fillStyle = cfg.skin;
    c2.beginPath(); c2.ellipse(-s * 9.5, -s * 19.5, s * 2.2, s * 2.8, 0, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.ellipse(s * 9.5, -s * 19.5, s * 2.2, s * 2.8, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.ellipse(-s * 3.8, -s * 20, s * 2.9, s * 2.4, 0, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.ellipse(s * 3.8, -s * 20, s * 2.9, s * 2.4, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#1e3a5f';
    c2.beginPath(); c2.arc(-s * 3.8, -s * 20, s * 1.8, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(s * 3.8, -s * 20, s * 1.8, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#080f1e';
    c2.beginPath(); c2.arc(-s * 3.8, -s * 20, s * 1, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(s * 3.8, -s * 20, s * 1, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.arc(-s * 3.1, -s * 20.6, s * 0.6, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(s * 4.5, -s * 20.6, s * 0.6, 0, Math.PI * 2); c2.fill();
    c2.strokeStyle = cfg.hair; c2.lineWidth = s * 1.5; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(-s * 6.5, -s * 23.5); c2.lineTo(-s * 1.5, -s * 23.9); c2.stroke();
    c2.beginPath(); c2.moveTo(s * 6.5, -s * 23.5); c2.lineTo(s * 1.5, -s * 23.9); c2.stroke();
    c2.fillStyle = 'rgba(0,0,0,0.18)';
    c2.beginPath(); c2.arc(-s * 1.3, -s * 18, s * 0.85, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(s * 1.3, -s * 18, s * 0.85, 0, Math.PI * 2); c2.fill();
    c2.strokeStyle = '#7f4f24'; c2.lineWidth = s * 1.6; c2.lineCap = 'round';
    c2.beginPath(); c2.arc(0, -s * 16.5, s * 3.8, 0.28, Math.PI - 0.28, false); c2.stroke();
    c2.restore();
  }

  /* ══════════════════ SPRITE FABIO ════════════════════════════ */
  function drawFabioBig(c2, x, y, s) {
    c2.save(); c2.translate(x, y);
    c2.fillStyle = '#1a3a9f'; c2.fillRect(-s * 20, s * 5, s * 40, s * 48);
    c2.fillStyle = 'rgba(255,255,255,0.1)'; c2.fillRect(-s * 12, s * 8, s * 24, s * 3);
    c2.fillStyle = '#c4a07a'; c2.fillRect(-s * 7, -s * 3, s * 14, s * 10);
    c2.fillStyle = '#d4a87a'; c2.beginPath(); c2.ellipse(0, -s * 18, s * 19, s * 22, 0, 0, Math.PI * 2); c2.fill();
    c2.strokeStyle = '#b8825a'; c2.lineWidth = s * 1.3;
    c2.beginPath(); c2.moveTo(-s * 10, -s * 12); c2.lineTo(-s * 12, -s * 8); c2.stroke();
    c2.beginPath(); c2.moveTo(s * 10, -s * 12); c2.lineTo(s * 12, -s * 8); c2.stroke();
    c2.fillStyle = '#1e3a8a'; c2.beginPath(); c2.arc(0, -s * 28, s * 19, Math.PI, 0, false); c2.fill();
    c2.fillRect(-s * 19, -s * 32, s * 38, s * 6);
    c2.fillStyle = '#1d4ed8'; c2.fillRect(0, -s * 35, s * 24, s * 5);
    c2.fillStyle = '#bfdbfe';
    c2.font = 'bold ' + (s * 7) + 'px sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('VAN', 0, -s * 31);
    c2.fillStyle = '#1a2540';
    c2.beginPath(); c2.arc(-s * 7, -s * 19, s * 3.5, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(s * 7, -s * 19, s * 3.5, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.arc(-s * 6, -s * 20, s * 1.2, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(s * 8, -s * 20, s * 1.2, 0, Math.PI * 2); c2.fill();
    c2.strokeStyle = '#7c4b1a'; c2.lineWidth = s * 2.2;
    c2.beginPath(); c2.moveTo(-s * 12, -s * 26); c2.lineTo(-s * 3, -s * 24); c2.stroke();
    c2.beginPath(); c2.moveTo(s * 12, -s * 26); c2.lineTo(s * 3, -s * 24); c2.stroke();
    c2.fillStyle = '#5c2e0a';
    c2.fillRect(-s * 10, -s * 14, s * 8, s * 3); c2.fillRect(s * 2, -s * 14, s * 8, s * 3);
    c2.strokeStyle = '#7c4b1a'; c2.lineWidth = s * 2.5;
    c2.beginPath(); c2.arc(0, -s * 9, s * 9, 0.25, Math.PI - 0.25, false); c2.stroke();
    c2.restore();
  }

  /* ══════════════════ RESULTADO ═══════════════════════════════ */
  function showResult() {
    SCREEN = 'result';
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    var ph   = PHASES[phaseIdx];
    var full = getFullRoute();
    var km   = routeKm(full);
    var diff = km - ph.optimal;
    var pct  = Math.round(Math.abs(diff) / ph.optimal * 100);
    var win  = diff <= Math.ceil(ph.optimal * 0.15);
    var ok   = !win && diff <= Math.ceil(ph.optimal * 0.40);
    var hasNext = phaseIdx < PHASES.length - 1;
    el('g-game').hidden = true;
    var r = el('g-result'); r.hidden = false;
    var routeHTML = full.map(function (k, i) {
      return (i > 0 ? '<span class="g-arr">\u2192</span>' : '') +
        '<span class="g-rseg" style="color:' + NODES[k].color + '">' + NODES[k].label + '</span>';
    }).join('');
    var btns = '';
    if (!win) btns += '<details class="g-hint"><summary>Ver rota otima</summary><p>' + ph.optimalHint + '</p></details>';
    if (hasNext) btns += '<button class="button button-main" id="g-next">Proxima fase \u2192</button>';
    btns += '<button class="button button-ghost" id="g-retry">Tentar novamente \u21BA</button>';
    r.innerHTML = [
      '<div class="g-res-icon">' + (win ? '\uD83C\uDFC6' : ok ? '\uD83D\uDC4D' : '\uD83D\uDE23') + '</div>',
      '<div class="g-res-title">' + (
        win ? '<strong>Rota otima!</strong> Fabio economizou combustivel e chegou a tempo.' :
        ok  ? '<strong>Boa rota!</strong> Fabio chegou, mas da para economizar ainda mais.' :
              '<strong>Rota longa.</strong> Fabio gastou combustivel a toa na madrugada.'
      ) + '</div>',
      '<div class="g-res-route">' + routeHTML + '</div>',
      '<div class="g-res-stats">',
        '<div class="g-stat"><span>Km total</span><strong>' + km + ' km</strong></div>',
        '<div class="g-stat"><span>Combust. est.</span><strong>' + (km * 0.09).toFixed(1) + ' L</strong></div>',
        '<div class="g-stat"><span>Rota otima</span><strong>~' + ph.optimal + ' km</strong></div>',
        '<div class="g-stat ' + (diff > 0 ? 'g-bad' : 'g-good') + '">',
          '<span>Diferenca</span>',
          '<strong>' + (diff > 0 ? '+' : '') + diff + ' km (' + (diff > 0 ? '+' : '') + pct + '%)</strong>',
        '</div>',
      '</div>',
      '<div class="g-res-btns">' + btns + '</div>',
    ].join('');
    if (el('g-next')) el('g-next').addEventListener('click', function () { phaseIdx++; startPhase(); });
    el('g-retry').addEventListener('click', startPhase);
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  window.rotaInitGame = initGame;

}());
