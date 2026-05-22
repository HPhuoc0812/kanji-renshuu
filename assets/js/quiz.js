import { MAX_OPTION_COUNT, MAX_QUESTION_COUNT } from "./constants.js";
import { elements } from "./dom.js";
import {
  getFilteredSourceData,
  getSourceData
} from "./data.js";
import { hideError, setActiveTab, showError } from "./ui.js";
import { normalizeReading, shuffle } from "./utils.js";

let quizItems = [];
let currentIndex = 0;
let score = 0;
let selectedChoice = null;
let selectedButton = null;

export function resetQuizState() {
  quizItems = [];
  currentIndex = 0;
  score = 0;
  selectedChoice = null;
  selectedButton = null;
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

  shuffle(candidates);

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
  if (currentIndex >= quizItems.length) {
    elements.questionPrompt.textContent = "Hoàn thành bài luyện tập!";
    elements.optionsContainer.innerHTML = "";
    elements.quizStatus.textContent = `Bạn đã hoàn thành ${quizItems.length} câu.`;
    elements.scoreInfo.textContent = `Điểm của bạn: ${score} / ${quizItems.length}`;
    elements.confirmBtn.classList.add("hidden");
    elements.nextBtn.classList.add("hidden");
    return;
  }

  const item = quizItems[currentIndex];
  const mode = elements.modeSelect.value;
  const source = getSourceData();
  const choices = buildChoices(item, source, mode);

  shuffle(choices);
  elements.optionsContainer.innerHTML = "";
  elements.optionsContainer.classList.toggle("kanji-options", mode === "reading-to-kanji");
  selectedChoice = null;
  selectedButton = null;

  if (mode === "reading-to-kanji") {
    elements.questionPrompt.textContent = `Câu ${currentIndex + 1}/${quizItems.length}: Chọn Kanji tương ứng với "${item.reading}"`;
  } else {
    elements.questionPrompt.textContent = `Câu ${currentIndex + 1}/${quizItems.length}: Chọn Âm Hán tương ứng với "${item.kanji}"`;
  }

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = mode === "reading-to-kanji" ? choice.kanji : choice.reading;
    button.addEventListener("click", () => selectAnswer(choice, button));
    elements.optionsContainer.appendChild(button);
  });

  elements.quizStatus.textContent = `Câu ${currentIndex + 1} / ${quizItems.length}`;
  elements.scoreInfo.textContent = `Điểm hiện tại: ${score} / ${currentIndex}`;
  elements.confirmBtn.classList.remove("hidden");
  elements.confirmBtn.disabled = false;
  elements.nextBtn.classList.add("hidden");
}

export function startQuiz() {
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

  hideError();
  const item = quizItems[currentIndex];
  const isCorrect = selectedChoice.kanji === item.kanji && selectedChoice.reading === item.reading;

  selectedButton.classList.remove("selected");
  selectedButton.classList.add(isCorrect ? "correct" : "wrong");

  if (isCorrect) {
    score += 1;
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

  elements.scoreInfo.textContent = `Điểm hiện tại: ${score} / ${currentIndex + 1}`;
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
