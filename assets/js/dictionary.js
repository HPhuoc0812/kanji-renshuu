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

// History stack for dictionary modal
let dictHistory = [];

// Common radicals for the empty state suggestion grid
const SUGGESTED_RADICALS = [
  { char: "人", name: "Nhân" }, { char: "心", name: "Tâm" },
  { char: "手", name: "Thủ" }, { char: "水", name: "Thủy" },
  { char: "木", name: "Mộc" }, { char: "火", name: "Hỏa" },
  { char: "言", name: "Ngôn" }, { char: "糸", name: "Mịch" },
  { char: "日", name: "Nhật" }, { char: "月", name: "Nguyệt" },
  { char: "金", name: "Kim" }, { char: "土", name: "Thổ" }
];

function cleanHanViet(str, query = "") {
  if (!str) return "";
  let cleaned = str.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");
  let parts = cleaned.split(/[,/\-]/).map(s => s.trim()).filter(s => s);
  
  if (query) {
    let qNoAccent = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let matchedPart = parts.find(p => p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(qNoAccent));
    if (matchedPart) {
      return matchedPart.toUpperCase();
    }
  }
  return (parts[0] || "").toUpperCase();
}

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
    const queryNoAccent = queryLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const results = json.results
      .filter(r => r.kanji)
      .filter(r => {
        const hanViet = (r.mean || "").toLowerCase();
        const hanVietNoAccent = hanViet.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const kanjiMatch = r.kanji.includes(query);
        const onKunMatch = (r.on && r.on.toLowerCase().includes(queryLower)) || 
                           (r.kun && r.kun.toLowerCase().includes(queryLower));
        return hanVietNoAccent.includes(queryNoAccent) || kanjiMatch || onKunMatch;
      })
      .map(r => ({
        kanji: r.kanji,
        hanViet: cleanHanViet(r.mean, query),
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
  const qNoAccent = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const matches = data.filter(item => {
    const kanji = (item.kanji || "").toLowerCase();
    const reading = (item.reading || "").toLowerCase();
    const readingNoAccent = reading.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const meaning = (item.meaning || "").toLowerCase();
    const meaningNoAccent = meaning.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return kanji.includes(q) || readingNoAccent.includes(qNoAccent) || meaningNoAccent.includes(qNoAccent);
  });
  
  return matches.map(m => ({
    kanji: m.kanji,
    hanViet: cleanHanViet(m.reading, query),
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
  
  const results = Array.from(map.values());
  results.sort((a, b) => (a.hanViet || "").localeCompare(b.hanViet || "", 'vi'));
  return results.slice(0, 15);
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
    const sourceData = getSourceData();
    const exampleRows = data.examples.map(ex => {
      // Build word with clickable kanji chars and Hán Việt tooltips
      const wordHtml = (ex.w || "").split("").map(ch => {
        const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(ch);
        if (isKanji) {
          const match = sourceData.find(item => item.kanji === ch);
          const hvName = match ? match.reading.toUpperCase() : "";
          return `<span class="dict-vocab-kanji" data-kanji="${ch}" title="${hvName}" style="cursor:pointer">${ch}</span>`;
        }
        return ch;
      }).join("");

      return `<tr>
        <td class="dict-ex-word">${wordHtml}</td>
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

  // Wire up clicks on radical tags
  container.querySelectorAll(".dict-clickable-radical").forEach(tag => {
    tag.addEventListener("click", async () => {
      const char = tag.dataset.kanji;
      if (char) {
        const data = await lookupKanji(char);
        if (data) {
          const searchInput = document.getElementById("dictSearchInput");
          if (searchInput) searchInput.value = char;
          openDictionary(char, true);
        } else {
          // Not found in dict, navigate to radicals tab
          closeDictionary();
          const radicalsTabBtn = document.querySelector('[data-tab-target="radicalsPanel"]');
          if (radicalsTabBtn) radicalsTabBtn.click();
          
          const radSearch = document.getElementById("radicalsSearch");
          if (radSearch) {
            radSearch.value = char;
            radSearch.dispatchEvent(new Event('input'));
          }
        }
      }
    });
  });

  // Wire up clicks on vocab kanji characters
  container.querySelectorAll(".dict-vocab-kanji").forEach(span => {
    span.addEventListener("click", () => {
      const char = span.dataset.kanji;
      if (char) {
        openDictionary(char, true);
      }
    });
  });
}

export function goBackDictionary() {
  if (dictHistory.length > 1) {
    dictHistory.pop(); // Remove current
    const prevKanji = dictHistory[dictHistory.length - 1]; // Get previous
    openDictionary(prevKanji, false);
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
export async function openDictionary(kanji = null, addToHistory = true) {
  const modal = document.getElementById("kanjiDictModal");
  const content = document.getElementById("dictContent");
  const searchInput = document.getElementById("dictSearchInput");
  const clearBtn = document.getElementById("dictClearSearchBtn");
  const autocomplete = document.getElementById("dictAutocomplete");
  const backBtn = document.getElementById("dictBackBtn");

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
      if (addToHistory) {
        if (dictHistory.length === 0 || dictHistory[dictHistory.length - 1] !== kanji) {
          dictHistory.push(kanji);
        }
      }
      
      if (backBtn) {
        if (dictHistory.length > 1) {
          backBtn.classList.remove("hidden");
        } else {
          backBtn.classList.add("hidden");
        }
      }
      
      const data = await lookupKanji(kanji);
      setCurrentKanjiData(data);
      
      const addBtn = document.getElementById("dictAddBtn");
      const appsScriptUrl = document.getElementById("appsScriptUrlInput")?.value.trim();
      if (addBtn) {
        if (appsScriptUrl) {
          addBtn.classList.remove("hidden");
        } else {
          addBtn.classList.add("hidden");
        }
      }
      
      renderDictionaryContent(data, content);
    } else {
      // It's a search term, run search and show first result
      const results = await searchMazii(kanji);
      if (results.length > 0) {
        // Auto select first result
        if (searchInput) searchInput.value = results[0].kanji;
        const data = await lookupKanji(results[0].kanji);
        setCurrentKanjiData(data);
        
        const addBtn = document.getElementById("dictAddBtn");
        const appsScriptUrl = document.getElementById("appsScriptUrlInput")?.value.trim();
        if (addBtn) {
          if (appsScriptUrl) {
            addBtn.classList.remove("hidden");
          } else {
            addBtn.classList.add("hidden");
          }
        }
        
        renderDictionaryContent(data, content);
      } else {
        renderDictionaryContent(null, content);
      }
    }
  } else {
    // Empty state
    dictHistory = [];
    if (backBtn) backBtn.classList.add("hidden");
    const addBtn = document.getElementById("dictAddBtn");
    if (addBtn) addBtn.classList.add("hidden");
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
  dictHistory = [];
  const backBtn = document.getElementById("dictBackBtn");
  if (backBtn) backBtn.classList.add("hidden");
  modal.close?.();
  modal.classList.add("hidden");
}

let currentKanjiData = null;

export function setCurrentKanjiData(data) {
  currentKanjiData = data;
}

export function openAddKanjiModal() {
  const modal = document.getElementById("kanjiAddModal");
  if (!modal || !currentKanjiData) return;

  const display = document.getElementById("kanjiAddDisplay");
  const hanviet = document.getElementById("kanjiAddHanviet");
  const mnemonic = document.getElementById("kanjiAddMnemonic");
  const lesson = document.getElementById("kanjiAddLesson");
  const status = document.getElementById("kanjiAddStatus");

  if (display) display.textContent = currentKanjiData.kanji;
  if (hanviet) {
    const raw = currentKanjiData.hanViet || "";
    hanviet.textContent = raw.toLowerCase().replace(/(^|[\s\/]+)(.)/g, (match, sep, char) => sep + char.toUpperCase());
  }
  if (mnemonic) {
    const rawMnemonic = currentKanjiData.mnemonic || "";
    mnemonic.value = rawMnemonic.replace(/<[^>]*>?/gm, '');
  }
  if (lesson) lesson.value = "";
  if (status) status.textContent = "";

  modal.classList.remove("hidden");
  if (modal.showModal && !modal.open) {
    modal.showModal();
  }
}

export function closeAddKanjiModal() {
  const modal = document.getElementById("kanjiAddModal");
  if (!modal) return;
  modal.close?.();
  modal.classList.add("hidden");
}

export async function submitAddKanji() {
  const urlInput = document.getElementById("appsScriptUrlInput");
  const url = urlInput ? urlInput.value.trim() : "";
  if (!url) {
    alert("Vui lòng nhập link Google Apps Script trong phần Cài Đặt trước khi thêm!");
    return;
  }

  const lesson = document.getElementById("kanjiAddLesson")?.value.trim() || "";
  const mnemonic = document.getElementById("kanjiAddMnemonic")?.value.trim() || "";
  const status = document.getElementById("kanjiAddStatus");
  const btn = document.getElementById("kanjiAddSubmitBtn");

  if (!lesson) {
    if (status) {
      status.style.color = "var(--rose)";
      status.textContent = "Vui lòng nhập Bài số mấy!";
    }
    return;
  }

  if (btn) btn.disabled = true;
  if (btn) btn.querySelector("span").textContent = "Đang gửi...";
  if (status) {
    status.style.color = "var(--text-tertiary)";
    status.textContent = "Đang kết nối...";
  }

  try {
    const formatTitleCase = (str) => {
      if (!str) return "";
      return str.toLowerCase().replace(/(^|[\s\/]+)(.)/g, (match, sep, char) => sep + char.toUpperCase());
    };

    const params = new URLSearchParams();
    params.append("lesson", lesson);
    params.append("kanji", currentKanjiData.kanji);
    params.append("hanviet", formatTitleCase(currentKanjiData.hanViet || ""));
    params.append("mnemonic", mnemonic);

    const targetUrl = url + (url.includes('?') ? '&' : '?') + params.toString();

    const response = await fetch(targetUrl, {
      method: "GET"
    });

    const result = await response.json();
    
    if (status) {
      if (result.status === "exists") {
        status.style.color = "var(--rose)";
        status.textContent = "Kanji này đã tồn tại trong Sheet!";
      } else if (result.status === "success") {
        status.style.color = "var(--teal-dark)";
        status.textContent = "Thêm thành công! Đã gửi lên Sheets.";
      } else {
        throw new Error(result.message || "Unknown error");
      }
    }
    setTimeout(() => {
      closeAddKanjiModal();
      if (status) status.textContent = "";
    }, 1500);

  } catch (error) {
    console.error("Lỗi khi thêm Kanji:", error);
    if (status) {
      status.style.color = "var(--rose)";
      status.textContent = "Lỗi: " + (error.message || "Không xác định. Kiểm tra console.");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Gửi lên Sheets";
    }
  }
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
