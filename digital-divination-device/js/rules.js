let bits = [];

export function recordChoice(bit) {
  if (bits.length >= 5) return;
  bits.push(bit);
  console.log("CHOICE:", bit, "→", bits.join(""));
}

export function getBinaryString() {
  return bits.join("");
}

export function reset() {
  bits = [];
}

export function getBitsArray() {
  return bits.slice();
}

export function setBitsArray(arr) {
  bits = Array.isArray(arr) ? arr.slice(0, 5).map(x => (x ? 1 : 0)) : [];
}

async function loadJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path} (${resp.status})`);
  return await resp.json();
}

export async function resolveOutcome(code) {
  const outcomes = await loadJson("./data/outcomes.json");
  const stickerSets = await loadJson("./data/sticker_sets.json");

  const entry = outcomes[code];
  if (!entry) {
    // Deterministic fallback: treat unknown code as neutral.
    return {
      code,
      photo: "./assets/photos/strip_00000.png",
      talisman: "./assets/talismans/talisman_00000.png",
      stickers: []
    };
  }
  

  const setName = entry.stickers?.set;
  const count = entry.stickers?.count ?? 0;
  const pool = (setName && stickerSets[setName]) ? stickerSets[setName] : [];

  // Deterministic selection: repeat pool in order until count met.
  const stickers = [];
  for (let i = 0; i < count; i++) {
    stickers.push(pool.length ? pool[i % pool.length] : null);
  }

  return {
    code,
    photo: entry.photo ?? null,
    talisman: entry.talisman ?? null,
    stickers
  };
}
