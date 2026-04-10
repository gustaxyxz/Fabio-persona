/* game.js - Rota Certa: runner lateral com planejamento */
(function () {
  'use strict';

  var VW = 960;
  var VH = 540;
  var VAN_SCREEN_X = 212;
  var MAP_NODE_R = 34;
  var KM_PER_UNIT = 0.026;

  var MAP_NODES = {
    garagem: { x: 92, y: 282, label: 'Garagem', type: 'start' },
    centro: { x: 272, y: 146, label: 'Centro', type: 'stop' },
    pgrande: { x: 278, y: 404, label: 'P. Grande', type: 'stop' },
    vnova: { x: 592, y: 142, label: 'Vila Nova', type: 'stop' },
    jamerica: { x: 596, y: 404, label: 'J. America', type: 'stop' },
    facul: { x: 860, y: 276, label: 'Faculdade', type: 'end' }
  };

  var MAP_ROADS = [
    ['garagem', 'centro'],
    ['garagem', 'pgrande'],
    ['centro', 'vnova'],
    ['pgrande', 'jamerica'],
    ['centro', 'pgrande'],
    ['vnova', 'jamerica'],
    ['vnova', 'facul'],
    ['jamerica', 'facul']
  ];

  var PHASES = [
    {
      id: 1,
      title: 'Aquecendo a rota',
      students: ['centro', 'pgrande'],
      optimal: 29,
      fuelMax: 54,
      fuelPerKm: 1.34,
      timeLimit: 36,
      sleepRate: 7.8,
      engine: 92,
      maxSpeed: 150,
      terrain: 0.92,
      briefing: 'Fabio vai sair da garagem, pegar dois alunos e chegar inteiro a faculdade.'
    },
    {
      id: 2,
      title: 'Noite puxada',
      students: ['centro', 'pgrande', 'vnova'],
      optimal: 36,
      fuelMax: 68,
      fuelPerKm: 1.38,
      timeLimit: 46,
      sleepRate: 8.9,
      engine: 96,
      maxSpeed: 160,
      terrain: 1.06,
      briefing: 'A rota ficou maior. Agora a ordem errada drena combustivel rapido.'
    },
    {
      id: 3,
      title: 'Madrugada pesada',
      students: ['centro', 'pgrande', 'vnova', 'jamerica'],
      optimal: 38,
      fuelMax: 76,
      fuelPerKm: 1.42,
      timeLimit: 56,
      sleepRate: 10.4,
      engine: 102,
      maxSpeed: 168,
      terrain: 1.18,
      briefing: 'Quatro embarques. Fabio precisa de rota curta, mao firme e pouco cochilo.'
    }
  ];

  var STUDENT_CFG = {
    centro: { name: 'Ana', shirt: '#ef4444', skin: '#d6a97f', hair: '#1f2937' },
    pgrande: { name: 'Bruno', shirt: '#22c55e', skin: '#c08958', hair: '#292524' },
    vnova: { name: 'Carla', shirt: '#8b5cf6', skin: '#e8c49a', hair: '#78350f' },
    jamerica: { name: 'Diego', shirt: '#f97316', skin: '#be8a5e', hair: '#111827' }
  };

  var screen = 'intro';
  var phaseIdx = 0;
  var planningOrder = [];
  var collected = [];
  var track = null;
  var resultData = null;
  var countdownEndMs = 0;
  var phaseStartMs = 0;
  var finishMs = 0;
  var pickupPauseUntil = 0;
  var worldX = 0;
  var fuelCurrent = 0;
  var sleepValue = 0;
  var sleepActive = false;
  var sleepCount = 0;
  var wakeCount = 0;
  var wakeMeter = 0;
  var bursts = [];
  var messageText = '';
  var messageUntilMs = 0;
  var impactFlashUntilMs = 0;
  var lastTs = 0;
  var animId = null;
  var audioCtx = null;
  var listenersBound = false;

  var inputState = { throttle: false, brake: false };
  var holdState = { throttle: false, brake: false };

  var van = {
    speed: 0,
    y: 0,
    pitch: 0,
    wheel: 0,
    shake: 0,
    bob: 0
  };

  var canvas;
  var ctx;
  var wrap;

  function el(id) {
    return document.getElementById(id);
  }

  function phase() {
    return PHASES[phaseIdx];
  }

  function now() {
    return Date.now();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function cx(value) {
    return value / VW * canvas.width;
  }

  function cy(value) {
    return value / VH * canvas.height;
  }

  function cs(value) {
    return value / VW * canvas.width;
  }

  function activeThrottle() {
    return inputState.throttle || holdState.throttle;
  }

  function activeBrake() {
    return inputState.brake || holdState.brake;
  }

  function distanceUnits(aKey, bKey) {
    var a = MAP_NODES[aKey];
    var b = MAP_NODES[bKey];
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function legKmRaw(aKey, bKey) {
    return distanceUnits(aKey, bKey) * KM_PER_UNIT;
  }

  function computeKmRaw(order, includeFaculty) {
    var seq = ['garagem'].concat(order);
    var total = 0;
    var index;
    if (includeFaculty) seq.push('facul');
    for (index = 0; index < seq.length - 1; index++) {
      total += legKmRaw(seq[index], seq[index + 1]);
    }
    return total;
  }

  function computeKm(order, includeFaculty) {
    return Math.round(computeKmRaw(order, includeFaculty));
  }

  function sequenceLabels(order, includeFaculty) {
    var seq = ['garagem'].concat(order);
    if (includeFaculty) seq.push('facul');
    return seq.map(function (key) {
      return MAP_NODES[key].label;
    }).join(' -> ');
  }

  function previewSequence() {
    var seq = ['garagem'].concat(planningOrder);
    if (planningOrder.length === phase().students.length) seq.push('facul');
    return seq;
  }

  function predictFuelUse(order, includeFaculty) {
    return computeKmRaw(order, includeFaculty) * phase().fuelPerKm;
  }

  function predictSleepRisk(order, includeFaculty) {
    var km = computeKm(order, includeFaculty);
    var optimalRatio = km / phase().optimal;
    return clamp(0.36 + optimalRatio * 0.34 + order.length * 0.06, 0.18, 0.98);
  }

  function worldToScreenX(world) {
    return world - worldX;
  }

  function showMsg(text) {
    messageText = text;
    messageUntilMs = now() + 1800;
  }

  function createBurst(world, groundY, color) {
    var index;
    for (index = 0; index < 10; index++) {
      bursts.push({
        x: world,
        y: groundY,
        vx: -28 + Math.random() * 56,
        vy: -40 - Math.random() * 34,
        life: 0.65 + Math.random() * 0.25,
        t: 0,
        color: color
      });
    }
  }

  function updateBursts(dt) {
    bursts = bursts.filter(function (item) {
      item.t += dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vy += 88 * dt;
      return item.t < item.life;
    });
  }

  function ensureAudio() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(fromFreq, toFreq, duration, type, volume, delay) {
    var ac = ensureAudio();
    var oscillator;
    var filter;
    var gain;
    var startAt;
    if (!ac) return;
    oscillator = ac.createOscillator();
    filter = ac.createBiquadFilter();
    gain = ac.createGain();
    startAt = ac.currentTime + (delay || 0);
    oscillator.type = type || 'sawtooth';
    oscillator.frequency.setValueAtTime(fromFreq, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, toFreq), startAt + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, startAt);
    filter.frequency.exponentialRampToValueAtTime(220, startAt + duration);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume || 0.08, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.05);
  }

  function playEngineStartSound() {
    playTone(130, 54, 0.6, 'sawtooth', 0.12, 0);
    playTone(164, 88, 0.38, 'square', 0.05, 0.08);
  }

  function playPickupSound() {
    playTone(480, 720, 0.12, 'triangle', 0.045, 0);
    playTone(620, 860, 0.1, 'triangle', 0.03, 0.06);
  }

  function playFuelSound() {
    playTone(320, 560, 0.16, 'triangle', 0.045, 0);
    playTone(560, 760, 0.12, 'triangle', 0.03, 0.05);
  }

  function playWakeSound() {
    playTone(240, 460, 0.18, 'square', 0.045, 0);
  }

  function playCrashSound() {
    playTone(170, 92, 0.16, 'sawtooth', 0.045, 0);
    playTone(120, 64, 0.12, 'square', 0.03, 0.03);
  }

  function playFailSound() {
    playTone(180, 74, 0.45, 'sawtooth', 0.06, 0);
  }

  function playWinSound() {
    playTone(360, 540, 0.2, 'triangle', 0.05, 0);
    playTone(540, 760, 0.24, 'triangle', 0.04, 0.12);
  }

  function initGame() {
    var container = el('game-container');
    if (!container) return;

    container.innerHTML = [
      '<div id="g-wrap">',
      '<div id="g-intro">',
      '<div class="g-icard">',
      '<div class="g-iart"><canvas id="g-char" width="110" height="148"></canvas></div>',
      '<div class="g-icopy">',
      '<div class="g-ititle">Rota Certa: Van da Madrugada</div>',
      '<p class="g-isub">Escolha a ordem dos bairros e depois segure a van do Fabio numa corrida curta, pesada e noturna ate a faculdade.</p>',
      '<p class="g-isub">Rota ruim seca o tanque, entulho derruba velocidade e cochilo no volante pode matar a fase no fim da reta.</p>',
      '<p class="g-isub"><strong>Controles:</strong> direita, W ou espaco aceleram. esquerda, A ou S aliviam a velocidade.</p>',
      '<button id="g-btn-start" class="button button-main" type="button">Ligar a van e iniciar</button>',
      '</div>',
      '</div>',
      '</div>',
      '<div id="g-game" hidden>',
      '<div id="g-hud">',
      '<div id="g-hud-l"></div>',
      '<div id="g-hud-m"></div>',
      '<div id="g-hud-r"></div>',
      '</div>',
      '<div id="g-map"><canvas id="g-canvas"></canvas></div>',
      '<div id="g-ctrl-bar">',
      '<span id="g-inst"></span>',
      '<div class="g-ctrl-btns">',
      '<button id="g-undo" class="button button-ghost" type="button">Desfazer</button>',
      '<button id="g-reset" class="button button-ghost" type="button">Limpar</button>',
      '<button id="g-run" class="button button-main" type="button">Partir</button>',
      '<button id="g-accel" class="button button-main" type="button" hidden>Acelerar</button>',
      '<button id="g-brake" class="button button-ghost" type="button" hidden>Frear</button>',
      '</div>',
      '</div>',
      '</div>',
      '<div id="g-result" hidden></div>',
      '</div>'
    ].join('');

    canvas = el('g-canvas');
    wrap = el('g-map');
    ctx = canvas.getContext('2d');

    drawIntroPoster(el('g-char').getContext('2d'));

    el('g-btn-start').addEventListener('click', startGame);
    el('g-undo').addEventListener('click', undoSelection);
    el('g-reset').addEventListener('click', clearSelection);
    el('g-run').addEventListener('click', startRun);

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });

    bindHoldButton(el('g-accel'), 'throttle');
    bindHoldButton(el('g-brake'), 'brake');

    if (!listenersBound) {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', resetInputs);
      window.addEventListener('resize', resizeCanvas);
      listenersBound = true;
    }
  }

  function bindHoldButton(button, prop) {
    function press(event) {
      event.preventDefault();
      if (screen === 'driving' && sleepActive) {
        registerWakeTap();
        return;
      }
      holdState[prop] = true;
      button.classList.add('is-pressed');
    }

    function release(event) {
      event.preventDefault();
      holdState[prop] = false;
      button.classList.remove('is-pressed');
    }

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  }

  function onKeyDown(event) {
    var key = String(event.key).toLowerCase();
    if (key === 'arrowright' || key === 'd' || key === 'w') inputState.throttle = true;
    if (key === 'arrowleft' || key === 'a' || key === 's') inputState.brake = true;
    if (key === 'enter' && screen === 'planning') startRun();
    if (key === ' ') {
      event.preventDefault();
      if (screen === 'driving' && sleepActive) {
        registerWakeTap();
      } else {
        inputState.throttle = true;
      }
    }
  }

  function onKeyUp(event) {
    var key = String(event.key).toLowerCase();
    if (key === 'arrowright' || key === 'd' || key === 'w') inputState.throttle = false;
    if (key === 'arrowleft' || key === 'a' || key === 's') inputState.brake = false;
    if (key === ' ') inputState.throttle = false;
  }

  function resetInputs() {
    inputState.throttle = false;
    inputState.brake = false;
    holdState.throttle = false;
    holdState.brake = false;
    if (el('g-accel')) el('g-accel').classList.remove('is-pressed');
    if (el('g-brake')) el('g-brake').classList.remove('is-pressed');
  }

  function startGame() {
    phaseIdx = 0;
    playEngineStartSound();
    startPhase();
  }

  function startPhase() {
    screen = 'planning';
    planningOrder = [];
    collected = [];
    track = null;
    resultData = null;
    countdownEndMs = 0;
    phaseStartMs = 0;
    finishMs = 0;
    pickupPauseUntil = 0;
    worldX = 0;
    fuelCurrent = phase().fuelMax;
    sleepValue = 18;
    sleepActive = false;
    sleepCount = 0;
    wakeCount = 0;
    wakeMeter = 0;
    bursts = [];
    impactFlashUntilMs = 0;
    lastTs = 0;
    resetInputs();

    van.speed = 0;
    van.pitch = 0;
    van.wheel = 0;
    van.shake = 0;
    van.bob = 0;
    van.y = 0;

    el('g-intro').hidden = true;
    el('g-game').hidden = false;
    el('g-result').hidden = true;

    resizeCanvas();
    updateUi();
    startLoop();
  }

  function undoSelection() {
    if (screen !== 'planning' || planningOrder.length === 0) return;
    planningOrder.pop();
    updateUi();
  }

  function clearSelection() {
    if (screen !== 'planning') return;
    planningOrder = [];
    updateUi();
  }

  function startRun() {
    if (screen !== 'planning') return;
    if (planningOrder.length !== phase().students.length) {
      showMsg('Defina todos os bairros antes de sair.');
      return;
    }

    track = buildTrack(planningOrder);
    countdownEndMs = now() + 2600;
    screen = 'countdown';
    playEngineStartSound();
    showMsg('Van ligada. Segure acelerar quando a contagem acabar.');
    updateUi();
  }

  function beginDrive() {
    screen = 'driving';
    phaseStartMs = now();
    finishMs = 0;
    pickupPauseUntil = 0;
    worldX = 0;
    fuelCurrent = phase().fuelMax;
    sleepValue = 18;
    sleepActive = false;
    wakeMeter = 0;
    collected = [];
    bursts = [];
    impactFlashUntilMs = 0;
    van.speed = 0;
    van.pitch = 0;
    van.wheel = 0;
    van.shake = 0;
    van.y = terrainHeightAt(VAN_SCREEN_X) - 54;
    track.events.forEach(function (event) {
      event.hit = false;
    });
    showMsg('Rota em execucao. Pegue os alunos e chegue a faculdade.');
    updateUi();
  }

  function buildTrack(order) {
    var seq = ['garagem'].concat(order).concat(['facul']);
    var events = [];
    var props = [];
    var totalKm = computeKmRaw(order, true);
    var cursor = 160;
    var segmentStart = 120;
    var index;

    for (index = 0; index < seq.length - 1; index++) {
      var legKm = legKmRaw(seq[index], seq[index + 1]);
      var segmentLength = 210 + legKm * 37;
      cursor += segmentLength;

      pushSegmentProps(props, segmentStart, cursor, legKm, seq[index + 1] === 'facul');

      if (seq[index + 1] === 'facul') {
        events.push({ kind: 'finish', x: cursor, hit: false });
      } else {
        events.push({ kind: 'student', key: seq[index + 1], x: cursor - 34, hit: false });
      }

      segmentStart = cursor;
    }

    return {
      routeKmRaw: totalKm,
      routeKm: Math.round(totalKm),
      fuelUseForecast: predictFuelUse(order, true),
      fuelPerUnit: predictFuelUse(order, true) / Math.max(1, cursor + 120),
      sleepFactor: 0.85 + Math.max(1, totalKm / phase().optimal) * 0.32,
      length: cursor + 120,
      events: events,
      props: props
    };
  }

  function pushSegmentProps(props, startX, endX, legKm, isFinalLeg) {
    var travel = endX - startX;
    var safeEnd = endX - 120;
    var debrisCount = Math.max(1, Math.floor(legKm / 4.6) + 1);
    var index;

    for (index = 0; index < debrisCount; index++) {
      var debrisX = startX + travel * (0.18 + (index + 1) / (debrisCount + 1) * 0.54);
      if (debrisX >= safeEnd) break;
      props.push({
        kind: 'debris',
        x: debrisX,
        hit: false,
        damage: 1.4 + legKm * 0.08,
        size: 0.9 + (index % 2) * 0.2
      });
    }

    if (!isFinalLeg && legKm > 5.2) {
      props.push({
        kind: 'fuel',
        x: Math.min(safeEnd - 18, startX + travel * 0.62),
        hit: false,
        amount: 6 + Math.round(legKm * 0.7)
      });
    }
  }

  function terrainHeightAt(world) {
    var p = phase();
    var rolling = Math.sin(world * 0.0064 + p.id * 0.7) * (26 + p.terrain * 10);
    var bumps = Math.sin(world * 0.017) * 11;
    var longWave = Math.sin(world * 0.0032 - 1.2) * (22 + p.terrain * 12);
    return clamp(396 + rolling + bumps + longWave, 314, 454);
  }

  function terrainSlopeAt(world) {
    return clamp((terrainHeightAt(world + 14) - terrainHeightAt(world - 14)) / 32, -1.15, 1.15);
  }

  function registerWakeTap() {
    if (screen !== 'driving' || !sleepActive) return;
    wakeMeter = clamp(wakeMeter + 24, 0, 100);
    van.shake = 10;
    if (wakeMeter >= 100) {
      sleepActive = false;
      sleepValue = 34;
      wakeCount += 1;
      playWakeSound();
      showMsg('Fabio acordou e retomou o controle.');
      updateUi();
    }
  }

  function updateUi() {
    updateHud();
    updateControls();
  }

  function updateHud() {
    var hudL = el('g-hud-l');
    var hudM = el('g-hud-m');
    var hudR = el('g-hud-r');
    var timeLeft;
    if (!hudL || !hudM || !hudR) return;

    if (screen === 'planning') {
      hudL.textContent = 'Fase ' + phase().id + '/' + PHASES.length + ' | Mapa da noite';
      hudM.innerHTML = planningHudHtml();
      hudR.textContent = phase().title;
      return;
    }

    if (screen === 'countdown') {
      hudL.textContent = 'Fase ' + phase().id + '/' + PHASES.length + ' | Contagem';
      hudM.innerHTML = '<span class="g-hud-note">A ordem escolhida vai virar a pista desta fase.</span>' + meterHtml('Combustivel', 1, 'fuel') + meterHtml('Sono', 0.18, 'sleep');
      hudR.textContent = 'Rota: ' + track.routeKm + ' km';
      return;
    }

    if (screen === 'driving') {
      timeLeft = Math.max(0, Math.ceil(phase().timeLimit - ((now() - phaseStartMs) / 1000)));
      hudL.textContent = 'Passageiros ' + collected.length + '/' + planningOrder.length;
      hudM.innerHTML = '<span class="g-hud-note">' + (sleepActive ? 'Fabio cochilou. Clique ou aperte espaco para acorda-lo.' : currentDriveNote()) + '</span>' + meterHtml('Combustivel', fuelCurrent / phase().fuelMax, 'fuel') + meterHtml('Sono', sleepValue / 100, 'sleep');
      hudR.textContent = Math.round(van.speed) + ' km/h | ' + Math.round(worldX / Math.max(1, track.length) * 100) + '% | ' + timeLeft + 's';
    }
  }

  function planningHudHtml() {
    var complete = planningOrder.length === phase().students.length;
    var km = computeKm(planningOrder, complete);
    var fuelRatio = predictFuelUse(planningOrder, complete) / phase().fuelMax;
    var sleepRatio = predictSleepRisk(planningOrder, complete);
    var routeText = planningOrder.length ? sequenceLabels(planningOrder, complete) : 'Clique nos bairros para montar a ordem de embarque.';
    return '<span class="g-hud-note">' + routeText + '</span>' + meterHtml('Combustivel previsto', fuelRatio, 'fuel') + meterHtml('Risco de sono', sleepRatio, 'sleep') + '<div class="g-chip">Distancia: ' + km + ' km</div>';
  }

  function meterHtml(label, ratio, kind) {
    var percent = Math.round(clamp(ratio, 0, 1) * 100);
    return [
      '<div class="g-meter-card">',
      '<span>',
      '<strong>' + label + '</strong>',
      '<b>' + percent + '%</b>',
      '</span>',
      '<div class="g-meter">',
      '<div class="g-meter-fill ' + kind + '" style="width:' + percent + '%"></div>',
      '</div>',
      '</div>'
    ].join('');
  }

  function currentDriveNote() {
    if (collected.length === planningOrder.length) return 'Todos a bordo. Agora e reta final ate a faculdade.';
    return 'Proxima parada: ' + STUDENT_CFG[planningOrder[collected.length]].name;
  }

  function updateControls() {
    var undo = el('g-undo');
    var reset = el('g-reset');
    var run = el('g-run');
    var accel = el('g-accel');
    var brake = el('g-brake');
    var inst = el('g-inst');
    if (!undo || !reset || !run || !accel || !brake || !inst) return;

    if (screen === 'planning') {
      undo.hidden = false;
      reset.hidden = false;
      run.hidden = false;
      accel.hidden = true;
      brake.hidden = true;
      undo.disabled = planningOrder.length === 0;
      reset.disabled = planningOrder.length === 0;
      run.disabled = planningOrder.length !== phase().students.length;
      inst.textContent = phase().briefing;
      return;
    }

    if (screen === 'countdown') {
      undo.hidden = true;
      reset.hidden = true;
      run.hidden = true;
      accel.hidden = true;
      brake.hidden = true;
      inst.textContent = 'A contagem vai entrar no runner lateral. Prepare o acelerador.';
      return;
    }

    if (screen === 'driving') {
      undo.hidden = true;
      reset.hidden = true;
      run.hidden = true;
      accel.hidden = false;
      brake.hidden = false;
      accel.textContent = sleepActive ? 'Acordar Fabio' : 'Acelerar';
      brake.textContent = sleepActive ? 'Acordar Fabio' : 'Frear';
      inst.textContent = sleepActive ? 'Fabio cochilou. Clique, toque ou aperte espaco ate encher a barra.' : 'Segure acelerar para manter a van viva nas subidas.';
    }
  }

  function startLoop() {
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    var dt;
    if (screen !== 'planning' && screen !== 'countdown' && screen !== 'driving') return;
    if (!lastTs) lastTs = ts;
    dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    resizeCanvas();

    if (screen === 'countdown' && now() >= countdownEndMs) beginDrive();
    if (screen === 'driving') updateDrive(dt);
    updateBursts(dt);
    updateUi();
    drawScene();

    if (screen === 'planning' || screen === 'countdown' || screen === 'driving') {
      animId = requestAnimationFrame(loop);
    }
  }

  function updateDrive(dt) {
    var p = phase();
    var beforeX = worldX;
    var slope;
    var throttle = activeThrottle() ? 1 : 0;
    var brake = activeBrake() ? 1 : 0;
    var accelForce;
    var drag;
    var deltaX;
    var currentTime = now();

    if (sleepActive) {
      throttle *= 0.22;
      brake *= 0.3;
      wakeMeter = clamp(wakeMeter - dt * 6, 0, 100);
    }

    slope = terrainSlopeAt(worldX + VAN_SCREEN_X);
    accelForce = throttle * (p.engine + 18 - Math.max(0, slope) * 34) - brake * 96 + Math.max(0, -slope) * 24;
    drag = 16 + van.speed * 0.36 + Math.max(0, slope) * 24;
    if (currentTime < pickupPauseUntil) accelForce -= 56;
    van.speed = clamp(van.speed + (accelForce - drag) * dt, 0, p.maxSpeed);

    if (sleepActive) van.speed = Math.min(van.speed, p.maxSpeed * 0.42);

    worldX += van.speed * dt;
    deltaX = Math.max(0, worldX - beforeX);
    fuelCurrent = Math.max(0, fuelCurrent - deltaX * track.fuelPerUnit - throttle * dt * 0.62 - Math.max(0, slope) * dt * 0.52);
    sleepValue = clamp(sleepValue + dt * p.sleepRate * track.sleepFactor + throttle * dt * 1.5, 0, 100);
    if (!sleepActive && !throttle && van.speed < 72) sleepValue = Math.max(0, sleepValue - dt * 4.2);

    if (!sleepActive && sleepValue >= 100) {
      sleepActive = true;
      sleepCount += 1;
      wakeMeter = 0;
      showMsg('Fabio cochilou no volante. Acorde ele agora.');
    }

    updateVanPose(dt);
  checkRoadProps();
    checkTrackEvents();

    if (fuelCurrent <= 0) {
      finishRun('fuel');
      return;
    }

    if ((currentTime - phaseStartMs) / 1000 >= p.timeLimit) {
      finishRun('time');
    }
  }

  function checkRoadProps() {
    var noseWorld = worldX + VAN_SCREEN_X + 44;
    if (!track || !track.props) return;

    track.props.forEach(function (prop) {
      if (prop.hit || noseWorld < prop.x) return;
      prop.hit = true;

      if (prop.kind === 'fuel') {
        fuelCurrent = Math.min(phase().fuelMax, fuelCurrent + prop.amount);
        createBurst(prop.x, terrainHeightAt(prop.x) - 24, '#fbbf24');
        playFuelSound();
        showMsg('Galao coletado. O tanque ganhou folego.');
        return;
      }

      van.speed *= van.speed > 122 ? 0.48 : 0.7;
      fuelCurrent = Math.max(0, fuelCurrent - prop.damage);
      sleepValue = Math.min(100, sleepValue + 6);
      impactFlashUntilMs = now() + 130;
      createBurst(prop.x, terrainHeightAt(prop.x) - 6, '#94a3b8');
      playCrashSound();
      showMsg('Entulho na pista derrubou sua velocidade.');
    });
  }

  function updateVanPose(dt) {
    var wheelWorld = worldX + VAN_SCREEN_X;
    var roadY = terrainHeightAt(wheelWorld);
    var targetY = roadY - 40 - Math.min(7, van.speed * 0.03) * Math.abs(Math.sin(worldX * 0.04));
    van.y = lerp(van.y, targetY, Math.min(1, dt * 10));
    van.pitch = lerp(van.pitch, Math.atan2(terrainHeightAt(wheelWorld + 18) - terrainHeightAt(wheelWorld - 18), 40), Math.min(1, dt * 8));
    van.wheel += van.speed * dt * 0.11;
    van.bob += dt * (1.8 + van.speed * 0.03);
    van.shake = lerp(van.shake, sleepActive ? 4.5 : 0, Math.min(1, dt * 7));
  }

  function checkTrackEvents() {
    var noseWorld = worldX + VAN_SCREEN_X + 42;
    track.events.forEach(function (event) {
      if (event.hit || noseWorld < event.x) return;
      event.hit = true;
      if (event.kind === 'student') {
        pickupStudent(event);
        return;
      }
      finishRun('finish');
    });
  }

  function pickupStudent(event) {
    var cfg = STUDENT_CFG[event.key];
    collected.push(event.key);
    pickupPauseUntil = now() + 520;
    van.speed *= 0.68;
    sleepValue = Math.max(8, sleepValue - 18);
    createBurst(event.x, terrainHeightAt(event.x) - 70, cfg.shirt);
    playPickupSound();
    showMsg(cfg.name + ' entrou na van.');
  }

  function finishRun(reason) {
    var timeUsed = Math.ceil((now() - phaseStartMs) / 1000);
    var diff = track.routeKm - phase().optimal;
    var arrived = reason === 'finish';
    var goodRoute = diff <= Math.ceil(phase().optimal * 0.15);
    var okRoute = diff <= Math.ceil(phase().optimal * 0.35);
    finishMs = now();
    resultData = {
      reason: reason,
      arrived: arrived,
      timeUsed: timeUsed,
      fuelLeft: Math.max(0, fuelCurrent),
      diff: diff,
      goodRoute: goodRoute,
      okRoute: okRoute,
      pickups: collected.length
    };

    if (arrived) playWinSound();
    else playFailSound();

    screen = 'result';
    showResult();
  }

  function showResult() {
    var result = el('g-result');
    var hasNext = phaseIdx < PHASES.length - 1;
    var medalIcon;
    var title;
    var buttons = '';
    var pct = Math.round(Math.abs(resultData.diff) / phase().optimal * 100);
    if (animId) cancelAnimationFrame(animId);
    animId = null;

    el('g-game').hidden = true;
    result.hidden = false;

    if (resultData.reason === 'fuel') {
      medalIcon = '&#9981;';
      title = '<strong>Combustivel zerado.</strong> A van morreu antes da faculdade.';
    } else if (resultData.reason === 'time') {
      medalIcon = '&#9200;';
      title = '<strong>Tempo esgotado.</strong> A rota ficou longa demais para a madrugada.';
    } else if (resultData.goodRoute) {
      medalIcon = '&#127942;';
      title = '<strong>Chegada excelente.</strong> Esta fase ficou com a pressao e o ritmo certos.';
    } else if (resultData.okRoute) {
      medalIcon = '&#128293;';
      title = '<strong>Chegada boa.</strong> Passou no sufoco, mas ainda da para cortar rota.';
    } else {
      medalIcon = '&#128549;';
      title = '<strong>Chegou, mas gastou demais.</strong> A ordem dos bairros pesou no trajeto.';
    }

    if (hasNext && resultData.arrived) {
      buttons += '<button class="button button-main" id="g-next" type="button">Proxima fase</button>';
    }
    buttons += '<button class="button button-ghost" id="g-retry" type="button">Tentar novamente</button>';

    result.innerHTML = [
      '<div class="g-res-icon">' + medalIcon + '</div>',
      '<div class="g-res-title">' + title + '</div>',
      '<div class="g-res-route"><span class="g-rseg">Sequencia:</span><span class="g-arr">' + sequenceLabels(planningOrder, true) + '</span></div>',
      '<div class="g-res-stats">',
      '<div class="g-stat"><span>Rota</span><strong>' + track.routeKm + ' km</strong></div>',
      '<div class="g-stat"><span>Combustivel restante</span><strong>' + resultData.fuelLeft.toFixed(1) + ' L</strong></div>',
      '<div class="g-stat"><span>Tempo</span><strong>' + resultData.timeUsed + ' s</strong></div>',
      '<div class="g-stat"><span>Embarques</span><strong>' + resultData.pickups + '/' + planningOrder.length + '</strong></div>',
      '<div class="g-stat"><span>Cochilos</span><strong>' + sleepCount + '</strong></div>',
      '<div class="g-stat"><span>Despertares</span><strong>' + wakeCount + '</strong></div>',
      '<div class="g-stat"><span>Rota otima</span><strong>~' + phase().optimal + ' km</strong></div>',
      '<div class="g-stat ' + (resultData.diff > 0 ? 'g-bad' : 'g-good') + '"><span>Diferenca</span><strong>' + (resultData.diff > 0 ? '+' : '') + resultData.diff + ' km (' + (resultData.diff > 0 ? '+' : '') + pct + '%)</strong></div>',
      '</div>',
      '<div class="g-res-btns">' + buttons + '</div>'
    ].join('');

    if (el('g-next')) {
      el('g-next').addEventListener('click', function () {
        phaseIdx += 1;
        startPhase();
      });
    }

    el('g-retry').addEventListener('click', startPhase);
  }

  function onCanvasClick(event) {
    var rect = canvas.getBoundingClientRect();
    var vx = (event.clientX - rect.left) / rect.width * VW;
    var vy = (event.clientY - rect.top) / rect.height * VH;
    handleCanvasPointer(vx, vy);
  }

  function onCanvasTouch(event) {
    var rect;
    var touch;
    event.preventDefault();
    if (!event.touches.length) return;
    rect = canvas.getBoundingClientRect();
    touch = event.touches[0];
    handleCanvasPointer(
      (touch.clientX - rect.left) / rect.width * VW,
      (touch.clientY - rect.top) / rect.height * VH
    );
  }

  function handleCanvasPointer(vx, vy) {
    if (screen === 'planning') {
      selectStudent(vx, vy);
      return;
    }
    if (screen === 'driving' && sleepActive) registerWakeTap();
  }

  function selectStudent(vx, vy) {
    var available = phase().students.filter(function (key) {
      return planningOrder.indexOf(key) === -1;
    });
    var index;

    for (index = 0; index < available.length; index++) {
      var key = available[index];
      var node = MAP_NODES[key];
      var dist = Math.sqrt(Math.pow(vx - node.x, 2) + Math.pow(vy - node.y, 2));
      if (dist <= MAP_NODE_R + 10) {
        planningOrder.push(key);
        showMsg(STUDENT_CFG[key].name + ' entrou na rota.');
        updateUi();
        return;
      }
    }
  }

  function resizeCanvas() {
    var width = wrap ? (wrap.offsetWidth || 860) : 860;
    if (!canvas || canvas.width === width) return;
    canvas.width = width;
    canvas.height = Math.round(width * VH / VW);
    wrap.style.height = canvas.height + 'px';
  }

  function drawScene() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (screen === 'planning') {
      drawPlanningScene();
      return;
    }
    drawDrivingScene();
  }

  function drawPlanningScene() {
    var index;
    var node;
    ctx.fillStyle = '#06111a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (index = 0; index < 24; index++) {
      ctx.fillStyle = index % 2 ? 'rgba(22,34,54,0.8)' : 'rgba(15,26,42,0.8)';
      ctx.fillRect(cx(index * 40), cy(28), cs(18), cy(390));
    }

    ctx.strokeStyle = 'rgba(63,113,170,0.18)';
    ctx.lineWidth = cs(2);
    MAP_ROADS.forEach(function (pair) {
      var a = MAP_NODES[pair[0]];
      var b = MAP_NODES[pair[1]];
      ctx.beginPath();
      ctx.moveTo(cx(a.x), cy(a.y));
      ctx.lineTo(cx(b.x), cy(b.y));
      ctx.stroke();
    });

    drawMapRoutePreview();

    Object.keys(MAP_NODES).forEach(function (key) {
      node = MAP_NODES[key];
      drawMapNode(key, node);
    });

    drawPlanningCard();
    drawMessage();
  }

  function drawPlanningCard() {
    var x = cx(24);
    var y = cy(20);
    var width = cs(286);
    var height = cy(104);
    var chosen = planningOrder.length ? planningOrder.map(function (key, idx) {
      return (idx + 1) + '. ' + MAP_NODES[key].label;
    }).join('   ') : 'Nenhum bairro escolhido ainda';

    ctx.save();
    roundRect(ctx, x, y, width, height, cs(12));
    ctx.fillStyle = 'rgba(8,15,26,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(96,165,250,0.24)';
    ctx.lineWidth = cs(1.8);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 ' + cs(16) + 'px League Spartan, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Monte a ordem da noite', x + cs(14), y + cy(10));

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 ' + cs(9.6) + 'px sans-serif';
    ctx.fillText('Clique nos bairros na sequencia de embarque e depois aperte Partir.', x + cs(14), y + cy(34));

    ctx.fillStyle = '#93c5fd';
    ctx.font = '700 ' + cs(9) + 'px sans-serif';
    ctx.fillText(chosen, x + cs(14), y + cy(58));

    ctx.fillStyle = '#fde68a';
    ctx.fillText('Fase: ' + phase().title, x + cs(14), y + cy(80));
    ctx.restore();
  }

  function drawMapRoutePreview() {
    var seq = previewSequence();
    var i;
    if (seq.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(96,165,250,0.2)';
    ctx.lineWidth = cs(12);
    ctx.beginPath();
    ctx.moveTo(cx(MAP_NODES[seq[0]].x), cy(MAP_NODES[seq[0]].y));
    for (i = 1; i < seq.length; i++) {
      var prev = MAP_NODES[seq[i - 1]];
      var cur = MAP_NODES[seq[i]];
      if (prev.x !== cur.x && prev.y !== cur.y) ctx.lineTo(cx(cur.x), cy(prev.y));
      ctx.lineTo(cx(cur.x), cy(cur.y));
    }
    ctx.stroke();

    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = cs(3);
    ctx.setLineDash([cs(11), cs(9)]);
    ctx.lineDashOffset = -(now() / 45) % cs(20);
    ctx.beginPath();
    ctx.moveTo(cx(MAP_NODES[seq[0]].x), cy(MAP_NODES[seq[0]].y));
    for (i = 1; i < seq.length; i++) {
      prev = MAP_NODES[seq[i - 1]];
      cur = MAP_NODES[seq[i]];
      if (prev.x !== cur.x && prev.y !== cur.y) ctx.lineTo(cx(cur.x), cy(prev.y));
      ctx.lineTo(cx(cur.x), cy(cur.y));
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMapNode(key, node) {
    var isSelected = planningOrder.indexOf(key) !== -1;
    var isActive = key === 'garagem' || key === 'facul' || phase().students.indexOf(key) !== -1;
    var pulse = 1 + Math.sin(now() * 0.004 + node.x) * 0.04;
    var radius = cs(MAP_NODE_R * pulse);
    var orderIndex = planningOrder.indexOf(key);

    ctx.save();
    ctx.globalAlpha = isActive ? 1 : 0.2;
    ctx.fillStyle = '#07111f';
    ctx.beginPath();
    ctx.arc(cx(node.x), cy(node.y), radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = node.type === 'start' ? '#4ade80' : node.type === 'end' ? '#f59e0b' : isSelected ? '#60a5fa' : '#64748b';
    ctx.lineWidth = cs(isSelected ? 3 : 2);
    ctx.beginPath();
    ctx.arc(cx(node.x), cy(node.y), radius, 0, Math.PI * 2);
    ctx.stroke();

    if (node.type === 'stop') {
      drawStudentToken(cx(node.x), cy(node.y), cs(0.78), STUDENT_CFG[key]);
    } else {
      ctx.fillStyle = node.type === 'start' ? '#4ade80' : '#fbbf24';
      ctx.font = 'bold ' + cs(18) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.type === 'start' ? 'G' : 'F', cx(node.x), cy(node.y));
    }

    if (orderIndex !== -1 && node.type === 'stop') {
      ctx.fillStyle = '#0b1220';
      ctx.beginPath();
      ctx.arc(cx(node.x) + cs(18), cy(node.y) - cs(18), cs(12), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = cs(2);
      ctx.beginPath();
      ctx.arc(cx(node.x) + cs(18), cy(node.y) - cs(18), cs(12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#dbeafe';
      ctx.font = 'bold ' + cs(10) + 'px sans-serif';
      ctx.fillText(String(orderIndex + 1), cx(node.x) + cs(18), cy(node.y) - cs(18));
    }

    ctx.fillStyle = isActive ? '#d7e2f3' : '#6b7280';
    ctx.font = 'bold ' + cs(9) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, cx(node.x), cy(node.y) + cs(24));
    ctx.restore();
  }

  function drawDrivingScene() {
    drawSky();
    drawParallaxLayer(0.14, cy(290), '#0c1627', '#10203a', 26, 54, 170);
    drawParallaxLayer(0.32, cy(332), '#12233b', '#18314f', 36, 78, 220);
    drawSpeedFx();
    drawRoad();
    drawRoadProps();
    drawTrackMarkers();
    drawBursts();
    drawRunnerVan();
    drawProgressStrip();
    drawMessage();
    if (now() < impactFlashUntilMs) drawImpactFlash();

    if (screen === 'countdown') drawCountdownOverlay();
    if (screen === 'driving' && sleepActive) drawSleepOverlay();
  }

  function drawSpeedFx() {
    var index;
    var strength = clamp(van.speed / phase().maxSpeed, 0, 1);
    if (strength < 0.25) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(191,219,254,' + (0.08 + strength * 0.12) + ')';
    ctx.lineWidth = cs(1.4);
    for (index = 0; index < 12; index++) {
      var x = ((index * 97) - worldX * (0.9 + strength)) % canvas.width;
      if (x < 0) x += canvas.width;
      var y = cy(82 + (index % 6) * 42);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - cs(24 + strength * 26), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSky() {
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    var index;
    gradient.addColorStop(0, '#06111a');
    gradient.addColorStop(0.55, '#13233a');
    gradient.addColorStop(1, '#18283b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (index = 0; index < 22; index++) {
      var starX = ((index * 131) - worldX * 0.06) % canvas.width;
      if (starX < 0) starX += canvas.width;
      ctx.globalAlpha = 0.3 + (index % 5) * 0.12;
      ctx.beginPath();
      ctx.arc(starX, cy(42 + (index % 7) * 24), 1.2 + (index % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,246,185,0.9)';
    ctx.beginPath();
    ctx.arc(cx(840), cy(78), cs(24), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParallaxLayer(speedFactor, baseY, colorA, colorB, count, minH, maxH) {
    var index;
    for (index = 0; index < count; index++) {
      var width = 28 + (index % 5) * 12;
      var height = minH + (index % 7) * ((maxH - minH) / 6);
      var world = index * 64;
      var screenX = ((world - worldX * speedFactor) % (count * 64));
      if (screenX < -width) screenX += count * 64;
      ctx.fillStyle = index % 2 ? colorA : colorB;
      ctx.fillRect(screenX, baseY - height, width, height);
    }
  }

  function drawRoad() {
    var x;
    var screenY;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (x = -40; x <= canvas.width + 40; x += 10) {
      ctx.lineTo(x, cy(terrainHeightAt(worldX + x)));
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = '#1c4f2c';
    ctx.fill();

    ctx.beginPath();
    for (x = -20; x <= canvas.width + 20; x += 10) {
      screenY = cy(terrainHeightAt(worldX + x));
      if (x === -20) ctx.moveTo(x, screenY);
      else ctx.lineTo(x, screenY);
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = cs(46);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = cs(4);
    ctx.stroke();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = cs(2.3);
    ctx.setLineDash([cs(18), cs(14)]);
    ctx.lineDashOffset = -(worldX * 0.8) % cs(32);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = cs(1.2);
    ctx.beginPath();
    for (x = -20; x <= canvas.width + 20; x += 22) {
      screenY = cy(terrainHeightAt(worldX + x));
      ctx.moveTo(x, screenY + cs(24));
      ctx.lineTo(x + cs(10), screenY + cs(24));
    }
    ctx.stroke();
  }

  function drawRoadProps() {
    if (!track || !track.props) return;
    track.props.forEach(function (prop) {
      var sx = worldToScreenX(prop.x);
      var gy = cy(terrainHeightAt(prop.x));
      if (prop.hit || sx < -60 || sx > canvas.width + 60) return;
      if (prop.kind === 'fuel') {
        drawFuelCan(sx, gy - cs(26));
        return;
      }
      drawDebris(sx, gy - cs(4), prop.size);
    });
  }

  function drawFuelCan(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(251,191,36,0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, cs(22), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, -cs(10), -cs(16), cs(20), cs(28), cs(4));
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-cs(3), -cs(20), cs(8), cs(5));
    ctx.fillStyle = '#fffbeb';
    ctx.font = 'bold ' + cs(8.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', 0, -cs(2));
    ctx.restore();
  }

  function drawDebris(x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = '#475569';
    roundRect(ctx, -cs(16), -cs(10), cs(32), cs(18), cs(3));
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-cs(10), -cs(4), cs(20), cs(3));
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-cs(5), cs(8), cs(10), cs(4));
    ctx.restore();
  }

  function drawTrackMarkers() {
    if (!track) return;
    track.events.forEach(function (event) {
      var sx = worldToScreenX(event.x);
      var groundY = terrainHeightAt(event.x);
      if (sx < -80 || sx > canvas.width + 80) return;
      if (event.kind === 'finish') {
        drawFacultyMarker(sx, groundY, event.hit);
        return;
      }
      if (!event.hit) drawStopMarker(sx, groundY, STUDENT_CFG[event.key], planningOrder.indexOf(event.key) + 1);
    });
  }

  function drawStopMarker(sx, groundY, cfg, orderIndex) {
    var gy = cy(groundY);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = cs(3);
    ctx.beginPath();
    ctx.moveTo(sx, gy - cs(14));
    ctx.lineTo(sx, gy - cs(86));
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    roundRect(ctx, sx - cs(18), gy - cs(102), cs(58), cs(26), cs(6));
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = cs(2);
    ctx.stroke();
    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold ' + cs(10) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P' + orderIndex, sx + cs(11), gy - cs(89));

    drawStudentToken(sx + cs(3), gy - cs(46), cs(0.92), cfg);
  }

  function drawFacultyMarker(sx, groundY, arrived) {
    var gy = cy(groundY);
    ctx.fillStyle = arrived ? 'rgba(251,191,36,0.55)' : 'rgba(251,191,36,0.22)';
    ctx.beginPath();
    ctx.arc(sx, gy - cs(52), cs(48), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = cs(5);
    ctx.beginPath();
    ctx.moveTo(sx - cs(22), gy - cs(12));
    ctx.lineTo(sx - cs(22), gy - cs(96));
    ctx.lineTo(sx + cs(22), gy - cs(96));
    ctx.lineTo(sx + cs(22), gy - cs(12));
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    roundRect(ctx, sx - cs(28), gy - cs(120), cs(56), cs(22), cs(6));
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = cs(2);
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold ' + cs(10) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FACUL', sx, gy - cs(109));
  }

  function drawBursts() {
    bursts.forEach(function (item) {
      var alpha = 1 - item.t / item.life;
      var sx = worldToScreenX(item.x);
      if (sx < -20 || sx > canvas.width + 20) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(sx, cy(item.y), cs(3), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawRunnerVan() {
    var px = cx(VAN_SCREEN_X) + Math.sin(van.bob) * cs(1.6);
    var py = cy(van.y) + Math.sin(van.bob * 1.8) * cs(1.2);
    var beamAlpha = sleepActive ? 0.08 : 0.16;
    ctx.save();
    ctx.translate(px + (Math.random() - 0.5) * van.shake, py + (Math.random() - 0.5) * van.shake);
    ctx.rotate(van.pitch * 0.75);

    ctx.fillStyle = 'rgba(255,244,185,' + beamAlpha + ')';
    ctx.beginPath();
    ctx.moveTo(cs(52), -cs(4));
    ctx.lineTo(cs(178), -cs(28));
    ctx.lineTo(cs(178), cs(30));
    ctx.lineTo(cs(52), cs(10));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, cs(26), cs(54), cs(11), 0, 0, Math.PI * 2);
    ctx.fill();

    if (van.speed > 26) {
      drawExhaust(-cs(60), cs(8), 0.26 + van.speed / phase().maxSpeed * 0.4);
    }

    ctx.fillStyle = '#1d4ed8';
    roundRect(ctx, -cs(58), -cs(12), cs(112), cs(34), cs(12));
    ctx.fill();
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(-cs(44), -cs(6), cs(80), cs(4));
    ctx.fillStyle = '#17328b';
    roundRect(ctx, -cs(4), -cs(28), cs(60), cs(20), cs(10));
    ctx.fill();
    ctx.fillStyle = 'rgba(191,219,254,0.82)';
    roundRect(ctx, -cs(40), -cs(8), cs(22), cs(12), cs(4));
    ctx.fill();
    roundRect(ctx, -cs(12), -cs(8), cs(22), cs(12), cs(4));
    ctx.fill();
    roundRect(ctx, cs(14), -cs(24), cs(24), cs(12), cs(4));
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cs(52), -cs(2), cs(6), cs(8));
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-cs(58), -cs(2), cs(6), cs(8));
    ctx.fillStyle = '#0b1220';
    roundRect(ctx, -cs(54), cs(8), cs(108), cs(7), cs(3));
    ctx.fill();

    drawWheel(-cs(34), cs(25), cs(16));
    drawWheel(cs(32), cs(25), cs(16));
    ctx.restore();
  }

  function drawExhaust(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.arc(x - cs(10), y + cs(2), cs(8), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - cs(22), y - cs(2), cs(6), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - cs(30), y + cs(1), cs(4), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWheel(x, y, radius) {
    var spoke;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = cs(1.6);
    ctx.rotate(van.wheel);
    for (spoke = 0; spoke < 4; spoke++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius * 0.6, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 2);
    }
    ctx.restore();
  }

  function drawStudentToken(x, y, scale, cfg) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = cfg.skin;
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cfg.hair;
    ctx.beginPath();
    ctx.arc(0, -13, 10, Math.PI, 0, false);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-3.4, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.4, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-3.4, -10, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.4, -10, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c4b1a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -6.8, 3.2, 0.3, Math.PI - 0.3, false);
    ctx.stroke();
    ctx.fillStyle = cfg.shirt;
    roundRect(ctx, -10, 0, 20, 17, 5);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6, 17, 4, 9);
    ctx.fillRect(2, 17, 4, 9);
    ctx.restore();
  }

  function drawCountdownOverlay() {
    var remaining = Math.max(1, Math.ceil((countdownEndMs - now()) / 1000));
    ctx.fillStyle = 'rgba(5,10,16,0.36)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 ' + cs(74) + 'px League Spartan, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(remaining), canvas.width * 0.5, canvas.height * 0.42);
    ctx.font = '700 ' + cs(14) + 'px sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText('Segure acelerar quando a contagem zerar', canvas.width * 0.5, canvas.height * 0.56);
    drawProgressStrip(true);
  }

  function drawSleepOverlay() {
    ctx.fillStyle = 'rgba(11,8,20,0.56)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d8b4fe';
    ctx.font = '800 ' + cs(34) + 'px League Spartan, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Fabio cochilou', canvas.width * 0.5, canvas.height * 0.42);
    ctx.font = '700 ' + cs(12) + 'px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Clique, toque ou aperte espaco ate a barra encher', canvas.width * 0.5, canvas.height * 0.5);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, canvas.width * 0.5 - cs(120), canvas.height * 0.56, cs(240), cs(16), cs(8));
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    roundRect(ctx, canvas.width * 0.5 - cs(120), canvas.height * 0.56, cs(240) * (wakeMeter / 100), cs(16), cs(8));
    ctx.fill();
  }

  function drawMessage() {
    if (now() >= messageUntilMs || !messageText) return;
    ctx.save();
    roundRect(ctx, canvas.width * 0.5 - cs(178), cy(22), cs(356), cs(34), cs(10));
    ctx.fillStyle = 'rgba(8,15,26,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)';
    ctx.lineWidth = cs(1.6);
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 ' + cs(10.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(messageText, canvas.width * 0.5, cy(39));
    ctx.restore();
  }

  function drawProgressStrip(isCountdown) {
    var barW;
    var barX;
    var barY;
    var progress;
    if (!track) return;

    barW = canvas.width * 0.62;
    barX = (canvas.width - barW) * 0.5;
    barY = canvas.height - cy(34);
    progress = clamp(worldX / Math.max(1, track.length), 0, 1);

    ctx.save();
    roundRect(ctx, barX, barY, barW, cy(14), cs(7));
    ctx.fillStyle = 'rgba(9,15,26,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.28)';
    ctx.lineWidth = cs(1.4);
    ctx.stroke();

    roundRect(ctx, barX, barY, barW * progress, cy(14), cs(7));
    ctx.fillStyle = 'rgba(96,165,250,0.28)';
    ctx.fill();

    track.events.forEach(function (event) {
      var ratio = clamp(event.x / track.length, 0, 1);
      var px = barX + barW * ratio;
      ctx.fillStyle = event.kind === 'finish' ? '#fbbf24' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(px, barY + cy(7), cs(event.kind === 'finish' ? 6 : 5), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = isCountdown ? '#f8fafc' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(barX + barW * progress, barY - cy(6));
    ctx.lineTo(barX + barW * progress - cs(7), barY - cy(18));
    ctx.lineTo(barX + barW * progress + cs(7), barY - cy(18));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawImpactFlash() {
    var alpha = 1 - (impactFlashUntilMs - now()) / 130;
    ctx.fillStyle = 'rgba(248,113,113,' + clamp(alpha * 0.22, 0.04, 0.22) + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawIntroPoster(c2) {
    c2.clearRect(0, 0, 110, 148);
    c2.fillStyle = '#0a1220';
    roundRect(c2, 6, 6, 98, 136, 16);
    c2.fill();
    c2.fillStyle = '#13263c';
    c2.fillRect(12, 78, 86, 52);
    c2.fillStyle = '#1d4ed8';
    roundRect(c2, 18, 86, 58, 18, 8);
    c2.fill();
    c2.fillStyle = '#17328b';
    roundRect(c2, 54, 76, 26, 14, 8);
    c2.fill();
    c2.fillStyle = '#0f172a';
    c2.beginPath(); c2.arc(30, 106, 9, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(68, 106, 9, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#64748b';
    c2.beginPath(); c2.arc(30, 106, 4, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(68, 106, 4, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#d4a87a';
    c2.beginPath(); c2.ellipse(76, 42, 17, 19, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = '#1e3a8a';
    c2.beginPath(); c2.arc(76, 33, 17, Math.PI, 0, false); c2.fill();
    c2.fillStyle = '#1e293b';
    c2.beginPath(); c2.arc(70, 42, 2.4, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(82, 42, 2.4, 0, Math.PI * 2); c2.fill();
    c2.strokeStyle = '#7c4b1a';
    c2.lineWidth = 2.2;
    c2.beginPath(); c2.arc(76, 52, 7, 0.2, Math.PI - 0.2, false); c2.stroke();
  }

  function roundRect(c2, x, y, w, h, r) {
    c2.beginPath();
    c2.moveTo(x + r, y);
    c2.lineTo(x + w - r, y);
    c2.quadraticCurveTo(x + w, y, x + w, y + r);
    c2.lineTo(x + w, y + h - r);
    c2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c2.lineTo(x + r, y + h);
    c2.quadraticCurveTo(x, y + h, x, y + h - r);
    c2.lineTo(x, y + r);
    c2.quadraticCurveTo(x, y, x + r, y);
    c2.closePath();
  }

  window.rotaInitGame = initGame;
}());
