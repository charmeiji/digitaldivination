export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Paced dialogue: track timers so Enter/Space can skip hold and advance chain. */
if (typeof window !== "undefined") {
  window.__pace = window.__pace || { timers: new Set(), nextTick: null, active: false, transitionResolve: null };
}

export function paceTimeout(fn, ms) {
  if (typeof window === "undefined" || !window.__pace) return setTimeout(fn, ms);
  const id = setTimeout(() => {
    window.__pace.timers.delete(id);
    fn();
  }, ms);
  window.__pace.timers.add(id);
  return id;
}

export function clearPaceTimers() {
  if (typeof window === "undefined" || !window.__pace) return;
  for (const id of window.__pace.timers) clearTimeout(id);
  window.__pace.timers.clear();
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