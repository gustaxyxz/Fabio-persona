const SITE_NAME = "Rota";
const PERSONA_NAME = "Fábio Alves";
const GAME_NAME = "Rota";
const GAME_RELEASE_YEAR = 2026;
const GAME_FOCUS = "encontrar a menor rota para levar ou buscar alunos dos seus endereços até a faculdade";
const PREVIEW_LEVEL = "conceitual";
const AGE_LIMIT = 16;
const LOCKED_PREVIEW_CARDS = [
  {
    title: "Endereços",
    description: "Disponível após validar a idade."
  },
  {
    title: "Destino",
    description: "Conteúdo liberado apenas para usuários autorizados."
  },
  {
    title: "Objetivo",
    description: "Valide a idade para ver a prévia completa."
  }
];
const UNLOCKED_PREVIEW_CARDS = [
  {
    title: "Endereços",
    description: "Centro e Paulo Grande"
  },
  {
    title: "Destino",
    description: "Faculdade"
  },
  {
    title: "Objetivo",
    description: "Menor distância total"
  }
];

const previewGrid = document.getElementById("previewGrid");
const ageGateStatus = document.getElementById("ageGateStatus");
const themeToggle = document.getElementById("themeToggle");
const ageGateButton = document.getElementById("ageGateButton");
const welcomeForm = document.getElementById("welcomeForm");
const visitorNameInput = document.getElementById("visitorName");
const welcomeMessage = document.getElementById("welcomeMessage");

function injectStaticData() {
  document.getElementById("personaName").textContent = PERSONA_NAME;
  document.getElementById("gameName").textContent = GAME_NAME;
  document.getElementById("gameReleaseYear").textContent = String(GAME_RELEASE_YEAR);
  document.getElementById("gameFocus").textContent = GAME_FOCUS;
  document.getElementById("siteNameFooter").textContent = SITE_NAME;
}

function updateThemeButtonLabel() {
  const isDarkTheme = document.body.dataset.theme === "dark";
  themeToggle.textContent = isDarkTheme ? "Tema claro" : "Tema escuro";
  themeToggle.setAttribute("aria-label", isDarkTheme ? "Ativar tema claro" : "Ativar tema escuro");
  themeToggle.setAttribute("aria-pressed", isDarkTheme ? "true" : "false");
}

function toggleTheme() {
  document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  updateThemeButtonLabel();
}

function buildPreviewCards(cards) {
  return cards.map(function(card) {
    return '<article class="preview-card"><h3>' + card.title + '</h3><p>' + card.description + '</p></article>';
  }).join("");
}

function updatePreviewVisibility(hasAccess) {
  previewGrid.innerHTML = buildPreviewCards(hasAccess ? UNLOCKED_PREVIEW_CARDS : LOCKED_PREVIEW_CARDS);
  previewGrid.setAttribute("data-preview-state", hasAccess ? "unlocked" : "locked");

  ageGateStatus.textContent = hasAccess
    ? "Previa liberada. Conteudo sensivel visivel."
    : "Previa bloqueada ate validar a idade.";
}

function validateAge() {
  const rawAge = prompt("Digite sua idade para liberar a previa do mini game:");

  if (rawAge === null) {
    alert("Acesso negado ao conteudo sensivel: idade nao informada.");
    updatePreviewVisibility(false);
    return;
  }

  const age = Number(rawAge);

  if (!Number.isFinite(age)) {
    alert("Acesso negado ao conteudo sensivel: informe uma idade valida.");
    updatePreviewVisibility(false);
    return;
  }

  if (age >= AGE_LIMIT) {
    alert("Acesso liberado ao conteudo sensivel do mini game.");
    updatePreviewVisibility(true);
  } else {
    alert("Acesso negado ao conteudo sensivel do mini game.");
    updatePreviewVisibility(false);
  }
}

function showPersonalizedMessage(event) {
  event.preventDefault();
  const visitorName = visitorNameInput.value.trim();

  if (!visitorName) {
    welcomeMessage.textContent = "Digite seu nome para aparecer a mensagem.";
    return;
  }

  welcomeMessage.textContent = "Oi, " + visitorName + ". O sistema Rota ajuda o Fábio a encontrar o menor caminho para buscar ou levar os alunos até a faculdade.";
}

function checkLaunchYear() {
  const currentYear = new Date().getFullYear();
  const launchAlertKey = "grande-lancamento-2026-ja-visto";

  if (currentYear === GAME_RELEASE_YEAR) {
    const hasSeenLaunchAlert = window.localStorage.getItem(launchAlertKey) === "1";

    if (!hasSeenLaunchAlert) {
      alert("Grande Lançamento: " + GAME_NAME + " — protótipo em nível " + PREVIEW_LEVEL + ".");
      window.localStorage.setItem(launchAlertKey, "1");
    }
  }
}

function initializePage() {
  injectStaticData();
  updateThemeButtonLabel();
  updatePreviewVisibility(false);
  checkLaunchYear();

  themeToggle.addEventListener("click", toggleTheme);
  ageGateButton.addEventListener("click", validateAge);
  welcomeForm.addEventListener("submit", showPersonalizedMessage);
}

initializePage();
