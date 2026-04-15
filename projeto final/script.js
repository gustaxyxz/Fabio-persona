// (Listeners and visibility initialization centralized in initializePage)
// Permite arrastar o nome dos alunos manualmente no mapa
function enableStudentTagDrag() {
  // Carrega posições salvas
  let tagPositions = {};
  try {
    tagPositions = JSON.parse(localStorage.getItem('rota-student-tag-positions') || '{}');
  } catch { }

  document.querySelectorAll('.student-tag-top').forEach(function (tag) {
    tag.style.cursor = 'grab';
    const btn = tag.closest('.map-point');
    if (!btn) return;
    const stop = btn.dataset.stop;
    // Aplica posição salva se existir
    if (tagPositions[stop]) {
      tag.style.left = tagPositions[stop].left;
      tag.style.top = tagPositions[stop].top;
    } else {
      tag.style.left = '';
      tag.style.top = '';
    }
    tag.onmousedown = function (e) {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      let dragging = true;
      let startLeft = parseInt(tag.style.left || 0);
      let startTop = parseInt(tag.style.top || 0);
      let startPageX = e.pageX;
      let startPageY = e.pageY;
      function moveAt(pageX, pageY) {
        if (!dragging) return;
        let relX = startLeft + (pageX - startPageX);
        let relY = startTop + (pageY - startPageY);
        tag.style.left = relX + 'px';
        tag.style.top = relY + 'px';
      }
      function onMouseMove(ev) {
        moveAt(ev.pageX, ev.pageY);
      }
      function onMouseUp() {
        dragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        tag.onmouseup = null;
        tag.style.cursor = 'grab';
        // Salva posição ao soltar
        tagPositions[stop] = {
          left: tag.style.left,
          top: tag.style.top
        };
        localStorage.setItem('rota-student-tag-positions', JSON.stringify(tagPositions));
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      tag.onmouseup = onMouseUp;
    };
    tag.ondragstart = function () { return false; };
  });
}

// enableStudentTagDrag() será chamado em initializePage
const SITE_NAME = "Rota";
const PERSONA_NAME = "Fabio Alves";
const GAME_NAME = "Rota";
const GAME_RELEASE_YEAR = 2026;
const GAME_FOCUS = "encontrar a menor rota para levar ou buscar alunos dos seus enderecos ate a faculdade";
const PREVIEW_LEVEL = "conceitual";
const AGE_LIMIT = 5;
const UNLOCKED_PREVIEW_CARDS = [
  {
    title: "Passageiros",
    description: "André, Bruno, Carlos e Diego"
  },
  {
    title: "Destino Final",
    description: "Faculdade Integrado"
  },
  {
    title: "Efetividade",
    description: "Menor consumo de diesel"
  }
];

// Feature toggles (úteis para apresentação)
// Defina true para reativar o editor de waypoints durante debugging
const ENABLE_WAYPOINT_EDITOR = false;

const previewGrid = document.getElementById("previewGrid");
const ageGateStatus = document.getElementById("ageGateStatus");
let routeToolUnlocked = false; // Ferramenta desabilitada inicialmente até uma falha
const themeToggle = document.getElementById("themeToggle");
const ageGateButton = document.getElementById("ageGateButton");
const welcomeForm = document.getElementById("welcomeForm");
const visitorNameInput = document.getElementById("visitorName");
const welcomeMessage = document.getElementById("welcomeMessage");

let _routeDrawSvg = null;
let LEG_WAYPOINTS = {};

function initGlobalWaypoints() {
    LEG_WAYPOINTS = JSON.parse(JSON.stringify(DEFAULT_LEG_WAYPOINTS));
}
function loadWaypointsOverrides() {}

function _getOrCreateRouteSvg() {
  const map = document.getElementById('game-map');
  if (!map) return null;
  let svg = document.getElementById('route-draw-canvas');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'route-draw-canvas';
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.position = 'absolute';
    svg.style.top = '0'; svg.style.left = '0';
    svg.style.width = '100%'; svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '5';
    map.appendChild(svg);
  }
  return svg;
}

function injectStaticData() {
  if (document.getElementById("personaName")) document.getElementById("personaName").textContent = PERSONA_NAME;
  if (document.getElementById("gameName")) document.getElementById("gameName").textContent = GAME_NAME;
  if (document.getElementById("gameReleaseYear")) document.getElementById("gameReleaseYear").textContent = String(GAME_RELEASE_YEAR);
  if (document.getElementById("gameFocus")) document.getElementById("gameFocus").textContent = GAME_FOCUS;
  if (document.getElementById("siteNameFooter")) document.getElementById("siteNameFooter").textContent = SITE_NAME;
}

function updateThemeButtonLabel() {
  var el = document.getElementById('themeToggle');
  if (!el) return;
  var isDarkTheme = document.body.dataset.theme === 'dark';
  el.textContent = isDarkTheme ? 'Tema claro' : 'Tema escuro';
  el.setAttribute('aria-label', isDarkTheme ? 'Ativar tema claro' : 'Ativar tema escuro');
  el.setAttribute('aria-pressed', isDarkTheme ? 'true' : 'false');
}

function toggleTheme() {
  document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  updateThemeButtonLabel();
}

function buildPreviewCards(cards) {
  return cards.map(function (card) {
    return '<article class="preview-card"><h3>' + card.title + '</h3><p>' + card.description + '</p></article>';
  }).join("");
}

function updatePreviewVisibility() {
  const hasAgeGate = window.localStorage.getItem(AGE_GATE_KEY) === '1';
  const hasIdentity = window.localStorage.getItem(USER_NAME_KEY);

  // Identity Card logic
  const identityGate = document.getElementById('game-identity-gate');
  const identityForm = document.getElementById('welcomeForm');
  const identityNext = document.getElementById('game-identity-gate-next');
  const welcomeText = document.getElementById('welcome-intro-text');

  if (identityGate) {
    if (!hasIdentity) {
      identityGate.style.display = "block";
      if (identityForm) identityForm.style.display = "block";
      if (identityNext) identityNext.style.display = "none";
    } else if (!hasAgeGate) {
      identityGate.style.display = "block";
      if (identityForm) identityForm.style.display = "none";
      if (identityNext) identityNext.style.display = "block";
      if (welcomeText) welcomeText.textContent = "Oi, " + hasIdentity + "! Para começar, precisamos confirmar sua idade.";
    } else {
      identityGate.style.display = "none";
    }
  }

  // Preview Grid
  if (previewGrid) {
    previewGrid.innerHTML = buildPreviewCards(UNLOCKED_PREVIEW_CARDS);
    previewGrid.setAttribute("data-preview-state", hasAgeGate ? "unlocked" : "locked");
    const cards = previewGrid.querySelectorAll(".preview-card");
    cards.forEach(function (card) {
      card.style.filter = hasAgeGate ? "" : "blur(8px)";
      card.style.userSelect = hasAgeGate ? "" : "none";
      card.style.pointerEvents = hasAgeGate ? "" : "none";
    });
  }

  // Map blur target: apenas o mapa é borrado — baseia-se somente na validação da idade
  const mapBlurTarget = document.getElementById('map-blur-target');
  if (mapBlurTarget) {
    mapBlurTarget.style.filter = hasAgeGate ? "" : "blur(8px)";
    mapBlurTarget.style.userSelect = hasAgeGate ? "" : "none";
    mapBlurTarget.style.pointerEvents = hasAgeGate ? "" : "none";
  }

  // Age Overlay: mostrar até que a idade seja validada (independe do nome)
  const ageGateOverlay = document.getElementById('age-gate-overlay');
  if (ageGateOverlay) {
    ageGateOverlay.style.display = hasAgeGate ? "none" : "flex";
  }

  if (ageGateStatus) {
    if (!hasIdentity) {
      ageGateStatus.textContent = "Identifique-se para começar.";
    } else if (!hasAgeGate) {
      ageGateStatus.textContent = "Valide sua idade para liberar o jogo.";
    } else {
      ageGateStatus.textContent = "Tudo pronto! Boa rota, " + hasIdentity + ".";
    }
  }
}

const AGE_GATE_KEY = 'rota-age-validated';
const USER_NAME_KEY = 'rota-user-name';

let ageValidatedThisSession = false;
function validateAge() {
  if (ageValidatedThisSession) return;
  ageValidatedThisSession = true;
  const rawAge = prompt("Para confirmar sua entrada, digite sua idade:");

  if (rawAge === null) {
    alert("Idade não informada. O acesso completo do jogo continuará bloqueado.");
    ageValidatedThisSession = false;
    return;
  }

  const age = Number(rawAge);
  if (!Number.isFinite(age)) {
    alert("Por favor, informe uma idade válida.");
    ageValidatedThisSession = false;
    return;
  }

  if (age >= AGE_LIMIT) {
    alert("Idade validada! O jogo do Fábio foi liberado.");
    window.localStorage.setItem(AGE_GATE_KEY, '1');
    updatePreviewVisibility();
  } else {
    alert("Acesso negado: este conteúdo é voltado para maiores de " + AGE_LIMIT + " anos.");
    window.localStorage.removeItem(AGE_GATE_KEY);
    updatePreviewVisibility();
    ageValidatedThisSession = false;
  }
}

function showPersonalizedMessage(event) {
  if (event) event.preventDefault();
  const visitorName = visitorNameInput.value.trim();

  if (!visitorName) {
    if (welcomeMessage) welcomeMessage.textContent = "Precisamos do seu nome para começar.";
    return;
  }

  window.localStorage.setItem(USER_NAME_KEY, visitorName);
  updatePreviewVisibility();
}

function checkLaunchYear() {
  if (sessionStorage.getItem('rota_launched')) return;
  const currentYear = new Date().getFullYear();

  if (currentYear === GAME_RELEASE_YEAR) {
    alert("Grande Lancamento: " + GAME_NAME + " - prototipo em nivel " + PREVIEW_LEVEL + ".");
    sessionStorage.setItem('rota_launched', 'true');
  }
}

// --- DOM Game ---

const STUDENT_NAMES = {
  'Centro': 'André',
  'Paulo Grande': 'Bruno',
  'Vila Nova': 'Carlos',
  'Jardim America': 'Diego'
};
const ALL_STOPS = Object.keys(STUDENT_NAMES);
const REQUIRED_STOPS = ALL_STOPS.length;

function cloneStopPositions(source) {
  return Object.keys(source).reduce(function (acc, name) {
    acc[name] = {
      top: source[name].top,
      left: source[name].left
    };
    return acc;
  }, {});
}

function cloneWaypointMap(source) {
  return Object.keys(source).reduce(function (acc, legKey) {
    acc[legKey] = (source[legKey] || []).map(function (point) {
      return { top: point.top, left: point.left };
    });
    return acc;
  }, {});
}

const DEFAULT_STOP_POSITIONS = {
  'Garagem': { top: '40.1%', left: '43.9%' },
  'Faculdade': { top: '48.1%', left: '68.8%' },
  'Centro': { top: '49.5%', left: '41.8%' },
  'Paulo Grande': { top: '36.8%', left: '58.8%' },
  'Vila Nova': { top: '68.8%', left: '52.6%' },
  'Jardim America': { top: '52.8%', left: '60.6%' }
};

const STOP_POSITIONS = cloneStopPositions(DEFAULT_STOP_POSITIONS);

const ROAD_GRAPH = {
  'Garagem': ['Centro', 'Paulo Grande'],
  'Centro': ['Garagem', 'Paulo Grande', 'Vila Nova'],
  'Paulo Grande': ['Garagem', 'Centro', 'Jardim America'],
  'Vila Nova': ['Centro', 'Jardim America', 'Faculdade'],
  'Jardim America': ['Paulo Grande', 'Vila Nova', 'Faculdade'],
  'Faculdade': ['Vila Nova', 'Jardim America']
};

const LEG_STREETS = {
  'Garagem>Centro': ['st-g-centro'],
  'Centro>Garagem': ['st-g-centro'],
  'Garagem>Paulo Grande': ['st-g-paulo'],
  'Paulo Grande>Garagem': ['st-g-paulo'],
  'Centro>Paulo Grande': ['st-centro-paulo'],
  'Paulo Grande>Centro': ['st-centro-paulo'],
  'Centro>Vila Nova': ['st-centro-vila'],
  'Vila Nova>Centro': ['st-centro-vila'],
  'Paulo Grande>Jardim America': ['st-paulo-jardim'],
  'Jardim America>Paulo Grande': ['st-paulo-jardim'],
  'Vila Nova>Jardim America': ['st-vila-jardim'],
  'Jardim America>Vila Nova': ['st-vila-jardim'],
  'Vila Nova>Faculdade': ['st-vila-facul'],
  'Faculdade>Vila Nova': ['st-vila-facul'],
  'Jardim America>Faculdade': ['st-jardim-facul'],
  'Faculdade>Jardim America': ['st-jardim-facul']
};

const DEFAULT_LEG_WAYPOINTS = {
  "Garagem>Centro": [
    { "top": "40.1%", "left": "43.9%" },
    { "top": "42.8%", "left": "48.4%" },
    { "top": "44.0%", "left": "48.5%" },
    { "top": "49.7%", "left": "41.9%" }
  ],
  "Centro>Garagem": [
    { "top": "49.1%", "left": "42.1%" },
    { "top": "45.2%", "left": "48.1%" },
    { "top": "43.1%", "left": "47.9%" },
    { "top": "40.2%", "left": "44.4%" }
  ],
  "Garagem>Paulo Grande": [
    { "top": "40.0%", "left": "44.5%" },
    { "top": "43.9%", "left": "49.4%" },
    { "top": "40.2%", "left": "54.3%" },
    { "top": "36.8%", "left": "58.8%" }
  ],
  "Paulo Grande>Garagem": [
    { "top": "37.3%", "left": "57.8%" },
    { "top": "43.5%", "left": "50.3%" },
    { "top": "43.6%", "left": "48.7%" },
    { "top": "40.4%", "left": "44.7%" }
  ],
  "Centro>Paulo Grande": [
    { "top": "49.1%", "left": "42.1%" },
    { "top": "37.1%", "left": "58.1%" }
  ],
  "Paulo Grande>Centro": [
    { "top": "37.2%", "left": "58.0%" },
    { "top": "49.7%", "left": "42.0%" }
  ],
  "Centro>Vila Nova": [
    { "top": "49.6%", "left": "42.0%" },
    { "top": "54.0%", "left": "36.1%" },
    { "top": "55.3%", "left": "36.1%" },
    { "top": "61.3%", "left": "43.4%" },
    { "top": "68.8%", "left": "52.6%" }
  ],
  "Vila Nova>Centro": [
    { "top": "69.0%", "left": "52.7%" },
    { "top": "62.6%", "left": "44.8%" },
    { "top": "55.3%", "left": "36.1%" },
    { "top": "54.1%", "left": "36.0%" },
    { "top": "49.3%", "left": "42.5%" }
  ],
  "Paulo Grande>Jardim America": [
    { "top": "37.0%", "left": "57.7%" },
    { "top": "42.7%", "left": "50.6%" },
    { "top": "44.0%", "left": "50.4%" },
    { "top": "48.2%", "left": "54.9%" },
    { "top": "52.8%", "left": "60.6%" }
  ],
  "Jardim America>Paulo Grande": [
    { "top": "52.9%", "left": "60.5%" },
    { "top": "46.5%", "left": "53.1%" },
    { "top": "44.1%", "left": "50.2%" },
    { "top": "43.0%", "left": "50.5%" },
    { "top": "37.3%", "left": "57.8%" }
  ],
  "Vila Nova>Jardim America": [
    { "top": "69.2%", "left": "53.7%" },
    { "top": "66.7%", "left": "50.4%" },
    { "top": "64.5%", "left": "47.9%" },
    { "top": "62.1%", "left": "50.9%" },
    { "top": "55.0%", "left": "59.8%" }
  ],
  "Jardim America>Vila Nova": [
    { "top": "54.8%", "left": "60.0%" },
    { "top": "63.3%", "left": "49.7%" },
    { "top": "64.7%", "left": "48.1%" },
    { "top": "65.8%", "left": "49.4%" },
    { "top": "69.0%", "left": "53.0%" }
  ],
  "Vila Nova>Faculdade": [
    { "top": "69.3%", "left": "54.0%" },
    { "top": "66.3%", "left": "50.0%" },
    { "top": "64.5%", "left": "48.0%" },
    { "top": "62.5%", "left": "50.3%" },
    { "top": "48.1%", "left": "68.8%" }
  ],
  "Faculdade>Vila Nova": [
    { "top": "47.6%", "left": "69.1%" },
    { "top": "61.3%", "left": "52.0%" },
    { "top": "64.2%", "left": "48.7%" },
    { "top": "65.4%", "left": "48.6%" },
    { "top": "69.4%", "left": "53.3%" }
  ],
  "Jardim America>Faculdade": [
    { "top": "54.7%", "left": "60.2%" },
    { "top": "47.4%", "left": "69.5%" }
  ],
  "Faculdade>Jardim America": [
    { "top": "47.6%", "left": "69.4%" },
    { "top": "55.2%", "left": "60.2%" }
  ]
};


const MOVE_MS_PER_UNIT = 115;
const MOVE_MIN_MS = 260;
const MOVE_MAX_MS = 1500;
const VAN_HEADING_OFFSET_DEG = -10;
const VAN_VISUAL_TILT_SCALE = 0.76;
const VAN_ANCHOR_X_PCT = 50;
const VAN_ANCHOR_Y_PCT = 50;
const VAN_FORWARD_OFFSET_PCT = 0;
const VAN_SIDE_OFFSET_PCT = 0;
const VAN_CURVE_STEP = 1.25;
const STOP_WAIT_MS = 900;
const PICKUP_WAIT_MS = 1200; // tempo de parada ao recolher um aluno (ms)
const PICKUP_RADIUS = 1.2;   // distância em percentuais para considerar "perto o suficiente"

let audioCtx = null;
let engineLoop = null;
const EFFECT_GAIN_MULTIPLIER = 1.9;
const MAX_EFFECT_GAIN = 0.16;
const ENGINE_MASTER_GAIN = 0.07;

const FUEL_PER_UNIT = 0.35; // reduz consumo para dar mais tempo ao jogador
const SLEEP_PER_UNIT = 0.55;
const HARD_MODE_INITIAL_FUEL = 72; // aumenta reserva no modo desafio
const HARD_MODE_INITIAL_SLEEP = 22;
const HARD_MODE_FUEL_MULTIPLIER = 2.1;
const HARD_MODE_SLEEP_MULTIPLIER = 2.0;
const ROUTE_TOOL_FUEL_MULTIPLIER = 0.42;
const ROUTE_TOOL_SLEEP_MULTIPLIER = 0.38;

let fuelCurrent = 100;
let sleepMeter = 0;

let selectedRoute = [];
let gameRunning = false;
let gameInitialized = false;
let routeToolEnabled = false;
let manualDrawMode = false;
let manualRouteNodes = [];
let _routeDrawSvg = null;

// Inicializamos apos as funcoes utilitarias estarem prontas
let LEG_WAYPOINTS = {};

function initGlobalWaypoints() {
  LEG_WAYPOINTS = cloneWaypointMap(DEFAULT_LEG_WAYPOINTS);
}

const ROUTE_WAYPOINTS_KEY = 'rota-waypoints-overrides-v1';
const routeEditorState = {
  enabled: false,
  editMode: 'lines',
  activeLeg: 'Garagem>Centro',
  draggingIndex: -1,
  textarea: null,
  statusEl: null,
  legSelect: null,
  mouseToggle: null,
  modeSelect: null,
  panelEl: null
};


function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function percentNumber(value) {
  return Number(String(value).replace('%', ''));
}

function normalizePercent(value) {
  const num = Number(String(value).replace('%', '').trim());
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, num));
}



function sanitizeWaypointMap(candidate) {
  const out = cloneWaypointMap(DEFAULT_LEG_WAYPOINTS);
  Object.keys(DEFAULT_LEG_WAYPOINTS).forEach(function (legKey) {
    const points = candidate && Array.isArray(candidate[legKey]) ? candidate[legKey] : null;
    if (!points || !points.length) return;
    const sanitized = points.map(function (point) {
      if (!point || typeof point !== 'object') return null;
      const top = normalizePercent(point.top);
      const left = normalizePercent(point.left);
      if (top === null || left === null) return null;
      return { top: top.toFixed(1) + '%', left: left.toFixed(1) + '%' };
    }).filter(Boolean);
    if (sanitized.length) out[legKey] = sanitized;
  });
  return out;
}

function loadWaypointsOverrides() {
  try {
    const raw = window.localStorage.getItem(ROUTE_WAYPOINTS_KEY);
    if (!raw) { LEG_WAYPOINTS = cloneWaypointMap(DEFAULT_LEG_WAYPOINTS); return; }
    const parsed = JSON.parse(raw);
    LEG_WAYPOINTS = sanitizeWaypointMap(parsed);
  } catch (err) { LEG_WAYPOINTS = cloneWaypointMap(DEFAULT_LEG_WAYPOINTS); }
}

function persistWaypointsOverrides() {
  window.localStorage.setItem(ROUTE_WAYPOINTS_KEY, JSON.stringify(LEG_WAYPOINTS));
}

function resetWaypointsOverrides() {
  LEG_WAYPOINTS = cloneWaypointMap(DEFAULT_LEG_WAYPOINTS);
  window.localStorage.removeItem(ROUTE_WAYPOINTS_KEY);
}

function setEditorStatus(text) {
  if (routeEditorState.statusEl) routeEditorState.statusEl.textContent = text;
}

function syncEditorTextarea() {
  if (routeEditorState.textarea) routeEditorState.textarea.value = JSON.stringify(LEG_WAYPOINTS, null, 2);
}

function getWaypointEditorLayer() {
  const map = document.getElementById('game-map');
  if (!map) return null;
  let layer = document.getElementById('waypoint-editor-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'waypoint-editor-layer';
    map.appendChild(layer);
  }
  return layer;
}

function updateWaypointFromPointer(clientX, clientY) {
  const map = document.getElementById('game-map');
  const points = LEG_WAYPOINTS[routeEditorState.activeLeg];
  const idx = routeEditorState.draggingIndex;
  if (!map || !points || idx < 0 || idx >= points.length) return;
  const rect = map.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const leftPct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  const topPct = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
  points[idx] = { top: topPct.toFixed(1) + '%', left: leftPct.toFixed(1) + '%' };
  ensureStreetSegments();
  renderWaypointHandles();
  syncEditorTextarea();
}

function renderWaypointHandles() {
  const layer = getWaypointEditorLayer();
  if (!layer) return;
  layer.innerHTML = '';
  if (!routeEditorState.enabled) return;
  const points = LEG_WAYPOINTS[routeEditorState.activeLeg] || [];
  points.forEach(function (point, index) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = routeEditorState.editMode === 'lines' ? 'line-endpoint-handle' : 'waypoint-handle';
    handle.style.top = point.top;
    handle.style.left = point.left;
    handle.textContent = String(index + 1);
    handle.addEventListener('pointerdown', function (event) {
      if (gameRunning) return;
      event.preventDefault();
      routeEditorState.draggingIndex = index;
      updateWaypointFromPointer(event.clientX, event.clientY);
    });
    layer.appendChild(handle);
  });
}

function updateMouseEditorMode() {
  const map = document.getElementById('game-map');
  const canEdit = routeEditorState.panelEl && routeEditorState.panelEl.open && routeEditorState.mouseToggle && routeEditorState.mouseToggle.checked;
  routeEditorState.enabled = !!canEdit;
  if (!routeEditorState.enabled) routeEditorState.draggingIndex = -1;
  if (map) map.classList.toggle('is-editing-lines', routeEditorState.enabled && routeEditorState.editMode === 'lines');
  renderWaypointHandles();
}
function buildWaypointsEditorPanel() {
  if (!ENABLE_WAYPOINT_EDITOR) return;
  const controls = document.getElementById('game-controls');
  if (!controls || document.getElementById('route-waypoints-editor')) return;
  const panel = document.createElement('details');
  panel.id = 'route-waypoints-editor';
  panel.className = 'route-editor';
  panel.innerHTML = [
    '<summary class="route-editor-summary">Ajustar rotas da van (waypoints)</summary>',
    '<p class="route-editor-help">Arraste os pontos numerados no mapa ou edite o JSON abaixo para alinhar a van na pista. Clique em Aplicar para salvar.</p>',
    '<div class="route-editor-row"><label class="route-editor-field">Trecho</label><select id="route-waypoints-leg" class="route-editor-select"></select></div>',
    '<div class="route-editor-row"><label class="route-editor-field">Modos</label><select id="route-waypoints-mode" class="route-editor-select"><option value="lines" selected>Mover pontas da linha</option><option value="points">Mover pontos intermediários</option></select></div>',
    '<label class="route-editor-mouse-toggle"><input id="route-waypoints-mouse" type="checkbox" checked> Ativar edição com mouse</label>',
    '<textarea id="route-waypoints-json" class="route-editor-textarea" spellcheck="false"></textarea>',
    '<div class="route-editor-actions">',
    '<button class="button button-app" id="route-waypoints-apply" type="button">Aplicar ajustes e salvar</button>',
    '<button class="button button-ghost" id="route-waypoints-reset" type="button">Resetar padrão</button>',
    '</div>',
    '<p id="route-waypoints-status" class="route-editor-status"></p>'
  ].join('');
  controls.insertAdjacentElement('afterend', panel);
  const textarea = document.getElementById('route-waypoints-json');
  const legSelect = document.getElementById('route-waypoints-leg');
  Object.keys(DEFAULT_LEG_WAYPOINTS).forEach(function (legKey) {
    const opt = document.createElement('option'); opt.value = legKey; opt.textContent = legKey;
    legSelect.appendChild(opt);
  });
  routeEditorState.textarea = textarea;
  routeEditorState.legSelect = legSelect;
  routeEditorState.modeSelect = document.getElementById('route-waypoints-mode');
  routeEditorState.mouseToggle = document.getElementById('route-waypoints-mouse');
  routeEditorState.statusEl = document.getElementById('route-waypoints-status');
  routeEditorState.panelEl = panel;
  legSelect.addEventListener('change', function () { routeEditorState.activeLeg = legSelect.value; renderWaypointHandles(); });
  routeEditorState.modeSelect.addEventListener('change', function () { routeEditorState.editMode = routeEditorState.modeSelect.value; updateMouseEditorMode(); });
  routeEditorState.mouseToggle.addEventListener('change', updateMouseEditorMode);
  document.getElementById('route-waypoints-apply').addEventListener('click', function () {
    try {
      LEG_WAYPOINTS = sanitizeWaypointMap(JSON.parse(textarea.value));
      persistWaypointsOverrides(); ensureStreetSegments(); resetGame();
      routeEditorState.statusEl.textContent = 'Ajustes aplicados e salvos com sucesso.';
    } catch (e) { routeEditorState.statusEl.textContent = 'JSON inválido!'; }
  });
  document.getElementById('route-waypoints-reset').addEventListener('click', function () {
    resetWaypointsOverrides(); ensureStreetSegments(); resetGame();
    textarea.value = JSON.stringify(LEG_WAYPOINTS, null, 2);
    routeEditorState.statusEl.textContent = 'Padrao restaurado.';
  });
  window.addEventListener('pointermove', function (e) { if (routeEditorState.draggingIndex >= 0) updateWaypointFromPointer(e.clientX, e.clientY); });
  window.addEventListener('pointerup', function () { if (routeEditorState.draggingIndex >= 0) { routeEditorState.draggingIndex = -1; persistWaypointsOverrides(); } });
  syncEditorTextarea();
  updateMouseEditorMode();
}

function vanAngle(fromPos, toPos) {
  const dx = percentNumber(toPos.left) - percentNumber(fromPos.left);
  const dy = percentNumber(toPos.top) - percentNumber(fromPos.top);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function normalizeAngleDelta(target, current) {
  return ((target - current + 540) % 360) - 180;
}

function normalizeAngle(angle) {
  return ((angle + 540) % 360) - 180;
}

function uprightHeading(rawAngle) {
  const normalized = normalizeAngle(rawAngle);
  if (normalized > 90) return { angle: normalized - 180, flip: -1 };
  if (normalized < -90) return { angle: normalized + 180, flip: -1 };
  return { angle: normalized, flip: 1 };
}

function stepDurationMs(fromPos, toPos, sleepRatio) {
  const dist = pointDistance(fromPos, toPos);
  const sr = (sleepRatio !== undefined) ? Math.min(1, sleepRatio) : 0;
  const sleepMult = 1 + sr * 3;
  return Math.max(MOVE_MIN_MS, Math.min(MOVE_MAX_MS * 5, Math.round(dist * MOVE_MS_PER_UNIT * sleepMult)));
}

function percentPoint(topValue, leftValue) {
  return { top: topValue.toFixed(1) + '%', left: leftValue.toFixed(1) + '%' };
}

function buildVanTransform(angle, flip) {
  return 'translate(-' + VAN_ANCHOR_X_PCT + '%, -' + VAN_ANCHOR_Y_PCT + '%) rotate(' + angle + 'deg) scaleX(' + flip + ')';
}

function offsetVanPosition(pos, rawAngle) {
  const radians = rawAngle * Math.PI / 180;
  const dx = Math.cos(radians) * VAN_FORWARD_OFFSET_PCT - Math.sin(radians) * VAN_SIDE_OFFSET_PCT;
  const dy = Math.sin(radians) * VAN_FORWARD_OFFSET_PCT + Math.cos(radians) * VAN_SIDE_OFFSET_PCT;
  return percentPoint(percentNumber(pos.top) + dy, percentNumber(pos.left) + dx);
}
function bestOrderForPoints(stops) {
  if (stops.length === 0) return { order: [], distance: 0 };
  const permutations = [];
  function backtrack(curr, remaining) {
    if (remaining.length === 0) { permutations.push(curr); return; }
    for (let i = 0; i < remaining.length; i++) {
      backtrack(curr.concat([remaining[i]]), remaining.slice(0, i).concat(remaining.slice(i + 1)));
    }
  }
  backtrack([], stops);
  let best = permutations[0];
  let minD = routeDistanceForOrder(best);
  for (let i = 1; i < permutations.length; i++) {
    let d = routeDistanceForOrder(permutations[i]);
    if (d < minD) { minD = d; best = permutations[i]; }
  }
  return { order: best, distance: minD };
}

function bestOrderForSelection(selection) {
  return bestOrderForPoints(selection);
}

function applyOptimalRoute() {
  if (gameRunning) return;

  // Ordem pedida pelo usuário: Bruno -> André -> Carlos -> Diego
  // Mapeando para os nomes técnicos dos pontos:
  // Bruno: Paulo Grande
  // André: Centro
  // Carlos: Vila Nova
  // Diego: Jardim America
  selectedRoute = ['Paulo Grande', 'Centro', 'Vila Nova', 'Jardim America'];

  // Ativa a ferramenta Rota (destacar em verde) e atualizar visual dos botões no mapa
  routeToolEnabled = true;
  const rotaBtn = document.getElementById('btn-rota-otima');
  if (rotaBtn) rotaBtn.textContent = 'Ferramenta Rota (ativa)';

  // Atualizar visual dos botões no mapa
  document.querySelectorAll('.stop-btn').forEach(function (btn) {
    const stop = btn.dataset.stop;
    if (selectedRoute.indexOf(stop) >= 0) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  updatePointOrderBadges();
  updateRouteDisplay();
  playSelectSound();
  setGameFeedback('Ferramenta Rota: Menor trajeto configurado (Bruno > André > Carlos > Diego).', 'good');
}

function densifySegment(fromPos, toPos, maxStepDist) {
  const fromTop = percentNumber(fromPos.top);
  const fromLeft = percentNumber(fromPos.left);
  const toTop = percentNumber(toPos.top);
  const toLeft = percentNumber(toPos.left);
  const dist = pointDistance(fromPos, toPos);
  if (dist < 0.01) return [];
  const parts = Math.max(1, Math.ceil(dist / Math.max(0.2, maxStepDist || VAN_CURVE_STEP)));
  const points = [];

  for (let step = 1; step <= parts; step++) {
    const t = step / parts;
    points.push(percentPoint(
      fromTop + (toTop - fromTop) * t,
      fromLeft + (toLeft - fromLeft) * t
    ));
  }

  return points;
}

function densifyWaypoints(startPos, waypoints, maxStepDist) {
  const dense = [];
  let previous = startPos;

  for (let i = 0; i < waypoints.length; i++) {
    const next = waypoints[i];
    dense.push.apply(dense, densifySegment(previous, next, maxStepDist));
    previous = next;
  }

  return dense;
}

function setVanPose(van, fromPos, toPos, durationMs) {
  const rawAngle = vanAngle(fromPos, toPos);
  const currentAngle = Number(van.dataset.angle || '0');
  const currentFlip = Number(van.dataset.flip || '1');
  const heading = uprightHeading(rawAngle + VAN_HEADING_OFFSET_DEG);
  var legFlipOverride = van.dataset.legFlip ? Number(van.dataset.legFlip) : null;
  if (legFlipOverride !== null && heading.flip !== legFlipOverride) {
    heading.flip = legFlipOverride;
    heading.angle = Math.max(-50, Math.min(50, normalizeAngle(rawAngle + VAN_HEADING_OFFSET_DEG)));
  }
  const visualTargetAngle = heading.angle * VAN_VISUAL_TILT_SCALE;
  const flipChanging = heading.flip !== currentFlip;
  const smoothAngle = flipChanging
    ? visualTargetAngle
    : currentAngle + normalizeAngleDelta(visualTargetAngle, currentAngle);
  const adjustedPosition = offsetVanPosition(toPos, smoothAngle);
  van.style.top = adjustedPosition.top;
  van.style.left = adjustedPosition.left;
  van.dataset.angle = String(smoothAngle);
  van.dataset.flip = String(heading.flip);

  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    const travelMs = Math.max(120, durationMs);
    const turnMs = flipChanging ? 0 : Math.max(140, Math.min(420, Math.round(travelMs * 0.72)));
    van.style.transition = 'top ' + travelMs + 'ms linear, left ' + travelMs + 'ms linear, transform ' + turnMs + 'ms ease-out';
  }

  van.style.transform = buildVanTransform(smoothAngle, heading.flip);
}

function getLegKey(from, to) {
  return from + '>' + to;
}

function setStreetState(className, from, to) {
  const key = getLegKey(from, to);
  const streets = LEG_STREETS[key] || [];
  streets.forEach(function (streetId) {
    document.querySelectorAll('.street-seg[data-street-id="' + streetId + '"]').forEach(function (seg) {
      seg.classList.add(className);
    });
  });
}

function setStreetSegmentGeometry(segmentElement, fromPos, toPos) {
  const fromTop = percentNumber(fromPos.top);
  const fromLeft = percentNumber(fromPos.left);
  const toTop = percentNumber(toPos.top);
  const toLeft = percentNumber(toPos.left);
  const dx = toLeft - fromLeft;
  const dy = toTop - fromTop;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.15) return false;

  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  segmentElement.style.left = fromLeft.toFixed(2) + '%';
  segmentElement.style.top = fromTop.toFixed(2) + '%';
  segmentElement.style.width = dist.toFixed(2) + '%';
  segmentElement.style.transform = 'rotate(' + angle.toFixed(2) + 'deg)';
  return true;
}

function ensureStreetSegments() {
  const layer = document.getElementById('street-layer');
  if (!layer) return;

  layer.innerHTML = '';

  const uniqueStreetIds = Array.from(new Set(
    Object.keys(LEG_STREETS).reduce(function (acc, legKey) {
      return acc.concat(LEG_STREETS[legKey]);
    }, [])
  ));

  uniqueStreetIds.forEach(function (streetId) {
    const representativeLeg = Object.keys(LEG_STREETS).find(function (legKey) {
      return (LEG_STREETS[legKey] || []).indexOf(streetId) >= 0;
    });
    if (!representativeLeg) return;

    const parts = representativeLeg.split('>');
    const from = parts[0];
    const to = parts[1];
    const fromPos = STOP_POSITIONS[from];
    const toPos = STOP_POSITIONS[to];
    if (!fromPos || !toPos) return;

    const waypoints = (LEG_WAYPOINTS[representativeLeg] || []).slice();
    const points = [fromPos].concat(waypoints);
    const lastPoint = points[points.length - 1];
    if (!lastPoint || pointDistance(lastPoint, toPos) > 0.1) {
      points.push(toPos);
    }

    for (let i = 1; i < points.length; i++) {
      const seg = document.createElement('div');
      seg.className = 'street-seg';
      seg.dataset.streetId = streetId;
      seg.dataset.legKey = representativeLeg;
      seg.dataset.segmentIndex = String(i - 1);
      if (setStreetSegmentGeometry(seg, points[i - 1], points[i])) {
        layer.appendChild(seg);
      }
    }
  });
}

function pointDistance(fromPos, toPos) {
  const dx = percentNumber(toPos.left) - percentNumber(fromPos.left);
  const dy = percentNumber(toPos.top) - percentNumber(fromPos.top);
  return Math.hypot(dx, dy);
}

function legDistance(from, to) {
  const key = getLegKey(from, to);
  const waypoints = LEG_WAYPOINTS[key] || [STOP_POSITIONS[to]];
  let prevPos = STOP_POSITIONS[from];
  let total = 0;

  for (let i = 0; i < waypoints.length; i++) {
    total += pointDistance(prevPos, waypoints[i]);
    prevPos = waypoints[i];
  }

  return total;
}

function shortestPath(start, end, avoid) {
  if (start === end) return [start];

  const nodes = Object.keys(ROAD_GRAPH);
  const distances = {};
  const previous = {};
  const queue = nodes.slice();

  nodes.forEach(function (node) {
    distances[node] = Number.POSITIVE_INFINITY;
    previous[node] = null;
  });
  distances[start] = 0;

  while (queue.length) {
    queue.sort(function (a, b) { return distances[a] - distances[b]; });
    const current = queue.shift();
    if (!Number.isFinite(distances[current])) break;
    if (current === end) break;

    (ROAD_GRAPH[current] || []).forEach(function (neighbor) {
      if (avoid && neighbor !== end && avoid.has(neighbor)) return;
      const alt = distances[current] + legDistance(current, neighbor);
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = current;
      }
    });
  }

  if (!Number.isFinite(distances[end])) return shortestPath(start, end);

  const path = [];
  let step = end;
  while (step) {
    path.unshift(step);
    step = previous[step];
  }
  return path;
}

function shortestDistance(start, end) {
  const nodes = shortestPath(start, end);
  let total = 0;
  for (let i = 1; i < nodes.length; i++) {
    total += legDistance(nodes[i - 1], nodes[i]);
  }
  return total;
}

function expandRouteNodes(order) {
  const route = ['Garagem'];
  let current = 'Garagem';
  const doneStops = new Set();

  for (let i = 0; i < order.length; i++) {
    const part = shortestPath(current, order[i], doneStops);
    route.push.apply(route, part.slice(1));
    current = order[i];
    doneStops.add(current);
  }

  if (order.length) {
    const toFaculty = shortestPath(current, 'Faculdade', doneStops);
    route.push.apply(route, toFaculty.slice(1));
  }

  return route;
}

function permutations(items) {
  if (items.length <= 1) return [items.slice()];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    const restPerms = permutations(rest);
    for (let j = 0; j < restPerms.length; j++) {
      out.push([items[i]].concat(restPerms[j]));
    }
  }
  return out;
}

function routeDistanceForOrder(order) {
  if (!order.length) return 0;
  let total = 0;
  let current = 'Garagem';

  for (let i = 0; i < order.length; i++) {
    total += shortestDistance(current, order[i]);
    current = order[i];
  }

  total += shortestDistance(current, 'Faculdade');
  return total;
}

function updatePointOrderBadges() {
  // Posições fixas dos nomes dos alunos (fornecidas pelo usuário)
  const fixedTagPositions = {
    'Centro': { left: '-12px', top: '-59px' },
    'Paulo Grande': { left: '-15px', top: '-52px' },
    'Vila Nova': { left: '-28px', top: '25px' },
    'Jardim America': { left: '-5px', top: '26px' }
  };

  // Limpa badges antigos
  document.querySelectorAll('.student-tag-top .order-badge').forEach(function (b) { b.remove(); });

  document.querySelectorAll('.student-tag-top').forEach(function (tag) {
    tag.style.cursor = 'grab';
    const btn = tag.closest('.map-point');
    if (!btn) return;
    const stop = btn.dataset.stop;
    // Aplica posição fixa
    if (fixedTagPositions[stop]) {
      tag.style.left = fixedTagPositions[stop].left;
      tag.style.top = fixedTagPositions[stop].top;
    } else {
      tag.style.left = '';
      tag.style.top = '';
    }
    // Desabilita arrasto manual (apenas visual)
    tag.onmousedown = null;
    tag.ondragstart = function () { return false; };

    // Badge de ordem
    const idx = selectedRoute.indexOf(stop);
    if (idx >= 0) {
      let badge = document.createElement('span');
      badge.className = 'order-badge';
      badge.textContent = (idx + 1);
      badge.style.cssText = 'display:inline-block;margin-left:0.5em;background:#22c55e;color:#fff;font-size:0.95em;font-weight:800;padding:0.1em 0.5em;border-radius:8px;vertical-align:middle;';
      tag.appendChild(badge);
    }
  });

  // Permite voltar ao modo manual ao clicar em Limpar rota
  const btnReset = document.getElementById('btn-reset-route');
  if (btnReset) {
    btnReset.onclick = function () {
      resetGame();
      // Reabilita escolha manual
      routeToolEnabled = false;
      document.querySelectorAll('.map-point').forEach(function (btn) {
        btn.disabled = false;
        btn.style.pointerEvents = '';
      });
      updateRouteDisplay();
    };
  }
}

async function replayOptimalRoute() {
  const overlayEl = document.getElementById('game-overlay');
  if (overlayEl) overlayEl.hidden = true;
  resetGame();
  await sleep(120);
  applyOptimalRoute();
  await sleep(520);
  startRoute();
}

/**
 * Redesenha a rota verde (SVG) usando porcentagens para garantir responsividade no mobile.
 */
function _redrawRouteSvg() {
  const svg = _getOrCreateRouteSvg();
  if (!svg) return;
  svg.innerHTML = '';

  const nodes = expandRouteNodes(selectedRoute);
  let allWaypoints = [];
  let current = nodes[0];
  allWaypoints.push(STOP_POSITIONS[current]);

  for (let i = 1; i < nodes.length; i++) {
    const next = nodes[i];
    const legKey = getLegKey(current, next);
    const waypoints = LEG_WAYPOINTS[legKey] || [STOP_POSITIONS[next]];
    allWaypoints = allWaypoints.concat(waypoints);
    current = next;
  }

  if (allWaypoints.length < 2) return;

  const ptsStr = allWaypoints.map(function (p) {
    return percentNumber(p.left) + ',' + percentNumber(p.top);
  }).join(' ');

  const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  pl.setAttribute('points', ptsStr);
  pl.setAttribute('fill', 'none');
  pl.setAttribute('stroke', '#22c55e');
  pl.setAttribute('stroke-width', '0.8'); // Fino em coordenadas 0-100
  pl.setAttribute('stroke-linecap', 'round');
  pl.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(pl);

  // Bolinhas nos pontos principais
  allWaypoints.forEach(function (p, i) {
    const isFirst = i === 0;
    const isLast = i === allWaypoints.length - 1;
    // se for um ponto de parada (Stop)
    const isStop = Object.values(STOP_POSITIONS).some(function (sp) { return sp.top === p.top && sp.left === p.left; });

    if (isStop || isFirst || isLast) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', percentNumber(p.left));
      circle.setAttribute('cy', percentNumber(p.top));
      circle.setAttribute('r', isFirst ? '1.2' : '0.8');
      circle.setAttribute('fill', isFirst ? '#facc15' : '#22c55e');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '0.2');
      svg.appendChild(circle);
    }
  });
}

function _getOrCreateRouteSvg() {
  const map = document.getElementById('game-map');
  if (!map) return null;
  let svg = document.getElementById('route-draw-canvas');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'route-draw-canvas';
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;pointer-events:none;overflow:visible';
    map.appendChild(svg);
  }
  return svg;
}

function drawRouteManually(nodes) {
  document.querySelectorAll('.street-seg').forEach(function (seg) {
    seg.classList.remove('manual-route');
  });

  _redrawRouteSvg();

  // Ocultamos as linhas grossas da van (street-seg) e deixamos apenas a linha SVG fina
  // Para fins de feedback visual no editor, os segmentos ainda existem, mas não são pintados aqui.
}



function ensureAudio() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(fromFreq, toFreq, duration, type, volume) {
  const ac = ensureAudio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const baseVolume = typeof volume === 'number' ? volume : 0.045;
  const targetGain = Math.min(MAX_EFFECT_GAIN, baseVolume * EFFECT_GAIN_MULTIPLIER);
  osc.type = type || 'triangle';
  osc.frequency.setValueAtTime(fromFreq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq), ac.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(targetGain, ac.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.04);
}

function playSelectSound() { playTone(420, 520, 0.09, 'triangle', 0.035); }
function playDepartSound() {
  playTone(80, 160, 0.18, 'sawtooth', 0.06);
  playTone(120, 220, 0.28, 'sawtooth', 0.04);
  playTone(55, 90, 0.35, 'sawtooth', 0.035);
}
function playBrakeSound() {
  playTone(340, 120, 0.18, 'sawtooth', 0.04);
  playTone(200, 60, 0.22, 'triangle', 0.025);
}
function playPickupSound() {
  playBrakeSound();
  const ac = ensureAudio();
  if (!ac) return;
  setTimeout(function () {
    playTone(520, 740, 0.10, 'triangle', 0.045);
    playTone(660, 880, 0.12, 'triangle', 0.03);
  }, 220);
}
function playWinSound() {
  playTone(330, 440, 0.12, 'triangle', 0.05);
  playTone(440, 550, 0.12, 'triangle', 0.05);
  playTone(550, 660, 0.14, 'triangle', 0.055);
  playTone(660, 880, 0.22, 'triangle', 0.06);
  const ac = ensureAudio();
  if (!ac) return;
  setTimeout(function () { playTone(880, 1100, 0.3, 'triangle', 0.055); }, 420);
}
function playLoseSound() {
  playTone(280, 200, 0.18, 'sawtooth', 0.055);
  playTone(200, 140, 0.22, 'sawtooth', 0.05);
  playTone(140, 80, 0.35, 'sawtooth', 0.06);
  const ac = ensureAudio();
  if (!ac) return;
  setTimeout(function () { playTone(90, 55, 0.5, 'sawtooth', 0.04); }, 480);
}
function playFuelOutSound() {
  playTone(180, 90, 0.18, 'sawtooth', 0.06);
  playTone(90, 55, 0.28, 'sawtooth', 0.05);
  const ac = ensureAudio();
  if (!ac) return;
  setTimeout(function () { playTone(65, 40, 0.6, 'sawtooth', 0.035); }, 320);
}
function playSleepCrashSound() {
  playTone(220, 110, 0.14, 'sawtooth', 0.07);
  playTone(110, 60, 0.3, 'sawtooth', 0.06);
  const ac = ensureAudio();
  if (!ac) return;
  setTimeout(function () { playTone(60, 40, 0.55, 'sawtooth', 0.04); }, 380);
}
function playArrivalSound() { playTone(420, 760, 0.18, 'triangle', 0.05); }

function startEngineLoop() {
  const ac = ensureAudio();
  if (!ac || engineLoop) return;

  const master = ac.createGain();
  const filter = ac.createBiquadFilter();
  const lowOsc = ac.createOscillator();
  const highOsc = ac.createOscillator();
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(340, ac.currentTime);
  filter.Q.value = 0.8;

  lowOsc.type = 'sawtooth';
  lowOsc.frequency.setValueAtTime(52, ac.currentTime);

  highOsc.type = 'triangle';
  highOsc.frequency.setValueAtTime(104, ac.currentTime);

  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5.4, ac.currentTime);
  lfoGain.gain.setValueAtTime(5.5, ac.currentTime);

  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.exponentialRampToValueAtTime(ENGINE_MASTER_GAIN, ac.currentTime + 0.16);

  lfo.connect(lfoGain);
  lfoGain.connect(lowOsc.frequency);
  lowOsc.connect(filter);
  highOsc.connect(filter);
  filter.connect(master);
  master.connect(ac.destination);

  lowOsc.start();
  highOsc.start();
  lfo.start();

  engineLoop = {
    ac: ac,
    master: master,
    lowOsc: lowOsc,
    highOsc: highOsc,
    lfo: lfo
  };
}

function stopEngineLoop() {
  if (!engineLoop) return;

  const stopAt = engineLoop.ac.currentTime + 0.18;
  engineLoop.master.gain.cancelScheduledValues(engineLoop.ac.currentTime);
  engineLoop.master.gain.setValueAtTime(Math.max(0.0001, engineLoop.master.gain.value || ENGINE_MASTER_GAIN), engineLoop.ac.currentTime);
  engineLoop.master.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  engineLoop.lowOsc.stop(stopAt + 0.02);
  engineLoop.highOsc.stop(stopAt + 0.02);
  engineLoop.lfo.stop(stopAt + 0.02);
  engineLoop = null;
}

function setFacultyArrived(arrived) {
  const faculty = document.getElementById('pt-faculdade');
  if (!faculty) return;
  faculty.classList.toggle('arrived', !!arrived);
}

function setGameFeedback(text, tone) {
  const feedback = document.getElementById('game-feedback');
  if (!feedback) return;
  feedback.textContent = text;
  feedback.classList.remove('is-good', 'is-bad');
  if (tone === 'good') feedback.classList.add('is-good');
  if (tone === 'bad') feedback.classList.add('is-bad');
}

function formatRouteLabel(order, includeFaculty) {
  const names = order.map(function (stop) { return STUDENT_NAMES[stop]; });
  if (includeFaculty) names.push('Faculdade');
  return names.join(' -> ');
}

function updateRouteDisplay() {
  const display = document.getElementById('route-display');
  const btnPartir = document.getElementById('btn-partir');
  if (!display || !btnPartir) return;
  display.textContent = selectedRoute.length
    ? 'Ordem: ' + selectedRoute.map(function (stop, i) { return (i + 1) + '. ' + STUDENT_NAMES[stop]; }).join(' -> ') + ' -> Faculdade'
    : 'Clique nos alunos para marcar a ordem de busca.';
  btnPartir.disabled = selectedRoute.length < REQUIRED_STOPS;

  // Sempre desenha a linha da rota real (grafo), mas só destaca em verde se a ferramenta estiver ativada
  const svg = _getOrCreateRouteSvg();
  if (svg) {
    svg.innerHTML = '';
    if (selectedRoute.length > 0) {
      const nodes = expandRouteNodes(selectedRoute);
      let allWaypoints = [];
      let current = nodes[0];
      allWaypoints.push(STOP_POSITIONS[current]);
      for (let i = 1; i < nodes.length; i++) {
        const next = nodes[i];
        const legKey = getLegKey(current, next);
        const waypoints = LEG_WAYPOINTS[legKey] || [STOP_POSITIONS[next]];
        allWaypoints = allWaypoints.concat(waypoints);
        current = next;
      }
      if (allWaypoints.length >= 2) {
        const ptsStr = allWaypoints.map(function (p) {
          return percentNumber(p.left) + ',' + percentNumber(p.top);
        }).join(' ');
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', ptsStr);
        pl.setAttribute('fill', 'none');
        pl.setAttribute('stroke', routeToolEnabled ? '#22c55e' : '#888');
        pl.setAttribute('stroke-width', routeToolEnabled ? '0.8' : '0.5');
        pl.setAttribute('stroke-linecap', 'round');
        pl.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(pl);
        // Bolinhas nos pontos principais
        allWaypoints.forEach(function (p, i) {
          const isFirst = i === 0;
          const isLast = i === allWaypoints.length - 1;
          const isStop = Object.values(STOP_POSITIONS).some(function (sp) { return sp.top === p.top && sp.left === p.left; });
          if (isStop || isFirst || isLast) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', percentNumber(p.left));
            circle.setAttribute('cy', percentNumber(p.top));
            circle.setAttribute('r', isFirst ? '1.2' : '0.8');
            circle.setAttribute('fill', isFirst ? '#facc15' : (routeToolEnabled ? '#22c55e' : '#888'));
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '0.2');
            svg.appendChild(circle);
          }
        });
      }
    }
  }

  if (!gameRunning) {
    if (selectedRoute.length === 0) {
      setGameFeedback('Marque os ' + REQUIRED_STOPS + ' alunos no mapa na ordem desejada. Clique novamente em um nome para desmarcar.', '');
    } else if (selectedRoute.length < REQUIRED_STOPS) {
      setGameFeedback('Marcado ' + selectedRoute.length + ' de ' + REQUIRED_STOPS + '. Clique novamente em um nome para desmarcar, se precisar.', '');
    } else {
      setGameFeedback('Ordem definida: ' + selectedRoute.map(function (s, i) { return (i + 1) + '.' + STUDENT_NAMES[s]; }).join(' ') + '. Clique em Partir!', 'good');
    }
  }
}

function isNearStop(position, stopName) {
  const stopPosition = STOP_POSITIONS[stopName];
  if (!stopPosition) return false;
  return pointDistance(position, stopPosition) <= PICKUP_RADIUS;
}

async function collectStudent(stopName, collectedStops) {
  const btn = document.querySelector('[data-stop="' + stopName + '"]');
  const studentName = STUDENT_NAMES[stopName] || stopName;
  if (!btn || collectedStops.has(stopName)) return;

  setGameFeedback('Parada em ' + stopName + ': ' + studentName + ' embarcou na van.', '');
  btn.classList.add('is-boarding');
  btn.classList.remove('selected');
  btn.classList.add('collected');
  btn.style.pointerEvents = 'none';
  collectedStops.add(stopName);
  playPickupSound();
  // Parada mais longa: alinhar a van exatamente ao ponto e pausar
  const van = document.getElementById('van-icon');
  if (van) {
    const oldTransition = van.style.transition;
    try {
      const finalTarget = STOP_POSITIONS[stopName];
      // Força alinhamento exato
      van.style.transition = 'none';
      if (finalTarget) {
        van.style.top = finalTarget.top;
        van.style.left = finalTarget.left;
      }
      const angle = Number(van.dataset.angle || 0);
      const flip = Number(van.dataset.flip || 1);
      // Aplica efeito de escala preservando o translateX(-50%) do transform
      van.style.transition = 'transform 260ms ease';
      van.style.transform = buildVanTransform(angle, flip) + ' scale(1.14)';
      await sleep(PICKUP_WAIT_MS);
      van.style.transform = buildVanTransform(angle, flip);
      van.style.transition = oldTransition || '';
    } catch (e) {
      van.style.transition = oldTransition;
    }
  }
  await sleep(180);
  window.setTimeout(function () {
    btn.classList.remove('is-boarding');
  }, 180);
}

async function tryCollectStudentsAtPosition(position, collectedStops) {
  const nextStop = selectedRoute.find(function (stopName) {
    return !collectedStops.has(stopName);
  });

  if (nextStop && isNearStop(position, nextStop)) {
    await collectStudent(nextStop, collectedStops);
  }
}

function syncStopPositionsToDom() {
  const elementByStop = {
    'Centro': 'pt-centro',
    'Paulo Grande': 'pt-paulo',
    'Vila Nova': 'pt-vila',
    'Jardim America': 'pt-jardim',
    'Faculdade': 'pt-faculdade'
  };

  Object.keys(elementByStop).forEach(function (stopName) {
    const element = document.getElementById(elementByStop[stopName]);
    const position = STOP_POSITIONS[stopName];
    if (!element || !position) return;

    element.style.top = position.top;
    element.style.left = position.left;
  });
}

function resetGame() {
  selectedRoute = [];
  routeToolEnabled = false;
  gameRunning = false;
  manualDrawMode = false;

  // limpa SVG de desenho (esconde, mas nao apaga pontos salvos)
  var map = document.getElementById('game-map');
  if (map) {
    map.style.cursor = 'default';
  }
  if (_routeDrawSvg) { _routeDrawSvg.style.display = 'none'; }

  const van = document.getElementById('van-icon');
  const resetBtn = document.getElementById('btn-reset-route');
  stopEngineLoop();
  syncStopPositionsToDom();
  setFacultyArrived(false);
  if (van) {
    van.style.transition = 'none';
    van.style.top = STOP_POSITIONS['Garagem'].top;
    van.style.left = STOP_POSITIONS['Garagem'].left;
    van.dataset.angle = '0';
    van.dataset.flip = '1';
    van.style.transform = buildVanTransform(0, 1);
  }
  if (map) map.classList.remove('is-driving');
  const overlay = document.getElementById('game-overlay');
  if (overlay) { overlay.hidden = true; overlay.innerHTML = ''; overlay.className = 'game-overlay'; }
  if (resetBtn) resetBtn.disabled = false;
  document.querySelectorAll('.map-point').forEach(function (btn) {
    btn.classList.remove('selected', 'collected');
    btn.classList.remove('is-boarding');
    btn.classList.remove('ordered');
    btn.style.transform = '';
    btn.removeAttribute('data-order');
    btn.disabled = false;
    btn.style.pointerEvents = '';
  });

  const svg = document.getElementById('route-draw-canvas');
  if (svg) svg.innerHTML = '';

  document.querySelectorAll('.street-seg').forEach(function (seg) {
    seg.classList.remove('selected', 'traversed', 'manual-route');
  });
  const btn = document.getElementById('btn-rota-otima');
  if (btn) btn.textContent = 'Usar Ferramenta Rota';
  setGameFeedback('Selecione quais alunos vao embarcar e em qual ordem. Depois clique em Partir.', '');
  updateRouteDisplay();
  // Garante a limpeza total das classes e badges
  document.querySelectorAll('.map-point').forEach(function (b) {
    b.classList.remove('selected', 'collected', 'ordered', 'is-boarding');
  });
  updatePointOrderBadges();

  // CORREÇÃO: Restaura a interatividade dos nomes dos alunos
  document.querySelectorAll('.student-tag-top').forEach(function (tag) {
    tag.style.pointerEvents = 'auto';
    tag.style.cursor = 'grab';
  });

  // Mostra a ferramenta Rota apenas se foi desbloqueada (após uma falha ou rota ruim)
  const btnRota = document.getElementById('btn-rota-otima');
  if (btnRota) {
    btnRota.style.display = routeToolUnlocked ? 'inline-flex' : 'none';
  }

  try { enableStudentTagDrag(); } catch (e) { }
}

async function startRoute() {
  if (gameRunning || selectedRoute.length < 1) return;
  gameRunning = true;
  const routeAssistActive = routeToolEnabled;
  const fuelPerUnit = FUEL_PER_UNIT * (routeAssistActive ? ROUTE_TOOL_FUEL_MULTIPLIER : HARD_MODE_FUEL_MULTIPLIER);
  const sleepPerUnit = SLEEP_PER_UNIT * (routeAssistActive ? ROUTE_TOOL_SLEEP_MULTIPLIER : HARD_MODE_SLEEP_MULTIPLIER);

  fuelCurrent = routeAssistActive ? 100 : HARD_MODE_INITIAL_FUEL;
  sleepMeter = routeAssistActive ? 0 : HARD_MODE_INITIAL_SLEEP;

  const van = document.getElementById('van-icon');
  const map = document.getElementById('game-map');
  const hud = document.getElementById('game-hud');
  const hudFuelBar = document.getElementById('hud-fuel-bar');
  const hudFuelVal = document.getElementById('hud-fuel-val');
  const hudSleepBar = document.getElementById('hud-sleep-bar');
  const hudSleepVal = document.getElementById('hud-sleep-val');
  const expandedNodes = expandRouteNodes(selectedRoute);
  const collectedStops = new Set();
  let prev = expandedNodes[0];
  let prevPos = STOP_POSITIONS[prev];
  let routeAborted = null;

  function updateHud() {
    var fuel = Math.max(0, Math.round(fuelCurrent));
    var slp = Math.min(100, Math.round(sleepMeter));
    hudFuelBar.style.width = fuel + '%';
    hudFuelVal.textContent = fuel + '%';
    hudSleepBar.style.width = slp + '%';
    hudSleepVal.textContent = slp + '%';
    hudFuelBar.classList.toggle('hud-fuel-low', fuelCurrent < 25);
    hudSleepBar.classList.toggle('hud-sleep-high', sleepMeter > 75);
  }

  document.querySelectorAll('.map-point').forEach(function (b) { b.disabled = true; });
  document.getElementById('btn-partir').disabled = true;
  document.getElementById('btn-reset-route').disabled = true;

  // Desativa interacoes nos nomes dos alunos enquanto a van estiver em rota
  try {
    document.querySelectorAll('.student-tag-top').forEach(function (tag) {
      if (!tag) return;
      // salva handlers para possivel restauracao
      try { tag._onmousedown_backup = tag.onmousedown; } catch (e) { }
      try { tag._ondragstart_backup = tag.ondragstart; } catch (e) { }
      tag.style.pointerEvents = 'none';
      tag.style.cursor = 'default';
      tag.onmousedown = null;
      tag.ondragstart = function () { return false; };
    });
  } catch (e) { }

  if (hud) { hud.hidden = false; updateHud(); }
  map.classList.add('is-driving');
  setGameFeedback(
    routeAssistActive
      ? 'Ferramenta Rota guiando em linha verde: trajeto otimizado para menor cansaco e menor consumo.'
      : 'Modo desafio: sem ajuda da ferramenta Rota, a chance de erro e de perda de combustivel e cansaco e maior.',
    routeAssistActive ? 'good' : 'bad'
  );
  playDepartSound();
  startEngineLoop();
  await sleep(180);

  for (let i = 1; i < expandedNodes.length && !routeAborted; i++) {
    const stop = expandedNodes[i];
    const legKey = getLegKey(prev, stop);
    const rawWaypoints = LEG_WAYPOINTS[legKey] || [STOP_POSITIONS[stop]];
    setStreetState('traversed', prev, stop);

    for (let r = 0; r < rawWaypoints.length && !routeAborted; r++) {
      const segEnd = rawWaypoints[r];
      van.dataset.legFlip = String(uprightHeading(vanAngle(prevPos, segEnd) + VAN_HEADING_OFFSET_DEG).flip);
      const waypoints = densifySegment(prevPos, segEnd, VAN_CURVE_STEP);

      for (let step = 0; step < waypoints.length && !routeAborted; step++) {
        const pos = waypoints[step];
        const stepDist = pointDistance(prevPos, pos);
        // Penalidade de sono: quanto mais cansado, mais combustível gasta (até 50% de aumento)
        const sleepFuelPenalty = 1 + (sleepMeter / 100) * 0.5;
        fuelCurrent -= fuelPerUnit * stepDist * sleepFuelPenalty;
        sleepMeter = Math.min(100, sleepMeter + sleepPerUnit * stepDist);
        updateHud();

        if (fuelCurrent <= 0) {
          routeAborted = 'fuel';
          break;
        }

        const travelMs = stepDurationMs(prevPos, pos, sleepMeter / 100);
        setVanPose(van, prevPos, pos, travelMs);
        await sleep(travelMs);
        prevPos = pos;
        await tryCollectStudentsAtPosition(pos, collectedStops);
      }
    }

    if (routeAborted) break;

    // Garante que a van finalize o trecho exatamente na posicao do ponto (evita parar antes)
    try {
      const finalTarget = STOP_POSITIONS[stop];
      if (finalTarget && pointDistance(prevPos, finalTarget) > 0.01) {
        const travelMsFinal = stepDurationMs(prevPos, finalTarget, sleepMeter / 100);
        van.dataset.legFlip = String(uprightHeading(vanAngle(prevPos, finalTarget) + VAN_HEADING_OFFSET_DEG).flip);
        setVanPose(van, prevPos, finalTarget, travelMsFinal);
        await sleep(travelMsFinal);
        prevPos = finalTarget;
      }
    } catch (e) { }

    await tryCollectStudentsAtPosition(STOP_POSITIONS[stop], collectedStops);

    if (stop === 'Faculdade') {
      setFacultyArrived(true);
      playArrivalSound();
      setGameFeedback('Chegada na Faculdade. Conferindo combustivel, sono e eficiencia da rota.', 'good');
      await sleep(STOP_WAIT_MS);
    }

    prev = stop;
  }

  stopEngineLoop();
  const hud2 = document.getElementById('game-hud');
  if (hud2) hud2.hidden = true;

  if (routeAborted === 'fuel') {
    playFuelOutSound();
    await sleep(200);
  }

  showGameResult(routeAborted);
}

function showGameResult(forceLoss) {
  const overlay = document.getElementById('game-overlay');
  const chosenOrder = selectedRoute.slice();
  const chosenDistance = routeDistanceForOrder(chosenOrder);
  const best = bestOrderForSelection(chosenOrder);
  const delta = chosenDistance - best.distance;
  const routeCost = (chosenDistance / 10).toFixed(1);
  const bestCost = (best.distance / 10).toFixed(1);
  const fuelFinal = Math.max(0, Math.round(fuelCurrent));
  const sleepFinal = Math.min(100, Math.round(sleepMeter));
  const routeLabel = formatRouteLabel(chosenOrder, false);
  const bestLabel = formatRouteLabel(best.order, false);

  const aborted = forceLoss === 'fuel' || forceLoss === 'sleep';
  const won = !aborted && delta <= 0.4;

  // Desbloqueia a ferramenta Rota se o jogador não conseguiu a rota perfeita
  if (!won) {
    routeToolUnlocked = true;
  }

  const showRouteToolCta = !won && !aborted;
  const wonWithTool = won && routeToolEnabled;

  overlay.className = 'game-overlay ' + (won ? 'overlay-win' : 'overlay-loss');
  overlay.hidden = false;

  var icon, title, subtitle, desc;
  if (forceLoss === 'fuel') {
    const isVeryTired = sleepFinal > 80;
    icon = isVeryTired ? '🥱' : '⛽';
    title = isVeryTired ? 'Exaustão extrema!' : 'Combustivel acabou!';
    subtitle = isVeryTired
      ? 'O cansaco excessivo tornou a viagem lenta e o diesel acabou antes da hora!'
      : 'A van parou no meio da rota. Fabio nao chegou a Faculdade.';
    desc = 'A ordem escolhida consumiu combustivel demais. Melhor ordem: ' + bestLabel + '.';
  } else if (won) {
    icon = 'OK';
    title = 'Rota otimizada!';
    subtitle = 'Fabio pegou todos os alunos e chegou bem na Faculdade.';
    desc = 'Voce escolheu a menor rota possivel para os alunos selecionados.';
  } else {
    icon = '!';
    title = 'Rota ineficiente';
    subtitle = 'Fabio chegou, mas poderia ter ido mais rapido por outra ordem.';
    desc = 'Sua ordem: ' + routeLabel + '. Melhor ordem: ' + bestLabel + '.';
  }

  overlay.innerHTML = [
    '<div class="overlay-card">',
    '<div class="overlay-icon">' + icon + '</div>',
    '<p class="overlay-title">' + title + '</p>',
    '<p class="overlay-subtitle">' + subtitle + '</p>',
    '<p class="overlay-desc">' + desc + '</p>',
    '<p class="overlay-meta">',
    'Distancia: <strong>' + routeCost + ' km</strong> &nbsp;|&nbsp; ',
    'Melhor: <strong>' + bestCost + ' km</strong> &nbsp;|&nbsp; ',
    'Combustivel: <strong>' + fuelFinal + '%</strong> &nbsp;|&nbsp; ',
    'Sono: <strong>' + sleepFinal + '%</strong>',
    '</p>',
    showRouteToolCta ? '<p class="overlay-product-tip overlay-product-tip-cta"><strong>Quer melhorar?</strong> A ferramenta <strong>Rota</strong> calcula a ordem ideal automaticamente: clique para ver o trajeto mais rapido e eficiente.</p>' : '',
    showRouteToolCta ? '<button class="button button-app" id="btn-ver-ideal" type="button">Ver Melhor Rota com Rota</button>' : '',
    wonWithTool ? '<div class="overlay-pitch">' : '',
    wonWithTool ? '<p class="overlay-pitch-title">&#128640; Veja o que a <strong>Rota</strong> fez por voce</p>' : '',
    wonWithTool ? '<ul class="overlay-pitch-list">' : '',
    wonWithTool ? '<li>&#9989; Encurtou o trajeto, percorrendo apenas <strong>' + routeCost + ' km</strong></li>' : '',
    wonWithTool ? '<li>&#9989; Organizou a ordem de coleta de forma inteligente</li>' : '',
    wonWithTool ? '<li>&#9989; Economizou combustivel &mdash; sobraram <strong>' + fuelFinal + '%</strong></li>' : '',
    wonWithTool ? '<li>&#9989; Reduziu o cansaco do motorista com eficiencia e agilidade</li>' : '',
    wonWithTool ? '</ul>' : '',
    wonWithTool ? '<p class="overlay-pitch-cta-text">Imagine isso no dia a dia do transporte universitario: <strong>menos custo, mais seguranca e pontualidade</strong>.</p>' : '',
    wonWithTool ? '<a class="button button-app" href="contato.html">Entre em contato e contrate a Rota</a>' : '',
    wonWithTool ? '</div>' : '',
    '<button class="button button-main" id="btn-retry" type="button">Jogar novamente</button>',
    showRouteToolCta
      ? '<p class="overlay-product-tip">A ferramenta <strong>Rota</strong> calcula automaticamente quais alunos estao mais proximos, por qual endereco comecar, qual deixar por ultimo e o caminho mais rapido ate a faculdade.</p>'
      : (!wonWithTool ? '<p class="overlay-product-tip">O app <strong>Rota</strong> calcula automaticamente a ordem ideal de coleta e guia o motorista pelo menor caminho.</p>' : ''),
    '</div>'
  ].join('');

  if (won) playWinSound(); else playLoseSound();

  document.getElementById('btn-retry').addEventListener('click', resetGame);
  var btnVerIdeal = document.getElementById('btn-ver-ideal');
  if (btnVerIdeal) btnVerIdeal.addEventListener('click', replayOptimalRoute);
}

function updateRouteDisplay() {
  const display = document.getElementById('route-display');
  const btnPartir = document.getElementById('btn-partir');
  if (!display || !btnPartir) return;
  display.textContent = selectedRoute.length
    ? 'Ordem: ' + selectedRoute.map(function (stop, i) { return (i + 1) + '. ' + STUDENT_NAMES[stop]; }).join(' -> ') + ' -> Faculdade'
    : 'Clique nos alunos para marcar a ordem de busca.';
  btnPartir.disabled = selectedRoute.length < REQUIRED_STOPS;

  const svg = _getOrCreateRouteSvg();
  if (svg) {
    svg.innerHTML = '';
    if (selectedRoute.length > 0) {
      const nodes = expandRouteNodes(selectedRoute);
      let allWaypoints = [];
      let current = nodes[0];
      allWaypoints.push(STOP_POSITIONS[current]);
      for (let i = 1; i < nodes.length; i++) {
        const next = nodes[i];
        const legKey = getLegKey(current, next);
        const waypoints = LEG_WAYPOINTS[legKey] || [STOP_POSITIONS[next]];
        allWaypoints = allWaypoints.concat(waypoints);
        current = next;
      }
      if (allWaypoints.length >= 2) {
        const ptsStr = allWaypoints.map(function (p) {
          return percentNumber(p.left) + ',' + percentNumber(p.top);
        }).join(' ');
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', ptsStr);
        pl.setAttribute('fill', 'none');
        pl.setAttribute('stroke', routeToolEnabled ? '#22c55e' : '#888');
        pl.setAttribute('stroke-width', routeToolEnabled ? '0.8' : '0.5');
        pl.setAttribute('stroke-linecap', 'round');
        pl.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(pl);
        allWaypoints.forEach(function (p, i) {
          const isStop = Object.values(STOP_POSITIONS).some(function (sp) { return sp.top === p.top && sp.left === p.left; });
          if (isStop || i === 0 || i === allWaypoints.length - 1) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', percentNumber(p.left));
            circle.setAttribute('cy', percentNumber(p.top));
            circle.setAttribute('r', i === 0 ? '1.2' : '0.8');
            circle.setAttribute('fill', i === 0 ? '#facc15' : (routeToolEnabled ? '#22c55e' : '#888'));
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '0.2');
            svg.appendChild(circle);
          }
        });
      }
    }
  }

  if (!gameRunning) {
    if (selectedRoute.length === 0) {
      setGameFeedback('Marque os ' + REQUIRED_STOPS + ' alunos no mapa na ordem desejada.', '');
    } else if (selectedRoute.length < REQUIRED_STOPS) {
      setGameFeedback('Marcado ' + selectedRoute.length + ' de ' + REQUIRED_STOPS + '.', '');
    } else {
      setGameFeedback('Ordem definida! Clique em Partir.', 'good');
    }
  }
}

function initDomGame() {
  if (!document.getElementById('btn-partir')) return;
  if (gameInitialized) { resetGame(); return; }
  gameInitialized = true;

  ensureStreetSegments();
  if (ENABLE_WAYPOINT_EDITOR) buildWaypointsEditorPanel();

  resetGame();

  document.querySelectorAll('.map-point').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const stop = this.dataset.stop;
      if (gameRunning) return;
      routeToolEnabled = false;
      const stopIndex = selectedRoute.indexOf(stop);

      if (stopIndex >= 0) {
        selectedRoute.splice(stopIndex, 1);
        this.classList.remove('selected');
      } else {
        if (selectedRoute.length >= ALL_STOPS.length) return;
        selectedRoute.push(stop);
        this.classList.add('selected');
      }

      playSelectSound();
      updatePointOrderBadges();
      updateRouteDisplay();
    });
  });

  document.getElementById('btn-partir').addEventListener('click', startRoute);
  document.getElementById('btn-reset-route').addEventListener('click', resetGame);
  document.getElementById('btn-rota-otima').addEventListener('click', applyOptimalRoute);
}

// --- Removidas ferramentas temporarias de desenho --- 


// --- Inicializacao ---

function initializePage() {
  injectStaticData();
  // Atualiza o rótulo do botão de tema usando lookup dinâmico (mais resiliente)
  updateThemeButtonLabel();

  // Inicialização do estado de visibilidade baseado em locks salvos
  updatePreviewVisibility();

  // Ativa o arraste dos nomes dos alunos (inicialização centralizada)
  try { enableStudentTagDrag(); } catch (e) { }

  checkLaunchYear();
  initGlobalWaypoints();
  loadWaypointsOverrides();
  initDomGame();

  // Anexa listener ao botão de tema usando lookup dinâmico
  try {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  } catch (e) { }

  const ageGateButtonGlobal = document.getElementById('ageGateButton');
  if (ageGateButtonGlobal) ageGateButtonGlobal.addEventListener('click', validateAge);

  const cardAgeGateButton = document.getElementById('cardAgeGateButton');
  if (cardAgeGateButton) cardAgeGateButton.addEventListener('click', validateAge);

  const ageGateOverlay = document.getElementById('age-gate-overlay');
  if (ageGateOverlay) {
    ageGateOverlay.addEventListener('click', validateAge);
  }

  if (welcomeForm) welcomeForm.addEventListener("submit", showPersonalizedMessage);
}

initializePage();
// fim do arquivo
