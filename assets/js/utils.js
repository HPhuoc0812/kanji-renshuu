export function normalizeText(text) {
  return String(text || "").trim();
}

export function normalizeReading(reading) {
  return normalizeText(reading).normalize("NFC").toLocaleLowerCase("vi");
}

export function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi");
}

export function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}
