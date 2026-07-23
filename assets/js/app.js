import { elements } from "./dom.js";
import {
  autoLoadDefaultUrl,
  getKanjiData,
  parseCsv,
  parseExcel,
  parseRemoteUrl,
  resetKanjiData,
  saveUrlToStorage,
  loadUrlFromStorage
} from "./data.js";
import {
  confirmAnswer,
  getEnabledOptionButtons,
  hasSelectedChoice,
  moveSelectedOption,
  nextQuestion,
  refreshQuestionTimer,
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
  toggleTheme,
  init3DBanner
} from "./ui.js";
import {
  initWhiteboard,
  toggleWhiteboard,
  undo as whiteboardUndo
} from "./whiteboard.js";
import {
  openDictionary,
  closeDictionary,
  handleDictSearchInput,
  handleDictSearchSubmit,
  clearDictSearch
} from "./dictionary.js";

function handleKeyboardShortcut(event) {
  // Ctrl+Z for whiteboard undo (works globally when whiteboard is visible)
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    const panel = elements.whiteboardPanel;

    if (panel && !panel.classList.contains("hidden")) {
      event.preventDefault();
      whiteboardUndo();
      return;
    }
  }

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

  // W to toggle whiteboard
  if ((event.key === "w" || event.key === "W") && !elements.quizArea.classList.contains("hidden")) {
    event.preventDefault();
    toggleWhiteboard();
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

  elements.importBtn.addEventListener("click", async () => {
    const url = elements.urlInput.value.trim();

    console.log("Import button clicked, URL:", url);

    if (!url) {
      showError("Vui lòng nhập URL của file Excel hoặc CSV.");
      return;
    }

    console.log("Starting parseRemoteUrl with URL:", url);
    saveUrlToStorage(url);
    await parseRemoteUrl(url);
    console.log("parseRemoteUrl completed");
  });

  elements.maxQuestionBtn.addEventListener("click", setMaxQuestionCount);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.radicalsSearchInput.addEventListener("input", renderRadicals);
  elements.radicalsStrokeFilter.addEventListener("change", renderRadicals);

  elements.modeSegmentButtons.forEach((button) => {
    button.addEventListener("click", () => setModeSelectValue(button.dataset.modeValue));
  });

  elements.hardModeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      elements.timeLimitContainer.classList.remove("hidden");
    } else {
      elements.timeLimitContainer.classList.add("hidden");
    }
    
    if (elements.quizArea.classList.contains("hidden")) {
      refreshQuestionTimer();
    }
  });

  elements.timeLimitInput.addEventListener("input", () => {
    if (elements.quizArea.classList.contains("hidden")) {
      refreshQuestionTimer();
    }
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

  elements.closeResultsBtn?.addEventListener("click", () => {
    elements.quizResultsModal?.close?.();
    elements.quizResultsModal?.classList.add("hidden");
  });

  elements.resetBtn.addEventListener("click", () => {
    elements.quizArea.classList.add("hidden");
    resetKanjiData();
    resetQuizState();
    elements.fileInfo.textContent = "Đã đặt lại. Đang tải dữ liệu từ URL...";
    hideError();
    autoLoadDefaultUrl();
  });

  window.addEventListener("online", autoLoadDefaultUrl);

  // Dictionary events
  elements.dictTabBtn?.addEventListener("click", () => {
    openDictionary(); // Opens empty state
  });

  elements.dictSearchInput?.addEventListener("input", handleDictSearchInput);

  elements.dictSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleDictSearchSubmit();
    }
  });

  elements.dictClearSearchBtn?.addEventListener("click", clearDictSearch);

  elements.dictCloseBtn?.addEventListener("click", closeDictionary);

  // Close dictionary when clicking outside the modal content
  elements.kanjiDictModal?.addEventListener("click", (e) => {
    if (e.target === elements.kanjiDictModal) {
      closeDictionary();
    }
  });

  // Allow clicking Kanji in quiz option buttons to open dictionary
  elements.optionsContainer?.addEventListener("dblclick", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const text = btn.textContent.trim();
    // Check if the text contains a Kanji character (CJK Unified Ideographs range)
    const kanjiMatch = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/)
    if (kanjiMatch) {
      e.preventDefault();
      e.stopPropagation();
      openDictionary(kanjiMatch[0]);
    }
  });
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
  
  if (elements.hardModeToggle.checked) {
    elements.timeLimitContainer.classList.remove("hidden");
  }
  
  // Restore URL from storage if available
  const savedUrl = loadUrlFromStorage();
  if (savedUrl && !elements.urlInput.value.includes(savedUrl)) {
    elements.urlInput.value = savedUrl;
  }
  
  setActiveTab("practicePanel");
  autoLoadDefaultUrl();
  loadRadicalsData();
  initWhiteboard();
  init3DBanner();
});

registerServiceWorker();
