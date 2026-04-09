/* game.js — Rota Certa: Cidade Livre (van WASD) */
(function () {
  'use strict';

  /* ── Resolucao virtual do canvas ───────────────────── */
  var VW = 800, VH = 450;

  /* ── Grade de ruas ─────────────────────────────────────
     RH  = metade da largura da rua (virtual)
     HROADS = centerlines horizontais (y)
     VROADS = centerlines verticais  (x)
  ────────────────────────────────────────────────────── */
  var RH     = 22;
  var HROADS = [110, 225, 340];
  var VROADS = [68, 210, 360, 510, 660, 748];
  var VAN_CLR = 10; /* centro da van deve ficar a no maximo (RH - VAN_CLR) da centerline */

  /* ── Localizacoes (nas intersecoes da grade) ──────── */
  var LOCS = {
    garagem:  { x: 68,  y: 225, label: 'Garagem',   type: 'start' },
    centro:   { x: 210, y: 110, label: 'Centro',    type: 'stop'  },
    pgrande:  { x: 210, y: 340, label: 'P.Grande',  type: 'stop'  },
    vnova:    { x: 510, y: 110, label: 'Vila Nova',  type: 'stop'  },
    jamerica: { x: 510, y: 340, label: 'J.America', type: 'stop'  },
    facul:    { x: 748, y: 225, label: 'Faculdade', type: 'end'   },
  };

  /* ── Fases ─────────────────────────────────────────── */
  var PHASES = [
    { id:1, students:['centro','pgrande'],                     optimal:29,
      hint:'Garagem => Centro => P.Grande => Faculdade (~29 km)' },
    { id:2, students:['centro','pgrande','vnova'],             optimal:36,
      hint:'Garagem => Centro => P.Grande => Vila Nova => Faculdade (~36 km)' },
    { id:3, students:['centro','pgrande','vnova','jamerica'],  optimal:38,
      hint:'Garagem => Centro => P.Grande => J.America => Vila Nova => Faculdade (~38 km)' },
  ];

  /* ── Predios gerados proceduralmente nos blocos ────── */
  var BUILDINGS = (function () {
    var list = [];
    function segs(centers, hw, total) {
      var edges = [0];
      centers.forEach(function (c) { edges.push(c - hw - 1); edges.push(c + hw + 1); });
      edges.push(total);
      var out = [];
      for (var i = 0; i < edges.length - 1; i += 2) out.push([edges[i], edges[i + 1]]);
      return out;
    }
    var cols = segs(VROADS, RH, VW);
    var rows = segs(HROADS, RH, VH);
    var s = 0xABC7;
    function rng() { s = (s * 6364136 + 1013904223) & 0xFFFF; return (s >>> 0) / 0xFFFF; }
    rows.forEach(function (row) {
      cols.forEach(function (col) {
        var bx = col[0] + 3, by = row[0] + 3;
        var bw = col[1] - col[0] - 6, bh = row[1] - row[0] - 6;
        if (bw < 8 || bh < 8) return;
        var nc = Math.max(1, Math.floor(bw / 62));
        var nr = Math.max(1, Math.floor(bh / 52));
        for (var ri = 0; ri < nr; ri++) {
          for (var ci = 0; ci < nc; ci++) {
            var m = 2 + rng() * 3;
            list.push({ x: bx + ci * (bw / nc) + m, y: by + ri * (bh / nr) + m,
                        w: (bw / nc) - m * 2,        h: (bh / nr) - m * 2 });
          }
        }
      });
    });
    return list;
  }());

  /* ── Janelas (pre-calculadas, deterministicas) ─────── */
  var WINDOWS = (function () {
    var ws = [], s = 0xDEAD1;
    function rng() { s = (s * 22695477 + 1) & 0x7fffffff; return s / 0x7fffffff; }
    BUILDINGS.forEach(function (b) {
      for (var ri = 0; ri * 9 + 5 < b.h; ri++)
        for (var ci = 0; ci * 9 + 4 < b.w; ci++)
          ws.push({ x: b.x + 4 + ci * 9, y: b.y + 5 + ri * 9, lit: rng() > 0.38, warm: rng() > 0.45 });
    });
    return ws;
  }());

  /* ── Estado do jogo ─────────────────────────────────── */
  var SCREEN   = 'intro';
  var phaseIdx = 0;
  var collected = [];
  var kmTraveled = 0;
  var lastPos    = null;
  var KM_SCALE   = 0.046;

  /* ── Van ────────────────────────────────────────────── */
  var van = { x: 68, y: 225, vx: 0, vy: 0, flip: false, speed: 135, friction: 0.87 };

  /* ── Dados visuais por aluno ────────────────────────── */
  var STUDENT_CFG = {
    centro:   { skin:'#d4a87a', hair:'#1f2937', shirt:'#dc2626', name:'Ana'   },
    pgrande:  { skin:'#c08b57', hair:'#292524', shirt:'#16a34a', name:'Bruno' },
    vnova:    { skin:'#e8c49a', hair:'#78350f', shirt:'#7c3aed', name:'Carla' },
    jamerica: { skin:'#be8a5e', hair:'#111827', shirt:'#ea580c', name:'Diego' },
  };

  /* ── Animacoes ──────────────────────────────────────── */
  var spawnTimes   = {}; /* key -> ms do primeiro frame do aluno */
  var collectAnims = []; /* [{x,y,t0,parts:[{dx,dy,r,color}]}] */

  function easeOutBack(t) {
    if (t >= 1) return 1;
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function spawnCollect(vx, vy) {
    var COLS = ['#fbbf24','#34d399','#60a5fa','#f472b6','#a78bfa','#f9fafb'];
    var parts = [];
    for (var i = 0; i < 16; i++) {
      var angle = Math.random() * Math.PI * 2;
      var spd   = 45 + Math.random() * 90;
      parts.push({
        dx: Math.cos(angle) * spd,
        dy: Math.sin(angle) * spd - 65,
        r:  2 + Math.random() * 4,
        color: COLS[Math.floor(Math.random() * COLS.length)],
      });
    }
    collectAnims.push({ x: vx, y: vy, t0: Date.now(), parts: parts });
  }

  /* ── Input / DOM ────────────────────────────────────── */
  var keys = {}, canvas, ctx, wrap, lastTs, msgTimer;
  function el(id) { return document.getElementById(id); }

  function cx(v) { return v / VW * canvas.width;  }
  function cy(v) { return v / VH * canvas.height; }
  function cs(v) { return v / VW * canvas.width;  }

  function onRoad(x, y) {
    var lim = RH - VAN_CLR;
    for (var i = 0; i < HROADS.length; i++) if (Math.abs(y - HROADS[i]) <= lim) return true;
    for (var j = 0; j < VROADS.length; j++) if (Math.abs(x - VROADS[j]) <= lim) return true;
    return false;
  }

  /* ══════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════ */
  function initGame() {
    var c = el('game-container'); if (!c) return;

    c.innerHTML = [
      '<div id="g-wrap">',
      '<div id="g-intro">',
        '<div class="g-icard">',
          '<div class="g-iart"><canvas id="g-char" width="110" height="148"></canvas></div>',
          '<div class="g-icopy">',
            '<div class="g-ititle">Rota Certa</div>',
            '<p class="g-isub">Sao 2h da manha. Fabio Alves precisa buscar os alunos',
            ' e chegar a Faculdade antes das 6h.',
            ' A rota mais curta economiza combustivel.</p>',
            '<div class="g-ictrl">',
              '<span class="g-key">W A S D</span> ou <span class="g-key">&#8592;&#8593;&#8595;&#8594;</span>',
              ' para guiar a van.<br>',
              'Chegue <strong>sobre os alunos</strong> para coleta-los,',
              ' depois va a <strong>Faculdade &#127979;</strong>.',
            '</div>',
            '<button id="g-btn-start" class="button button-main">Iniciar Fase 1 &#9654;</button>',
          '</div>',
        '</div>',
      '</div>',
      '<div id="g-game" hidden>',
        '<div id="g-hud">',
          '<div id="g-hud-l"></div>',
          '<div id="g-hud-m"></div>',
          '<div id="g-hud-r"></div>',
        '</div>',
        '<div id="g-map">',
          '<canvas id="g-canvas"></canvas>',
          '<div id="g-pad">',
            '<button class="g-pb" data-k="ArrowUp">&#9650;</button>',
            '<button class="g-pb" data-k="ArrowLeft">&#9664;</button>',
            '<button class="g-pb" data-k="ArrowDown">&#9660;</button>',
            '<button class="g-pb" data-k="ArrowRight">&#9654;</button>',
          '</div>',
        '</div>',
        '<div id="g-ctrl-bar">WASD / flechas para guiar | colete os alunos | chegue a Faculdade</div>',
      '</div>',
      '<div id="g-result" hidden></div>',
      '</div>',
    ].join('');

    canvas = el('g-canvas');
    wrap   = el('g-map');
    ctx    = canvas.getContext('2d');

    drawFabioBig(el('g-char').getContext('2d'), 55, 120, 1);

    el('g-btn-start').addEventListener('click', startGame);
    document.addEventListener('keydown', function (e) {
      keys[e.key] = true;
      if (SCREEN === 'playing' &&
          ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) !== -1)
        e.preventDefault();
    });
    document.addEventListener('keyup', function (e) { keys[e.key] = false; });

    el('g-pad').querySelectorAll('.g-pb').forEach(function (btn) {
      var k = btn.getAttribute('data-k');
      btn.addEventListener('touchstart',  function (e) { e.preventDefault(); keys[k] = true;  }, { passive: false });
      btn.addEventListener('touchend',    function (e) { e.preventDefault(); keys[k] = false; }, { passive: false });
      btn.addEventListener('mousedown',   function () { keys[k] = true;  });
      btn.addEventListener('mouseup',     function () { keys[k] = false; });
      btn.addEventListener('mouseleave',  function () { keys[k] = false; });
    });
  }

  /* ══════════════════════════════════════════════════════
     FASE
  ══════════════════════════════════════════════════════ */
  function startGame() { phaseIdx = 0; startPhase(); }

  function startPhase() {
    var ph = PHASES[phaseIdx];
    collected = []; kmTraveled = 0; lastPos = null;
    spawnTimes = {}; collectAnims = [];
    van.x = LOCS.garagem.x; van.y = LOCS.garagem.y;
    van.vx = 0; van.vy = 0; van.flip = false;
    SCREEN = 'playing';
    el('g-intro').hidden  = true;
    el('g-game').hidden   = false;
    el('g-result').hidden = true;
    updateHUD();
    el('g-hud-r').textContent = '0 km';
    resizeCanvas(); lastTs = null;
    requestAnimationFrame(loop);
  }

  function updateHUD() {
    var ph = PHASES[phaseIdx];
    el('g-hud-l').textContent =
      'Fase ' + ph.id + '/' + PHASES.length + '  |  ' +
      collected.length + '/' + ph.students.length + ' alunos';
  }

  function showMsg(txt) {
    var m = el('g-hud-m'); if (!m) return;
    m.textContent = txt; m.style.opacity = '1';
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { m.style.opacity = '0'; }, 2500);
  }

  /* ══════════════════════════════════════════════════════
     GAME LOOP
  ══════════════════════════════════════════════════════ */
  function loop(ts) {
    if (SCREEN !== 'playing') return;
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    update(dt); render();
    requestAnimationFrame(loop);
  }

  /* ══════════════════════════════════════════════════════
     UPDATE
  ══════════════════════════════════════════════════════ */
  function update(dt) {
    var dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx =  1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) dy = -1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) dy =  1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }

    van.vx += dx * van.speed * dt * 7;
    van.vy += dy * van.speed * dt * 7;

    var fr = Math.pow(van.friction, dt * 60);
    van.vx *= fr; van.vy *= fr;

    var spd = Math.sqrt(van.vx * van.vx + van.vy * van.vy);
    if (spd > van.speed) { var f = van.speed / spd; van.vx *= f; van.vy *= f; }

    if (dx > 0) van.flip = false;
    if (dx < 0) van.flip = true;

    var nx = Math.max(8, Math.min(VW - 8, van.x + van.vx * dt));
    var ny = Math.max(8, Math.min(VH - 8, van.y + van.vy * dt));

    if (onRoad(nx, van.y)) van.x = nx; else van.vx *= -0.15;
    if (onRoad(van.x, ny)) van.y = ny; else van.vy *= -0.15;

    if (lastPos) {
      var dm = Math.sqrt(Math.pow(van.x - lastPos.x, 2) + Math.pow(van.y - lastPos.y, 2));
      kmTraveled += dm * KM_SCALE;
      el('g-hud-r').textContent = Math.round(kmTraveled) + ' km';
    }
    lastPos = { x: van.x, y: van.y };

    var ph = PHASES[phaseIdx];
    ph.students.forEach(function (key) {
      if (collected.indexOf(key) !== -1) return;
      var L = LOCS[key];
      var d = Math.sqrt(Math.pow(van.x - L.x, 2) + Math.pow(van.y - L.y, 2));
      if (d < 30) {
        collected.push(key); updateHUD();
        var cfg2 = STUDENT_CFG[key] || {};
        showMsg('\u2713 ' + (cfg2.name || L.label) + ' entrou na van!');
        spawnCollect(L.x, L.y);
      }
    });

    if (collected.length === ph.students.length) {
      var F = LOCS.facul;
      if (Math.sqrt(Math.pow(van.x - F.x, 2) + Math.pow(van.y - F.y, 2)) < 32) {
        SCREEN = 'result'; showResult();
      }
    }
  }

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  function resizeCanvas() {
    var W = wrap.offsetWidth || 800;
    if (canvas.width === W) return;
    canvas.width  = W;
    canvas.height = Math.round(W * VH / VW);
    wrap.style.height = canvas.height + 'px';
  }

  function render() {
    ctx.fillStyle = '#060b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawSidewalks();
    drawRoadSurface();
    drawBuildings();
    drawWindows();
    drawRoadMarkings();
    drawIntersectionGlow();
    drawStudents();
    drawFacultyMarker();
    drawGaragem();
    drawVanOnMap();
    drawCollectAnims();
  }

  function drawSidewalks() {
    var SW = RH + 7;
    ctx.fillStyle = '#0f1929';
    HROADS.forEach(function (y) {
      ctx.fillRect(0, cy(y - SW), canvas.width, cy(y + SW) - cy(y - SW));
    });
    VROADS.forEach(function (x) {
      ctx.fillRect(cx(x - SW), 0, cx(x + SW) - cx(x - SW), canvas.height);
    });
  }

  function drawRoadSurface() {
    ctx.fillStyle = '#19283d';
    HROADS.forEach(function (y) {
      ctx.fillRect(0, cy(y - RH), canvas.width, cy(y + RH) - cy(y - RH));
    });
    VROADS.forEach(function (x) {
      ctx.fillRect(cx(x - RH), 0, cx(x + RH) - cx(x - RH), canvas.height);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = cs(1);
    HROADS.forEach(function (y) {
      ctx.beginPath(); ctx.moveTo(0, cy(y - RH)); ctx.lineTo(canvas.width, cy(y - RH)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy(y + RH)); ctx.lineTo(canvas.width, cy(y + RH)); ctx.stroke();
    });
    VROADS.forEach(function (x) {
      ctx.beginPath(); ctx.moveTo(cx(x - RH), 0); ctx.lineTo(cx(x - RH), canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx(x + RH), 0); ctx.lineTo(cx(x + RH), canvas.height); ctx.stroke();
    });
  }

  function drawBuildings() {
    BUILDINGS.forEach(function (b) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(cx(b.x) + 2, cy(b.y) + 2, cx(b.x + b.w) - cx(b.x), cy(b.y + b.h) - cy(b.y));
      ctx.fillStyle = '#192845';
      ctx.fillRect(cx(b.x), cy(b.y), cx(b.x + b.w) - cx(b.x), cy(b.y + b.h) - cy(b.y));
      ctx.fillStyle = 'rgba(100,140,220,0.09)';
      ctx.fillRect(cx(b.x), cy(b.y), cx(b.x + b.w) - cx(b.x), cs(1.5));
    });
  }

  function drawWindows() {
    WINDOWS.forEach(function (w) {
      if (!w.lit) return;
      ctx.shadowColor = w.warm ? '#fbbf24' : '#93c5fd'; ctx.shadowBlur = cs(4.5);
      ctx.fillStyle   = w.warm ? 'rgba(251,191,36,0.76)' : 'rgba(147,197,253,0.65)';
      ctx.fillRect(cx(w.x), cy(w.y), Math.max(1.5, cs(4)), Math.max(1.5, cs(3.5)));
    });
    ctx.shadowBlur = 0;
  }

  function drawRoadMarkings() {
    ctx.save();
    ctx.setLineDash([cs(9), cs(9)]); ctx.lineCap = 'butt';
    ctx.lineWidth = cs(1.2); ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    HROADS.forEach(function (y) {
      ctx.beginPath(); ctx.moveTo(0, cy(y)); ctx.lineTo(canvas.width, cy(y)); ctx.stroke();
    });
    VROADS.forEach(function (x) {
      ctx.beginPath(); ctx.moveTo(cx(x), 0); ctx.lineTo(cx(x), canvas.height); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.restore();
  }

  function drawIntersectionGlow() {
    HROADS.forEach(function (y) {
      VROADS.forEach(function (x) {
        var g = ctx.createRadialGradient(cx(x), cy(y), 0, cx(x), cy(y), cs(36));
        g.addColorStop(0, 'rgba(253,186,16,0.055)'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx(x), cy(y), cs(36), 0, Math.PI * 2); ctx.fill();
      });
    });
  }

  function drawStudents() {
    var ph  = PHASES[phaseIdx];
    var now = Date.now();
    ph.students.forEach(function (key) {
      if (collected.indexOf(key) !== -1) return;
      var L   = LOCS[key];
      var px  = cx(L.x), py = cy(L.y);
      var cfg = STUDENT_CFG[key] || { skin:'#d4a87a', hair:'#1f2937', shirt:'#3b82f6', name:'?' };

      /* animacao de spawn */
      if (!spawnTimes[key]) spawnTimes[key] = now;
      var elapsed = now - spawnTimes[key];
      var sc    = easeOutBack(Math.min(1, elapsed / 480));
      var alpha = Math.min(1, elapsed / 180);

      /* pulsação do halo */
      var pulse = 0.88 + 0.12 * Math.sin(now * 0.0038);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px, py);
      ctx.scale(sc, sc);

      /* halo colorido */
      ctx.shadowColor = cfg.shirt; ctx.shadowBlur = cs(22) * pulse;
      ctx.globalAlpha = alpha * 0.18;
      ctx.fillStyle = cfg.shirt;
      ctx.beginPath(); ctx.arc(0, 0, cs(30) * pulse, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = alpha;

      /* circulo base */
      ctx.fillStyle = '#080f1e';
      ctx.beginPath(); ctx.arc(0, 0, cs(22), 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = cfg.shirt; ctx.lineWidth = cs(2.5);
      ctx.beginPath(); ctx.arc(0, 0, cs(22), 0, Math.PI*2); ctx.stroke();

      /* sprite */
      drawStudent(ctx, 0, 0, cs(0.85), cfg);

      ctx.restore();

      /* label — fora do scale */
      ctx.textAlign = 'center';
      ctx.font = 'bold ' + cs(8.5) + 'px sans-serif';
      var lbl = cfg.name + ' · ' + L.label;
      var lw  = ctx.measureText(lbl).width + cs(8);
      ctx.fillStyle = 'rgba(5,9,20,0.93)';
      ctx.fillRect(px - lw/2, py + cs(24), lw, cs(13));
      ctx.fillStyle = '#bfdbfe'; ctx.textBaseline = 'top';
      ctx.fillText(lbl, px, py + cs(25));
    });
  }

  /* Particulas de coleta */
  function drawCollectAnims() {
    var now = Date.now();
    collectAnims = collectAnims.filter(function (a) { return now - a.t0 < 950; });
    collectAnims.forEach(function (a) {
      var t = (now - a.t0) / 950;
      a.parts.forEach(function (p) {
        var ppx = cx(a.x + p.dx * t);
        var ppy = cy(a.y + p.dy * t + 55 * t * t); /* gravidade suave */
        ctx.globalAlpha = Math.max(0, 1 - t * 1.15);
        ctx.shadowColor = p.color; ctx.shadowBlur = cs(7);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(ppx, ppy, cs(p.r), 0, Math.PI*2); ctx.fill();
      });
      /* checkmark flutuante */
      ctx.globalAlpha = Math.max(0, 1 - t * 1.6);
      ctx.font = 'bold ' + cs(18) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4ade80';
      ctx.shadowColor = '#4ade80'; ctx.shadowBlur = cs(14);
      ctx.fillText('\u2713', cx(a.x), cy(a.y - 38 * t));
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function drawFacultyMarker() {
    var ph = PHASES[phaseIdx]; var ready = collected.length === ph.students.length;
    var L = LOCS.facul; var px = cx(L.x), py = cy(L.y);
    if (ready) { ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = cs(28); }
    ctx.fillStyle = ready ? '#451a03' : '#111827';
    ctx.beginPath(); ctx.arc(px, py, cs(20), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ready ? '#f59e0b' : '#374151'; ctx.lineWidth = cs(2.5);
    ctx.beginPath(); ctx.arc(px, py, cs(20), 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = cs(14) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDF93', px, py);
    ctx.font = 'bold ' + cs(8.5) + 'px sans-serif';
    ctx.fillStyle = ready ? '#fde68a' : '#4b5563'; ctx.textBaseline = 'top';
    ctx.fillText('Faculdade', px, py + cs(21));
  }

  function drawGaragem() {
    var L = LOCS.garagem; var px = cx(L.x), py = cy(L.y);
    ctx.font = cs(12) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDFE0', px, py - cs(21));
    ctx.font = 'bold ' + cs(8) + 'px sans-serif'; ctx.fillStyle = '#4ade80';
    ctx.textBaseline = 'top'; ctx.fillText('Garagem', px, py + cs(10));
  }

  /* ══════════════════ SPRITES ══════════════════════════ */

  function drawVanOnMap() {
    var px = cx(van.x), py = cy(van.y);
    ctx.save(); ctx.translate(px, py); ctx.scale(van.flip ? -1 : 1, 1);
    var hg = ctx.createRadialGradient(cs(20), 0, 0, cs(20), 0, cs(62));
    hg.addColorStop(0, 'rgba(255,249,196,0.45)'); hg.addColorStop(1, 'transparent');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(cs(18), -cs(18));
    ctx.arc(cs(20), 0, cs(62), -0.32, 0.32); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawVan(ctx, px, py, cs(1), van.flip);
  }

  function drawVan(c2, x, y, s, flip) {
    c2.save(); c2.translate(x, y); c2.scale(flip ? -1 : 1, 1);
    c2.fillStyle = 'rgba(0,0,0,0.38)';
    c2.beginPath(); c2.ellipse(0, s*11, s*21, s*5, 0, 0, Math.PI*2); c2.fill();
    c2.fillStyle = '#1d4ed8';
    var bx = -s*22, by = -s*8, bw = s*44, bh = s*18, r3 = s*3;
    c2.beginPath();
    c2.moveTo(bx + r3, by); c2.lineTo(bx + bw - r3, by);
    c2.quadraticCurveTo(bx + bw, by, bx + bw, by + r3);
    c2.lineTo(bx + bw, by + bh - r3); c2.quadraticCurveTo(bx + bw, by + bh, bx + bw - r3, by + bh);
    c2.lineTo(bx + r3, by + bh); c2.quadraticCurveTo(bx, by + bh, bx, by + bh - r3);
    c2.lineTo(bx, by + r3); c2.quadraticCurveTo(bx, by, bx + r3, by);
    c2.closePath(); c2.fill();
    c2.fillStyle = 'rgba(0,0,20,0.25)'; c2.fillRect(-s*22, s*3, s*44, s*7);
    c2.fillStyle = '#172554'; c2.fillRect(s*8, -s*11, s*14, s*21);
    c2.fillStyle = 'rgba(186,230,253,0.88)';
    c2.beginPath(); c2.moveTo(s*8, -s*9); c2.lineTo(s*21, -s*4);
    c2.lineTo(s*21, s*2); c2.lineTo(s*8, s*2); c2.closePath(); c2.fill();
    c2.fillStyle = 'rgba(255,255,255,0.18)'; c2.fillRect(s*10, -s*8, s*4, s*4);
    c2.fillStyle = 'rgba(186,230,253,0.66)';
    c2.fillRect(-s*20, -s*7, s*8, s*6);
    c2.fillRect(-s*10, -s*7, s*8, s*6);
    c2.fillRect(   s*0, -s*7, s*6, s*6);
    drawFabioMini(c2, s*16, -s*4, s*0.5);
    [[-s*12, s*10], [s*12, s*10]].forEach(function (w) {
      c2.fillStyle = '#0f172a'; c2.beginPath(); c2.arc(w[0], w[1], s*6, 0, Math.PI*2); c2.fill();
      c2.fillStyle = '#475569'; c2.beginPath(); c2.arc(w[0], w[1], s*3, 0, Math.PI*2); c2.fill();
      c2.strokeStyle = '#64748b'; c2.lineWidth = s*0.8;
      c2.beginPath(); c2.arc(w[0], w[1], s*3.5, 0, Math.PI*2); c2.stroke();
    });
    c2.shadowColor = '#fef08a'; c2.shadowBlur = s*12;
    c2.fillStyle = '#fef9c3'; c2.fillRect(s*21, -s*5, s*3, s*4);
    c2.shadowBlur = 0;
    c2.fillStyle = '#991b1b'; c2.fillRect(-s*25, -s*6, s*3, s*5);
    c2.fillStyle = '#ef4444'; c2.fillRect(-s*24, -s*5, s*2, s*3);
    c2.fillStyle = 'rgba(255,255,255,0.07)'; c2.fillRect(-s*22, s*1, s*30, s*2);
    c2.restore();
  }

  function drawFabioMini(c2, x, y, s) {
    c2.save(); c2.translate(x, y);
    c2.fillStyle = '#1e40af'; c2.fillRect(-s*7, 0, s*14, s*16);
    c2.fillStyle = '#c4a07a'; c2.fillRect(-s*3, -s*3, s*6, s*5);
    c2.fillStyle = '#d4a87a'; c2.beginPath(); c2.ellipse(0, -s*8, s*7, s*8, 0, 0, Math.PI*2); c2.fill();
    c2.fillStyle = '#1e3a8a'; c2.beginPath(); c2.arc(0, -s*12, s*7, Math.PI, 0, false); c2.fill();
    c2.fillRect(-s*7, -s*14, s*14, s*4);
    c2.fillStyle = '#1d4ed8'; c2.fillRect(0, -s*15, s*9, s*3);
    c2.fillStyle = '#111';
    c2.beginPath(); c2.arc(-s*2.5, -s*8, s*1.2, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*2.5, -s*8, s*1.2, 0, Math.PI*2); c2.fill();
    c2.restore();
  }

  /* Aluno com rosto detalhado */
  function drawStudent(c2, x, y, s, cfg) {
    c2.save(); c2.translate(x, y);

    /* sombra no chao */
    c2.fillStyle = 'rgba(0,0,0,0.28)';
    c2.beginPath(); c2.ellipse(0, s*16.5, s*7, s*2.5, 0, 0, Math.PI*2); c2.fill();

    /* pernas */
    c2.fillStyle = '#1e293b';
    c2.fillRect(-s*5.5, s*3, s*4.5, s*12); c2.fillRect(s*1, s*3, s*4.5, s*12);

    /* tenis */
    c2.fillStyle = '#f1f5f9';
    c2.fillRect(-s*7, s*13.5, s*6.5, s*2.8); c2.fillRect(s*0.5, s*13.5, s*6.5, s*2.8);
    c2.fillStyle = '#94a3b8';
    c2.fillRect(-s*7, s*15.3, s*6.5, s*1); c2.fillRect(s*0.5, s*15.3, s*6.5, s*1);

    /* corpo (camiseta) */
    c2.fillStyle = cfg.shirt;
    c2.beginPath();
    c2.moveTo(-s*9, s*3); c2.lineTo(-s*9, -s*8.5);
    c2.lineTo(-s*5, -s*11); c2.lineTo(s*5, -s*11);
    c2.lineTo(s*9, -s*8.5); c2.lineTo(s*9, s*3);
    c2.closePath(); c2.fill();
    /* listra sutil */
    c2.fillStyle = 'rgba(255,255,255,0.13)';
    c2.fillRect(-s*9, -s*1.5, s*18, s*2.5);

    /* pescoco */
    c2.fillStyle = cfg.skin; c2.fillRect(-s*3.5, -s*13, s*7, s*4);

    /* bracos */
    c2.fillStyle = cfg.shirt;
    c2.fillRect(-s*13.5, -s*8.5, s*4.5, s*10);
    c2.fillRect(s*9, -s*8.5, s*4.5, s*10);
    /* maos */
    c2.fillStyle = cfg.skin;
    c2.beginPath(); c2.ellipse(-s*11.5, s*3, s*3, s*2.3, 0, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.ellipse( s*11.5, s*3, s*3, s*2.3, 0, 0, Math.PI*2); c2.fill();

    /* mochila */
    c2.fillStyle = '#334155';
    c2.fillRect(s*7.5, -s*10, s*6.5, s*13);
    c2.fillStyle = '#475569'; c2.fillRect(s*8.5, -s*7, s*4.5, s*4.5);
    c2.strokeStyle = '#64748b'; c2.lineWidth = s*1.5; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(s*8.5, -s*9); c2.lineTo(s*6.5, -s*3); c2.stroke();

    /* cabeca */
    c2.fillStyle = cfg.skin;
    c2.beginPath(); c2.ellipse(0, -s*19.5, s*9.5, s*10, 0, 0, Math.PI*2); c2.fill();

    /* cabelo */
    c2.fillStyle = cfg.hair;
    c2.beginPath(); c2.ellipse(0, -s*25, s*9.5, s*7, 0, Math.PI, 0, true); c2.fill();
    c2.fillRect(-s*9.5, -s*26, s*19, s*4.5);

    /* orelhas */
    c2.fillStyle = cfg.skin;
    c2.beginPath(); c2.ellipse(-s*9.5, -s*19.5, s*2.2, s*2.8, 0, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.ellipse( s*9.5, -s*19.5, s*2.2, s*2.8, 0, 0, Math.PI*2); c2.fill();

    /* olhos — brancos */
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.ellipse(-s*3.8, -s*20, s*2.9, s*2.4, 0, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.ellipse( s*3.8, -s*20, s*2.9, s*2.4, 0, 0, Math.PI*2); c2.fill();
    /* olhos — iris */
    c2.fillStyle = '#1e3a5f';
    c2.beginPath(); c2.arc(-s*3.8, -s*20, s*1.8, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*3.8, -s*20, s*1.8, 0, Math.PI*2); c2.fill();
    /* pupila */
    c2.fillStyle = '#080f1e';
    c2.beginPath(); c2.arc(-s*3.8, -s*20, s*1, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*3.8, -s*20, s*1, 0, Math.PI*2); c2.fill();
    /* brilho */
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.arc(-s*3.1, -s*20.6, s*0.6, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*4.5, -s*20.6, s*0.6, 0, Math.PI*2); c2.fill();

    /* sobrancelhas */
    c2.strokeStyle = cfg.hair; c2.lineWidth = s*1.5; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(-s*6.5, -s*23.5); c2.lineTo(-s*1.5, -s*23.9); c2.stroke();
    c2.beginPath(); c2.moveTo( s*6.5, -s*23.5); c2.lineTo( s*1.5, -s*23.9); c2.stroke();

    /* nariz (duas narinas sutis) */
    c2.fillStyle = 'rgba(0,0,0,0.18)';
    c2.beginPath(); c2.arc(-s*1.3, -s*18, s*0.85, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*1.3, -s*18, s*0.85, 0, Math.PI*2); c2.fill();

    /* boca — sorriso */
    c2.strokeStyle = '#7f4f24'; c2.lineWidth = s*1.6; c2.lineCap = 'round';
    c2.beginPath(); c2.arc(0, -s*16.5, s*3.8, 0.28, Math.PI - 0.28, false); c2.stroke();

    c2.restore();
  }

  function drawFabioBig(c2, x, y, s) {
    c2.save(); c2.translate(x, y);
    c2.fillStyle = '#1a3a9f'; c2.fillRect(-s*20, s*5, s*40, s*48);
    c2.fillStyle = 'rgba(255,255,255,0.1)'; c2.fillRect(-s*12, s*8, s*24, s*3);
    c2.fillStyle = '#c4a07a'; c2.fillRect(-s*7, -s*3, s*14, s*10);
    c2.fillStyle = '#d4a87a'; c2.beginPath(); c2.ellipse(0, -s*18, s*19, s*22, 0, 0, Math.PI*2); c2.fill();
    c2.strokeStyle = '#b8825a'; c2.lineWidth = s*1.3;
    c2.beginPath(); c2.moveTo(-s*10, -s*12); c2.lineTo(-s*12, -s*8); c2.stroke();
    c2.beginPath(); c2.moveTo( s*10, -s*12); c2.lineTo( s*12, -s*8); c2.stroke();
    c2.fillStyle = '#1e3a8a'; c2.beginPath(); c2.arc(0, -s*28, s*19, Math.PI, 0, false); c2.fill();
    c2.fillRect(-s*19, -s*32, s*38, s*6);
    c2.fillStyle = '#1d4ed8'; c2.fillRect(0, -s*35, s*24, s*5);
    c2.fillStyle = '#bfdbfe'; c2.font = 'bold ' + (s*7) + 'px sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('VAN', 0, -s*31);
    c2.fillStyle = '#1a2540';
    c2.beginPath(); c2.arc(-s*7, -s*19, s*3.5, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*7, -s*19, s*3.5, 0, Math.PI*2); c2.fill();
    c2.fillStyle = '#fff';
    c2.beginPath(); c2.arc(-s*6, -s*20, s*1.2, 0, Math.PI*2); c2.fill();
    c2.beginPath(); c2.arc( s*8, -s*20, s*1.2, 0, Math.PI*2); c2.fill();
    c2.strokeStyle = '#7c4b1a'; c2.lineWidth = s*2.2;
    c2.beginPath(); c2.moveTo(-s*12, -s*26); c2.lineTo(-s*3, -s*24); c2.stroke();
    c2.beginPath(); c2.moveTo( s*12, -s*26); c2.lineTo( s*3, -s*24); c2.stroke();
    c2.fillStyle = '#5c2e0a';
    c2.fillRect(-s*10, -s*14, s*8, s*3); c2.fillRect(s*2, -s*14, s*8, s*3);
    c2.strokeStyle = '#7c4b1a'; c2.lineWidth = s*2.5;
    c2.beginPath(); c2.arc(0, -s*9, s*9, 0.25, Math.PI - 0.25, false); c2.stroke();
    c2.restore();
  }

  /* ══════════════════════════════════════════════════════
     RESULTADO
  ══════════════════════════════════════════════════════ */
  function showResult() {
    var ph   = PHASES[phaseIdx];
    var km   = Math.round(kmTraveled);
    var fuel = (km * 0.09).toFixed(1);
    var diff = km - ph.optimal;
    var pct  = Math.round(Math.abs(diff) / ph.optimal * 100);
    var win  = diff <= Math.ceil(ph.optimal * 0.2);
    var ok   = !win && diff <= Math.ceil(ph.optimal * 0.45);
    var hasNext = phaseIdx < PHASES.length - 1;

    el('g-game').hidden = true;
    var r = el('g-result'); r.hidden = false;

    var btns = '';
    if (hasNext) btns += '<button class="button button-main" id="g-next">Proxima fase &rarr;</button>';
    btns += '<button class="button button-ghost" id="g-retry">Tentar novamente &#8635;</button>';
    if (!win) btns += '<details class="g-hint"><summary>Ver rota otima</summary><p>' + ph.hint + '</p></details>';

    r.innerHTML = [
      '<div class="g-res-icon">' + (win ? '&#127942;' : ok ? '&#128077;' : '&#128549;') + '</div>',
      '<div class="g-res-text">' + (
        win ? '<strong>Rota otima!</strong> Fabio economizou combustivel e chegou a tempo.' :
        ok  ? '<strong>Boa rota!</strong> Fabio chegou, mas da pra economizar mais.' :
              '<strong>Rota longa.</strong> Fabio gastou combustivel a toa na madrugada.'
      ) + '</div>',
      '<div class="g-res-stats">',
        '<div class="g-stat"><span>Km percorrido</span><strong>' + km + ' km</strong></div>',
        '<div class="g-stat"><span>Combustivel est.</span><strong>' + fuel + ' L</strong></div>',
        '<div class="g-stat"><span>Rota otima</span><strong>~' + ph.optimal + ' km</strong></div>',
        '<div class="g-stat ' + (diff > 0 ? 'g-bad' : 'g-good') + '">',
          '<span>Diferenca</span><strong>' + (diff > 0 ? '+' : '') + diff + ' km (' + (diff > 0 ? '+' : '') + pct + '%)</strong>',
        '</div>',
      '</div>',
      '<div class="g-res-btns">' + btns + '</div>',
    ].join('');

    var nb = el('g-next'), rb = el('g-retry');
    if (nb) nb.addEventListener('click', function () { phaseIdx++; startPhase(); });
    if (rb) rb.addEventListener('click', startPhase);
  }

  /* ══════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════ */
  window.rotaInitGame = initGame;

}());
