/**
 * Minimal audio helpers for game-start vibe. No UI; procedural or silent if unsupported.
 * Uses Web Audio API for dry click and low-volume confirm/crystal sounds.
 */

let audioContext = null;

function getContext() {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioContext = new Ctx();
  return audioContext;
}

/**
 * Play a dry "click" on selection confirm (CONFIRM_1 accept/decline). No hover.
 */
export function playConfirmClick() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch (_) { /* no-op */ }
}

/**
 * Low-volume confirm SFX (e.g. CONFIRM_2 YES -> white flash).
 */
export function playConfirmLow() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (_) { /* no-op */ }
}

/**
 * One diegetic SFX when crystal ball camera feed becomes visible.
 */
export function playCrystalReveal() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (_) { /* no-op */ }
}

/**
 * Schedule a subtle one-shot SFX (e.g. ATTRACT every 10–20s randomized).
 * Call once to start; returns a cleanup function to cancel the next tick.
 * @param {() => void} callback - Called each tick (e.g. playAttractAmbienceOneShot).
 * @param {{ minMs?: number, maxMs?: number }} [opts] - Optional interval range in ms.
 */
export function scheduleAttractAmbienceOneShot(callback, opts = {}) {
  if (typeof callback !== "function") return () => {};
  const min = opts.minMs ?? 10000;
  const max = opts.maxMs ?? 20000;
  let timeoutId = null;

  function tick() {
    callback();
    const ms = min + Math.random() * (max - min);
    timeoutId = setTimeout(tick, ms);
  }
  const firstMs = min * 0.5 + Math.random() * (max - min) * 0.5;
  timeoutId = setTimeout(tick, firstMs);

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
}

/**
 * Play a very subtle one-shot ambience (e.g. low soft tone). Used by ATTRACT.
 */
export function playAttractAmbienceOneShot() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.015, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.start(now);
    osc.stop(now + 1.2);
  } catch (_) { /* no-op */ }
}
