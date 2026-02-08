import { STATES, transition, getState, isState } from "./state_machine.js";
import { recordChoiceLetter, getBinaryString, reset, resolveOutcome, getChoices, setChoices, computeBitstring, accumulateTags, pickStickerSet } from "./rules.js";
import { wait } from "./util.js";
import { PACE } from "./pacing.js";
import { validateAssets } from "./validate_assets.js";
import { loadSession, saveSession, clearSession, newSessionId, isActiveRitualState } from "./session_store.js";
import { CONFIG } from "./config.js";
import { installCloseGuard } from "./close_guard.js";
import { getStickersForBits } from "./logic/sticker_selector.js";
import { renderPreRitual, mountPreRitualInput, unmountPreRitualInput } from "./pre_ritual.js";

let currentSessionId = null;
let startedAt = null;
let manifest = null;
let currentResult = null; // Store result for downloads

function $(sel) {
  return document.querySelector(sel);
}

async function loadManifest() {
  if (!manifest) {
    const resp = await fetch("./data/manifest.json");
    if (!resp.ok) throw new Error(`Failed to load manifest.json (${resp.status})`);
    manifest = await resp.json();
  }
  return manifest;
}

function bitsFromCode(code) {
  const s = String(code ?? "");
  return Array.from({ length: 5 }, (_, i) => (s[i] === "1" ? 1 : 0));
}

function persist() {
  const choices = getChoices();
  const bitstring = choices.length === 5 ? computeBitstring(choices) : getBinaryString();
  const tagTotals = manifest && choices.length === 5 ? accumulateTags(choices, manifest) : { cute: 0, neutral: 0, cursed: 0 };
  const stickerSetId = pickStickerSet(tagTotals);
  const selectedStickerPaths = (currentResult?.stickers || []).map(s => s?.src).filter(Boolean);
  
  saveSession({
    runId: currentSessionId,
    startedAt: new Date(startedAt).toISOString(),
    choices: choices.slice(),
    bitstring: bitstring,
    tagTotals: tagTotals,
    stickerSetId: stickerSetId,
    selectedStickerPaths,
    state: getState()
  });
}
  
function stateForRound(n) {
  return STATES[`ROUND_${n}`];
}

function renderTextScreen(title, subtitle = "", showDownloads = false) {
  let downloadButtons = "";
  if (showDownloads && currentResult) {
    downloadButtons = `
      <div style="margin-top:24px; display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
        <button id="downloadStickers" style="padding:8px 16px; border:1px solid #000; background:#fff; cursor:pointer; font-family:monospace;">
          Download Sticker Sheet
        </button>
        <button id="downloadPhoto" style="padding:8px 16px; border:1px solid #000; background:#fff; cursor:pointer; font-family:monospace;">
          Download Photo Strip
        </button>
        <button id="downloadTalisman" style="padding:8px 16px; border:1px solid #000; background:#fff; cursor:pointer; font-family:monospace;">
          Download Talisman
        </button>
      </div>
    `;
  }
  
  $("#app").innerHTML = `
    <main style="padding:16px; font-family:monospace;">
      <div style="margin-bottom:8px;">${title}</div>
      ${subtitle ? `<div style="opacity:.8;">${subtitle}</div>` : ""}
      ${downloadButtons}
    </main>
  `;
  
  if (showDownloads && currentResult) {
    document.getElementById("downloadStickers")?.addEventListener("click", () => downloadStickerSheet());
    document.getElementById("downloadPhoto")?.addEventListener("click", () => downloadPhoto());
    document.getElementById("downloadTalisman")?.addEventListener("click", () => downloadTalisman());
  }
}

function downloadStickerSheet() {
  if (!window.stickerCanvas || !currentResult) return;
  const canvas = window.stickerCanvas;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sticker_sheet_${currentResult.code}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function downloadPhoto() {
  if (!currentResult?.photo) return;
  const a = document.createElement("a");
  a.href = currentResult.photo;
  a.download = `photo_strip_${currentResult.code}.png`;
  a.click();
}

function downloadTalisman() {
  if (!currentResult?.talisman) return;
  const a = document.createElement("a");
  a.href = currentResult.talisman;
  a.download = `talisman_${currentResult.code}.png`;
  a.click();
}

function renderIdleScreen() {
  // Image-only idle screen using existing asset (photo strip)
  $("#app").innerHTML = `
    <main style="padding:0; margin:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; background:#000;">
      <img src="assets/photos/strip_00000.png" style="max-width:100%; max-height:100%; object-fit:contain;" alt="" />
    </main>
  `;
}

function renderImageScreen(label, src) {
  $("#app").innerHTML = `
    <main style="padding:16px; font-family:monospace;">
      <div style="margin-bottom:10px;">${label}</div>
      ${src ? `<img src="${src}" style="max-width:360px; display:block;" />` : `<div style="opacity:.7;">(missing)</div>`}
    </main>
  `;
}

async function renderStickerScreen(result) {
  const stickers = (result.stickers || []).filter(Boolean).slice(0, 8);
  const PLACEHOLDER_SRC = "assets/stickers/placeholder.png";

  const metaRight = (CONFIG?.SHOW_DEBUG_CODE ?? true)
    ? `CODE ${result.code}`
    : `SHEET`;

  document.querySelector("#app").innerHTML = `
    <main class="sheet">
      <div class="crop tl"></div>
      <div class="crop tr"></div>
      <div class="crop bl"></div>
      <div class="crop br"></div>

      <div class="sheet-header">
        <div class="sheet-title">STICKER SHEET</div>
        <div class="sheet-meta">${metaRight}</div>
      </div>

      <div class="sticker-grid">
        ${stickers
          .map(
            (s) => `
              <div class="sticker-cell">
                ${s?.src ? `<img class="sticker-img" src="${s.src}" alt="" />` : ``}
              </div>
            `
          )
          .join("")}
      </div>

      <!-- hidden canvas kept only for existing "Download Sticker Sheet" flow -->
      <canvas id="stickerCanvas" width="800" height="800" style="display:none;"></canvas>
    </main>
  `;

  // If a sticker image is missing, fall back to placeholder (no crash).
  document.querySelectorAll(".sticker-img").forEach((img) => {
    img.addEventListener("error", () => {
      // Fall back to placeholder instead of removing
      if (img.src !== PLACEHOLDER_SRC) {
        img.src = PLACEHOLDER_SRC;
      }
    }, { once: true });
  });

  // Draw on hidden canvas for download (no randomness, skip missing images)
  const canvas = document.getElementById("stickerCanvas");
  const ctx = canvas.getContext("2d");
  const gridSize = 4;
  const cellWidth = canvas.width / gridSize;
  const cellHeight = canvas.height / gridSize;
  const padding = 10;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 16; i++) {
    const s = stickers[i];
    if (!s?.src) continue;

    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    const x = col * cellWidth + padding;
    const y = row * cellHeight + padding;
    const w = cellWidth - padding * 2;
    const h = cellHeight - padding * 2;

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, x, y, w, h);
        resolve();
      };
      img.onerror = () => {
        // Fall back to placeholder if original fails
        const placeholderImg = new Image();
        placeholderImg.crossOrigin = "anonymous";
        placeholderImg.onload = () => {
          ctx.drawImage(placeholderImg, x, y, w, h);
          resolve();
        };
        placeholderImg.onerror = () => resolve(); // skip if placeholder also fails
        placeholderImg.src = PLACEHOLDER_SRC;
      };
      img.src = s.src;
    });
  }

  window.stickerCanvas = canvas;
  window.stickerResult = result;
}

async function renderRound(n) {
  const app = $("#app");
  const expectedState = stateForRound(n);
  
  const m = await loadManifest();
  const round = m.rounds[n - 1];
  if (!round || !round.a || !round.b) {
    console.error(`Round ${n} not found in manifest or missing a/b choices`);
    return;
  }
  
  const choiceA = round.a;
  const choiceB = round.b;

  app.innerHTML = `
    <main style="display:flex; gap:16px; padding:16px; align-items:center;">
      <button id="choiceA" disabled style="border:0; background:transparent; cursor:not-allowed; opacity:.65;">
        <img src="${choiceA.img}" alt="Choice A"
             style="max-width:320px; height:auto; display:block;" />
      </button>
      <button id="choiceB" disabled style="border:0; background:transparent; cursor:not-allowed; opacity:.65;">
        <img src="${choiceB.img}" alt="Choice B"
             style="max-width:320px; height:auto; display:block;" />
      </button>
    </main>
  `;

  // Unskippable "enter" pause before input is allowed
  await wait(PACE.ROUND_ENTER_MS);
  if (!isState(expectedState)) return; // if state changed externally, abort

  const btnA = $("#choiceA");
  const btnB = $("#choiceB");
  btnA.disabled = false;
  btnB.disabled = false;
  btnA.style.cursor = "pointer";
  btnB.style.cursor = "pointer";
  btnA.style.opacity = "1";
  btnB.style.opacity = "1";

  let locked = false;

  async function choose(letter) {
    if (locked) return;
    if (getState() !== expectedState) return;

    locked = true;
    btnA.disabled = true;
    btnB.disabled = true;

    recordChoiceLetter(letter);
    persist();

    // Unskippable "after choice" pause
    await wait(PACE.ROUND_AFTER_CHOICE_MS);

    if (n < 5) {
      transition(stateForRound(n + 1));
      persist();
      await renderRound(n + 1);
    } else {
      transition(STATES.PROCESSING);
      persist();
      await renderProcessingAndOutputs();
    }
  }

  btnA.addEventListener("click", () => choose("a"));
  btnB.addEventListener("click", () => choose("b"));
}

async function renderProcessingAndOutputs() {
  // PROCESSING (hold) - state already set to PROCESSING before calling this function
  const choices = getChoices();
  const code = choices.length === 5 ? computeBitstring(choices) : getBinaryString();
  const codeDisplay = CONFIG.SHOW_DEBUG_CODE ? `CODE: ${code}` : "";
  renderTextScreen("PROCESSING…", codeDisplay);
  await wait(PACE.PROCESSING_MS);

  const m = await loadManifest();
  const result = await resolveOutcome(code, choices, m);
  const resultBits = bitsFromCode(code);
  const stickers = getStickersForBits(resultBits);
  result.stickers = stickers;
  console.log("[STICKERS]", stickers.map(s => s.id).join(","));
  currentResult = result; // Store for downloads
  persist(); // Finalize session with complete data

  // PHOTO STRIP (hold) - transition before rendering
  transition(STATES.OUTPUT_PHOTO);
  persist();
  renderImageScreen("PHOTO STRIP (JUDGMENT)", result.photo);
  await wait(PACE.PHOTO_HOLD_MS);

  // STICKERS (hold) - transition before rendering
  transition(STATES.OUTPUT_STICKERS);
  persist();
  await renderStickerScreen(result);
  await wait(PACE.STICKERS_HOLD_MS);

  // TALISMAN (hold) - transition before rendering
  transition(STATES.OUTPUT_TALISMAN);
  persist();
  renderImageScreen("TALISMAN (VERDICT)", result.talisman);
  await wait(PACE.TALISMAN_HOLD_MS);

  // END LOCK
  transition(STATES.END_LOCK);
  persist();
  renderTextScreen("SESSION ENDED.", "Close the window.", true);
}

async function resumeFromState(state) {
  // If you have intro/processing holds, decide whether to replay them.
  // MVP rule: do NOT replay long holds; resume immediately at the screen/state.

  if (state.startsWith("ROUND_")) {
    // Unmount pre-ritual handlers when entering ritual states
    unmountPreRitualInput();
    const n = parseInt(state.split("_")[1], 10);
    await renderRound(n);
    return;
  }

  if (state === STATES.PROCESSING) {
    await renderProcessingAndOutputs(); // will advance through outputs and end
    return;
  }

  if (state === STATES.OUTPUT_PHOTO || state === STATES.OUTPUT_STICKERS || state === STATES.OUTPUT_TALISMAN) {
    // Resume by continuing outputs from current state (state already set, continue forward)
    const choices = getChoices();
    const code = choices.length === 5 ? computeBitstring(choices) : getBinaryString();
    const m = await loadManifest();
    const result = await resolveOutcome(code, choices, m);
    result.stickers = getStickersForBits(bitsFromCode(code));
    currentResult = result; // Store for downloads
    
    if (state === STATES.OUTPUT_PHOTO) {
      // Already in OUTPUT_PHOTO, show it and continue
      renderImageScreen("PHOTO STRIP (JUDGMENT)", result.photo);
      await wait(PACE.PHOTO_HOLD_MS);
      
      transition(STATES.OUTPUT_STICKERS);
      persist();
      await renderStickerScreen(result);
      await wait(PACE.STICKERS_HOLD_MS);
      
      transition(STATES.OUTPUT_TALISMAN);
      persist();
      renderImageScreen("TALISMAN (VERDICT)", result.talisman);
      await wait(PACE.TALISMAN_HOLD_MS);
      
      transition(STATES.END_LOCK);
      persist();
      renderTextScreen("SESSION ENDED.", "Close the window.", true);
    } else if (state === STATES.OUTPUT_STICKERS) {
      // Already in OUTPUT_STICKERS, show it and continue
      await renderStickerScreen(result);
      await wait(PACE.STICKERS_HOLD_MS);
      
      transition(STATES.OUTPUT_TALISMAN);
      persist();
      renderImageScreen("TALISMAN (VERDICT)", result.talisman);
      await wait(PACE.TALISMAN_HOLD_MS);
      
      transition(STATES.END_LOCK);
      persist();
      renderTextScreen("SESSION ENDED.", "Close the window.", true);
    } else if (state === STATES.OUTPUT_TALISMAN) {
      // Already in OUTPUT_TALISMAN, show it and end
      renderImageScreen("TALISMAN (VERDICT)", result.talisman);
      await wait(PACE.TALISMAN_HOLD_MS);
      
      transition(STATES.END_LOCK);
      persist();
      renderTextScreen("SESSION ENDED.", "Close the window.", true);
    }
    return;
  }

  if (state === STATES.END_LOCK) {
    renderTextScreen("SESSION ENDED.", "Close the window.");
    return;
  }

  if (state === STATES.ATTRACT) {
    // Pre-ritual state: render and mount advance handlers
    renderPreRitual($("#app"), state);
    mountPreRitualInput({
      state: state,
      onAdvance: async () => {
        // Skip CONFIRM_1, CONFIRM_2, and CAMERA_PORTRAIT - go directly to ROUND_1
        transition(STATES.ROUND_1);
        persist();
        await resumeFromState(getState());
      }
    });
    return;
  }

  if (state === STATES.IDLE) {
    // IDLE should not be persisted, but handle gracefully if it somehow is
    renderIdleScreen();
    // Set up interaction listener (same as boot sequence)
    let idleListenerAttached = true;
    const handleIdleInteraction = async (e) => {
      if (!idleListenerAttached || getState() !== STATES.IDLE) return;
      
      // Don't trigger on debug keys (d, Ctrl+Shift+R)
      if (e && e.type === "keydown") {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") return;
        if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.shiftKey && !e.altKey) return;
      }
      
      idleListenerAttached = false;
      window.removeEventListener("click", handleIdleInteraction);
      window.removeEventListener("keydown", handleIdleInteraction);
      window.removeEventListener("touchstart", handleIdleInteraction);
      
      transition(STATES.INTRO);
      persist();
      
      renderTextScreen("DIGITAL DIVINATION DEVICE", "Initializing…");
      await wait(PACE.INTRO_HOLD_MS);
      
      if (getState() === STATES.INTRO) {
        transition(STATES.ROUND_1);
        persist();
        await renderRound(1);
      }
    };

    window.addEventListener("click", handleIdleInteraction, { once: true });
    window.addEventListener("keydown", handleIdleInteraction, { once: true });
    window.addEventListener("touchstart", handleIdleInteraction, { once: true });
    return;
  }

  // fallback - should not happen with guarded state machine, but handle gracefully
  try {
    // Only transition to INTRO if we're not already there
    if (getState() !== STATES.INTRO) {
      transition(STATES.INTRO);
      persist();
    }
    renderTextScreen("DIGITAL DIVINATION DEVICE", "Initializing…");
    await wait(PACE.INTRO_HOLD_MS);
    transition(STATES.ROUND_1);
    persist();
    await renderRound(1);
  } catch (e) {
    console.error("Resume fallback failed:", e);
      // Last resort: force ATTRACT if still in BOOT
      if (getState() === STATES.BOOT) {
        transition(STATES.ATTRACT);
        persist();
        renderPreRitual($("#app"), STATES.ATTRACT);
        mountPreRitualInput({
          state: STATES.ATTRACT,
          onAdvance: async () => {
            // Skip CONFIRM_1, CONFIRM_2, and CAMERA_PORTRAIT - go directly to ROUND_1
            transition(STATES.ROUND_1);
            persist();
            await resumeFromState(STATES.ROUND_1);
          }
        });
      }
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DDD MVP boot");

  // MVP: Clear any persisted state on refresh (fresh start always)
  clearSession();

  // Install close guard to warn during active rituals
  installCloseGuard(getState);

  // Debug overlay toggle
  let debugVisible = false;
  const debugOverlay = document.createElement("div");
  debugOverlay.id = "debugOverlay";
  debugOverlay.style.cssText = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:#0f0; padding:12px; font-family:monospace; font-size:12px; z-index:9999; display:none; border:1px solid #0f0;";
  document.body.appendChild(debugOverlay);

  function updateDebugOverlay() {
    if (!debugVisible) return;
    const code = getBinaryString();
    const choices = getChoices();
    const tagTotals = currentResult?.tagTotals || {};
    const selectedSet = currentResult?.stickerSetId || "none";
    
    debugOverlay.innerHTML = `
      <div style="margin-bottom:8px; font-weight:bold;">DEBUG</div>
      <div>Bitstring: ${code}</div>
      <div>Choices: ${choices.join(", ") || "none"}</div>
      <div>Tags: cute=${tagTotals.cute || 0}, neutral=${tagTotals.neutral || 0}, cursed=${tagTotals.cursed || 0}</div>
      <div>Sticker Set: ${selectedSet}</div>
    `;
  }

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
      clearSession();
      location.reload();
    }
    if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      debugVisible = !debugVisible;
      debugOverlay.style.display = debugVisible ? "block" : "none";
      updateDebugOverlay();
    }
  });

  // Update debug overlay periodically
  setInterval(updateDebugOverlay, 500);

  // OPTIONAL: run validator first (if you added it)
  const assetsValid = await validateAssets();
  if (!assetsValid) {
    return; // Stop execution if validation failed
  }

  // MVP: Always start fresh at ATTRACT (no resume/persistence)
  // Removed session resume logic - MVP requires fresh start on refresh

  // START NEW (always fresh on refresh)
  // Start with ATTRACT screen
  currentSessionId = newSessionId();
  startedAt = Date.now();

  reset(); // clears bits in rules.js
  transition(STATES.ATTRACT);
  persist();

  // Render pre-ritual and mount advance handlers
  renderPreRitual($("#app"), STATES.ATTRACT);
  mountPreRitualInput({
    state: STATES.ATTRACT,
    onAdvance: async () => {
      // Skip CONFIRM_1, CONFIRM_2, and CAMERA_PORTRAIT - go directly to ROUND_1
      transition(STATES.ROUND_1);
      persist();
      await resumeFromState(STATES.ROUND_1);
    }
  });
});
