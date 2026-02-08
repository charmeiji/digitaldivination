export function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Seed a 32-bit integer from a string (simple hash)
export function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 31) + str.charCodeAt(i);
    h = h >>> 0; // ensure unsigned
  }
  return h;
}

// Mulberry32 PRNG (deterministic)
export function mulberry32(seedInt) {
  let state = seedInt >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic PRNG from a string (NOT random; same code -> same layout)
export function seededRngFromString(str) {
  const seed = seedFromString(str);
  return mulberry32(seed);
}