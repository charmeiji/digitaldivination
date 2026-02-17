/**
 * Render functions for new ritual states:
 * ORACLE_INTRO, CRYSTAL_PREVIEW, FACE_POSITION, PORTRAIT_CAPTURE, NAME_ENTRY, READY_CONFIRM
 */

import { PACE } from "../pacing.js";
import { wait, paceTimeout, clearPaceTimers } from "../util.js";
import { getState } from "../state_machine.js";
import { STATES } from "../state_machine.js";
import { startCamera, stopCamera, captureStill } from "../camera/camera_capture.js";
import { saveSession } from "../session_store.js";
import { CONFIG } from "../config.js";
import { playCrystalReveal, startOracleTheme, stopOracleTheme } from "../audio.js";

let currentStream = null;
let currentVideo = null;

function logPace(msg, data) {
  if (CONFIG.DEBUG_PACE_LOGS) console.log(msg, data ?? "");
}

/** If DEV skip is active, resolve immediately; otherwise wait. Used only for dialogue pacing. */
function devSkipWait(ms) {
  if (window.__DEV_SKIP_ACTIVE) return Promise.resolve();
  return wait(ms);
}

/** Skippable delay when __pace.active: Enter/Space resolves early. Otherwise same as devSkipWait. */
function paceWait(ms) {
  if (window.__DEV_SKIP_ACTIVE) return Promise.resolve();
  if (!window.__pace?.active) return wait(ms);
  return new Promise((resolve) => {
    const id = paceTimeout(() => {
      if (window.__pace) window.__pace.nextTick = null;
      resolve();
    }, ms);
    window.__pace.nextTick = () => {
      window.__pace.timers.delete(id);
      clearTimeout(id);
      window.__pace.nextTick = null;
      resolve();
    };
  });
}

const ORACLE_LINE_BASE_STYLE = "font-family: monospace; font-size: clamp(20px, 4vw, 32px); color: #fff; text-align: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);";

/** Name-reaction blocks: pick exactly one per run. */
const NAME_REACTION_BLOCKS = Object.freeze([
  ["it settles upon you convincingly."],
  ["it clings to you.", "how appropriate."],
  ["curious.", "very curious."],
  ["ahh...", "that name...", "fragile.", "delicate.", "it will do."]
]);

function waitForTransition(target, propertyName, durationMs) {
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        target.removeEventListener("transitionend", handler);
        logPace("[ORACLE] transition timeout", { propertyName });
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
}

/**
 * Resolve when timeoutMs elapses or user advances (pointerdown / Enter|Space) after enableAfterMs, and predicateWhenEnabled() is true.
 * Listeners are removed on first resolve. Use during oracle intro only; predicate should check current state.
 */
function waitForAdvanceOrTimeout({ timeoutMs, enableAfterMs, predicateWhenEnabled }) {
  return new Promise((resolve) => {
    const start = performance.now();
    let resolved = false;

    const finish = (reason) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      if (window.__pace) window.__pace.timers.delete(timeoutId);
      clearTimeout(timeoutId);
      if (window.__pace) window.__pace.nextTick = null;
      resolve();
    };

    if (window.__pace) window.__pace.nextTick = () => finish("input");
    const timeoutId = paceTimeout(() => finish("timeout"), timeoutMs);

    function onInput(e) {
      const elapsed = performance.now() - start;
      const pred = typeof predicateWhenEnabled === "function" ? predicateWhenEnabled() : true;
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      if (e.type === "keydown") {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") return;
        if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.shiftKey && !e.altKey) return;
      }
      if (elapsed < enableAfterMs) return;
      if (typeof predicateWhenEnabled === "function" && !predicateWhenEnabled()) return;
      finish("input");
    }

    window.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
  });
}

/**
 * Build oracle scene DOM: character, ball, text container. Same layout for ORACLE_INTRO and READY_CONFIRM.
 */
function createOracleSceneDom(rootEl) {
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; align-items: center; justify-content: center; overflow: hidden;";
  const character = document.createElement("img");
  character.src = "assets/catoracle.png";
  character.alt = "Catoracle";
  character.style.cssText = "position: absolute; width: 340px; height: auto; max-height: 420px; object-fit: contain; left: 50%; top: 58%; transform: translate(-50%, -50%); z-index: 2;";
  const ballContainer = document.createElement("div");
  ballContainer.style.cssText = "position: absolute; left: 50%; top: 58%; width: 300px; height: 300px; transform: translate(-50%, -50%); border-radius: 50%; border: 4px solid rgba(255, 255, 255, 0.3); background: rgba(0, 0, 0, 0.5); z-index: 1;";
  const textContainer = document.createElement("div");
  textContainer.style.cssText = "position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 3; pointer-events: none;";
  rootEl.appendChild(character);
  rootEl.appendChild(ballContainer);
  rootEl.appendChild(textContainer);
  rootEl.style.opacity = "1";
  return { rootEl, textContainer, character, ballContainer };
}

/**
 * Demote existing lines to ghost, append new line at full opacity.
 * @param {HTMLElement} textContainer
 * @param {string} text
 * @param {{ isNameLine?: boolean }} opts
 * @returns {HTMLElement} the new line element
 */
function appendLine(textContainer, text, { isNameLine = false } = {}) {
  for (const child of textContainer.children) {
    child.classList.add("oracle-line--ghost");
  }
  const line = document.createElement("div");
  line.style.cssText = ORACLE_LINE_BASE_STYLE + (textContainer.children.length > 0 ? " margin-top: 20px;" : "");
  if (isNameLine) line.classList.add("oracle-line--name");
  line.textContent = text;
  textContainer.appendChild(line);
  return line;
}

/**
 * Show one oracle line with ghost trail: demote previous to ghost, append new, animate in, hold, then resolve.
 * When window.__DEV_SKIP_ACTIVE is true, appends line at full opacity and resolves immediately (no animation/hold).
 * When allowSkipAfterReveal is true, hold can end early on user advance after line reveal + minHoldBeforeSkipMs.
 */
async function showOracleLine(textContainer, text, holdMs, { isNameLine = false, allowSkipAfterReveal = false, minHoldBeforeSkipMs = 0 } = {}) {
  if (window.__DEV_SKIP_ACTIVE) {
    appendLine(textContainer, text, { isNameLine });
    const last = textContainer.lastElementChild;
    if (last) last.style.opacity = "1";
    return;
  }
  const line = appendLine(textContainer, text, { isNameLine });
  line.style.opacity = "0";
  line.style.transition = `opacity ${PACE.ORACLE_LINE_IN_MS}ms ease-in-out`;
  await new Promise((r) => requestAnimationFrame(r));
  line.style.opacity = "1";
  window.__activeFadingText = line;
  window.__isFadingTextActive = true;
  let transitionResolve;
  const transitionPromise = new Promise((r) => { transitionResolve = r; });
  if (window.__pace) window.__pace.transitionResolve = transitionResolve;
  await Promise.race([waitForTransition(line, "opacity", PACE.ORACLE_LINE_IN_MS), transitionPromise]);
  if (window.__pace) window.__pace.transitionResolve = null;
  window.__isFadingTextActive = false;
  window.__activeFadingText = null;
  const enableAfterMs = minHoldBeforeSkipMs ?? 0;
  if (allowSkipAfterReveal) {
    await waitForAdvanceOrTimeout({
      timeoutMs: holdMs,
      enableAfterMs,
      predicateWhenEnabled: () => getState() === STATES.ORACLE_INTRO
    });
  } else {
    let holdResolve;
    const holdPromise = new Promise((r) => { holdResolve = r; });
    const holdId = paceTimeout(() => {
      if (window.__pace) window.__pace.nextTick = null;
      holdResolve();
    }, holdMs);
    if (window.__pace) window.__pace.nextTick = () => {
      window.__pace.timers.delete(holdId);
      clearTimeout(holdId);
      if (window.__pace) window.__pace.nextTick = null;
      holdResolve();
    };
    await holdPromise;
  }
}

/**
 * Render ORACLE_INTRO state — Phase A: welcome/intro text only (oracle + ball).
 * Beat timeline: fade overlay down, first line (skippable after reveal), interline delay, second line (skippable), zoom delay.
 */
export async function renderOracleIntro(rootEl) {
  startOracleTheme();
  // Run oracle intro at full pace even if user had clicked SKIP on a previous screen
  if (window.__DEV_SKIP_ACTIVE) window.__DEV_SKIP_ACTIVE = false;

  if (window.__pace) {
    window.__pace.active = true;
    window.__pace.nextTick = null;
    clearPaceTimers();
  }

  try {
  const fadeOverlay = document.getElementById("fadeOverlay");
  const oracleFadeInMs = PACE.ORACLE_INTRO_FADE_IN_MS ?? PACE.FADE_IN_MS;

  const { textContainer } = createOracleSceneDom(rootEl);

  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  // Beat 1: fade overlay down
  const overlayFadePromise = fadeOverlay ? new Promise((resolve) => {
    fadeOverlay.style.transition = `opacity ${oracleFadeInMs}ms ease-in-out`;
    fadeOverlay.style.opacity = "0";
    const handler = (e) => {
      if (e.target === fadeOverlay && e.propertyName === "opacity") {
        fadeOverlay.removeEventListener("transitionend", handler);
        fadeOverlay.classList.remove("active");
        fadeOverlay.style.pointerEvents = "none";
        logPace("[ORACLE_INTRO] overlay fade complete");
        resolve();
      }
    };
    fadeOverlay.addEventListener("transitionend", handler);
    setTimeout(() => {
      fadeOverlay.removeEventListener("transitionend", handler);
      if (fadeOverlay) {
        fadeOverlay.classList.remove("active");
        fadeOverlay.style.pointerEvents = "none";
      }
      resolve();
    }, oracleFadeInMs * 2 + 200);
  }) : Promise.resolve();

  await overlayFadePromise;

  const holdMs = (i) => (Array.isArray(PACE.ORACLE_LINE_HOLD_MS) ? PACE.ORACLE_LINE_HOLD_MS[i] : PACE.ORACLE_LINE_HOLD_MS) ?? 1400;
  const minHoldBeforeSkip = PACE.ORACLE_MIN_HOLD_BEFORE_SKIP_MS ?? 0;

  // Beat 2: first line (skippable after reveal)
  await paceWait(PACE.ORACLE_FIRST_LINE_DELAY_MS ?? 1200);
  await showOracleLine(textContainer, "HELLO. WELCOME.", holdMs(0), {
    allowSkipAfterReveal: true,
    minHoldBeforeSkipMs: minHoldBeforeSkip
  });

  // Beat 3: interline delay (skippable via Enter/Space)
  await paceWait(PACE.ORACLE_INTERLINE_DELAY_MS ?? 900);

  // Beat 4: second line (skippable after reveal)
  await showOracleLine(textContainer, "LOOK INTO MY CRYSTAL BALL.", holdMs(1), {
    allowSkipAfterReveal: true,
    minHoldBeforeSkipMs: minHoldBeforeSkip
  });

  // Beat 5: zoom delay before transition to crystal (skippable)
  await paceWait(PACE.CRYSTAL_ZOOM_DELAY_MS);
  if (window.__DEV_SKIP_ACTIVE) window.__DEV_SKIP_ACTIVE = false;
  } finally {
    if (window.__pace) {
      window.__pace.active = false;
      window.__pace.nextTick = null;
      clearPaceTimers();
    }
  }
}

/**
 * Render ORACLE_POST_PORTRAIT — Phase C: "ahh... I see..." + name flow. Gated on portrait completion.
 */
export async function renderOraclePostPortrait(rootEl, onComplete) {
  startOracleTheme();
  if (CONFIG.DEBUG_PACE_LOGS) console.log("[ORACLE_POST_PORTRAIT] entering (after portrait)");
  const fadeOverlay = document.getElementById("fadeOverlay");
  if (fadeOverlay) {
    fadeOverlay.style.opacity = "0";
    fadeOverlay.classList.remove("active");
    fadeOverlay.style.pointerEvents = "none";
  }
  if (window.__pace) {
    window.__pace.active = true;
    window.__pace.nextTick = null;
    clearPaceTimers();
  }
  const { textContainer } = createOracleSceneDom(rootEl);
  const holdMs = (i) => (Array.isArray(PACE.ORACLE_LINE_HOLD_MS) ? PACE.ORACLE_LINE_HOLD_MS[i] : PACE.ORACLE_LINE_HOLD_MS) ?? 1400;
  const interline = PACE.ORACLE_INTERLINE_DELAY_MS ?? 900;

  try {
    await paceWait(PACE.ORACLE_FIRST_LINE_DELAY_MS ?? 1200);
    await showOracleLine(textContainer, "ahh...", holdMs(0));
    await paceWait(interline);
    await showOracleLine(textContainer, "I see.", holdMs(1));
  } finally {
    if (window.__pace) {
      window.__pace.active = false;
      window.__pace.nextTick = null;
      clearPaceTimers();
    }
  }
  if (window.__DEV_SKIP_ACTIVE) {
    window.__DEV_SKIP_ACTIVE = false;
  }
  if (onComplete) onComplete();
}

/**
 * Ensure fade overlay is cleared so content is visible (defensive for CRYSTAL_PREVIEW / FACE_POSITION).
 */
function clearFadeOverlay() {
  const fadeOverlay = document.getElementById("fadeOverlay");
  if (fadeOverlay) {
    fadeOverlay.style.opacity = "0";
    fadeOverlay.classList.remove("active");
    fadeOverlay.style.pointerEvents = "none";
    logPace("[FADE] clearFadeOverlay");
  }
}

/**
 * Render CRYSTAL_PREVIEW state (camera reveal inside crystal ball)
 */
export async function renderCrystalPreview(rootEl) {
  startOracleTheme();
  clearFadeOverlay();
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; align-items: center; justify-content: center; overflow: hidden;";
  
  // Crystal ball container with mask
  const ballContainer = document.createElement("div");
  ballContainer.className = "crystal-mask";
  ballContainer.style.cssText = "position: relative; width: 300px; height: 300px; border-radius: 50%; overflow: hidden; border: 4px solid rgba(255, 255, 255, 0.3); z-index: 1;";
  
  const zoomMs = PACE.CRYSTAL_ZOOM_MS ?? PACE.CAMERA_REVEAL_FADE_MS;
  const video = document.createElement("video");
  video.id = "cameraVideo";
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.cssText = "width: 100%; height: 100%; object-fit: cover; opacity: 0;";
  ballContainer.appendChild(video);
  rootEl.appendChild(ballContainer);
  currentVideo = video;

  try {
    currentStream = await startCamera(video);
    await wait(PACE.CAMERA_REVEAL_DELAY_MS);
    playCrystalReveal();
    video.style.transition = `opacity ${zoomMs}ms ease-in`;
    video.style.opacity = "1";
    await wait(zoomMs);
    await wait(500);
  } catch (error) {
    console.error("Camera failed:", error);
  }
}

/**
 * Render FACE_POSITION state
 */
export async function renderFacePosition(rootEl, onComplete) {
  startOracleTheme();
  clearFadeOverlay();
  // Keep camera running if it was from previous state
  if (!currentVideo || !currentStream) {
    // Recreate if needed
    rootEl.innerHTML = "";
    rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; align-items: center; justify-content: center; overflow: hidden;";
    
    const ballContainer = document.createElement("div");
    ballContainer.className = "crystal-mask";
    ballContainer.style.cssText = "position: relative; width: 300px; height: 300px; border-radius: 50%; overflow: hidden; border: 4px solid rgba(255, 255, 255, 0.3); z-index: 1;";
    
    const video = document.createElement("video");
    video.id = "cameraVideo";
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
    
    ballContainer.appendChild(video);
    rootEl.appendChild(ballContainer);
    
    currentVideo = video;
    
    try {
      currentStream = await startCamera(video);
    } catch (error) {
      console.error("Camera failed:", error);
    }
  }
  
  // Prompt overlay
  const prompt = document.createElement("div");
  prompt.style.cssText = "position: absolute; top: 20%; left: 50%; transform: translateX(-50%); font-family: monospace; font-size: clamp(18px, 3vw, 28px); color: #fff; text-align: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8); opacity: 0; z-index: 10;";
  prompt.textContent = "POSITION YOUR FACE";
  
  rootEl.appendChild(prompt);
  
  // Fade in prompt
  await wait(100);
  prompt.style.transition = `opacity ${PACE.FACE_PROMPT_IN_MS}ms ease-in`;
  prompt.style.opacity = "1";
  await wait(PACE.FACE_PROMPT_IN_MS);
  
  // Enforced dwell
  await wait(PACE.FACE_DWELL_MS);
  
  // Auto-capture after delay
  await wait(PACE.AUTO_CAPTURE_AFTER_MS - PACE.FACE_DWELL_MS);
  
  if (onComplete) onComplete();
}

/**
 * Render PORTRAIT_CAPTURE state
 */
export async function renderPortraitCapture(rootEl, onComplete) {
  startOracleTheme();
  if (!currentVideo) {
    console.error("No video element for capture");
    if (onComplete) onComplete();
    return;
  }

  // Capture still (no flash)
  let dataUrl = null;
  try {
    if (currentVideo.videoWidth > 0) {
      const result = captureStill(currentVideo);
      dataUrl = result.dataUrl;
    } else {
      // Fallback placeholder
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#4a148c";
      ctx.fillRect(0, 0, 300, 300);
      ctx.fillStyle = "#fff";
      ctx.font = "24px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Portrait", 150, 150);
      dataUrl = canvas.toDataURL("image/png");
    }
  } catch (error) {
    console.error("Capture failed:", error);
  }

  // Store portrait to session
  if (dataUrl) {
    const session = JSON.parse(localStorage.getItem("ddd_session_v1") || "{}");
    session.portrait_data_url = dataUrl;
    saveSession(session);
  }
  
  // Freeze frame - replace video with still
  if (currentVideo && dataUrl) {
    const stillImg = document.createElement("img");
    stillImg.src = dataUrl;
    stillImg.style.cssText = "width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0;";
    
    const ballContainer = rootEl.querySelector(".crystal-mask");
    if (ballContainer) {
      currentVideo.style.display = "none";
      ballContainer.appendChild(stillImg);
    }
  }
  
  // Stop camera
  if (currentStream) {
    stopCamera(currentStream);
    currentStream = null;
  }
  
  // Hold freeze
  await wait(PACE.FREEZE_HOLD_MS);
  
  if (onComplete) onComplete();
}

/**
 * Render NAME_ENTRY state
 */
export async function renderNameEntry(rootEl, onComplete) {
  startOracleTheme();
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace;";
  
  const prompt = document.createElement("div");
  prompt.style.cssText = "font-size: clamp(20px, 4vw, 32px); color: #fff; text-align: center; margin-bottom: 30px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);";
  prompt.textContent = "STATE YOUR NAME";
  
  const inputContainer = document.createElement("div");
  inputContainer.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 20px;";
  
  const input = document.createElement("input");
  input.type = "text";
  input.id = "nameInput";
  input.style.cssText = "font-family: monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 20px; border: 2px solid rgba(255, 255, 255, 0.5); background: rgba(0, 0, 0, 0.5); color: #fff; text-align: center; max-width: 300px; width: 100%;";
  input.placeholder = "ENTER IT HERE";
  input.maxLength = 16;
  
  const submitBtn = document.createElement("button");
  submitBtn.textContent = "CONFIRM";
  submitBtn.style.cssText = "font-family: monospace; font-size: clamp(16px, 2.5vw, 20px); padding: 10px 30px; border: 2px solid rgba(255, 255, 255, 0.5); background: rgba(74, 20, 140, 0.8); color: #fff; cursor: pointer;";
  
  inputContainer.appendChild(input);
  inputContainer.appendChild(submitBtn);
  
  rootEl.appendChild(prompt);
  rootEl.appendChild(inputContainer);
  
  // Input lock
  input.disabled = true;
  submitBtn.disabled = true;
  await wait(PACE.NAME_ENTRY_LOCK_MS);
  input.disabled = false;
  submitBtn.disabled = false;
  input.focus();
  
  const handleSubmit = () => {
    const name = input.value.trim();
    if (name.length >= 1 && name.length <= 16) {
      // Store name
      const session = JSON.parse(localStorage.getItem("ddd_session_v1") || "{}");
      session.player_name = name;
      saveSession(session);
      
      // Cleanup
      input.removeEventListener("keydown", handleKeyDown);
      submitBtn.removeEventListener("click", handleSubmit);
      
      if (onComplete) onComplete();
    } else {
      if (name.length === 0) input.placeholder = "SPEAK CLEARLY";
      else input.placeholder = "SHORTEN IT";
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };
  
  input.addEventListener("keydown", handleKeyDown);
  submitBtn.addEventListener("click", handleSubmit);
}

/** Sacred machine (C), artifact (D), directives (E), Kikazaru (F) — static lines. */
const ORACLE_SACRED_MACHINE = Object.freeze([
  "the machine of digital divination is a sacred mechanism.",
  "it listens without judgment.",
  "it arranges without apology.",
  "it reveals what was already present.",
  "you have stepped inside its procession."
]);
const ORACLE_ARTIFACT = Object.freeze([
  "from this sequence,",
  "artifacts will remain.",
  "a record.",
  "a remainder.",
  "a small talisman."
]);
const ORACLE_DIRECTIVES = Object.freeze([
  "when prompted,",
  "you will choose.",
  "when summoned,",
  "you will hold still.",
  "when instructed,",
  "you will pose."
]);
const ORACLE_KIKAZARU = Object.freeze([
  "there will be moments of concealment.",
  "of refusal.",
  "of silence.",
  "you will understand when it is time."
]);

/**
 * Render READY_CONFIRM state: oracle scene + ghost trail B→G, then YES.
 * Returns once DOM is built and dialogue sequence has started, so overlay can fade out; dialogue runs in background.
 */
export async function renderReadyConfirm(rootEl, onComplete) {
  startOracleTheme();
  if (window.__pace) {
    window.__pace.active = true;
    window.__pace.nextTick = null;
    clearPaceTimers();
  }
  const session = JSON.parse(localStorage.getItem("ddd_session_v1") || "{}");
  const playerName = session.player_name || "PLAYER";
  if (session.oracle_name_reaction_index === undefined) {
    session.oracle_name_reaction_index = Math.floor(Math.random() * NAME_REACTION_BLOCKS.length);
    saveSession(session);
  }
  const nameBlock = NAME_REACTION_BLOCKS[session.oracle_name_reaction_index];
  const holdMs = PACE.ORACLE_LINE_HOLD_DEFAULT_MS ?? 1600;
  const interline = PACE.ORACLE_INTERLINE_DELAY_MS ?? 900;

  const { textContainer } = createOracleSceneDom(rootEl);

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "YES";
  confirmBtn.style.cssText = "position: absolute; bottom: 15%; left: 50%; transform: translateX(-50%); z-index: 4; font-family: monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 40px; border: 2px solid rgba(255, 255, 255, 0.5); background: rgba(74, 20, 140, 0.8); color: #fff; cursor: pointer; opacity: 0; pointer-events: none;";
  rootEl.appendChild(confirmBtn);

  confirmBtn.disabled = true;
  let handled = false;
  const handleConfirm = () => {
    if (handled || confirmBtn.disabled) return;
    handled = true;
    confirmBtn.disabled = true;
    confirmBtn.removeEventListener("click", handleConfirm);
    window.removeEventListener("keydown", handleKeyDown);
    if (onComplete) onComplete();
  };
  const handleKeyDown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (handled) return;
    handled = true;
    confirmBtn.disabled = true;
    confirmBtn.removeEventListener("click", handleConfirm);
    window.removeEventListener("keydown", handleKeyDown);
    if (onComplete) onComplete();
  };
  confirmBtn.addEventListener("click", handleConfirm);

  const nameLine = `${playerName},`;
  const lineSteps = [
    { text: "what an odd assortment of letters.", isNameLine: false },
    ...nameBlock.map((text) => ({ text, isNameLine: false })),
    ...ORACLE_SACRED_MACHINE.map((text) => ({ text, isNameLine: false })),
    ...ORACLE_ARTIFACT.map((text) => ({ text, isNameLine: false })),
    ...ORACLE_DIRECTIVES.map((text) => ({ text, isNameLine: false })),
    ...ORACLE_KIKAZARU.map((text) => ({ text, isNameLine: false })),
    { text: nameLine, isNameLine: true },
    { text: "are you ready to begin?", isNameLine: false }
  ];

  function flushRemainingLines(fromIndex) {
    for (let j = fromIndex; j < lineSteps.length; j++) {
      const step = lineSteps[j];
      showOracleLine(textContainer, step.text, holdMs, { isNameLine: step.isNameLine });
    }
  }

  async function runSequence() {
    if (!textContainer.parentElement) {
      if (window.__pace) { window.__pace.active = false; window.__pace.nextTick = null; clearPaceTimers(); }
      return;
    }
    try {
      await paceWait(400);
      if (!textContainer.parentElement) return;

      for (let i = 0; i < lineSteps.length; i++) {
        if (window.__DEV_SKIP_ACTIVE) {
          flushRemainingLines(i);
          if (confirmBtn.parentElement) {
            confirmBtn.style.transition = "opacity 350ms ease-in";
            confirmBtn.style.opacity = "1";
            confirmBtn.style.pointerEvents = "auto";
            confirmBtn.disabled = false;
            window.addEventListener("keydown", handleKeyDown);
          }
          if (onComplete) onComplete();
          window.__DEV_SKIP_ACTIVE = false;
          return;
        }
        const step = lineSteps[i];
        await showOracleLine(textContainer, step.text, holdMs, { isNameLine: step.isNameLine });
        if (i < lineSteps.length - 1) await paceWait(interline);
      }

      if (!confirmBtn.parentElement) return;
      if (window.__DEV_SKIP_ACTIVE) {
        if (onComplete) onComplete();
        window.__DEV_SKIP_ACTIVE = false;
        return;
      }
      confirmBtn.style.transition = "opacity 350ms ease-in";
      confirmBtn.style.opacity = "1";
      confirmBtn.style.pointerEvents = "auto";
      await paceWait(PACE.READY_LOCK_MS);
      confirmBtn.disabled = false;
      window.addEventListener("keydown", handleKeyDown);
    } catch (err) {
      if (CONFIG.DEBUG_PACE_LOGS) console.warn("[READY_CONFIRM] sequence error", err);
    } finally {
      if (window.__pace) {
        window.__pace.active = false;
        window.__pace.nextTick = null;
        clearPaceTimers();
      }
    }
  }

  runSequence();
}

/**
 * Cleanup camera resources
 */
export function cleanupCamera() {
  if (currentStream) {
    stopCamera(currentStream);
    currentStream = null;
  }
  stopOracleTheme();
  currentVideo = null;
}
