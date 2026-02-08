/**
 * Attract screen view with animated background and text overlay.
 * @param {HTMLElement} rootEl - Root element to inject UI into
 * @param {Function} onStart - Callback when user starts (click/keydown)
 */

import { startAttractBackground } from "../fx/attract_bg_canvas.js";

let stopAnimation = null;
let ellipsisInterval = null;
let started = false;

export function renderAttract(rootEl, onStart) {
  // Reset started flag for new render
  started = false;
  
  // Cleanup any existing attract screen
  cleanup();

  // Create canvas for background
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

  // Inject into root
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

  // Add event listeners for start
  const handleStart = (e) => {
    // Prevent double-firing: only allow start once
    if (started) return;
    
    // Only accept Enter or Space for keydown
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") {
      return;
    }

    // Don't trigger on debug keys
    if (e.type === "keydown") {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") return;
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.shiftKey && !e.altKey) return;
    }

    // Mark as started and cleanup before calling onStart
    started = true;
    cleanup();
    onStart();
  };

  window.addEventListener("pointerdown", handleStart, { once: true });
  window.addEventListener("keydown", handleStart, { once: true });
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
  // Note: Event listeners are removed automatically by { once: true }
}
