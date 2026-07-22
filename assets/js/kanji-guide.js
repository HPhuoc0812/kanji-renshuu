/**
 * Kanji Guide Module
 * Fetches SVG stroke data from KanjiVG and animates it in the whiteboard background.
 */

const KANJIVG_CDN = "https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/";

/**
 * Converts a Kanji character to its zero-padded hex unicode string used by KanjiVG.
 * e.g. "学" -> "05b66"
 */
function getKanjiHex(kanji) {
  return kanji.charCodeAt(0).toString(16).padStart(5, '0');
}

/**
 * Fetches, parses, and animates the KanjiVG SVG in the given container.
 */
export async function playKanjiGuide(kanji, container) {
  if (!kanji || !container) return;

  // Clear previous guide
  container.innerHTML = "";

  const hex = getKanjiHex(kanji);
  const url = `${KANJIVG_CDN}${hex}.svg`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to load Kanji guide for ${kanji}`);
      return;
    }

    const svgText = await response.text();
    
    // Parse the SVG string into a DOM element
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) {
      console.error("Invalid SVG data returned");
      return;
    }

    // Prepare SVG for our container
    svgElement.setAttribute("width", "100%");
    svgElement.setAttribute("height", "100%");
    
    // KanjiVG SVGs usually have a viewBox of 0 0 109 109
    if (!svgElement.getAttribute("viewBox")) {
      svgElement.setAttribute("viewBox", "0 0 109 109");
    }

    // Clean up unnecessary KanjiVG groups/text to keep it pure
    const texts = svgElement.querySelectorAll("text");
    texts.forEach(t => t.remove());

    const paths = Array.from(svgElement.querySelectorAll("path"));

    // Prepare paths for animation (hidden initially)
    paths.forEach(path => {
      // Remove hardcoded inline styles from KanjiVG
      path.removeAttribute("style");
      
      const length = path.getTotalLength();
      // Add a tiny bit of buffer to ensure the dash covers the whole path
      path.style.strokeDasharray = length + 2; 
      path.style.strokeDashoffset = length + 2;
    });

    container.appendChild(svgElement);

    // Trigger animation sequentially
    let delay = 0;
    const animationSpeed = 700; // ms per stroke
    
    // Force a reflow so the initial strokeDashoffset is applied before we change it
    container.offsetHeight;

    paths.forEach((path, index) => {
      setTimeout(() => {
        path.style.strokeDashoffset = "0";
      }, delay);
      
      delay += animationSpeed;
    });

  } catch (error) {
    console.error("Error loading Kanji guide:", error);
  }
}
