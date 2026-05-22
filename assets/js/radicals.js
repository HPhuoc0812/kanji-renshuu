import { RADICALS_DATA_URL } from "./constants.js";
import { elements } from "./dom.js";
import { normalizeSearchText } from "./utils.js";

let radicalsData = [];

function getRadicalSearchText(item) {
  return normalizeSearchText([
    item.id,
    item.radical,
    item.hanViet,
    item.meaning,
    item.strokes,
    ...(item.variants || [])
  ].join(" "));
}

function populateRadicalStrokeFilter() {
  const strokes = [...new Set(radicalsData.map(item => item.strokes))].sort((a, b) => a - b);

  elements.radicalsStrokeFilter.innerHTML = '<option value="">Tất cả</option>';
  strokes.forEach((stroke) => {
    const option = document.createElement("option");
    option.value = String(stroke);
    option.textContent = `${stroke} nét`;
    elements.radicalsStrokeFilter.appendChild(option);
  });
}

function getFilteredRadicals() {
  const query = normalizeSearchText(elements.radicalsSearchInput.value);
  const stroke = Number(elements.radicalsStrokeFilter.value);
  const hasStroke = Number.isFinite(stroke) && stroke > 0;

  return radicalsData.filter((item) => {
    if (hasStroke && item.strokes !== stroke) {
      return false;
    }

    if (!query) {
      return true;
    }

    return getRadicalSearchText(item).includes(query);
  });
}

export function renderRadicals() {
  const filtered = getFilteredRadicals();
  elements.radicalsGrid.innerHTML = "";
  elements.radicalsCount.textContent = `${filtered.length} / ${radicalsData.length} bộ`;

  if (filtered.length === 0) {
    elements.radicalsMessage.textContent = "Không tìm thấy bộ thủ phù hợp.";
    return;
  }

  elements.radicalsMessage.textContent = "";

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "radical-item";

    const symbol = document.createElement("div");
    symbol.className = "radical-symbol";
    symbol.textContent = item.radical;

    const details = document.createElement("div");
    details.className = "radical-details";

    const title = document.createElement("h3");
    title.className = "radical-title";
    title.textContent = `${item.id}. ${item.hanViet}`;

    const meta = document.createElement("p");
    meta.className = "radical-meta";
    meta.textContent = `${item.strokes} nét - ${item.meaning}`;

    details.append(title, meta);

    if (item.variants?.length) {
      const variants = document.createElement("p");
      variants.className = "radical-variants";
      variants.textContent = `Dạng khác: ${item.variants.join(" ")}`;
      details.appendChild(variants);
    }

    card.append(symbol, details);
    elements.radicalsGrid.appendChild(card);
  });
}

export async function loadRadicalsData() {
  try {
    const response = await fetch(RADICALS_DATA_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Empty radicals data");
    }

    radicalsData = data;
    populateRadicalStrokeFilter();
    renderRadicals();
  } catch {
    elements.radicalsCount.textContent = "Chưa tải được";
    elements.radicalsMessage.textContent = "Không thể tải dữ liệu bộ thủ. Hãy chạy app qua dev server để trình duyệt cho phép đọc file JSON.";
  }
}
