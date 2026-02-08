// Pure functions for deterministic computation (no DOM dependencies)

/**
 * Compute bitstring from choices array ["a"|"b", ...]
 * a = 0, b = 1
 */
export function computeBitstring(choices) {
  return choices.map(c => c === "a" ? "0" : "1").join("");
}

/**
 * Accumulate tags from choices using manifest
 * Returns { cute: number, neutral: number, cursed: number }
 */
export function accumulateTags(choices, manifest) {
  const tagTotals = { cute: 0, neutral: 0, cursed: 0 };
  
  for (let i = 0; i < Math.min(choices.length, manifest.rounds.length); i++) {
    const round = manifest.rounds[i];
    const choiceKey = choices[i]; // "a" or "b"
    if (round && round[choiceKey] && round[choiceKey].tags) {
      const tags = round[choiceKey].tags;
      if (tags.cute) tagTotals.cute += tags.cute;
      if (tags.neutral) tagTotals.neutral += tags.neutral;
      if (tags.cursed) tagTotals.cursed += tags.cursed;
    }
  }
  
  return tagTotals;
}

/**
 * Pick sticker set based on tag totals
 * cursed highest => set_cursed; else cute highest => set_cute; else set_neutral
 */
export function pickStickerSet(tagTotals) {
  if (tagTotals.cursed > tagTotals.cute && tagTotals.cursed > tagTotals.neutral) {
    return "set_cursed";
  } else if (tagTotals.cute > tagTotals.neutral) {
    return "set_cute";
  } else {
    return "set_neutral";
  }
}

/**
 * Select verdict assets (photo and talisman) from bitstring
 */
export function selectVerdictAssets(bitstring) {
  return {
    photoSrc: `assets/photos/strip_${bitstring}.png`,
    talismanSrc: `assets/talismans/talisman_${bitstring}.png`
  };
}

// Legacy state management (for backward compatibility during transition)
let bits = [];
let choices = []; // Track choice IDs: ["r1_a", "r2_b", ...]

export function recordChoice(bit) {
  if (bits.length >= 5) return;
  bits.push(bit);
  console.log("CHOICE:", bit, "→", bits.join(""));
}

export function recordChoiceLetter(letter) {
  if (choices.length >= 5) return;
  choices.push(letter); // "a" or "b"
  const bit = letter === "a" ? 0 : 1;
  bits.push(bit);
  console.log("CHOICE:", letter, bit, "→", bits.join(""));
}

export function getBinaryString() {
  if (bits.length === 5) {
    return bits.join("");
  }
  // Fallback: compute from choices if available
  if (choices.length === 5) {
    return computeBitstring(choices);
  }
  return "00000";
}

export function getChoices() {
  return choices.slice();
}

export function reset() {
  bits = [];
  choices = [];
}

export function getBitsArray() {
  return bits.slice();
}

export function setBitsArray(arr) {
  bits = Array.isArray(arr) ? arr.slice(0, 5).map(x => (x ? 1 : 0)) : [];
}

export function setChoices(arr) {
  choices = Array.isArray(arr) ? arr.slice(0, 5) : [];
}

async function loadJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path} (${resp.status})`);
  return await resp.json();
}

export async function resolveOutcome(code, choicesArray, manifest) {
  // Compute tag totals
  const tagTotals = accumulateTags(choicesArray, manifest);
  const stickerSetId = pickStickerSet(tagTotals);
  
  // Select verdict assets
  const { photoSrc, talismanSrc } = selectVerdictAssets(code);

  return {
    code,
    photo: photoSrc,
    talisman: talismanSrc,
    tagTotals,
    stickerSetId,
    stickers: [] // set by app wiring (bit-driven MVP stickers)
  };
}
