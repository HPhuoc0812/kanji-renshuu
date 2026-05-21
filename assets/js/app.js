const fileInput = document.getElementById("fileInput");
const urlInput = document.getElementById("urlInput");
const importBtn = document.getElementById("importBtn");
const modeSelect = document.getElementById("modeSelect");
const modeSelectButton = document.getElementById("modeSelectButton");
const modeSelectText = document.getElementById("modeSelectText");
const modeSelectMenu = document.getElementById("modeSelectMenu");
const questionCountInput = document.getElementById("questionCount");
const maxQuestionBtn = document.getElementById("maxQuestionBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const lessonFromInput = document.getElementById("lessonFrom");
const lessonToInput = document.getElementById("lessonTo");
const startBtn = document.getElementById("startBtn");
const quizArea = document.getElementById("quizArea");
const questionPrompt = document.getElementById("questionPrompt");
const optionsContainer = document.getElementById("options");
const quizStatus = document.getElementById("quizStatus");
const scoreInfo = document.getElementById("scoreInfo");
const nextBtn = document.getElementById("nextBtn");
const confirmBtn = document.getElementById("confirmBtn");
const resetBtn = document.getElementById("resetBtn");
const fileInfo = document.getElementById("fileInfo");
const errorMessage = document.getElementById("errorMessage");

const DATA_CACHE_KEY = "kanji-renshuu-data-v1";
const THEME_CACHE_KEY = "kanji-renshuu-theme";
const MAX_OPTION_COUNT = 4;
const MAX_QUESTION_COUNT = 300;

let kanjiData = [];
let quizItems = [];
let currentIndex = 0;
let score = 0;
let selectedChoice = null;
let selectedButton = null;
let hasLessonInfo = false;

const fallbackData = [
  { kanji: "日", reading: "Nhật" },
  { kanji: "月", reading: "Nguyệt" },
  { kanji: "火", reading: "Hỏa" },
  { kanji: "水", reading: "Thủy" },
  { kanji: "木", reading: "Mộc" },
  { kanji: "金", reading: "Kim" },
  { kanji: "土", reading: "Thổ" },
  { kanji: "山", reading: "Sơn" },
  { kanji: "川", reading: "Xuyên" },
  { kanji: "田", reading: "Điền" }
];

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  errorMessage.classList.add("hidden");
  errorMessage.textContent = "";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  themeToggleBtn.title = isDark ? "Tắt dark mode" : "Bật dark mode";
}

function loadThemePreference() {
  const savedTheme = localStorage.getItem(THEME_CACHE_KEY);
  const fallbackTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(savedTheme || fallbackTheme);
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem(THEME_CACHE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function closeModeSelect() {
  modeSelectMenu.classList.add("hidden");
  modeSelectButton.setAttribute("aria-expanded", "false");
}

function openModeSelect() {
  modeSelectMenu.classList.remove("hidden");
  modeSelectButton.setAttribute("aria-expanded", "true");
}

function setModeSelectValue(value) {
  const option = modeSelectMenu.querySelector(`[data-value="${value}"]`);

  if (!option) {
    return;
  }

  modeSelect.value = value;
  modeSelectText.textContent = option.textContent;

  modeSelectMenu.querySelectorAll(".custom-select-option").forEach((button) => {
    const isSelected = button.dataset.value === value;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
  });

  modeSelect.dispatchEvent(new Event("change"));
}

function toggleModeSelect() {
  if (modeSelectMenu.classList.contains("hidden")) {
    openModeSelect();
  } else {
    closeModeSelect();
  }
}

function handleModeSelectKeydown(event) {
  const options = Array.from(modeSelectMenu.querySelectorAll(".custom-select-option"));
  const selectedIndex = Math.max(0, options.findIndex(option => option.dataset.value === modeSelect.value));

  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    toggleModeSelect();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeModeSelect();
    return;
  }

  if (!["ArrowDown", "ArrowUp"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (selectedIndex + direction + options.length) % options.length;
  setModeSelectValue(options[nextIndex].dataset.value);
  openModeSelect();
}

function normalizeText(text) {
  return String(text || "").trim();
}

function normalizeReading(reading) {
  return normalizeText(reading).normalize("NFC").toLocaleLowerCase("vi");
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function setKanjiData(data, lessonInfo) {
  kanjiData = data;
  hasLessonInfo = lessonInfo;
}

function saveKanjiDataToStorage() {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      hasLessonInfo,
      data: kanjiData
    }));
  } catch {
    // App vẫn chạy nếu trình duyệt chặn localStorage hoặc bộ nhớ đầy.
  }
}

function loadKanjiDataFromStorage() {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);

    if (!raw) {
      return false;
    }

    const cached = JSON.parse(raw);

    if (!Array.isArray(cached.data) || cached.data.length === 0) {
      return false;
    }

    setKanjiData(cached.data, Boolean(cached.hasLessonInfo));
    hideError();
    fileInfo.textContent = `Đang dùng dữ liệu đã lưu offline (${kanjiData.length} dòng). ${hasLessonInfo ? "Có hỗ trợ lọc theo cột Bài." : "Không có cột Bài."}`;
    return true;
  } catch {
    return false;
  }
}

function parseExcel(file) {
  hideError();
  fileInfo.textContent = "Đang đọc file Excel...";
  const reader = new FileReader();

  reader.onload = (event) => {
    parseExcelBuffer(event.target.result, "File Excel không có dữ liệu hoặc dữ liệu trống.");
  };

  reader.onerror = () => {
    showError("Lỗi đọc file. Vui lòng thử lại.");
  };

  reader.readAsArrayBuffer(file);
}

function parseExcelBuffer(buffer, emptyMessage = "File không có dữ liệu.") {
  try {
    if (!window.XLSX) {
      showError("Thư viện XLSX chưa tải xong. Vui lòng làm mới trang và thử lại.");
      return;
    }

    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, { type: "array" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      showError("File không có bảng tính nào.");
      return;
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!json || json.length === 0) {
      showError(emptyMessage);
      return;
    }

    loadDataFromJson(json);
  } catch (err) {
    showError(`Lỗi xử lý file: ${err.message || err}`);
  }
}

function parseCsv(file) {
  hideError();
  const reader = new FileReader();

  reader.onload = (event) => {
    loadCsvText(event.target.result);
  };

  reader.onerror = () => {
    showError("Lỗi đọc file CSV. Vui lòng thử lại.");
  };

  reader.readAsText(file, "utf-8");
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function loadCsvText(csv) {
  const rows = csv.split(/\r?\n/).filter(row => row.trim());

  if (rows.length < 2) {
    showError("File CSV không có dữ liệu hoặc định dạng không đúng.");
    return;
  }

  const headers = splitCsvLine(rows[0]);
  const json = rows.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] || "";
      return obj;
    }, {});
  });

  if (json.length === 0) {
    showError("File CSV không có dữ liệu.");
    return;
  }

  loadDataFromJson(json);
}

function normalizeGoogleSheetsUrl(url) {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname.toLowerCase().includes("docs.google.com")) {
      return url;
    }

    const idMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);

    if (!idMatch) {
      return url;
    }

    const sheetId = idMatch[1];
    const gid = parsed.searchParams.get("gid") || "0";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  } catch {
    return url;
  }
}

async function parseRemoteUrl(url) {
  hideError();

  try {
    const normalizedUrl = normalizeGoogleSheetsUrl(url);
    const response = await fetch(normalizedUrl);

    if (!response.ok) {
      if (!loadKanjiDataFromStorage()) {
        showError(`Không tải được file từ URL. Mã: ${response.status}`);
      }
      return;
    }

    const lowerUrl = normalizedUrl.split("?")[0].toLowerCase();
    const contentType = response.headers.get("content-type") || "";

    if (lowerUrl.endsWith(".csv") || contentType.includes("text/csv")) {
      const text = await response.text();
      loadCsvText(text);
      return;
    }

    if (
      lowerUrl.endsWith(".xlsx") ||
      lowerUrl.endsWith(".xls") ||
      contentType.includes("spreadsheetml") ||
      contentType.includes("vnd.ms-excel")
    ) {
      const buffer = await response.arrayBuffer();
      parseExcelBuffer(buffer);
      return;
    }

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    loadCsvText(text);
  } catch {
    if (!loadKanjiDataFromStorage()) {
      showError("Không có mạng và chưa có dữ liệu offline. Hãy mở app khi có mạng một lần để lưu dữ liệu.");
    }
  }
}

function loadDataFromJson(json) {
  const keyMap = {
    kanji: ["Kanji", "kanji", "漢字", "kanji ", "B"],
    reading: ["Âm Hán", "ÂmHán", "reading", "Hán", "âm hán", "am han", "C"],
    lesson: ["Bài", "bài", "Bai", "lesson", "Lesson", "A"]
  };

  const headers = Object.keys(json[0] || {});
  const findKey = names => headers.find(header =>
    names.some(name => header.toLowerCase() === name.toLowerCase())
  );

  const kanjiKey = findKey(keyMap.kanji);
  const readingKey = findKey(keyMap.reading);
  const lessonKey = findKey(keyMap.lesson);

  if (!kanjiKey || !readingKey) {
    const headerList = headers.length > 0
      ? `(Cột tìm được: ${headers.join(", ")})`
      : "(File không có header)";
    showError(`Không tìm thấy cột Kanji hoặc Âm Hán. ${headerList}\n\nFile phải có: Cột A (Bài), Cột B (Kanji), Cột C (Âm Hán)`);
    fileInfo.textContent = "Lỗi: Cấu trúc file không đúng";
    return;
  }

  const data = json
    .map((row) => {
      const lessonRaw = lessonKey ? normalizeText(row[lessonKey]) : "";
      const lessonNumber = lessonRaw ? Number(lessonRaw) : null;

      return {
        kanji: normalizeText(row[kanjiKey]),
        reading: normalizeText(row[readingKey]),
        lesson: Number.isFinite(lessonNumber) ? lessonNumber : null
      };
    })
    .filter(item => item.kanji && item.reading);

  if (data.length === 0) {
    showError("Không có dữ liệu hợp lệ. Dữ liệu trong Kanji (cột B) hoặc Âm Hán (cột C) bị trống hoặc không hợp lệ. Kiểm tra file của bạn.");
    fileInfo.textContent = "Lỗi: Dữ liệu không hợp lệ";
    return;
  }

  setKanjiData(data, Boolean(lessonKey));
  saveKanjiDataToStorage();
  hideError();
  fileInfo.textContent = `Đã tải ${kanjiData.length} dòng dữ liệu và lưu để dùng offline. ${hasLessonInfo ? "Có hỗ trợ lọc theo cột Bài." : "Không tìm thấy cột Bài trong file."}`;
}

function autoLoadDefaultUrl() {
  const defaultUrl = urlInput.value.trim();

  loadKanjiDataFromStorage();

  if (defaultUrl && navigator.onLine) {
    parseRemoteUrl(defaultUrl);
  }
}

function getSourceData() {
  return kanjiData.length ? kanjiData : fallbackData;
}

function getFilteredSourceData() {
  const source = getSourceData();
  const from = Number(lessonFromInput.value);
  const to = Number(lessonToInput.value);
  const hasFrom = Number.isFinite(from) && from > 0;
  const hasTo = Number.isFinite(to) && to > 0;

  if ((hasFrom || hasTo) && !hasLessonInfo) {
    return {
      data: [],
      error: "Dữ liệu hiện tại không có cột Bài nên không thể lọc theo phạm vi bài."
    };
  }

  if (hasFrom && hasTo && from > to) {
    return {
      data: [],
      error: 'Giá trị "Từ bài" phải nhỏ hơn hoặc bằng "Đến bài".'
    };
  }

  if (!hasFrom && !hasTo) {
    return { data: [...source], error: "" };
  }

  return {
    data: source.filter((item) => {
      if (item.lesson === null) return false;
      if (hasFrom && item.lesson < from) return false;
      if (hasTo && item.lesson > to) return false;
      return true;
    }),
    error: ""
  };
}

function setMaxQuestionCount() {
  const { data, error } = getFilteredSourceData();

  if (error) {
    showError(error);
    return false;
  }

  if (data.length === 0) {
    showError("Không tìm thấy mục nào phù hợp với phạm vi bài đã chọn.");
    return false;
  }

  questionCountInput.value = Math.min(data.length, MAX_QUESTION_COUNT);
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
  const total = Math.min(Math.max(1, Number(questionCountInput.value)), MAX_QUESTION_COUNT);
  const { data: filtered, error } = getFilteredSourceData();

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
  score = 0;
  currentIndex = 0;
  selectedChoice = null;
  selectedButton = null;
  return true;
}

function renderQuestion() {
  if (currentIndex >= quizItems.length) {
    questionPrompt.textContent = "Hoàn thành bài luyện tập!";
    optionsContainer.innerHTML = "";
    quizStatus.textContent = `Bạn đã hoàn thành ${quizItems.length} câu.`;
    scoreInfo.textContent = `Điểm của bạn: ${score} / ${quizItems.length}`;
    confirmBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
    return;
  }

  const item = quizItems[currentIndex];
  const mode = modeSelect.value;
  const source = getSourceData();
  const choices = buildChoices(item, source, mode);

  shuffle(choices);
  optionsContainer.innerHTML = "";
  optionsContainer.classList.toggle("kanji-options", mode === "reading-to-kanji");
  selectedChoice = null;
  selectedButton = null;

  if (mode === "reading-to-kanji") {
    questionPrompt.textContent = `Câu ${currentIndex + 1}/${quizItems.length}: Chọn Kanji tương ứng với "${item.reading}"`;
  } else {
    questionPrompt.textContent = `Câu ${currentIndex + 1}/${quizItems.length}: Chọn Âm Hán tương ứng với "${item.kanji}"`;
  }

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = mode === "reading-to-kanji" ? choice.kanji : choice.reading;
    button.addEventListener("click", () => selectAnswer(choice, button));
    optionsContainer.appendChild(button);
  });

  quizStatus.textContent = `Câu ${currentIndex + 1} / ${quizItems.length}`;
  scoreInfo.textContent = `Điểm hiện tại: ${score} / ${currentIndex}`;
  confirmBtn.classList.remove("hidden");
  confirmBtn.disabled = false;
  nextBtn.classList.add("hidden");
}

function showQuizArea() {
  quizArea.classList.remove("hidden");
  renderQuestion();
  quizArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectAnswer(choice, button) {
  if (selectedButton) {
    selectedButton.classList.remove("selected");
  }

  selectedChoice = choice;
  selectedButton = button;
  button.classList.add("selected");
}

function confirmAnswer() {
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

  Array.from(optionsContainer.children).forEach((option) => {
    option.disabled = true;
    const matchesCorrect = modeSelect.value === "reading-to-kanji"
      ? option.textContent === item.kanji
      : normalizeReading(option.textContent) === normalizeReading(item.reading);

    if (matchesCorrect) {
      option.classList.add("correct");
    }
  });

  scoreInfo.textContent = `Điểm hiện tại: ${score} / ${currentIndex + 1}`;
  confirmBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
}

function isTypingTarget(target) {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function getEnabledOptionButtons() {
  return Array.from(optionsContainer.querySelectorAll("button:not(:disabled)"));
}

function getOptionColumnCount() {
  const columns = window.getComputedStyle(optionsContainer).gridTemplateColumns;
  return columns ? columns.split(" ").filter(Boolean).length : 1;
}

function moveSelectedOption(direction) {
  const options = getEnabledOptionButtons();

  if (options.length === 0 || quizArea.classList.contains("hidden")) {
    return;
  }

  const currentIndex = selectedButton ? options.indexOf(selectedButton) : -1;
  const columnCount = Math.max(1, getOptionColumnCount());
  let nextIndex = currentIndex >= 0 ? currentIndex : 0;

  if (direction === "ArrowRight") {
    nextIndex = currentIndex < 0 ? 0 : Math.min(options.length - 1, currentIndex + 1);
  } else if (direction === "ArrowLeft") {
    nextIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
  } else if (direction === "ArrowDown") {
    nextIndex = currentIndex < 0 ? 0 : Math.min(options.length - 1, currentIndex + columnCount);
  } else if (direction === "ArrowUp") {
    nextIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - columnCount);
  }

  options[nextIndex].click();
  options[nextIndex].focus({ preventScroll: true });
}

function handleKeyboardShortcut(event) {
  if (
    event.key === "Enter" &&
    quizArea.classList.contains("hidden")
  ) {
    event.preventDefault();
    startBtn.click();
    return;
  }

  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    resetBtn.click();
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

  if (!nextBtn.classList.contains("hidden")) {
    nextBtn.click();
    return;
  }

  if (!confirmBtn.classList.contains("hidden")) {
    if (!selectedChoice) {
      const firstOption = getEnabledOptionButtons()[0];
      firstOption?.click();
    }

    confirmBtn.click();
  }
}

fileInput.addEventListener("change", (event) => {
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

importBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();

  if (!url) {
    showError("Vui lòng nhập URL của file Excel hoặc CSV.");
    return;
  }

  parseRemoteUrl(url);
});

modeSelectButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleModeSelect();
});

modeSelectButton.addEventListener("keydown", handleModeSelectKeydown);

modeSelectMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".custom-select-option");

  if (!option) {
    return;
  }

  event.stopPropagation();
  setModeSelectValue(option.dataset.value);
  closeModeSelect();
  modeSelectButton.focus();
});

document.addEventListener("click", (event) => {
  if (!modeSelectMenu.classList.contains("hidden") && !event.target.closest(".custom-select")) {
    closeModeSelect();
  }
});

maxQuestionBtn.addEventListener("click", setMaxQuestionCount);
themeToggleBtn.addEventListener("click", toggleTheme);

startBtn.addEventListener("click", () => {
  if (!kanjiData.length) {
    fileInfo.textContent = "Đang dùng dữ liệu mẫu. Bạn có thể tải file Excel/CSV để dùng dữ liệu của riêng mình.";
  }

  if (!buildQuiz()) {
    return;
  }

  showQuizArea();
});

confirmBtn.addEventListener("click", confirmAnswer);
document.addEventListener("keydown", handleKeyboardShortcut);

nextBtn.addEventListener("click", () => {
  currentIndex += 1;
  renderQuestion();
});

resetBtn.addEventListener("click", () => {
  quizArea.classList.add("hidden");
  kanjiData = [];
  quizItems = [];
  currentIndex = 0;
  score = 0;
  fileInfo.textContent = "Đã đặt lại. Đang tải dữ liệu từ URL...";
  hideError();
  autoLoadDefaultUrl();
});

window.addEventListener("online", autoLoadDefaultUrl);
document.addEventListener("DOMContentLoaded", () => {
  loadThemePreference();
  setModeSelectValue(modeSelect.value);
  autoLoadDefaultUrl();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // PWA vẫn chạy bình thường nếu trình duyệt không cho đăng ký service worker.
    });
  });
}
