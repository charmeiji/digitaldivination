/**
 * Render functions for new ritual states:
 * ORACLE_INTRO, CRYSTAL_PREVIEW, FACE_POSITION, PORTRAIT_CAPTURE, NAME_ENTRY, READY_CONFIRM
 */

import { PACE } from "../pacing.js";
import { wait } from "../util.js";
import { startCamera, stopCamera, captureStill } from "../camera/camera_capture.js";
import { saveSession } from "../session_store.js";
import { CONFIG } from "../config.js";
import { playCrystalReveal } from "../audio.js";

let currentStream = null;
let currentVideo = null;

function logPace(msg, data) {
  if (CONFIG.DEBUG_PACE_LOGS) console.log(msg, data ?? "");
}

/**
 * Render ORACLE_INTRO state
 */
export async function renderOracleIntro(rootEl) {
  
  // Fade out overlay and start content setup in parallel
  const fadeOverlay = document.getElementById('fadeOverlay');
  const overlayFadePromise = fadeOverlay ? new Promise((resolve) => {
    fadeOverlay.style.transition = `opacity ${PACE.FADE_IN_MS}ms ease-in-out`;
    fadeOverlay.style.opacity = "0";
    const handler = (e) => {
      if (e.target === fadeOverlay && e.propertyName === "opacity") {
        fadeOverlay.removeEventListener("transitionend", handler);
        fadeOverlay.classList.remove("active");
        resolve();
      }
    };
    fadeOverlay.addEventListener("transitionend", handler);
    setTimeout(() => {
      fadeOverlay.removeEventListener("transitionend", handler);
      if (fadeOverlay) fadeOverlay.classList.remove("active");
      resolve();
    }, PACE.FADE_IN_MS * 2 + 200);
  }) : Promise.resolve();
  
  // Setup content immediately (while overlay is fading out)
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; align-items: center; justify-content: center; overflow: hidden;";
  
  const character = document.createElement("img");
  character.src = "assets/catoracle.png";
  character.alt = "Catoracle";
  character.style.cssText = "position: absolute; width: 340px; height: auto; max-height: 420px; object-fit: contain; left: 50%; top: 58%; transform: translate(-50%, -50%); z-index: 2;";

  const ballContainer = document.createElement("div");
  ballContainer.style.cssText = "position: absolute; left: 50%; top: 58%; width: 300px; height: 300px; transform: translate(-50%, -50%); border-radius: 50%; border: 4px solid rgba(255, 255, 255, 0.3); background: rgba(0, 0, 0, 0.5); z-index: 1;";
  
  const textOverlay = document.createElement("div");
  textOverlay.style.cssText = "position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 3; pointer-events: none;";
  
  const line1 = document.createElement("div");
  line1.style.cssText = "font-family: monospace; font-size: clamp(20px, 4vw, 32px); color: #fff; text-align: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8); opacity: 0;";
  line1.textContent = "HELLO. WELCOME.";
  
  const line2 = document.createElement("div");
  line2.style.cssText = "font-family: monospace; font-size: clamp(20px, 4vw, 32px); color: #fff; text-align: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8); opacity: 0; margin-top: 20px;";
  line2.textContent = "LOOK INTO MY CRYSTAL BALL.";
  
  textOverlay.appendChild(line1);
  textOverlay.appendChild(line2);
  
  rootEl.appendChild(character);
  rootEl.appendChild(ballContainer);
  rootEl.appendChild(textOverlay);
  rootEl.style.opacity = "1";

  const holdMs = (i) => (Array.isArray(PACE.ORACLE_LINE_HOLD_MS) ? PACE.ORACLE_LINE_HOLD_MS[i] : PACE.ORACLE_LINE_HOLD_MS) ?? 1400;

  const waitForTransition = (target, propertyName, durationMs) => {
    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          target.removeEventListener("transitionend", handler);
          logPace(`[ORACLE_INTRO] transition timeout ${propertyName}`);
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

  await new Promise((resolve) => setTimeout(resolve, Math.max(0, PACE.FADE_IN_MS * 0.8 - 100 + 300)));
  if (!line1.parentElement) textOverlay.appendChild(line1);
  line1.style.transition = `opacity ${PACE.ORACLE_LINE_IN_MS}ms ease-in-out`;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  line1.style.opacity = "1";
  await overlayFadePromise;
  await waitForTransition(line1, "opacity", PACE.ORACLE_LINE_IN_MS);
  await wait(holdMs(0));
  line1.style.transition = `opacity ${PACE.ORACLE_LINE_OUT_MS}ms ease-in-out`;
  line1.style.opacity = "0";
  await waitForTransition(line1, "opacity", PACE.ORACLE_LINE_OUT_MS);

  if (!line2.parentElement) textOverlay.appendChild(line2);
  line2.style.transition = `opacity ${PACE.ORACLE_LINE_IN_MS}ms ease-in-out`;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  line2.style.opacity = "1";
  await waitForTransition(line2, "opacity", PACE.ORACLE_LINE_IN_MS);
  await wait(holdMs(1));
  await wait(PACE.CRYSTAL_ZOOM_DELAY_MS);
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
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace;";
  
  const prompt = document.createElement("div");
  prompt.style.cssText = "font-size: clamp(20px, 4vw, 32px); color: #fff; text-align: center; margin-bottom: 30px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);";
  prompt.textContent = "PLAYER NAME";
  
  const inputContainer = document.createElement("div");
  inputContainer.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 20px;";
  
  const input = document.createElement("input");
  input.type = "text";
  input.id = "nameInput";
  input.style.cssText = "font-family: monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 20px; border: 2px solid rgba(255, 255, 255, 0.5); background: rgba(0, 0, 0, 0.5); color: #fff; text-align: center; max-width: 300px; width: 100%;";
  input.placeholder = "ENTER A NAME";
  input.maxLength = 16;
  
  const submitBtn = document.createElement("button");
  submitBtn.textContent = "SUBMIT";
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
      // Minimal nudge
      input.placeholder = "ENTER A NAME";
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

/**
 * Render READY_CONFIRM state
 */
export async function renderReadyConfirm(rootEl, onComplete) {
  // Load player name from session
  const session = JSON.parse(localStorage.getItem("ddd_session_v1") || "{}");
  const playerName = session.player_name || "PLAYER";
  
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace;";
  
  const text = document.createElement("div");
  text.style.cssText = "font-size: clamp(20px, 4vw, 32px); color: #fff; text-align: center; margin-bottom: 40px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);";
  text.textContent = `${playerName} — ARE YOU READY TO BEGIN?`;
  
  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "YES";
  confirmBtn.style.cssText = "font-family: monospace; font-size: clamp(18px, 3vw, 24px); padding: 12px 40px; border: 2px solid rgba(255, 255, 255, 0.5); background: rgba(74, 20, 140, 0.8); color: #fff; cursor: pointer;";
  
  rootEl.appendChild(text);
  rootEl.appendChild(confirmBtn);
  
  // Input lock
  confirmBtn.disabled = true;
  await wait(PACE.READY_LOCK_MS);
  confirmBtn.disabled = false;
  
  const handleConfirm = () => {
    confirmBtn.removeEventListener("click", handleConfirm);
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        window.removeEventListener("keydown", handleKeyDown);
        if (onComplete) onComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { once: true });
    if (onComplete) onComplete();
  };
  
  confirmBtn.addEventListener("click", handleConfirm);
  
  // Also accept Enter/Space
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      window.removeEventListener("keydown", handleKeyDown);
      if (onComplete) onComplete();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
}

/**
 * Cleanup camera resources
 */
export function cleanupCamera() {
  if (currentStream) {
    stopCamera(currentStream);
    currentStream = null;
  }
  currentVideo = null;
}
