const fileInput = document.getElementById("fileInput");
const urlInput = document.getElementById("urlInput");
const importBtn = document.getElementById("importBtn");
const modeSelect = document.getElementById("modeSelect");
const questionCountInput = document.getElementById("questionCount");
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

function normalizeText(text) {
  return String(text || "").trim();
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

function buildQuiz() {
  const total = Math.min(Math.max(1, Number(questionCountInput.value)), 100);
  const source = kanjiData.length ? kanjiData : fallbackData;
  let filtered = [...source];

  const from = Number(lessonFromInput.value);
  const to = Number(lessonToInput.value);
  const hasFrom = Number.isFinite(from) && from > 0;
  const hasTo = Number.isFinite(to) && to > 0;

  if ((hasFrom || hasTo) && !hasLessonInfo) {
    showError("Dữ liệu hiện tại không có cột Bài nên không thể lọc theo phạm vi bài.");
    return false;
  }

  if (hasFrom && hasTo && from > to) {
    showError('Giá trị "Từ bài" phải nhỏ hơn hoặc bằng "Đến bài".');
    return false;
  }

  if (hasFrom || hasTo) {
    filtered = filtered.filter((item) => {
      if (item.lesson === null) return false;
      if (hasFrom && item.lesson < from) return false;
      if (hasTo && item.lesson > to) return false;
      return true;
    });
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
  const choices = [item];
  const source = kanjiData.length ? kanjiData : fallbackData;

  while (choices.length < Math.min(4, source.length)) {
    const candidate = source[getRandomInt(source.length)];
    const exists = choices.some(choice =>
      choice.kanji === candidate.kanji && choice.reading === candidate.reading
    );

    if (!exists) {
      choices.push(candidate);
    }
  }

  shuffle(choices);
  optionsContainer.innerHTML = "";
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
      : option.textContent === item.reading;

    if (matchesCorrect) {
      option.classList.add("correct");
    }
  });

  scoreInfo.textContent = `Điểm hiện tại: ${score} / ${currentIndex + 1}`;
  confirmBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
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

startBtn.addEventListener("click", () => {
  if (!kanjiData.length) {
    fileInfo.textContent = "Đang dùng dữ liệu mẫu. Bạn có thể tải file Excel/CSV để dùng dữ liệu của riêng mình.";
  }

  if (!buildQuiz()) {
    return;
  }

  quizArea.classList.remove("hidden");
  renderQuestion();
});

confirmBtn.addEventListener("click", confirmAnswer);

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
document.addEventListener("DOMContentLoaded", autoLoadDefaultUrl);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // PWA vẫn chạy bình thường nếu trình duyệt không cho đăng ký service worker.
    });
  });
}
