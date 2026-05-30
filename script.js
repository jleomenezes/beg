"use strict";

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzGdGoyy0JbpiE8AKPYlUVDM6XIs-_L9FnebjFn1g5fxc9SGCrPDrYLkADdXPhfyC-7Bg/exec";
const PIX_KEY = "bargonsilva@gmail.com";
const WHATSAPP_NUMBER = "553799586252";
const COMPANION_PRICE = 70;
const MAX_NAMES = 40;
const MAX_NAME_LENGTH = 80;

const form = document.querySelector("#rsvpForm");
const template = document.querySelector("#nameRowTemplate");
const companionList = document.querySelector("[data-companion-list]");
const presenceFields = document.querySelector("[data-presence-fields]");
const companionSection = document.querySelector("[data-companion-section]");
const addCompanionButton = document.querySelector("[data-add-companion]");
const submitButton = document.querySelector("[data-submit]");
const formActions = document.querySelector("[data-form-actions]");
const message = document.querySelector("[data-form-message]");
const totalPeople = document.querySelector("[data-total-people]");
const totalCompanions = document.querySelector("[data-total-companions]");
const totalPrice = document.querySelector("[data-total-price]");
const whatsappLink = document.querySelector("[data-whatsapp]");
const paymentAction = document.querySelector("[data-payment-action]");
const successPanel = document.querySelector("[data-success]");
const successSummary = document.querySelector("[data-success-summary]");
const successWhatsapp = document.querySelector("[data-success-whatsapp]");

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function money(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `form-message${type ? ` is-${type}` : ""}`;
}

function createCompanionRow(value = "") {
  const node = template.content.firstElementChild.cloneNode(true);
  const input = node.querySelector("input");
  const label = node.querySelector("[data-label]");
  const remove = node.querySelector("[data-remove-name]");
  const index = companionList.children.length + 1;

  label.textContent = `Acompanhante ${index}`;
  input.name = "companionName";
  input.placeholder = "Nome do acompanhante";
  input.value = value;
  input.maxLength = MAX_NAME_LENGTH;

  remove.addEventListener("click", () => {
    node.remove();
    refreshLabels();
    updateSummary();
  });

  input.addEventListener("input", updateSummary);
  companionList.appendChild(node);
  return input;
}

function refreshLabels() {
  [...companionList.querySelectorAll("[data-label]")].forEach((label, index) => {
    label.textContent = `Acompanhante ${index + 1}`;
  });
}

function valuesFrom(list) {
  return [...list.querySelectorAll("input")]
    .map((input) => normalizeText(input.value))
    .filter(Boolean);
}

function getAttendance() {
  return form.elements.attendance.value;
}

function buildWhatsappUrl(payload) {
  const lines = [
    "Olá, Bárbara e Gabriel.",
    payload.respondente ? `Sou ${payload.respondente}.` : "Recebi o convite.",
    payload.status === "confirmado"
      ? `Confirmo presença de ${payload.total_pessoas} pessoa(s).`
      : "Não poderei comparecer.",
  ];

  if (payload.nomes_confirmados.length) {
    lines.push(`Confirmados: ${payload.nomes_confirmados.join(", ")}.`);
  }

  if (payload.acompanhantes.length) {
    lines.push(`Acompanhante(s): ${payload.acompanhantes.join(", ")}.`);
    lines.push(`Contribuição de acompanhantes: ${money(payload.valor_acompanhantes)}.`);
    lines.push(`Pix: ${PIX_KEY}. Segue o comprovante.`);
  }

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function getPayload() {
  const status = getAttendance();
  const respondent = normalizeText(form.elements.respondentName.value);
  const guestNames = status === "confirmado" && respondent ? [respondent] : [];
  const companionNames = status === "confirmado" ? valuesFrom(companionList) : [];
  const companionCount = companionNames.length;

  return {
    status,
    respondente: respondent || (status === "nao_irei" ? "Não informado" : ""),
    nomes_confirmados: guestNames,
    acompanhantes: companionNames,
    total_pessoas: guestNames.length + companionCount,
    total_acompanhantes: companionCount,
    valor_acompanhantes: companionCount * COMPANION_PRICE,
  };
}

function updateSummary() {
  const payload = getPayload();
  totalPeople.textContent = String(payload.total_pessoas);
  totalCompanions.textContent = String(payload.total_acompanhantes);
  totalPrice.textContent = money(payload.valor_acompanhantes);
  if (whatsappLink) {
    whatsappLink.href = buildWhatsappUrl(payload);
  }
  paymentAction.hidden = !(payload.status === "confirmado" && payload.total_acompanhantes > 0);
}

function updateVisibility() {
  const attendance = getAttendance();
  const attending = attendance === "confirmado";

  presenceFields.hidden = !attending;
  companionSection.hidden = !attending;
  formActions.hidden = !attendance;

  updateSummary();
}

function validatePayload(payload) {
  if (form.elements.website.value) {
    return "Não foi possível enviar a resposta.";
  }

  if (!payload.status) {
    return "Selecione uma resposta.";
  }

  if (payload.status === "confirmado" && !payload.respondente) {
    return "Informe o nome do convidado para identificarmos a resposta.";
  }

  if (payload.respondente && payload.respondente.length > MAX_NAME_LENGTH) {
    return "O nome do convidado está muito longo.";
  }

  const allNames = [...payload.nomes_confirmados, ...payload.acompanhantes];
  if (allNames.length > MAX_NAMES) {
    return `Informe no máximo ${MAX_NAMES} nomes por resposta.`;
  }

  if (allNames.some((name) => name.length > MAX_NAME_LENGTH)) {
    return "Há um nome acima do limite de caracteres.";
  }

  if (payload.status === "confirmado" && payload.nomes_confirmados.length === 0) {
    return "Informe o nome do convidado confirmado.";
  }

  return "";
}

async function sendPayload(payload) {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return { ok: true, demo: true };
  }

  const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Falha ao enviar confirmação.");
  }

  return data;
}

function showSuccess(payload, result) {
  const demoText = result.demo
    ? " O site está em modo de demonstração até configurar a URL do Google Apps Script."
    : "";
  const base =
    payload.status === "confirmado"
      ? `Recebemos ${payload.total_pessoas} pessoa(s) confirmada(s), incluindo ${payload.total_acompanhantes} acompanhante(s).`
      : "Recebemos sua resposta informando que você não poderá comparecer.";

  successSummary.textContent = `${base}${demoText}`;
  successWhatsapp.href = buildWhatsappUrl(payload);
  successPanel.hidden = false;
  form.hidden = true;
  successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

addCompanionButton.addEventListener("click", () => {
  createCompanionRow().focus();
  updateSummary();
});

form.addEventListener("change", (event) => {
  if (event.target.matches("input[type='radio']")) {
    updateVisibility();
  }
});

form.elements.respondentName.addEventListener("input", updateSummary);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = getPayload();
  const validationError = validatePayload(payload);

  if (validationError) {
    setMessage(validationError, "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  setMessage("Enviando sua confirmação com segurança.");

  try {
    const result = await sendPayload(payload);
    setMessage("Confirmação enviada.", "success");
    showSuccess(payload, result);
  } catch (error) {
    setMessage(
      "Não conseguimos enviar agora. Tente novamente ou envie sua resposta pelo WhatsApp.",
      "error",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar confirmação";
  }
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Pix copiado";
      window.setTimeout(() => {
        button.textContent = value;
      }, 1800);
    } catch {
      setMessage(`Pix: ${value}`, "success");
    }
  });
});

updateVisibility();
