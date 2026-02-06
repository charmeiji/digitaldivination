import { STATES, transition, getState, isState } from "./state_machine.js";
import { recordChoice, getBinaryString, reset, resolveOutcome } from "./rules.js";
import { wait, seededRngFromString } from "./util.js";
import { PACE } from "./pacing.js";
import { validateAssets } from "./validate_assets.js";
import { loadSession, saveSession, clearSession, newSessionId, isActiveRitualState } from "./session_store.js";
import { getBitsArray, setBitsArray } from "./rules.js";
import { CONFIG } from "./config.js";
import { installCloseGuard } from "./close_guard.js";

let currentSessionId = null;
let startedAt = null;

function $(sel) {
  return document.querySelector(sel);
}

function persist() {
    saveSession({
      session_id: currentSessionId,
      started_at: startedAt,
      state: getState(),
      bits: getBitsArray()
    });
  }
  
function stateForRound(n) {
  return STATES[`ROUND_${n}`];
}

function renderTextScreen(title, subtitle = "") {
  $("#app").innerHTML = `
    <main style="padding:16px; font-family:monospace;">
      <div style="margin-bottom:8px;">${title}</div>
      ${subtitle ? `<div style="opacity:.8;">${subtitle}</div>` : ""}
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

function renderStickerScreen(result) {
  const stickers = (result.stickers || []).filter(Boolean).slice(0, 12);
  const rng = seededRngFromString(result.code || "00000");

  const cells = [];
  for (let i = 0; i < 12; i++) {
    const src = stickers[i] || null;

    // Deterministic "imperfection"
    const rot = (rng() * 6 - 3).toFixed(2);      // -3°..+3°
    const tx  = (rng() * 6 - 3).toFixed(2);      // -3px..+3px
    const ty  = (rng() * 6 - 3).toFixed(2);

    cells.push(`
      <div class="sticker-cell">
        ${
          src
            ? `<img class="sticker-img" src="${src}" alt="Sticker"
                   style="transform: translate(${tx}px, ${ty}px) rotate(${rot}deg);" />`
            : `<div style="opacity:.35; font-size:12px;">(empty)</div>`
        }
      </div>
    `);
  }

  const metaRight = (CONFIG?.SHOW_DEBUG_CODE ?? true)
    ? `CODE ${result.code}`
    : `SHEET`;

  document.querySelector("#app").innerHTML = `
    <main class="sheet">
      <div class="crop tl"></div><div class="crop tr"></div>
      <div class="crop bl"></div><div class="crop br"></div>

      <div class="sheet-header">
        <div class="sheet-title">STICKER SHEET</div>
        <div class="sheet-meta">${metaRight}</div>
      </div>

      <section class="sticker-grid">
        ${cells.join("")}
      </section>
    </main>
  `;
}

async function renderRound(n) {
  const app = $("#app");
  const expectedState = stateForRound(n);

  app.innerHTML = `
    <main style="display:flex; gap:16px; padding:16px; align-items:center;">
      <button id="choiceA" disabled style="border:0; background:transparent; cursor:not-allowed; opacity:.65;">
        <img src="./assets/choices/r${n}_a.png" alt="Choice A"
             style="max-width:320px; height:auto; display:block;" />
      </button>
      <button id="choiceB" disabled style="border:0; background:transparent; cursor:not-allowed; opacity:.65;">
        <img src="./assets/choices/r${n}_b.png" alt="Choice B"
             style="max-width:320px; height:auto; display:block;" />
      </button>
    </main>
  `;

  // Unskippable “enter” pause before input is allowed
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

  async function choose(bit) {
    if (locked) return;
    if (getState() !== expectedState) return;

    locked = true;
    btnA.disabled = true;
    btnB.disabled = true;

    recordChoice(bit);
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

  btnA.addEventListener("click", () => choose(0));
  btnB.addEventListener("click", () => choose(1));
}

async function renderProcessingAndOutputs() {
  // PROCESSING (hold)
  transition(STATES.PROCESSING);
  persist();
  const code = getBinaryString();
  const codeDisplay = CONFIG.SHOW_DEBUG_CODE ? `CODE: ${code}` : "";
  renderTextScreen("PROCESSING…", codeDisplay);
  await wait(PACE.PROCESSING_MS);

  const result = await resolveOutcome(code);

  // PHOTO STRIP (hold) - transition before rendering
  transition(STATES.OUTPUT_PHOTO);
  persist();
  renderImageScreen("PHOTO STRIP (JUDGMENT)", result.photo);
  await wait(PACE.PHOTO_HOLD_MS);

  // STICKERS (hold) - transition before rendering
  transition(STATES.OUTPUT_STICKERS);
  persist();
  renderStickerScreen(result);
  await wait(PACE.STICKERS_HOLD_MS);

  // TALISMAN (hold) - transition before rendering
  transition(STATES.OUTPUT_TALISMAN);
  persist();
  renderImageScreen("TALISMAN (VERDICT)", result.talisman);
  await wait(PACE.TALISMAN_HOLD_MS);

  // END LOCK
  transition(STATES.END_LOCK);
  persist();
  renderTextScreen("SESSION ENDED.", "Close the window.");
}

async function resumeFromState(state) {
  // If you have intro/processing holds, decide whether to replay them.
  // MVP rule: do NOT replay long holds; resume immediately at the screen/state.

  if (state.startsWith("ROUND_")) {
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
    const result = await resolveOutcome(getBinaryString());
    
    if (state === STATES.OUTPUT_PHOTO) {
      // Already in OUTPUT_PHOTO, show it and continue
      renderImageScreen("PHOTO STRIP (JUDGMENT)", result.photo);
      await wait(PACE.PHOTO_HOLD_MS);
      
      transition(STATES.OUTPUT_STICKERS);
      persist();
      renderStickerScreen(result);
      await wait(PACE.STICKERS_HOLD_MS);
      
      transition(STATES.OUTPUT_TALISMAN);
      persist();
      renderImageScreen("TALISMAN (VERDICT)", result.talisman);
      await wait(PACE.TALISMAN_HOLD_MS);
      
      transition(STATES.END_LOCK);
      persist();
      renderTextScreen("SESSION ENDED.", "Close the window.");
    } else if (state === STATES.OUTPUT_STICKERS) {
      // Already in OUTPUT_STICKERS, show it and continue
      renderStickerScreen(result);
      await wait(PACE.STICKERS_HOLD_MS);
      
      transition(STATES.OUTPUT_TALISMAN);
      persist();
      renderImageScreen("TALISMAN (VERDICT)", result.talisman);
      await wait(PACE.TALISMAN_HOLD_MS);
      
      transition(STATES.END_LOCK);
      persist();
      renderTextScreen("SESSION ENDED.", "Close the window.");
    } else if (state === STATES.OUTPUT_TALISMAN) {
      // Already in OUTPUT_TALISMAN, show it and end
      renderImageScreen("TALISMAN (VERDICT)", result.talisman);
      await wait(PACE.TALISMAN_HOLD_MS);
      
      transition(STATES.END_LOCK);
      persist();
      renderTextScreen("SESSION ENDED.", "Close the window.");
    }
    return;
  }

  if (state === STATES.END_LOCK) {
    renderTextScreen("SESSION ENDED.", "Close the window.");
    return;
  }

  // fallback - should not happen with guarded state machine, but handle gracefully
  try {
    transition(STATES.INTRO);
    persist();
    renderTextScreen("DIGITAL DIVINATION DEVICE", "Initializing…");
    await wait(PACE.INTRO_HOLD_MS);
    transition(STATES.ROUND_1);
    persist();
    await renderRound(1);
  } catch (e) {
    console.error("Resume fallback failed:", e);
    // Last resort: try to start from ROUND_1 if possible
    if (getState() === STATES.BOOT) {
      transition(STATES.INTRO);
      persist();
    }
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DDD MVP boot");

  // Install close guard to warn during active rituals
  installCloseGuard(getState);

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
      clearSession();
      location.reload();
    }
  });

  // OPTIONAL: run validator first (if you added it)
  const assetsValid = await validateAssets();
  if (!assetsValid) {
    return; // Stop execution if validation failed
  }

  const saved = loadSession();

  if (saved && isActiveRitualState(saved.state)) {
    // RESUME - skip INTRO when resuming from persistence
    currentSessionId = saved.session_id;
    startedAt = saved.started_at;
    setBitsArray(saved.bits || []);
    transition(saved.state);
    persist();

    await resumeFromState(saved.state);
    return;
  }

  // START NEW (either no session, or last session ended)
  // Always go through INTRO (no dev skip)
  currentSessionId = newSessionId();
  startedAt = Date.now();

  reset(); // clears bits in rules.js
  transition(STATES.INTRO);
  persist();

  renderTextScreen("DIGITAL DIVINATION DEVICE", "Initializing…");
  await wait(PACE.INTRO_HOLD_MS);

  transition(STATES.ROUND_1);
  persist();
  await renderRound(1);
});
