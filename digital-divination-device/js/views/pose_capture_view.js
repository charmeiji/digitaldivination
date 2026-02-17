import { startCamera, stopCamera, captureStill } from "../camera/camera_capture.js";

let currentStream = null;

export async function renderPoseCapture(rootEl, { pose, onDone }) {
  currentStream = null;
  rootEl.innerHTML = "";
  rootEl.style.cssText = "position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center;";
  
  const prompt = document.createElement("div");
  prompt.style.cssText = "color: #fff; font-family: ui-monospace, monospace; font-size: 24px; margin-bottom: 20px; opacity: 0; transition: opacity 0.5s;";
  prompt.textContent = pose;
  
  const videoContainer = document.createElement("div");
  videoContainer.style.cssText = "position: relative; width: 480px; height: 480px; border-radius: 50%; overflow: hidden; opacity: 0; transition: opacity 0.5s;";
  
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
  
  const flash = document.createElement("div");
  flash.style.cssText = "position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 9999; transition: opacity 0.1s;";
  
  videoContainer.appendChild(video);
  rootEl.appendChild(prompt);
  rootEl.appendChild(videoContainer);
  rootEl.appendChild(flash);
  
  setTimeout(() => {
    prompt.style.opacity = "1";
  }, 100);
  
  setTimeout(async () => {
    try {
      currentStream = await startCamera(video);
      videoContainer.style.opacity = "1";
      
      setTimeout(() => {
        flash.style.opacity = "1";
        setTimeout(() => {
          flash.style.opacity = "0";
        }, 100);
        
        let dataUrl;
        if (currentStream && video.videoWidth > 0) {
          const result = captureStill(video);
          dataUrl = result.dataUrl;
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = 300;
          canvas.height = 300;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#4a148c";
          ctx.fillRect(0, 0, 300, 300);
          ctx.fillStyle = "#fff";
          ctx.font = "20px monospace";
          ctx.textAlign = "center";
          ctx.fillText(pose, 150, 150);
          dataUrl = canvas.toDataURL("image/png");
        }
        
        if (currentStream) {
          stopCamera(currentStream);
          currentStream = null;
        }
        
        setTimeout(() => {
          onDone(dataUrl);
        }, 500);
      }, 2000);
    } catch (error) {
      console.error("Pose capture failed:", error);
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#4a148c";
      ctx.fillRect(0, 0, 300, 300);
      ctx.fillStyle = "#fff";
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.fillText(pose, 150, 150);
      const dataUrl = canvas.toDataURL("image/png");
      
      setTimeout(() => {
        onDone(dataUrl);
      }, 500);
    }
  }, 1200);
  
  return () => {
    if (currentStream) {
      stopCamera(currentStream);
      currentStream = null;
    }
  };
}
