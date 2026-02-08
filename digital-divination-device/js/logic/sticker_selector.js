import { MAX_STICKERS, NULL_STICKER_ID, STICKERS } from "../content/stickers_catalog.js";

function normalizeResultBits(resultBits) {
  const arr = Array.isArray(resultBits) ? resultBits : [];
  // Coerce safely: treat non-1 as 0
  return Array.from({ length: 5 }, (_, i) => (arr[i] === 1 ? 1 : 0));
}

function getNullSticker() {
  return (
    STICKERS.find(s => s && s.id === NULL_STICKER_ID) || {
      id: NULL_STICKER_ID,
      src: "assets/stickers/s000.png",
      bits: []
    }
  );
}

/**
 * Deterministic sticker selection (no randomness).
 * @param {Array<number>} resultBits - [b1,b2,b3,b4,b5] where each is 0/1 (non-1 coerced to 0)
 * @returns {Array<{id: string, src: string}>}
 */
export function getStickersForBits(resultBits) {
  const bits = normalizeResultBits(resultBits);
  const allZero = bits.every(b => b !== 1);

  if (allZero) {
    const s = getNullSticker();
    return [{ id: s.id, src: s.src }];
  }

  const included = [];

  for (const sticker of STICKERS) {
    if (!sticker || sticker.id === NULL_STICKER_ID) continue;
    const listens = Array.isArray(sticker.bits) ? sticker.bits : [];
    const hit = listens.some(p => p >= 1 && p <= 5 && bits[p - 1] === 1);
    if (hit) included.push(sticker);
  }

  included.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return included.slice(0, MAX_STICKERS).map(s => ({ id: s.id, src: s.src }));
}

