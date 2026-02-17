import { STATES, transition, getState, isState } from "./state_machine.js";
import { recordChoiceLetter, getBinaryString, reset, resolveOutcome, getChoices, computeBitstring, accumulateTags, pickStickerSet } from "./rules.js";
import { wait, clearPaceTimers } from "./util.js";
import { PACE } from "./pacing.js";
import { validateAssets } from "./validate_assets.js";
import { loadSession, saveSession, clearSession, newSessionId } from "./session_store.js";
import { CONFIG } from "./config.js";
import { installCloseGuard } from "./close_guard.js";
import { getStickersForBits } from "./logic/sticker_selector.js";
import { renderPreRitual, mountPreRitualInput, unmountPreRitualInput } from "./pre_ritual.js";
import { renderCameraPortrait } from "./views/camera_portrait_view.js";
import { renderPoseCapture } from "./views/pose_capture_view.js";
import { renderOracleIntro, renderOraclePostPortrait, renderCrystalPreview, renderFacePosition, renderPortraitCapture, renderNameEntry, renderReadyConfirm, cleanupCamera } from "./views/ritual_states.js";

let currentSessionId = null;
let startedAt = null;
let manifest = null;
let currentResult = null;
let posePhotos = { hear: null, see: null, speak: null };
let uiLocked = false;
let isTransitioning = false;

export function isUILocked() {
  return uiLocked;
}

function $(sel) {
  return document.querySelector(sel);
}

/** Full-screen white flash (reuse .flash). Returns a Promise that resolves after the flash. */
function whiteFlash() {
  const flash = document.createElement("div");
  flash.className = "flash";
  flash.style.cssText = "position: fixed; inset: 0; background: #ffffff; opacity: 0; pointer-events: none; z-index: 9999; transition: opacity 0.12s ease-out;";
  document.body.appendChild(flash);
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      flash.style.opacity = "1";
      setTimeout(() => {
        flash.style.opacity = "0";
        setTimeout(() => {
          flash.remove();
          resolve();
        }, 120);
      }, 120);
    });
  });
}

async function fadeTransition(nextState, renderCallback, options = {}) {
  if (isTransitioning) return;

  const overlay = $("#fadeOverlay");
  if (!overlay) {
    console.error("fadeOverlay element not found");
    return;
  }

  const fadeOutMs = options.fadeOutMs ?? PACE.FADE_OUT_MS;
  const fadeInMs = options.fadeInMs ?? PACE.FADE_IN_MS;
  const skipFadeIn = options.skipFadeIn === true;
  const unlockDuringCallback = options.unlockDuringCallback === true;
  if (CONFIG.DEBUG_PACE_LOGS) {
    console.log("[fadeTransition]", { nextState, fadeOutMs, fadeInMs, skipFadeIn, unlockDuringCallback });
  }

  isTransitioning = true;
  uiLocked = true;

  try {
    const waitForTransition = (target, propertyName, durationMs) => {
      return new Promise((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            target.removeEventListener("transitionend", handler);
            resolve();
          }
        }, durationMs * 2 + 200);

        const handler = (e) => {
          if (e.target === target && e.propertyName === propertyName && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            target.removeEventListener("transitionend", handler);
            resolve();
          }
        };
        target.addEventListener("transitionend", handler);
      });
    };

    // Fade to black (overlay opacity 1 before state switch)
    if (CONFIG.DEBUG_PACE_LOGS) console.log("[fadeTransition] starting overlay fade to black", { nextState });
    overlay.style.transition = `opacity ${fadeOutMs}ms ease-in-out`;
    overlay.style.opacity = "1";
    overlay.classList.add("active");
    await waitForTransition(overlay, "opacity", fadeOutMs);

    if (nextState) {
      transition(nextState);
      persist();
    }

    isTransitioning = false;

    if (unlockDuringCallback) {
      uiLocked = false;
    }

    // Render next state while overlay is still black so we never show previous state
    const callbackPromise = renderCallback ? renderCallback() : Promise.resolve();
    await callbackPromise;
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    if (!skipFadeIn) {
      if (unlockDuringCallback) {
        uiLocked = true;
      }
      overlay.style.transition = `opacity ${fadeInMs}ms ease-in-out`;
      overlay.style.opacity = "0";
      await waitForTransition(overlay, "opacity", fadeInMs);
      if (CONFIG.DEBUG_PACE_LOGS) console.log("[fadeTransition] overlay fade out complete");
    }
    overlay.classList.remove("active");
    overlay.style.pointerEvents = "none";
  } finally {
    uiLocked = false;
  }
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
  const existingSession = loadSession() || {};
  
  saveSession({
    runId: currentSessionId,
    startedAt: new Date(startedAt).toISOString(),
    choices: choices.slice(),
    bitstring,
    tagTotals,
    stickerSetId,
    selectedStickerPaths,
    state: getState(),
    portrait_data_url: existingSession.portrait_data_url || null,
    player_name: existingSession.player_name || null
  });
}
  
function stateForRound(n) {
  return STATES[`ROUND_${n}`];
}

function renderTextScreen(title, subtitle = "", showDownloads = false) {
  const downloadButtons = showDownloads && currentResult ? `
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
  ` : "";
  
  $("#app").innerHTML = `
    <main style="padding:16px; font-family:monospace;">
      <div style="margin-bottom:8px;">${title}</div>
      ${subtitle ? `<div style="opacity:.8;">${subtitle}</div>` : ""}
      ${downloadButtons}
    </main>
  `;
  
  if (showDownloads && currentResult) {
    $("#downloadStickers")?.addEventListener("click", downloadStickerSheet);
    $("#downloadPhoto")?.addEventListener("click", downloadPhoto);
    $("#downloadTalisman")?.addEventListener("click", downloadTalisman);
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
  $("#app").innerHTML = `
    <main style="padding:0; margin:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; background:#000;">
      <img src="assets/photos/strip_00000.png" style="max-width:100%; max-height:100%; object-fit:contain;" alt="" />
    </main>
  `;
}

function renderImageScreen(label, src) {
  $("#app").innerHTML = `
    <main style="padding:16px; font-family:monospace; background:#fff; min-height:100vh;">
      <div style="margin-bottom:10px;">${label}</div>
      ${src ? `<img src="${src}" style="max-width:100%; height:auto; display:block;" />` : `<div style="opacity:.7;">(missing)</div>`}
    </main>
  `;
}

async function renderStickerScreen(result) {
  let stickers = (result.stickers || []).filter(Boolean).slice(0, 7);
  if (posePhotos.hear) {
    stickers = [{ src: posePhotos.hear, id: "portrait_hear" }, ...stickers];
  }
  
  const PLACEHOLDER_SRC = "assets/stickers/placeholder.png";
  const metaRight = (CONFIG?.SHOW_DEBUG_CODE ?? true) ? `CODE ${result.code}` : `SHEET`;

  $("#app").innerHTML = `
    <main class="sheet" style="background:#fff;">
      <div class="crop tl"></div>
      <div class="crop tr"></div>
      <div class="crop bl"></div>
      <div class="crop br"></div>
      <div class="sheet-header">
        <div class="sheet-title">STICKER SHEET</div>
        <div class="sheet-meta">${metaRight}</div>
      </div>
      <div class="sticker-grid">
        ${stickers.map(s => `
          <div class="sticker-cell">
            ${s?.src ? `<img class="sticker-img" src="${s.src}" alt="" />` : ""}
          </div>
        `).join("")}
      </div>
      <canvas id="stickerCanvas" width="800" height="800" style="display:none;"></canvas>
    </main>
  `;

  document.querySelectorAll(".sticker-img").forEach((img) => {
    img.addEventListener("error", () => {
      if (img.src !== PLACEHOLDER_SRC) {
        img.src = PLACEHOLDER_SRC;
      }
    }, { once: true });
  });

  const canvas = $("#stickerCanvas");
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
        const imgAspect = img.width / img.height;
        const cellAspect = w / h;
        let drawW, drawH, drawX, drawY;
        
        if (imgAspect > cellAspect) {
          drawH = h;
          drawW = img.width * (h / img.height);
          drawX = x + (w - drawW) / 2;
          drawY = y;
        } else {
          drawW = w;
          drawH = img.height * (w / img.width);
          drawX = x;
          drawY = y + (h - drawH) / 2;
        }
        
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        resolve();
      };
      img.onerror = () => {
        const placeholderImg = new Image();
        placeholderImg.crossOrigin = "anonymous";
        placeholderImg.onload = () => {
          ctx.drawImage(placeholderImg, x, y, w, h);
          resolve();
        };
        placeholderImg.onerror = () => resolve();
        placeholderImg.src = PLACEHOLDER_SRC;
      };
      img.src = s.src;
    });
  }

  window.stickerCanvas = canvas;
  window.stickerResult = result;
}

async function capturePose(poseText, poseKey) {
  return new Promise((resolve) => {
    renderPoseCapture($("#app"), {
      pose: poseText,
      onDone: (dataUrl) => {
        posePhotos[poseKey] = dataUrl;
        persist();
        resolve();
      }
    });
  });
}

async function generatePhotoStrip(poses) {
  const canvas = document.createElement("canvas");
  const cellWidth = 400;
  const cellHeight = 400;
  canvas.width = cellWidth * 3;
  canvas.height = cellHeight;
  
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const poseKeys = ["hear", "see", "speak"];
  for (let i = 0; i < 3; i++) {
    const dataUrl = poses[poseKeys[i]];
    if (!dataUrl) continue;
    
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = () => {
        const imgAspect = img.width / img.height;
        const cellAspect = cellWidth / cellHeight;
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > cellAspect) {
          drawHeight = cellHeight;
          drawWidth = img.width * (cellHeight / img.height);
          offsetX = (cellWidth - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = cellWidth;
          drawHeight = img.height * (cellWidth / img.width);
          offsetX = 0;
          offsetY = (cellHeight - drawHeight) / 2;
        }
        
        ctx.drawImage(img, i * cellWidth + offsetX, offsetY, drawWidth, drawHeight);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataUrl;
    });
  }
  
  return canvas.toDataURL("image/png");
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

  app.innerHTML = `
    <main style="display:flex; gap:16px; padding:16px; align-items:center;">
      <button id="choiceA" disabled style="border:0; background:transparent; cursor:not-allowed; opacity:.65;">
        <img src="${round.a.img}" alt="Choice A" style="max-width:320px; height:auto; display:block;" />
      </button>
      <button id="choiceB" disabled style="border:0; background:transparent; cursor:not-allowed; opacity:.65;">
        <img src="${round.b.img}" alt="Choice B" style="max-width:320px; height:auto; display:block;" />
      </button>
    </main>
  `;

  await wait(PACE.ROUND_ENTER_MS);
  if (!isState(expectedState)) return;

  const btnA = $("#choiceA");
  const btnB = $("#choiceB");
  btnA.disabled = false;
  btnB.disabled = false;
  btnA.style.cursor = "pointer";
  btnB.style.cursor = "pointer";
  btnA.style.opacity = "1";
  btnB.style.opacity = "1";

  let locked = false;

  const poseMap = { 2: ["hear no evil", "hear"], 3: ["see no evil", "see"], 4: ["speak no evil", "speak"] };

  async function choose(letter) {
    if (locked || getState() !== expectedState) return;

    locked = true;
    btnA.disabled = true;
    btnB.disabled = true;

    recordChoiceLetter(letter);
    persist();
    await wait(PACE.ROUND_AFTER_CHOICE_MS);

    if (poseMap[n]) {
      await capturePose(poseMap[n][0], poseMap[n][1]);
    }

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

async function renderOutputSequence(result) {
  transition(STATES.OUTPUT_PHOTO);
  persist();
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
}

async function renderProcessingAndOutputs() {
  const choices = getChoices();
  const code = choices.length === 5 ? computeBitstring(choices) : getBinaryString();
  const codeDisplay = CONFIG.SHOW_DEBUG_CODE ? `CODE: ${code}` : "";
  renderTextScreen("PROCESSING…", codeDisplay);
  await wait(PACE.PROCESSING_MS);

  const m = await loadManifest();
  const result = await resolveOutcome(code, choices, m);
  result.stickers = getStickersForBits(bitsFromCode(code));
  result.photo = await generatePhotoStrip(posePhotos);
  
  console.log("[STICKERS]", result.stickers.map(s => s.id).join(","));
  currentResult = result;
  persist();

  await renderOutputSequence(result);
}

async function resumeFromState(state) {
  if (state.startsWith("ROUND_")) {
    unmountPreRitualInput();
    const n = parseInt(state.split("_")[1], 10);
    await renderRound(n);
    return;
  }

  if (state === STATES.PROCESSING) {
    await renderProcessingAndOutputs();
    return;
  }

  if (state === STATES.OUTPUT_PHOTO || state === STATES.OUTPUT_STICKERS || state === STATES.OUTPUT_TALISMAN) {
    const choices = getChoices();
    const code = choices.length === 5 ? computeBitstring(choices) : getBinaryString();
    const m = await loadManifest();
    const result = await resolveOutcome(code, choices, m);
    result.stickers = getStickersForBits(bitsFromCode(code));
    result.photo = await generatePhotoStrip(posePhotos);
    currentResult = result;
    
    if (state === STATES.OUTPUT_PHOTO) {
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

  if (state === STATES.CAMERA_PORTRAIT) {
    const cleanup = await renderCameraPortrait($("#app"), {
      onDone: async () => {
        if (cleanup) cleanup();
        transition(STATES.ROUND_1);
        persist();
        await renderRound(1);
      }
    });
    return;
  }

  if (state === STATES.ATTRACT) {
    renderPreRitual($("#app"), state);
    mountPreRitualInput({
      state,
      isLocked: isUILocked,
      onAdvance: async () => {
        await fadeTransition(STATES.CONFIRM_1, async () => {
          await resumeFromState(STATES.CONFIRM_1);
        });
      }
    });
    return;
  }

  if (state === STATES.CONFIRM_1) {
    if (CONFIG.DEBUG_PACE_LOGS) console.log("[CONFIRM_1] entering; YES only advances to CONFIRM_2");
    renderPreRitual($("#app"), state);
    mountPreRitualInput({
      state,
      isLocked: isUILocked,
      onAdvance: async () => {
        if (CONFIG.DEBUG_PACE_LOGS) console.log("[CONFIRM_1] YES -> CONFIRM_2 only");
        await fadeTransition(STATES.CONFIRM_2, async () => {
          await resumeFromState(STATES.CONFIRM_2);
        });
      },
      onDecline: async () => {
        await fadeTransition(STATES.ATTRACT, async () => {
          await resumeFromState(STATES.ATTRACT);
        });
      }
    });
    return;
  }

  if (state === STATES.CONFIRM_2) {
    renderPreRitual($("#app"), state);
    mountPreRitualInput({
      state,
      isLocked: isUILocked,
      onAdvance: async () => {
        await fadeTransition(STATES.ORACLE_INTRO, async () => {
          await resumeFromState(STATES.ORACLE_INTRO);
        }, { fadeOutMs: PACE.CONFIRM_2_FADE_TO_BLACK_MS, skipFadeIn: true, unlockDuringCallback: true });
      }
    });
    return;
  }

  if (state === STATES.ORACLE_INTRO) {
    await renderOracleIntro($("#app"));
    await fadeTransition(STATES.CRYSTAL_PREVIEW, async () => {
      await resumeFromState(STATES.CRYSTAL_PREVIEW);
    });
    return;
  }

  if (state === STATES.CRYSTAL_PREVIEW) {
    await renderCrystalPreview($("#app"));
    transition(STATES.FACE_POSITION);
    persist();
    await resumeFromState(STATES.FACE_POSITION);
    return;
  }

  if (state === STATES.FACE_POSITION) {
    await renderFacePosition($("#app"), async () => {
      transition(STATES.PORTRAIT_CAPTURE);
      persist();
      await resumeFromState(STATES.PORTRAIT_CAPTURE);
    });
    return;
  }

  if (state === STATES.PORTRAIT_CAPTURE) {
    await renderPortraitCapture($("#app"), async () => {
      transition(STATES.ORACLE_POST_PORTRAIT);
      persist();
      await resumeFromState(STATES.ORACLE_POST_PORTRAIT);
    });
    return;
  }

  if (state === STATES.ORACLE_POST_PORTRAIT) {
    await renderOraclePostPortrait($("#app"), async () => {
      transition(STATES.NAME_ENTRY);
      persist();
      await resumeFromState(STATES.NAME_ENTRY);
    });
    return;
  }

  if (state === STATES.NAME_ENTRY) {
    if (CONFIG.DEBUG_PACE_LOGS) console.log("[NAME_ENTRY] entering");
    await renderNameEntry($("#app"), async () => {
      if (CONFIG.DEBUG_PACE_LOGS) console.log("[NAME_ENTRY] name confirm clicked");
      if (CONFIG.DEBUG_PACE_LOGS) console.log("[NAME_ENTRY] starting overlay fade to black -> READY_CONFIRM");
      await fadeTransition(STATES.READY_CONFIRM, async () => {
        if (CONFIG.DEBUG_PACE_LOGS) console.log("[NAME_ENTRY] rendering next state (READY_CONFIRM)");
        await resumeFromState(STATES.READY_CONFIRM);
      });
      if (CONFIG.DEBUG_PACE_LOGS) console.log("[NAME_ENTRY] overlay fade out complete");
    });
    return;
  }

  if (state === STATES.READY_CONFIRM) {
    await renderReadyConfirm($("#app"), async () => {
      await whiteFlash();
      await fadeTransition(STATES.ROUND_1, async () => {
        cleanupCamera();
        await resumeFromState(STATES.ROUND_1);
      });
    });
    return;
  }

  if (state === STATES.IDLE) {
    renderIdleScreen();
    let idleListenerAttached = true;
    const handleIdleInteraction = async (e) => {
      if (!idleListenerAttached || getState() !== STATES.IDLE || uiLocked) return;
      
      if (e?.type === "keydown") {
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

  try {
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
    if (getState() === STATES.BOOT) {
      transition(STATES.ATTRACT);
      persist();
      renderPreRitual($("#app"), STATES.ATTRACT);
      mountPreRitualInput({
        state: STATES.ATTRACT,
        isLocked: isUILocked,
        onAdvance: async () => {
          await fadeTransition(STATES.CONFIRM_1, async () => {
            await resumeFromState(STATES.CONFIRM_1);
          });
        }
      });
    }
  }
}

function handleDialogueFastForward() {
  if (!window.__pace?.active) return;

  if (window.__isFadingTextActive && window.__activeFadingText) {
    const el = window.__activeFadingText;
    el.style.transition = "none";
    el.style.opacity = "1";
    void el.offsetWidth;
    window.__isFadingTextActive = false;
    window.__activeFadingText = null;
    if (typeof window.__pace.transitionResolve === "function") {
      window.__pace.transitionResolve();
      window.__pace.transitionResolve = null;
    }
  }

  queueMicrotask(() => {
    queueMicrotask(() => {
      const next = window.__pace.nextTick;
      clearPaceTimers();
      window.__pace.nextTick = null;
      if (typeof next === "function") next();
    });
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DDD MVP boot");

  clearSession();
  installCloseGuard(getState);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" || e.code === "Space") {
      handleDialogueFastForward();
    }
  });

  if (CONFIG.DEV_SKIP_DIALOGUE) {
    window.__DEV_SKIP_ACTIVE = false;
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "dev-skip-btn";
    skipBtn.textContent = "SKIP";
    skipBtn.addEventListener("click", () => {
      window.__DEV_SKIP_ACTIVE = true;
    });
    document.body.appendChild(skipBtn);
  }

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

  setInterval(updateDebugOverlay, 500);

  const assetsValid = await validateAssets();
  if (!assetsValid) return;

  currentSessionId = newSessionId();
  startedAt = Date.now();
  reset();
  posePhotos = { hear: null, see: null, speak: null };
  transition(STATES.ATTRACT);
  persist();

  renderPreRitual($("#app"), STATES.ATTRACT);
  mountPreRitualInput({
    state: STATES.ATTRACT,
    isLocked: isUILocked,
    onAdvance: async () => {
      await fadeTransition(STATES.CONFIRM_1, async () => {
        await resumeFromState(STATES.CONFIRM_1);
      });
    }
  });
});
