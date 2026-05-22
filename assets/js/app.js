import { elements } from "./dom.js";
import {
  autoLoadDefaultUrl,
  getKanjiData,
  parseCsv,
  parseExcel,
  parseRemoteUrl,
  resetKanjiData
} from "./data.js";
import {
  confirmAnswer,
  getEnabledOptionButtons,
  hasSelectedChoice,
  moveSelectedOption,
  nextQuestion,
  resetQuizState,
  setMaxQuestionCount,
  startQuiz
} from "./quiz.js";
import {
  loadRadicalsData,
  renderRadicals
} from "./radicals.js";
import {
  hideError,
  isTypingTarget,
  loadThemePreference,
  setActiveTab,
  setModeSelectValue,
  showError,
  toggleTheme
} from "./ui.js";

function handleKeyboardShortcut(event) {
  if (elements.practicePanel.classList.contains("hidden")) {
    return;
  }

  if (event.target.closest(".app-tabs")) {
    return;
  }

  if (
    event.key === "Enter" &&
    elements.quizArea.classList.contains("hidden")
  ) {
    event.preventDefault();
    elements.startBtn.click();
    return;
  }

  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    elements.resetBtn.click();
    return;
  }

  if (event.key === "m" || event.key === "M") {
    event.preventDefault();
    setMaxQuestionCount();
    return;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    moveSelectedOption(event.key);
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  if (!elements.nextBtn.classList.contains("hidden")) {
    elements.nextBtn.click();
    return;
  }

  if (!elements.confirmBtn.classList.contains("hidden")) {
    if (!hasSelectedChoice()) {
      const firstOption = getEnabledOptionButtons()[0];
      firstOption?.click();
    }

    elements.confirmBtn.click();
  }
}

function bindEvents() {
  elements.fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      parseCsv(file);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      parseExcel(file);
    } else {
      showError("Chỉ hỗ trợ file Excel (.xlsx, .xls) và CSV.");
    }
  });

  elements.importBtn.addEventListener("click", () => {
    const url = elements.urlInput.value.trim();

    if (!url) {
      showError("Vui lòng nhập URL của file Excel hoặc CSV.");
      return;
    }

    parseRemoteUrl(url);
  });

  elements.maxQuestionBtn.addEventListener("click", setMaxQuestionCount);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.radicalsSearchInput.addEventListener("input", renderRadicals);
  elements.radicalsStrokeFilter.addEventListener("change", renderRadicals);

  elements.modeSegmentButtons.forEach((button) => {
    button.addEventListener("click", () => setModeSelectValue(button.dataset.modeValue));
  });

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  });

  elements.startBtn.addEventListener("click", () => {
    if (!getKanjiData().length) {
      elements.fileInfo.textContent = "Đang dùng dữ liệu mẫu. Bạn có thể tải file Excel/CSV để dùng dữ liệu của riêng mình.";
    }

    startQuiz();
  });

  elements.confirmBtn.addEventListener("click", confirmAnswer);
  document.addEventListener("keydown", handleKeyboardShortcut);

  elements.nextBtn.addEventListener("click", nextQuestion);

  elements.resetBtn.addEventListener("click", () => {
    elements.quizArea.classList.add("hidden");
    resetKanjiData();
    resetQuizState();
    elements.fileInfo.textContent = "Đã đặt lại. Đang tải dữ liệu từ URL...";
    hideError();
    autoLoadDefaultUrl();
  });

  window.addEventListener("online", autoLoadDefaultUrl);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // PWA vẫn chạy bình thường nếu trình duyệt không cho đăng ký service worker.
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadThemePreference();
  setModeSelectValue(elements.modeSelect.value);
  setActiveTab("practicePanel");
  autoLoadDefaultUrl();
  loadRadicalsData();
});

registerServiceWorker();
