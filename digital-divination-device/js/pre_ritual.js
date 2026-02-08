/**
 * Pre-ritual spine: ATTRACT -> CONFIRM_1 -> CONFIRM_2 -> ROUND_1
 * Minimal DOM views with gated input advance.
 */

import { startAttractBackground } from "./fx/attract_bg_canvas.js";
import { STATES } from "./state_machine.js";

let stopAnimation = null;
let ellipsisInterval = null;
let advanceHandlers = {
  pointerdown: null,
  keydown: null
};
let stateEnteredAt = 0;
let inputLockHandler = null;
let inputLockTimeout = null;

// Pacing gates (ms) - suspenseful timing
const GATES = {
  [STATES.ATTRACT]: 800,
  [STATES.CONFIRM_1]: 1200,
  [STATES.CONFIRM_2]: 2100
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
  // Create canvas for animated background
  const canvas = document.createElement("canvas");
  canvas.id = "attract-canvas";
  canvas.className = "attract-canvas";

  // Create UI overlay
  const overlay = document.createElement("div");
  overlay.className = "attract-overlay";
  overlay.innerHTML = `
    <div class="attract-title">DIGITAL DIVINATION DEVICE</div>
    <div class="attract-status" id="attract-status">expecting entrant</div>
  `;

  rootEl.innerHTML = "";
  rootEl.appendChild(canvas);
  rootEl.appendChild(overlay);

  // Start background animation
  stopAnimation = startAttractBackground(canvas);

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
  const canvas = document.createElement("canvas");
  canvas.id = "attract-canvas";
  canvas.className = "attract-canvas";

  const overlay = document.createElement("div");
  overlay.className = "attract-overlay";
  // Add semi-transparent dark overlay
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  
  const text = document.createElement("div");
  text.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(24px, 5vw, 48px); color: #ffffff; text-align: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);";
  text.textContent = "ARE YOU SURE?";

  rootEl.innerHTML = "";
  rootEl.appendChild(canvas);
  overlay.appendChild(text);
  rootEl.appendChild(overlay);

  // Start background animation (same as attract)
  stopAnimation = startAttractBackground(canvas);
}

function renderConfirm2(rootEl) {
  // Pure white background, no canvas
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #ffffff; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;";
  
  const text = document.createElement("div");
  text.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: clamp(24px, 5vw, 48px); color: #000000; text-align: center;";
  text.textContent = "ARE YOU REALLY SURE?";
  
  rootEl.appendChild(text);
}

function cleanup() {
  if (stopAnimation) {
    stopAnimation();
    stopAnimation = null;
  }
  if (ellipsisInterval !== null) {
    clearInterval(ellipsisInterval);
    ellipsisInterval = null;
  }
}

/**
 * Mount advance handlers for pre-ritual states
 */
export function mountPreRitualInput({ state, onAdvance }) {
  // Unmount any existing handlers first
  unmountPreRitualInput();

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
      console.log(`ADVANCE IGNORED (GATED): ${state}`);
      return;
    }

    // Advance to next state
    const nextState = getNextState(state);
    console.log(`ADVANCE OK: ${state}`);
    
    // Remove handlers immediately to prevent double-firing
    unmountPreRitualInput();
    
    // Special handling for CONFIRM_2: white flash transition
    if (state === STATES.CONFIRM_2) {
      handleConfirm2Transition(onAdvance);
    } else {
      // Call onAdvance immediately for other states
      onAdvance();
    }
  };

  // Store handlers so we can remove them if needed
  advanceHandlers.pointerdown = handleAdvance;
  advanceHandlers.keydown = handleAdvance;

  window.addEventListener("pointerdown", handleAdvance);
  window.addEventListener("keydown", handleAdvance);
}

/**
 * Handle CONFIRM_2 transition with white flash and input lock
 */
function handleConfirm2Transition(onAdvance) {
  // Immediately set background to pure white
  document.body.style.backgroundColor = "#ffffff";
  document.body.style.transition = "none";
  
  // Hold white for 250ms, then transition to ROUND_1
  setTimeout(() => {
    // Call onAdvance to transition to ROUND_1
    // White background will persist (not cleared)
    onAdvance();
    
    // Install input lock to prevent accidental ROUND_1 selection
    installInputLock();
  }, 250);
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
  
  // Remove lock after 500ms
  inputLockTimeout = setTimeout(() => {
    removeInputLock();
  }, 500);
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
  // Also remove input lock if active
  removeInputLock();
}

function getNextState(currentState) {
  if (currentState === STATES.ATTRACT) return STATES.CONFIRM_1;
  if (currentState === STATES.CONFIRM_1) return STATES.CONFIRM_2;
  if (currentState === STATES.CONFIRM_2) return STATES.CAMERA_PORTRAIT;
  return null;
}
