/**
 * Camera portrait capture view - cinematic sequence
 */

import { startCamera, stopCamera, captureStill } from "../camera/camera_capture.js";

let currentStream = null;
let captured = false;
let captureLocked = true;

// Initialize global storage
if (!window.DDD) {
  window.DDD = {};
}

/**
 * Render camera portrait scene
 * @param {HTMLElement} rootEl - Root element to render into
 * @param {Object} options - Options object
 * @param {Function} options.onDone - Callback when capture is complete
 */
export async function renderCameraPortrait(rootEl, { onDone }) {
  // Reset state
  captured = false;
  captureLocked = true;
  currentStream = null;
  
  // Clear root
  rootEl.innerHTML = "";
  rootEl.className = "scene";
  
  // Create scene container
  const scene = document.createElement("div");
  scene.className = "scene-container";
  scene.style.cssText = "position: fixed; inset: 0; background: #1a0a2e; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 1.5s ease-in;";
  
  // Character image (placeholder)
  const character = document.createElement("div");
  character.className = "character";
  character.style.cssText = "position: absolute; width: 200px; height: 300px; background: #4a148c; border-radius: 8px; left: 10%; bottom: 10%; z-index: 2; display: flex; align-items: center; justify-content: center;";
  
  // Try to load character image, fallback to colored box
  const charImg = document.createElement("img");
  charImg.src = "assets/characters/placeholder.png";
  charImg.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 8px;";
  charImg.onerror = () => {
    // Fallback: show colored box with text
    character.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Character</div>';
    charImg.style.display = "none";
  };
  character.appendChild(charImg);
  
  // Crystal ball container
  const ballContainer = document.createElement("div");
  ballContainer.className = "ball-container";
  ballContainer.style.cssText = "position: relative; width: 300px; height: 300px; z-index: 1;";
  
  // Crystal ball
  const ball = document.createElement("div");
  ball.className = "ball";
  ball.style.cssText = "width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), rgba(100,50,200,0.6)); border: 3px solid rgba(255,255,255,0.2); box-shadow: 0 0 40px rgba(150,100,255,0.5), inset 0 0 60px rgba(0,0,0,0.3); position: relative; overflow: hidden;";
  
  // Video element for camera feed (hidden initially)
  const video = document.createElement("video");
  video.className = "ball-video";
  video.autoplay = true;
  video.playsInline = true;
  video.style.cssText = "width: 100%; height: 100%; object-fit: cover; clip-path: circle(50%); border-radius: 50%; display: none;";
  
  // Captured still image (hidden initially)
  const stillImg = document.createElement("img");
  stillImg.className = "ball-still";
  stillImg.style.cssText = "width: 100%; height: 100%; object-fit: cover; clip-path: circle(50%); border-radius: 50%; display: none;";
  
  // Face frame overlay
  const faceFrame = document.createElement("div");
  faceFrame.className = "face-frame";
  faceFrame.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 180px; height: 180px; border: 3px solid rgba(255,255,255,0.8); border-radius: 50%; pointer-events: none; z-index: 10; display: none;";
  
  ball.appendChild(video);
  ball.appendChild(stillImg);
  ball.appendChild(faceFrame);
  ballContainer.appendChild(ball);
  
  // Dialogue line
  const dialogue = document.createElement("div");
  dialogue.className = "dialogue";
  dialogue.style.cssText = "position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%); color: #ffffff; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 18px; text-align: center; opacity: 0; transition: opacity 0.8s ease-in; z-index: 3; background: rgba(0,0,0,0.6); padding: 12px 24px; border-radius: 8px;";
  dialogue.textContent = "hello welcome…";
  
  // Flash overlay (hidden initially)
  const flash = document.createElement("div");
  flash.className = "flash";
  flash.style.cssText = "position: fixed; inset: 0; background: #ffffff; opacity: 0; pointer-events: none; z-index: 9999; transition: opacity 0.12s ease-out;";
  
  scene.appendChild(character);
  scene.appendChild(ballContainer);
  scene.appendChild(dialogue);
  rootEl.appendChild(scene);
  rootEl.appendChild(flash);
  
  // Step 1: Fade in scene
  setTimeout(() => {
    scene.style.opacity = "1";
  }, 100);
  
  // Step 2: Show first dialogue
  setTimeout(() => {
    dialogue.style.opacity = "1";
  }, 1800);
  
  // Step 3: Change to second dialogue
  setTimeout(() => {
    dialogue.style.opacity = "0";
    setTimeout(() => {
      dialogue.textContent = "look into my crystal ball…";
      dialogue.style.opacity = "1";
    }, 600);
  }, 4200);
  
  // Step 4: Zoom into crystal ball after full intro sequence
  setTimeout(() => {
    scene.classList.add("zoomed");
    
    // Step 5: Start camera and show feed inside ball
    setTimeout(async () => {
      try {
        currentStream = await startCamera(video);
        video.style.display = "block";
        
        // Step 6: Show face frame overlay
        setTimeout(() => {
          faceFrame.style.display = "block";
          
          // Enable capture after lockout delay (1.5s)
          setTimeout(() => {
            captureLocked = false;
            
            // Auto-capture after a short delay
            setTimeout(() => {
              performCapture();
            }, 500);
          }, 1500);
        }, 500);
      } catch (error) {
        console.error("Camera failed:", error);
        // Continue even if camera fails - use placeholder
        captureLocked = false;
        setTimeout(() => {
          performCapture();
        }, 500);
      }
    }, 800);
  }, 6800);
  
  // Capture function
  const performCapture = async () => {
    if (captured || captureLocked) return;
    
    captured = true;
    captureLocked = true;
    
    // Flash effect
    flash.style.opacity = "1";
    setTimeout(() => {
      flash.style.opacity = "0";
    }, 120);
    
    // Capture still
    try {
      let dataUrl;
      if (currentStream && video.videoWidth > 0) {
        const result = captureStill(video);
        dataUrl = result.dataUrl;
      } else {
        // Fallback: create a placeholder image
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#4a148c";
        ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = "#ffffff";
        ctx.font = "24px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Portrait", 150, 150);
        dataUrl = canvas.toDataURL("image/png");
      }
      
      // Store portrait
      window.DDD.portrait = {
        dataUrl,
        capturedAt: Date.now()
      };
      
      // Freeze frame - replace video with still
      video.style.display = "none";
      stillImg.src = dataUrl;
      stillImg.style.display = "block";
      
      // Stop camera
      if (currentStream) {
        stopCamera(currentStream);
        currentStream = null;
      }
      
      // Hold for 600-900ms, then call onDone
      setTimeout(() => {
        onDone();
      }, 750);
    } catch (error) {
      console.error("Capture failed:", error);
      // Continue anyway
      if (currentStream) {
        stopCamera(currentStream);
        currentStream = null;
      }
      setTimeout(() => {
        onDone();
      }, 750);
    }
  };
  
  // Cleanup function (exported for external cleanup)
  const cleanupFn = () => {
    if (currentStream) {
      stopCamera(currentStream);
      currentStream = null;
    }
  };
  
  // Store cleanup on rootEl for potential early exit
  rootEl._cameraCleanup = cleanupFn;
  
  return cleanupFn;
}

/**
 * Cleanup camera portrait view
 */
export function cleanupCameraPortrait() {
  // This will be called by the cleanup function returned from renderCameraPortrait
  // Additional cleanup can be added here if needed
}
