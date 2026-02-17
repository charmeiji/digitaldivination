/**
 * Minimal audio helpers for game-start vibe. Loads from assets/sfx/ when present, else procedural.
 */

const SFX = Object.freeze({
  CONFIRM_CLICK: "assets/sfx/confirm_click.wav",
  CRYSTAL_REVEAL: "assets/sfx/crystal_reveal.wav"
});
const ORACLE_THEME_SOURCES = Object.freeze([
  "assets/sfx/oracletheme.mp3",
  "assets/sfx/oracletheme.wav",
  "assets/sfx/oracletheme.ogg"
]);
const ATTRACT_MUSIC_SOURCES = Object.freeze([
  "assets/sfx/oracletheme.mp3",
  "assets/sfx/oracletheme.wav",
  "assets/sfx/oracletheme.ogg"
]);

let audioContext = null;
let oracleThemeAudio = null;
let oracleThemeStarting = false;
let attractMusicAudio = null;
let attractMusicStarting = false;

function getContext() {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioContext = new Ctx();
  return audioContext;
}

function ensureContextRunning(ctx) {
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === "running") return Promise.resolve(true);
  return ctx.resume().then(() => {
    return ctx.state === "running";
  }).catch(() => {
    return false;
  });
}

/**
 * Play an SFX file; on error or unsupported, call fallback (e.g. procedural) once.
 */
function playSfxFile(path, fallback) {
  if (typeof fallback !== "function") return;
  const audio = new Audio(path);
  audio.volume = 1;
  let fallbackDone = false;
  const doFallback = () => {
    if (fallbackDone) return;
    fallbackDone = true;
    fallback();
  };
  audio.play().catch(doFallback);
  audio.addEventListener("error", doFallback, { once: true });
}

/**
 * Play a dry "click" on selection confirm (CONFIRM_1 accept/decline). No hover.
 * Uses assets/sfx/confirm_click.wav if present, else procedural.
 */
export function playConfirmClick() {
  playSfxFile(SFX.CONFIRM_CLICK, playConfirmClickProcedural);
}

function playConfirmClickProcedural() {
  const ctx = getContext();
  if (!ctx) return;
  const playTone = () => {
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
  };
  ensureContextRunning(ctx).then((ok) => {
    if (ok) playTone();
  });
}

/**
 * Low-volume confirm SFX (e.g. CONFIRM_2 YES -> white flash).
 */
export function playConfirmLow() {
  const ctx = getContext();
  if (!ctx) return;
  const playTone = () => {
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
  };
  ensureContextRunning(ctx).then((ok) => {
    if (ok) playTone();
  });
}

/**
 * One diegetic SFX when crystal ball camera feed becomes visible.
 * Uses assets/sfx/crystal_reveal.wav if present, else procedural.
 */
export function playCrystalReveal() {
  playSfxFile(SFX.CRYSTAL_REVEAL, playCrystalRevealProcedural);
}

function playCrystalRevealProcedural() {
  const ctx = getContext();
  if (!ctx) return;
  const playTone = () => {
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
  };
  ensureContextRunning(ctx).then((ok) => {
    if (ok) playTone();
  });
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
  const playTone = () => {
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
  };
  ensureContextRunning(ctx).then((ok) => {
    if (ok) playTone();
  });
}

function createOracleThemeAudio(src) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0.22;
  audio.preload = "auto";
  return audio;
}

/**
 * Start looping oracle theme for oracle flow states.
 * Safe to call repeatedly; it will not stack multiple tracks.
 */
export function startOracleTheme() {
  if (oracleThemeAudio && !oracleThemeAudio.paused) return;
  if (oracleThemeStarting) return;
  oracleThemeStarting = true;

  const trySource = (idx) => {
    if (idx >= ORACLE_THEME_SOURCES.length) {
      oracleThemeStarting = false;
      return;
    }
    const audio = createOracleThemeAudio(ORACLE_THEME_SOURCES[idx]);
    const onError = () => {
      audio.removeEventListener("error", onError);
      trySource(idx + 1);
    };
    audio.addEventListener("error", onError, { once: true });
    audio.play().then(() => {
      oracleThemeAudio = audio;
      oracleThemeStarting = false;
    }).catch(() => {
      audio.removeEventListener("error", onError);
      trySource(idx + 1);
    });
  };

  trySource(0);
}

/**
 * Stop oracle theme when leaving oracle flow.
 */
export function stopOracleTheme() {
  if (!oracleThemeAudio) return;
  try {
    oracleThemeAudio.pause();
    oracleThemeAudio.currentTime = 0;
  } catch (_) {
    // no-op
  }
  oracleThemeAudio = null;
  oracleThemeStarting = false;
}

/**
 * Start looping background music for ATTRACT only. Modest volume, seamless loop.
 * Stop when leaving ATTRACT via stopAttractMusic().
 */
export function startAttractMusic() {
  if (attractMusicAudio && !attractMusicAudio.paused) return;
  if (attractMusicStarting) return;
  attractMusicStarting = true;

  const trySource = (idx) => {
    if (idx >= ATTRACT_MUSIC_SOURCES.length) {
      attractMusicStarting = false;
      return;
    }
    const audio = new Audio(ATTRACT_MUSIC_SOURCES[idx]);
    audio.loop = true;
    audio.volume = 0.18;
    audio.preload = "auto";
    const onError = () => {
      audio.removeEventListener("error", onError);
      trySource(idx + 1);
    };
    audio.addEventListener("error", onError, { once: true });
    audio.play().then(() => {
      attractMusicAudio = audio;
      attractMusicStarting = false;
    }).catch(() => {
      audio.removeEventListener("error", onError);
      trySource(idx + 1);
    });
  };

  trySource(0);
}

/**
 * Stop ATTRACT music immediately when leaving ATTRACT.
 */
export function stopAttractMusic() {
  if (!attractMusicAudio) return;
  try {
    attractMusicAudio.pause();
    attractMusicAudio.currentTime = 0;
  } catch (_) {
    // no-op
  }
  attractMusicAudio = null;
  attractMusicStarting = false;
}

let lastHoverSfxAt = 0;
const HOVER_SFX_COOLDOWN_MS = 120;

/**
 * Short subtle hover SFX for YES/NO buttons. One-shot, no stacking.
 * Do not call when uiLocked.
 */
export function playHoverSfx() {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (now - lastHoverSfxAt < HOVER_SFX_COOLDOWN_MS) return;
  lastHoverSfxAt = now;

  const ctx = getContext();
  if (!ctx) return;
  const playTone = () => {
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) { /* no-op */ }
  };
  ensureContextRunning(ctx).then((ok) => {
    if (ok) playTone();
  });
}
