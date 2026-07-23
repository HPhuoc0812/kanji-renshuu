import { MAX_OPTION_COUNT, MAX_QUESTION_COUNT } from "./constants.js";
import { elements } from "./dom.js";
import {
  getFilteredSourceData,
  getSourceData
} from "./data.js";
import { hideError, setActiveTab, showError } from "./ui.js";
import { normalizeReading, shuffle } from "./utils.js";
import { getSimilarKanjis } from "./similar-kanji.js";

let quizItems = [];
let currentIndex = 0;
let score = 0;
let selectedChoice = null;
let selectedButton = null;
let quizHardModeEnabled = false;
let quizNightmareModeEnabled = false;
let quizTimeLimitSeconds = null;
let currentStreak = 0;
let maxStreak = 0;

export function resetQuizState() {
  quizItems = [];
  currentIndex = 0;
  score = 0;
  selectedChoice = null;
  selectedButton = null;
  quizHardModeEnabled = false;
  quizTimeLimitSeconds = null;
  currentStreak = 0;
  maxStreak = 0;
  stopQuestionTimer();
  resetTimerDisplay();
}

export function refreshQuestionTimer() {
  const isQuizActive = currentIndex < quizItems.length && !elements.quizArea.classList.contains("hidden");

  if (isQuizActive) {
    return;
  }

  resetTimerDisplay();
}

let questionTimerId = null;
let questionTimerEnd = 0;
const TIMER_STEP_MS = 100;
const DEFAULT_TIME_LIMIT_SECONDS = 12;
const MIN_TIME_LIMIT_SECONDS = 3;

function getActiveTimeLimit() {
  const value = Number(elements.timeLimitInput?.value);
  return Number.isFinite(value) && value >= MIN_TIME_LIMIT_SECONDS ? Math.round(value) : null;
}

function resetTimerDisplay() {
  if (!elements.timerRow) {
    return;
  }

  elements.timerRow.classList.add("hidden");
  elements.timerFill.style.width = "0%";
  elements.timerFill.classList.remove("timer-warning");
  elements.timerText.textContent = `0s`;
}

function updateScoreDisplay() {
  if (!elements.scoreInfo) {
    return;
  }

  let text = `Điểm hiện tại: ${score}`;
  let classesToAdd = [];
  
  if (currentIndex >= quizItems.length) {
    text = `Điểm của bạn: ${score} / ${quizItems.length}`;
  } else if (currentStreak >= 5) {
    text = `<span class="fire-icon">🔥</span> Điểm hiện tại: ${score}`;
    if (currentStreak >= 15) {
      classesToAdd.push("streak-blazing");
    } else if (currentStreak >= 10) {
      classesToAdd.push("streak-hot");
    } else {
      classesToAdd.push("streak-warm");
    }
  }

  elements.scoreInfo.innerHTML = text;
  elements.scoreInfo.classList.remove("streak-warm", "streak-hot", "streak-blazing");
  if (classesToAdd.length > 0) {
    elements.scoreInfo.classList.add(...classesToAdd);
  }
}

function stopQuestionTimer() {
  if (questionTimerId !== null) {
    window.clearInterval(questionTimerId);
    questionTimerId = null;
  }
}

function startQuestionTimer() {
  if (!quizHardModeEnabled || !elements.timerRow) {
    resetTimerDisplay();
    return;
  }

  if (quizTimeLimitSeconds === null) {
    resetTimerDisplay();
    return;
  }

  stopQuestionTimer();
  questionTimerEnd = Date.now() + quizTimeLimitSeconds * 1000;

  elements.timerRow.classList.remove("hidden");
  elements.timerText.textContent = `${quizTimeLimitSeconds}s`;
  elements.timerFill.style.width = "100%";
  elements.timerFill.classList.remove("timer-warning");

  questionTimerId = window.setInterval(() => {
    const remainingMs = Math.max(0, questionTimerEnd - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const percentage = Math.max(0, (remainingMs / (quizTimeLimitSeconds * 1000)) * 100);

    elements.timerText.textContent = `${remainingSeconds}s`;
    elements.timerFill.style.width = `${percentage}%`;
    elements.timerFill.classList.toggle("timer-warning", percentage <= 25);

    if (remainingMs <= 0) {
      handleTimeExpired();
    }
  }, TIMER_STEP_MS);
}

function handleTimeExpired() {
  stopQuestionTimer();
  if (!quizItems[currentIndex]) {
    return;
  }

  currentStreak = 0;

  selectedChoice = null;
  if (selectedButton) {
    selectedButton.classList.remove("selected");
    selectedButton = null;
  }

  Array.from(elements.optionsContainer.children).forEach((option) => {
    option.disabled = true;
    const matchesCorrect = elements.modeSelect.value === "reading-to-kanji"
      ? option.textContent === quizItems[currentIndex].kanji
      : normalizeReading(option.textContent) === normalizeReading(quizItems[currentIndex].reading);

    if (matchesCorrect) {
      option.classList.add("correct");
    }
  });

  updateScoreDisplay();
  elements.confirmBtn.classList.add("hidden");
  elements.nextBtn.classList.remove("hidden");
  showError("Hết giờ! Đáp án đúng đã hiển thị.");
}

function getFilteredSourceFromInputs() {
  return getFilteredSourceData(
    elements.lessonFromInput.value,
    elements.lessonToInput.value
  );
}

export function setMaxQuestionCount() {
  const { data, error } = getFilteredSourceFromInputs();

  if (error) {
    showError(error);
    return false;
  }

  if (data.length === 0) {
    showError("Không tìm thấy mục nào phù hợp với phạm vi bài đã chọn.");
    return false;
  }

  elements.questionCountInput.value = Math.min(data.length, MAX_QUESTION_COUNT);
  hideError();
  return true;
}

function buildChoices(item, source, mode) {
  const currentReading = normalizeReading(item.reading);
  const choices = [item];
  const usedDisplayValues = new Set([
    mode === "reading-to-kanji" ? item.kanji : normalizeReading(item.reading)
  ]);

  const candidates = source.filter((candidate) => {
    const sameKanjiAndReading = candidate.kanji === item.kanji && candidate.reading === item.reading;
    const sameReading = normalizeReading(candidate.reading) === currentReading;

    if (sameKanjiAndReading || sameReading) {
      return false;
    }

    const displayValue = mode === "reading-to-kanji"
      ? candidate.kanji
      : normalizeReading(candidate.reading);

    return !usedDisplayValues.has(displayValue);
  });

  // If Nightmare mode is enabled, sort candidates to prioritize visually similar kanji
  if (quizNightmareModeEnabled) {
    const similarKanjiList = getSimilarKanjis(item.kanji);
    candidates.sort((a, b) => {
      const aIsSimilar = similarKanjiList.includes(a.kanji) ? 1 : 0;
      const bIsSimilar = similarKanjiList.includes(b.kanji) ? 1 : 0;
      // Also prioritize slightly by random to shuffle the similar ones
      if (aIsSimilar === bIsSimilar) return Math.random() - 0.5;
      return bIsSimilar - aIsSimilar;
    });
  } else {
    shuffle(candidates);
  }

  for (const candidate of candidates) {
    const displayValue = mode === "reading-to-kanji"
      ? candidate.kanji
      : normalizeReading(candidate.reading);

    if (!usedDisplayValues.has(displayValue)) {
      choices.push(candidate);
      usedDisplayValues.add(displayValue);
    }

    if (choices.length >= MAX_OPTION_COUNT) {
      break;
    }
  }

  return choices;
}

function buildQuiz() {
  const total = Math.min(Math.max(1, Number(elements.questionCountInput.value)), MAX_QUESTION_COUNT);
  const { data: filtered, error } = getFilteredSourceFromInputs();

  if (error) {
    showError(error);
    return false;
  }

  if (filtered.length === 0) {
    showError("Không tìm thấy mục nào phù hợp với phạm vi bài đã chọn.");
    return false;
  }

  if (total > filtered.length) {
    showError(`Chỉ có ${filtered.length} mục phù hợp với lựa chọn của bạn. Vui lòng giảm số câu.`);
    return false;
  }

  hideError();
  shuffle(filtered);
  quizItems = filtered.slice(0, total).map(item => ({ ...item }));
  currentIndex = 0;
  score = 0;
  selectedChoice = null;
  selectedButton = null;
  return true;
}

export function renderQuestion() {
  hideError();

  if (currentIndex >= quizItems.length) {
    stopQuestionTimer();
    resetTimerDisplay();
    elements.questionPrompt.textContent = "Hoàn thành bài luyện tập!";
    elements.optionsContainer.innerHTML = "";
    elements.quizStatus.textContent = `Bạn đã hoàn thành ${quizItems.length} câu.`;
    updateScoreDisplay();
    elements.confirmBtn.classList.add("hidden");
    elements.nextBtn.classList.add("hidden");

    if (quizHardModeEnabled) {
      showQuizResultsModal();
    }
    return;
  }

  const item = quizItems[currentIndex];
  const mode = elements.modeSelect.value;
  const source = getSourceData();
  const choices = buildChoices(item, source, mode);

  stopQuestionTimer();
  startQuestionTimer();

  shuffle(choices);
  elements.optionsContainer.innerHTML = "";
  elements.optionsContainer.classList.toggle("kanji-options", mode === "reading-to-kanji");
  selectedChoice = null;
  selectedButton = null;

  if (mode === "reading-to-kanji") {
    elements.questionPrompt.textContent = `Chọn Kanji tương ứng với "${item.reading}"`;
  } else {
    elements.questionPrompt.textContent = `Chọn Âm Hán tương ứng với "${item.kanji}"`;
  }

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = mode === "reading-to-kanji" ? choice.kanji : choice.reading;
    button.addEventListener("click", () => selectAnswer(choice, button));
    elements.optionsContainer.appendChild(button);
  });

  elements.quizStatus.textContent = `Câu ${currentIndex + 1} / ${quizItems.length}`;
  updateScoreDisplay();
  elements.confirmBtn.classList.remove("hidden");
  elements.confirmBtn.disabled = false;
  elements.nextBtn.classList.add("hidden");

  refreshQuestionTimer();
}

export function startQuiz() {
  const requestedHardMode = elements.hardModeToggle?.checked ?? false;
  const requestedNightmareMode = elements.nightmareModeToggle?.checked ?? false;
  const requestedTimeLimit = getActiveTimeLimit();

  if (requestedHardMode && requestedTimeLimit === null) {
    showError(`Thời gian mỗi câu phải lớn hơn hoặc bằng ${MIN_TIME_LIMIT_SECONDS} giây.`);
    return false;
  }

  quizHardModeEnabled = requestedHardMode;
  quizNightmareModeEnabled = requestedNightmareMode;
  quizTimeLimitSeconds = requestedHardMode ? requestedTimeLimit : null;
  currentStreak = 0;
  maxStreak = 0;

  if (!buildQuiz()) {
    return false;
  }

  setActiveTab("practicePanel");
  elements.quizArea.classList.remove("hidden");
  renderQuestion();
  elements.quizArea.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function selectAnswer(choice, button) {
  if (selectedButton) {
    selectedButton.classList.remove("selected");
  }

  selectedChoice = choice;
  selectedButton = button;
  button.classList.add("selected");
}

export function confirmAnswer() {
  if (!selectedChoice) {
    showError("Vui lòng chọn đáp án trước khi xác nhận.");
    return;
  }

  stopQuestionTimer();
  hideError();
  const item = quizItems[currentIndex];
  const isCorrect = selectedChoice.kanji === item.kanji && selectedChoice.reading === item.reading;

  selectedButton.classList.remove("selected");
  selectedButton.classList.add(isCorrect ? "correct" : "wrong");

  if (isCorrect) {
    score += 1;
    currentStreak += 1;
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }
  } else {
    currentStreak = 0;
  }

  Array.from(elements.optionsContainer.children).forEach((option) => {
    option.disabled = true;
    const matchesCorrect = elements.modeSelect.value === "reading-to-kanji"
      ? option.textContent === item.kanji
      : normalizeReading(option.textContent) === normalizeReading(item.reading);

    if (matchesCorrect) {
      option.classList.add("correct");
    }
  });

  updateScoreDisplay();
  elements.confirmBtn.classList.add("hidden");
  elements.nextBtn.classList.remove("hidden");
}

export function nextQuestion() {
  currentIndex += 1;
  renderQuestion();
}

export function getEnabledOptionButtons() {
  return Array.from(elements.optionsContainer.querySelectorAll("button:not(:disabled)"));
}

function getOptionColumnCount() {
  const columns = window.getComputedStyle(elements.optionsContainer).gridTemplateColumns;
  return columns ? columns.split(" ").filter(Boolean).length : 1;
}

export function moveSelectedOption(direction) {
  const options = getEnabledOptionButtons();

  if (options.length === 0 || elements.quizArea.classList.contains("hidden")) {
    return;
  }

  const activeIndex = selectedButton ? options.indexOf(selectedButton) : -1;
  const columnCount = Math.max(1, getOptionColumnCount());
  let nextIndex = activeIndex >= 0 ? activeIndex : 0;

  if (direction === "ArrowRight") {
    nextIndex = activeIndex < 0 ? 0 : Math.min(options.length - 1, activeIndex + 1);
  } else if (direction === "ArrowLeft") {
    nextIndex = activeIndex < 0 ? 0 : Math.max(0, activeIndex - 1);
  } else if (direction === "ArrowDown") {
    nextIndex = activeIndex < 0 ? 0 : Math.min(options.length - 1, activeIndex + columnCount);
  } else if (direction === "ArrowUp") {
    nextIndex = activeIndex < 0 ? 0 : Math.max(0, activeIndex - columnCount);
  }

  options[nextIndex].click();
  options[nextIndex].focus({ preventScroll: true });
}

export function hasSelectedChoice() {
  return Boolean(selectedChoice);
}

function showQuizResultsModal() {
  const modal = elements.quizResultsModal;
  if (!modal) return;

  elements.resultsScore.textContent = `${score} / ${quizItems.length}`;
  elements.resultsStreak.textContent = `${maxStreak}`;

  modal.classList.remove("hidden");
  modal.showModal?.();
}

export function getCurrentKanji() {
  if (currentIndex >= 0 && currentIndex < quizItems.length) {
    return quizItems[currentIndex].kanji;
  }
  return null;
}
