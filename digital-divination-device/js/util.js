export function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

// Deterministic PRNG from a string (NOT random; same code -> same layout)
export function seededRngFromString(str) {
  // FNV-1a-ish hash into 32-bit
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift32
  let x = h >>> 0;
  return function next() {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}