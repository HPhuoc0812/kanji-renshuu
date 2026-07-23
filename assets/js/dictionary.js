/**
 * Kanji Dictionary Module
 * Fetches detailed kanji information from Mazii API with fallback to KanjiAPI.dev.
 * Handles autocomplete search by Kanji, Romaji, and Han Viet.
 */

import { playKanjiGuide } from "./kanji-guide.js";
import { getSourceData } from "./data.js";

const MAZII_API = "https://mazii.net/api/search";
const KANJIAPI_BASE = "https://kanjiapi.dev/v1";

// Cache for full kanji lookups
const lookupCache = new Map();
// Cache for autocomplete search queries
const searchCache = new Map();

// Common radicals for the empty state suggestion grid
const SUGGESTED_RADICALS = [
  { char: "人", name: "Nhân" }, { char: "心", name: "Tâm" },
  { char: "手", name: "Thủ" }, { char: "水", name: "Thủy" },
  { char: "木", name: "Mộc" }, { char: "火", name: "Hỏa" },
  { char: "言", name: "Ngôn" }, { char: "糸", name: "Mịch" },
  { char: "日", name: "Nhật" }, { char: "月", name: "Nguyệt" },
  { char: "金", name: "Kim" }, { char: "土", name: "Thổ" }
];

/**
 * Perform a general search on Mazii API to get a list of matching Kanji.
 * E.g. query "tế" returns [細, 祭, 際, 済...]
 */
async function searchMazii(query) {
  if (!query) return [];
  if (searchCache.has(query)) return searchCache.get(query);

  try {
    const response = await fetch(MAZII_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dict: "javi", type: "kanji", query: query })
    });

    if (!response.ok) return [];
    
    const json = await response.json();
    if (!json.results) return [];

    // Map to a lightweight format for autocomplete, filtering out results without kanji
    // and filtering out matches that only exist in the detail/meaning (not in Han Viet, Kanji, or readings).
    const queryLower = query.toLowerCase();
    const results = json.results
      .filter(r => r.kanji)
      .filter(r => {
        const hanVietMatch = r.mean && r.mean.toLowerCase().includes(queryLower);
        const kanjiMatch = r.kanji.includes(query);
        const onKunMatch = (r.on && r.on.toLowerCase().includes(queryLower)) || 
                           (r.kun && r.kun.toLowerCase().includes(queryLower));
        return hanVietMatch || kanjiMatch || onKunMatch;
      })
      .map(r => ({
        kanji: r.kanji,
        hanViet: r.mean || "",
        detail: (r.detail || "").replace(/##/g, " - ").replace(/\n/g, " - ").substring(0, 60),
        jlpt: Array.isArray(r.level) ? r.level[0] : r.level
      }));

    searchCache.set(query, results);
    return results;
  } catch (err) {
    console.error("Search API error:", err);
    return [];
  }
}

/**
 * Search local dataset synchronously for instant autocomplete.
 */
function searchLocal(query) {
  const data = getSourceData() || [];
  const q = query.toLowerCase();
  
  const matches = data.filter(item => {
    const kanji = (item.kanji || "").toLowerCase();
    const reading = (item.reading || "").toLowerCase();
    const meaning = (item.meaning || "").toLowerCase();
    return kanji.includes(q) || reading.includes(q) || meaning.includes(q);
  }).slice(0, 15);
  
  return matches.map(m => ({
    kanji: m.kanji,
    hanViet: m.reading || "",
    detail: (m.meaning || "").substring(0, 60),
    jlpt: ""
  }));
}

/**
 * Merge local results with API results. API results take precedence.
 */
function mergeResults(local, api) {
  const map = new Map();
  local.forEach(r => map.set(r.kanji, r));
  api.forEach(r => map.set(r.kanji, r));
  return Array.from(map.values()).slice(0, 15);
}

/**
 * Fetch full kanji data from Mazii API (primary source).
 */
async function fetchFromMazii(kanji) {
  const response = await fetch(MAZII_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dict: "javi", type: "kanji", query: kanji })
  });

  if (!response.ok) throw new Error(`Mazii API error: ${response.status}`);

  const json = await response.json();

  if (!json.results || json.results.length === 0) {
    throw new Error("No results from Mazii");
  }

  // Find exact match just in case
  const r = json.results.find(res => res.kanji === kanji) || json.results[0];

  return {
    source: "mazii",
    kanji: r.kanji || kanji,
    hanViet: r.mean || "",
    detail: r.detail || "",
    on: r.on || "",
    kun: r.kun || "",
    strokeCount: r.stroke_count || "",
    jlpt: Array.isArray(r.level) ? r.level.join(", ") : (r.level || ""),
    radicals: Array.isArray(r.compDetail) ? r.compDetail : [],
    mnemonic: r.tips?.vi || "",
    examples: Array.isArray(r.examples) ? r.examples.slice(0, 8) : [],
    freq: r.freq || null
  };
}

/**
 * Fetch kanji data from KanjiAPI.dev (fallback source).
 */
async function fetchFromKanjiApi(kanji) {
  const [kanjiResp, wordsResp] = await Promise.all([
    fetch(`${KANJIAPI_BASE}/kanji/${encodeURIComponent(kanji)}`),
    fetch(`${KANJIAPI_BASE}/words/${encodeURIComponent(kanji)}`)
  ]);

  if (!kanjiResp.ok) throw new Error(`KanjiAPI error: ${kanjiResp.status}`);

  const kanjiData = await kanjiResp.json();
  let words = [];

  if (wordsResp.ok) {
    const wordsData = await wordsResp.json();
    words = wordsData.slice(0, 8).map(w => ({
      w: w.variants?.[0]?.written || "",
      p: w.variants?.[0]?.pronounced || "",
      m: w.meanings?.[0]?.glosses?.join("; ") || ""
    }));
  }

  const source = getSourceData();
  const match = source.find(item => item.kanji === kanji);

  return {
    source: "kanjiapi",
    kanji: kanjiData.kanji || kanji,
    hanViet: match?.reading || "",
    detail: kanjiData.meanings?.join("; ") || "",
    on: (kanjiData.on_readings || []).join("、"),
    kun: (kanjiData.kun_readings || []).join("、"),
    strokeCount: kanjiData.stroke_count || "",
    jlpt: kanjiData.jlpt ? `N${kanjiData.jlpt}` : "",
    radicals: [],
    mnemonic: "",
    examples: words,
    freq: null
  };
}

/**
 * Main lookup function for a specific Kanji.
 */
export async function lookupKanji(kanji) {
  if (lookupCache.has(kanji)) return lookupCache.get(kanji);

  try {
    const data = await fetchFromMazii(kanji);
    lookupCache.set(kanji, data);
    return data;
  } catch (maziiError) {
    console.warn("Mazii API failed, falling back to KanjiAPI:", maziiError.message);
    try {
      const data = await fetchFromKanjiApi(kanji);
      lookupCache.set(kanji, data);
      return data;
    } catch (fallbackError) {
      console.error("All dictionary APIs failed:", fallbackError.message);
      return null;
    }
  }
}

/**
 * Render dictionary data into the modal body.
 */
function renderDictionaryContent(data, container) {
  if (!data) {
    container.innerHTML = `
      <div class="dict-empty">
        <p>😔 Không tìm thấy thông tin cho chữ này.</p>
        <p class="dict-empty-hint">Hãy thử tra một chữ Kanji khác.</p>
      </div>`;
    return;
  }

  const isMazii = data.source === "mazii";

  // Build radicals HTML
  let radicalsHtml = "";
  if (data.radicals.length > 0) {
    radicalsHtml = `
      <div class="dict-section">
        <h4 class="dict-section-title">Bộ thủ</h4>
        <div class="dict-radicals">
          ${data.radicals.map(r => `
            <span class="dict-radical-tag" title="${r.h || ''}">
              <span class="dict-radical-char">${r.w || ""}</span>
              ${r.h ? `<span class="dict-radical-name">${r.h}</span>` : ""}
            </span>
          `).join("")}
        </div>
      </div>`;
  }

  // Build mnemonic HTML
  let mnemonicHtml = "";
  if (data.mnemonic) {
    mnemonicHtml = `
      <div class="dict-section">
        <h4 class="dict-section-title">💡 Cách nhớ</h4>
        <p class="dict-mnemonic">${data.mnemonic}</p>
      </div>`;
  }

  // Build examples HTML
  let examplesHtml = "";
  if (data.examples.length > 0) {
    const exampleRows = data.examples.map(ex => {
      return `<tr>
        <td class="dict-ex-word">${ex.w || ""}</td>
        <td class="dict-ex-reading">${ex.p || ""}</td>
        <td class="dict-ex-meaning">${ex.m || ""}</td>
      </tr>`;
    }).join("");

    examplesHtml = `
      <div class="dict-section">
        <h4 class="dict-section-title">📚 Từ vựng</h4>
        <div class="dict-examples-wrap">
          <table class="dict-examples">
            <thead><tr><th>Từ</th><th>Đọc</th><th>Nghĩa</th></tr></thead>
            <tbody>${exampleRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // Build detail HTML
  let detailHtml = "";
  if (data.detail) {
    const cleaned = data.detail
      .replace(/<i>/g, "<em>").replace(/<\/i>/g, "</em>")
      .replace(/<b>/g, "<strong>").replace(/<\/b>/g, "</strong>");

    // Split by ## or newlines to create list items
    const items = cleaned.replace(/\n/g, "##").split("##").map(s => s.trim()).filter(s => s.length > 0);
    const listHtml = `<ul>${items.map(item => `<li>${item}</li>`).join("")}</ul>`;

    detailHtml = `
      <div class="dict-section">
        <h4 class="dict-section-title">📖 Nghĩa chi tiết</h4>
        <div class="dict-detail">${listHtml}</div>
      </div>`;
  }

  // Metadata badges
  const badges = [];
  if (data.strokeCount) badges.push(`<span class="dict-badge">✏️ ${data.strokeCount} nét</span>`);
  if (data.jlpt) badges.push(`<span class="dict-badge dict-badge-jlpt">${data.jlpt}</span>`);
  if (data.freq) badges.push(`<span class="dict-badge">📊 #${data.freq}</span>`);

  container.innerHTML = `
    <div class="dict-header">
      <div class="dict-kanji-col">
        <div class="dict-kanji-display">${data.kanji}</div>
        <div id="dictGuideContainer" class="dict-guide-container"></div>
        <button id="dictPlayStrokeBtn" class="dict-play-btn" type="button" title="Xem thứ tự nét">▶ Xem nét viết</button>
      </div>
      <div class="dict-info-col">
        ${data.hanViet ? `<div class="dict-hanviet">${data.hanViet}</div>` : ""}
        <div class="dict-readings">
          ${data.on ? `<div class="dict-reading-row"><span class="dict-reading-label">On:</span> <span class="dict-reading-value">${data.on}</span></div>` : ""}
          ${data.kun ? `<div class="dict-reading-row"><span class="dict-reading-label">Kun:</span> <span class="dict-reading-value">${data.kun}</span></div>` : ""}
        </div>
        ${badges.length > 0 ? `<div class="dict-badges">${badges.join("")}</div>` : ""}
      </div>
    </div>
    ${radicalsHtml}
    ${mnemonicHtml}
    ${detailHtml}
    ${examplesHtml}
    ${!isMazii ? `<p class="dict-source-note">⚠ Dữ liệu từ nguồn dự phòng (kanjiapi.dev). Một số thông tin có thể bằng tiếng Anh.</p>` : ""}
  `;

  // Wire up stroke play button
  const playBtn = container.querySelector("#dictPlayStrokeBtn");
  const guideEl = container.querySelector("#dictGuideContainer");
  const displayEl = container.querySelector(".dict-kanji-display");

  if (playBtn && guideEl && displayEl) {
    playBtn.addEventListener("click", () => {
      displayEl.style.display = "none";
      guideEl.classList.add("active");
      playKanjiGuide(data.kanji, guideEl);
      playBtn.textContent = "⏳ Đang vẽ...";
      playBtn.disabled = true;
      setTimeout(() => {
        playBtn.textContent = "▶ Vẽ lại";
        playBtn.disabled = false;
      }, 2500);
    });
  }
}

/**
 * Render the autocomplete dropdown results.
 */
function renderAutocomplete(results, dropdownEl, inputEl) {
  if (!results || results.length === 0) {
    dropdownEl.classList.add("hidden");
    dropdownEl.innerHTML = "";
    return;
  }

  dropdownEl.innerHTML = results.map(r => `
    <div class="dict-ac-item" data-kanji="${r.kanji}">
      <div class="dict-ac-kanji">${r.kanji}</div>
      <div class="dict-ac-info">
        <div style="display: flex; gap: 8px; align-items: baseline;">
          <span class="dict-ac-mean">${r.hanViet}</span>
          ${r.jlpt ? `<span class="dict-ac-level">${r.jlpt}</span>` : ""}
        </div>
        <span class="dict-ac-detail">${r.detail.replace(/^\d+\.\s*/, '')}</span>
      </div>
    </div>
  `).join("");

  dropdownEl.classList.remove("hidden");

  // Wire up clicks on autocomplete items
  dropdownEl.querySelectorAll(".dict-ac-item").forEach(item => {
    item.addEventListener("click", () => {
      const selectedKanji = item.dataset.kanji;
      inputEl.value = selectedKanji;
      dropdownEl.classList.add("hidden");
      openDictionary(selectedKanji);
    });
  });
}

/**
 * Render the initial empty state with random kanji suggestions.
 */
function renderEmptyState(container) {
  const allData = getSourceData() || [];
  let suggestions = [];

  if (allData.length > 0) {
    // Shuffle and pick up to 12 kanji
    const shuffled = [...allData].sort(() => 0.5 - Math.random());
    suggestions = shuffled.slice(0, 12).map(item => ({
      char: item.kanji,
      name: item.reading // Hán Việt
    }));
  } else {
    // Fallback if no data is loaded yet
    suggestions = [
      { char: "人", name: "Nhân" }, { char: "心", name: "Tâm" },
      { char: "手", name: "Thủ" }, { char: "水", name: "Thủy" },
      { char: "木", name: "Mộc" }, { char: "火", name: "Hỏa" },
      { char: "言", name: "Ngôn" }, { char: "糸", name: "Mịch" }
    ];
  }

  const suggestionCards = suggestions.map(r => `
    <div class="dict-rad-card" data-kanji="${r.char}">
      <span class="dict-rad-char">${r.char}</span>
      <span class="dict-rad-name">${r.name}</span>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="dict-empty">
      <h4 class="dict-section-title" style="text-align: left; margin-bottom: 12px; font-family: var(--app-font);">Gợi ý ngẫu nhiên:</h4>
      <div class="dict-radicals-suggest">
        ${suggestionCards}
      </div>
    </div>
  `;

  // Wire up clicks on suggestion cards
  container.querySelectorAll(".dict-rad-card").forEach(card => {
    card.addEventListener("click", () => {
      const selectedKanji = card.dataset.kanji;
      const searchInput = document.getElementById("dictSearchInput");
      if (searchInput) searchInput.value = selectedKanji;
      openDictionary(selectedKanji);
    });
  });
}

/**
 * Show loading UI
 */
function renderLoadingState(container, kanji) {
  container.innerHTML = `
    <div class="dict-loading">
      <div class="dict-loading-spinner"></div>
      <p>Đang tra cứu <strong>${kanji}</strong>...</p>
    </div>`;
}

/**
 * Open the dictionary modal for a given kanji or query.
 */
export async function openDictionary(kanji = null) {
  const modal = document.getElementById("kanjiDictModal");
  const content = document.getElementById("dictContent");
  const searchInput = document.getElementById("dictSearchInput");
  const clearBtn = document.getElementById("dictClearSearchBtn");
  const autocomplete = document.getElementById("dictAutocomplete");

  if (!modal || !content) return;

  // Show the modal
  modal.classList.remove("hidden");
  if (modal.showModal && !modal.open) {
    modal.showModal();
  }

  // Ensure autocomplete is hidden when opening fresh
  if (autocomplete) autocomplete.classList.add("hidden");

  if (kanji) {
    if (searchInput) searchInput.value = kanji;
    if (clearBtn) clearBtn.classList.remove("hidden");
    
    renderLoadingState(content, kanji);
    
    // Check if it's a single kanji character or a search term
    const isSingleKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(kanji) && kanji.length === 1;
    
    if (isSingleKanji) {
      const data = await lookupKanji(kanji);
      renderDictionaryContent(data, content);
    } else {
      // It's a search term, run search and show first result
      const results = await searchMazii(kanji);
      if (results.length > 0) {
        // Auto select first result
        if (searchInput) searchInput.value = results[0].kanji;
        const data = await lookupKanji(results[0].kanji);
        renderDictionaryContent(data, content);
      } else {
        renderDictionaryContent(null, content);
      }
    }
  } else {
    // Empty state
    if (searchInput) searchInput.value = "";
    if (clearBtn) clearBtn.classList.add("hidden");
    renderEmptyState(content);
    if (searchInput) setTimeout(() => searchInput.focus(), 100);
  }
}

/**
 * Close the dictionary modal.
 */
export function closeDictionary() {
  const modal = document.getElementById("kanjiDictModal");
  if (!modal) return;
  modal.close?.();
  modal.classList.add("hidden");
}

let searchTimeout = null;

/**
 * Handle inputs in the dictionary search box (for autocomplete).
 */
export async function handleDictSearchInput(e) {
  const inputEl = e.target;
  const clearBtn = document.getElementById("dictClearSearchBtn");
  const dropdownEl = document.getElementById("dictAutocomplete");
  
  const query = inputEl.value.trim();
  
  if (clearBtn) {
    if (query.length > 0) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  if (query.length === 0) {
    if (dropdownEl) dropdownEl.classList.add("hidden");
    const content = document.getElementById("dictContent");
    if (content) renderEmptyState(content);
    return;
  }

  // 1. Instant local search
  const localResults = searchLocal(query);
  if (dropdownEl && localResults.length > 0) {
    renderAutocomplete(localResults, dropdownEl, inputEl);
  }

  // 2. Debounce API search
  if (searchTimeout) clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    const apiResults = await searchMazii(query);
    if (dropdownEl) {
      const merged = mergeResults(localResults, apiResults);
      renderAutocomplete(merged, dropdownEl, inputEl);
    }
  }, 300); // 300ms debounce
}

/**
 * Handle dictionary search form submission (Enter key).
 */
export function handleDictSearchSubmit() {
  const input = document.getElementById("dictSearchInput");
  const dropdownEl = document.getElementById("dictAutocomplete");
  
  if (!input) return;

  const query = input.value.trim();
  if (!query) return;

  if (dropdownEl) dropdownEl.classList.add("hidden");
  openDictionary(query);
}

/**
 * Clear the search box and reset to empty state.
 */
export function clearDictSearch() {
  const input = document.getElementById("dictSearchInput");
  const clearBtn = document.getElementById("dictClearSearchBtn");
  const dropdownEl = document.getElementById("dictAutocomplete");
  const content = document.getElementById("dictContent");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (dropdownEl) dropdownEl.classList.add("hidden");
  if (content) renderEmptyState(content);
}
