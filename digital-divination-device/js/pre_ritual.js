/**
 * Pre-ritual spine: ATTRACT -> CONFIRM_1 -> CONFIRM_2 -> ORACLE_INTRO
 * Minimal DOM views with gated input advance. Staged reveals + audio hooks.
 */

import { startAttractBackground } from "./fx/attract_bg_canvas.js";
import { STATES } from "./state_machine.js";
import { PACE } from "./pacing.js";
import { wait } from "./util.js";
import { playConfirmClick, playConfirmLow, playAttractAmbienceOneShot, scheduleAttractAmbienceOneShot, startAttractMusic, stopAttractMusic, playHoverSfx } from "./audio.js";
import { CONFIG } from "./config.js";

let stopAnimation = null;
let ellipsisInterval = null;
let attractAmbienceCleanup = null;
let attractDelayTimeout = null;
let advanceHandlers = {
  pointerdown: null,
  keydown: null
};
let confirm1Keydown = null;
let confirm2Keydown = null;
let stateEnteredAt = 0;
let inputLockHandler = null;
let inputLockTimeout = null;

function logPace(msg, data) {
  if (CONFIG.DEBUG_PACE_LOGS) console.log(msg, data ?? "");
}

// Pacing gates (ms) - input enabled after this from state enter
const GATES = {
  [STATES.ATTRACT]: 400, // ATTRACT_INPUT_LOCK_MS
  [STATES.CONFIRM_1]: PACE.PROMPT_1_INPUT_ENABLE_MS,
  [STATES.CONFIRM_2]: PACE.PROMPT_2_INPUT_ENABLE_MS
};

/**
 * Render pre-ritual state
 */
export function renderPreRitual(rootEl, state) {
  // Cleanup previous render
  cleanup();
  stateEnteredAt = performance.now();

  if (state === STATES.ATTRACT) {
    renderAttract(rootEl);
  } else if (state === STATES.CONFIRM_1) {
    renderConfirm1(rootEl);
  } else if (state === STATES.CONFIRM_2) {
    renderConfirm2(rootEl);
  }
}

function renderAttract(rootEl) {
  // Create animated background div (CSS-based)
  const bg = document.createElement("div");
  bg.className = "attract-bg";
  
  // Create canvas for animated background (keep existing if needed)
  const canvas = document.createElement("canvas");
  canvas.id = "attract-canvas";
  canvas.className = "attract-canvas";

  // Create UI overlay
  const overlay = document.createElement("div");
  overlay.className = "attract-overlay";
  overlay.innerHTML = `
    <div class="attract-title attract-entry">DIGITAL DIVINATION DEVICE</div>
    <div class="attract-status" id="attract-status">expecting entrant</div>
  `;

  rootEl.innerHTML = "";
  rootEl.appendChild(bg);
  rootEl.appendChild(canvas);
  rootEl.appendChild(overlay);

  // Start background animation (if canvas-based)
  stopAnimation = startAttractBackground(canvas);

  startAttractMusic();

  // Subtle one-shot ambience every 10–20s (randomized)
  if (attractAmbienceCleanup) attractAmbienceCleanup();
  attractAmbienceCleanup = scheduleAttractAmbienceOneShot(playAttractAmbienceOneShot, {
    minMs: PACE.ATTRACT_AMBIENCE_INTERVAL_MIN_MS,
    maxMs: PACE.ATTRACT_AMBIENCE_INTERVAL_MAX_MS
  });

  // Animate ellipsis in status text
  const statusEl = document.getElementById("attract-status");
  let ellipsisCount = 0;
  ellipsisInterval = setInterval(() => {
    ellipsisCount = (ellipsisCount + 1) % 4;
    const dots = ".".repeat(ellipsisCount);
    statusEl.textContent = `expecting entrant${dots}`;
  }, 500);
}

function renderConfirm1(rootEl) {
  // Reuse purple background with subdued overlay
  const bg = document.createElement("div");
  bg.className = "attract-bg";
  
  const canvas = document.createElement("canvas");
  canvas.id = "attract-canvas";
  canvas.className = "attract-canvas";

  const overlay = document.createElement("div");
  overlay.className = "attract-overlay";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  
  // Warning text
  const warningText = document.createElement("div");
  warningText.id = "confirm1-warning";
  warningText.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(20px, 4vw, 36px); color: #ffffff; text-align: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8); margin-bottom: 40px; opacity: 0;";
  warningText.textContent = "THIS RITUAL WILL CAPTURE YOUR IMAGE AND CHOICES.";
  
  // Buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.id = "confirm1-buttons";
  buttonsContainer.style.cssText = "display: flex; gap: 30px; opacity: 0;";
  
  const acceptBtn = document.createElement("button");
  acceptBtn.id = "confirm1-accept";
  acceptBtn.textContent = "ACCEPT";
  acceptBtn.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 30px; border: 2px solid rgba(255, 255, 255, 0.6); background: rgba(74, 20, 140, 0.8); color: #ffffff; cursor: pointer; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);";
  
  const declineBtn = document.createElement("button");
  declineBtn.id = "confirm1-decline";
  declineBtn.textContent = "DECLINE";
  declineBtn.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 30px; border: 2px solid rgba(255, 255, 255, 0.6); background: rgba(0, 0, 0, 0.5); color: #ffffff; cursor: pointer; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);";
  
  buttonsContainer.appendChild(acceptBtn);
  buttonsContainer.appendChild(declineBtn);
  
  overlay.appendChild(warningText);
  overlay.appendChild(buttonsContainer);

  rootEl.innerHTML = "";
  rootEl.appendChild(bg);
  rootEl.appendChild(canvas);
  rootEl.appendChild(overlay);

  // Start background animation (same as attract)
  stopAnimation = startAttractBackground(canvas);
  
  // Staged: text first, then options after PROMPT_1_OPTIONS_REVEAL_MS
  setTimeout(() => {
    warningText.style.transition = `opacity ${PACE.CONFIRM1_TEXT_FADE_MS}ms ease-in`;
    warningText.style.opacity = "1";
    logPace("[CONFIRM_1] prompt text visible");
  }, 100);

  setTimeout(() => {
    buttonsContainer.style.transition = `opacity ${PACE.CONFIRM1_BUTTONS_FADE_MS}ms ease-in`;
    buttonsContainer.style.opacity = "1";
    logPace("[CONFIRM_1] options revealed", { after: PACE.PROMPT_1_OPTIONS_REVEAL_MS });
  }, 100 + PACE.PROMPT_1_OPTIONS_REVEAL_MS);
}

function renderConfirm2(rootEl) {
  // Hard cut to black (existing); staged: text first, then YES
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #000000; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0; padding: 0; gap: 40px;";
  
  const text = document.createElement("div");
  text.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(24px, 5vw, 48px); color: #ffffff; text-align: center;";
  text.textContent = "ARE YOU REALLY SURE?";
  
  const yesBtn = document.createElement("button");
  yesBtn.id = "confirm2-yes";
  yesBtn.textContent = "YES";
  yesBtn.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 30px; border: 2px solid rgba(255, 255, 255, 0.6); background: rgba(74, 20, 140, 0.8); color: #ffffff; cursor: pointer; opacity: 0; transition: opacity 350ms ease-in;";
  yesBtn.disabled = true;
  
  rootEl.appendChild(text);
  rootEl.appendChild(yesBtn);
  
  setTimeout(() => {
    yesBtn.style.opacity = "1";
    logPace("[CONFIRM_2] YES revealed", { after: PACE.PROMPT_2_YES_REVEAL_MS });
  }, PACE.PROMPT_2_YES_REVEAL_MS);
}

function cleanup() {
  stopAttractMusic();
  if (stopAnimation) {
    stopAnimation();
    stopAnimation = null;
  }
  if (ellipsisInterval !== null) {
    clearInterval(ellipsisInterval);
    ellipsisInterval = null;
  }
  if (attractAmbienceCleanup) {
    attractAmbienceCleanup();
    attractAmbienceCleanup = null;
  }
  if (attractDelayTimeout) {
    clearTimeout(attractDelayTimeout);
    attractDelayTimeout = null;
  }
}

/**
 * Mount advance handlers for pre-ritual states
 * @param { { state: string, onAdvance: function, onDecline?: function, isLocked?: () => boolean } } opts
 */
export function mountPreRitualInput({ state, onAdvance, onDecline, isLocked }) {
  // Unmount any existing handlers first
  unmountPreRitualInput();

  const canPlayHover = () => !(typeof isLocked === "function" && isLocked());

  if (state === STATES.CONFIRM_1) {
    const acceptBtn = document.getElementById("confirm1-accept");
    const declineBtn = document.getElementById("confirm1-decline");
    if (acceptBtn && declineBtn) {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      acceptBtn.addEventListener("mouseenter", () => { if (canPlayHover()) playHoverSfx(); }, { once: false });
      declineBtn.addEventListener("mouseenter", () => { if (canPlayHover()) playHoverSfx(); }, { once: false });
      let handled = false;
      const runAccept = () => {
        if (handled) return;
        handled = true;
        playConfirmClick();
        acceptBtn.disabled = true;
        declineBtn.disabled = true;
        unmountPreRitualInput();
        if (onAdvance) onAdvance();
      };
      const runDecline = () => {
        if (handled) return;
        handled = true;
        playConfirmClick();
        acceptBtn.disabled = true;
        declineBtn.disabled = true;
        unmountPreRitualInput();
        if (onDecline) onDecline();
      };
      setTimeout(() => {
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        acceptBtn.addEventListener("click", runAccept);
        declineBtn.addEventListener("click", runDecline);
        acceptBtn.focus();
        confirm1Keydown = (e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            acceptBtn.focus();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            declineBtn.focus();
          } else if (e.key === "Escape") {
            e.preventDefault();
            runDecline();
          }
          // Enter/Space activate the focused button natively
        };
        window.addEventListener("keydown", confirm1Keydown);
      }, GATES[state] || 0);
    }
    return;
  }

  if (state === STATES.CONFIRM_2) {
    const yesBtn = document.getElementById("confirm2-yes");
    if (yesBtn) {
      yesBtn.disabled = true;
      yesBtn.addEventListener("mouseenter", () => { if (canPlayHover()) playHoverSfx(); }, { once: false });
      let handled = false;
      const runYes = () => {
        if (handled) return;
        handled = true;
        playConfirmLow();
        yesBtn.disabled = true;
        unmountPreRitualInput();
        handleConfirm2Transition(onAdvance);
      };
      setTimeout(() => {
        yesBtn.disabled = false;
        yesBtn.addEventListener("click", runYes);
        yesBtn.focus();
        confirm2Keydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            runYes();
          }
        };
        window.addEventListener("keydown", confirm2Keydown);
        logPace("[CONFIRM_2] input enabled", { after: PACE.PROMPT_2_INPUT_ENABLE_MS });
      }, GATES[state] || 0);
    }
    return;
  }

  // For ATTRACT and other states, use generic advance handler
  const handleAdvance = (e) => {
    // Only accept Enter or Space for keydown
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") {
      return;
    }

    // Don't trigger on debug keys
    if (e.type === "keydown") {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") return;
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.shiftKey && !e.altKey) return;
    }

    // Check pacing gate
    const gateMs = GATES[state] || 0;
    const elapsed = performance.now() - stateEnteredAt;

    if (elapsed < gateMs) {
      logPace(`ADVANCE IGNORED (GATED): ${state}`, { elapsed, gateMs });
      return;
    }

    const nextState = getNextState(state);
    logPace(`ADVANCE OK: ${state}`, { nextState });

    // ATTRACT: brief delay before transition (eerie pause)
    if (state === STATES.ATTRACT) {
      attractDelayTimeout = setTimeout(() => {
        attractDelayTimeout = null;
        unmountPreRitualInput();
        if (onAdvance) onAdvance();
      }, PACE.ATTRACT_INPUT_DELAY_MS);
      return;
    }

    // Remove handlers immediately to prevent double-firing
    unmountPreRitualInput();

    // Special handling for CONFIRM_2: white flash transition (only when using generic advance)
    if (state === STATES.CONFIRM_2) {
      handleConfirm2Transition(onAdvance);
    } else {
      if (onAdvance) onAdvance();
    }
  };

  // Store handlers so we can remove them if needed
  advanceHandlers.pointerdown = handleAdvance;
  advanceHandlers.keydown = handleAdvance;

  window.addEventListener("pointerdown", handleAdvance);
  window.addEventListener("keydown", handleAdvance);
}

/**
 * Handle CONFIRM_2 transition: fade to black is done by fadeTransition in app.js.
 * Call onAdvance immediately so overlay fades to black, then state switch and oracle fade-in.
 */
function handleConfirm2Transition(onAdvance) {
  if (onAdvance) onAdvance();
  installInputLock();
}

/**
 * Install global input lock to prevent accidental ROUND_1 selection
 */
function installInputLock() {
  // Clear any existing lock
  removeInputLock();
  
  inputLockHandler = (e) => {
    // Block all pointerdown and keydown events during lock period
    e.stopPropagation();
    e.preventDefault();
  };
  
  // Install lock on capture phase to catch events early
  document.addEventListener("pointerdown", inputLockHandler, { capture: true });
  document.addEventListener("keydown", inputLockHandler, { capture: true });
  
  // Remove lock after 800ms
  inputLockTimeout = setTimeout(() => {
    removeInputLock();
  }, 800);
}

/**
 * Remove input lock
 */
function removeInputLock() {
  if (inputLockHandler) {
    document.removeEventListener("pointerdown", inputLockHandler, { capture: true });
    document.removeEventListener("keydown", inputLockHandler, { capture: true });
    inputLockHandler = null;
  }
  if (inputLockTimeout) {
    clearTimeout(inputLockTimeout);
    inputLockTimeout = null;
  }
}

/**
 * Unmount advance handlers
 */
export function unmountPreRitualInput() {
  if (advanceHandlers.pointerdown) {
    window.removeEventListener("pointerdown", advanceHandlers.pointerdown);
    advanceHandlers.pointerdown = null;
  }
  if (advanceHandlers.keydown) {
    window.removeEventListener("keydown", advanceHandlers.keydown);
    advanceHandlers.keydown = null;
  }
  if (confirm1Keydown) {
    window.removeEventListener("keydown", confirm1Keydown);
    confirm1Keydown = null;
  }
  if (confirm2Keydown) {
    window.removeEventListener("keydown", confirm2Keydown);
    confirm2Keydown = null;
  }
  removeInputLock();
}

function getNextState(currentState) {
  if (currentState === STATES.ATTRACT) return STATES.CONFIRM_1;
  if (currentState === STATES.CONFIRM_1) return STATES.CONFIRM_2;
  if (currentState === STATES.CONFIRM_2) return STATES.ORACLE_INTRO;
  return null;
}
