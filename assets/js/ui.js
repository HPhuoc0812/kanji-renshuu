import { THEME_CACHE_KEY } from "./constants.js";
import { elements } from "./dom.js";

export function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
}

export function hideError() {
  elements.errorMessage.classList.add("hidden");
  elements.errorMessage.textContent = "";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  elements.themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  elements.themeToggleBtn.title = isDark ? "Tắt dark mode" : "Bật dark mode";
}

export function loadThemePreference() {
  const savedTheme = localStorage.getItem(THEME_CACHE_KEY);
  const fallbackTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(savedTheme || fallbackTheme);
}

export function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem(THEME_CACHE_KEY, nextTheme);
  applyTheme(nextTheme);
}

export function setActiveTab(panelId) {
  elements.tabPanels.forEach((panel) => {
    const isActive = panel.id === panelId;
    panel.classList.toggle("hidden", !isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === panelId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

export function setModeSelectValue(value) {
  const hasMode = elements.modeSegmentButtons.some(button => button.dataset.modeValue === value);

  if (!hasMode) {
    return;
  }

  elements.modeSelect.value = value;

  elements.modeSegmentButtons.forEach((button) => {
    const isSelected = button.dataset.modeValue === value;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

export function isTypingTarget(target) {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}
