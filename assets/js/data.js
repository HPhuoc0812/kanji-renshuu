import {
  DATA_CACHE_KEY,
  KANJI_DATA_URL,
  REMOTE_FETCH_TIMEOUT_MS
} from "./constants.js";
import { elements } from "./dom.js";
import { hideError, showError } from "./ui.js";
import { normalizeText } from "./utils.js";

let kanjiData = [];
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

let bundledKanjiData = fallbackData;

export function getKanjiData() {
  return kanjiData;
}

export function getHasLessonInfo() {
  return hasLessonInfo;
}

export function resetKanjiData() {
  kanjiData = [];
  hasLessonInfo = false;
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

export function loadKanjiDataFromStorage() {
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
    elements.fileInfo.textContent = `Đang dùng dữ liệu đã lưu offline (${kanjiData.length} dòng). ${hasLessonInfo ? "Có hỗ trợ lọc theo cột Bài." : "Không có cột Bài."}`;
    return true;
  } catch {
    return false;
  }
}

export async function loadBundledKanjiData() {
  try {
    const response = await fetch(KANJI_DATA_URL);

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data.items) && data.items.length > 0) {
        bundledKanjiData = data.items;
        setKanjiData(data.items.map(item => ({ ...item })), Boolean(data.hasLessonInfo));
        hideError();
        elements.fileInfo.textContent = `Đang dùng dữ liệu Kanji đi kèm app (${kanjiData.length} dòng). Khi có mạng, app sẽ tự cập nhật dữ liệu mới vào cache offline.`;
        return true;
      }
    }
  } catch {
    // Nếu không đọc được JSON đi kèm, app vẫn còn dữ liệu mẫu tối thiểu.
  }

  setKanjiData(fallbackData.map(item => ({ ...item })), false);
  return false;
}

export function parseExcel(file) {
  hideError();
  elements.fileInfo.textContent = "Đang đọc file Excel...";
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

export function parseCsv(file) {
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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function parseRemoteUrl(url) {
  hideError();

  if (!navigator.onLine) {
    if (!loadKanjiDataFromStorage()) {
      showError("Không có mạng và chưa có dữ liệu offline. Hãy mở app khi có mạng một lần để lưu dữ liệu.");
    }
    return;
  }

  try {
    const normalizedUrl = normalizeGoogleSheetsUrl(url);
    const response = await fetchWithTimeout(normalizedUrl);

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
    elements.fileInfo.textContent = "Lỗi: Cấu trúc file không đúng";
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
    elements.fileInfo.textContent = "Lỗi: Dữ liệu không hợp lệ";
    return;
  }

  setKanjiData(data, Boolean(lessonKey));
  saveKanjiDataToStorage();
  hideError();
  elements.fileInfo.textContent = `Đã tải ${kanjiData.length} dòng dữ liệu và lưu để dùng offline. ${hasLessonInfo ? "Có hỗ trợ lọc theo cột Bài." : "Không tìm thấy cột Bài trong file."}`;
}

export async function autoLoadDefaultUrl() {
  const defaultUrl = elements.urlInput.value.trim();
  let hasOfflineData = loadKanjiDataFromStorage();

  if (!hasOfflineData) {
    hasOfflineData = await loadBundledKanjiData();
  }

  if (defaultUrl && navigator.onLine) {
    parseRemoteUrl(defaultUrl);
  } else if (!hasOfflineData) {
    elements.fileInfo.textContent = "Chưa có dữ liệu offline. Hãy mở app khi có mạng một lần để lưu dữ liệu.";
  }
}

export function getSourceData() {
  return kanjiData.length ? kanjiData : bundledKanjiData;
}

export function getFilteredSourceData(fromValue, toValue) {
  const source = getSourceData();
  const from = Number(fromValue);
  const to = Number(toValue);
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
