/**
 * Camera capture utilities for portrait sequence
 */

/**
 * Start camera and assign to video element
 * @param {HTMLVideoElement} videoEl - Video element to display camera feed
 * @returns {Promise<MediaStream>} The media stream
 */
export async function startCamera(videoEl) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    
    videoEl.srcObject = stream;
    await videoEl.play();
    
    return stream;
  } catch (error) {
    console.error("Failed to start camera:", error);
    throw error;
  }
}

/**
 * Stop camera stream
 * @param {MediaStream} stream - The media stream to stop
 */
export function stopCamera(stream) {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
}

/**
 * Capture a still frame from video element
 * @param {HTMLVideoElement} videoEl - Video element to capture from
 * @returns {{ dataUrl: string, width: number, height: number }} Captured image data
 */
export function captureStill(videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth || videoEl.clientWidth;
  canvas.height = videoEl.videoHeight || videoEl.clientHeight;
  
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  
  const dataUrl = canvas.toDataURL("image/png");
  
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height
  };
}
