/**
 * Animated purple/whimsical background for attract screen.
 * Returns a stop() function to clean up animation.
 */

export function startAttractBackground(canvas) {
  const ctx = canvas.getContext("2d");
  let animationId = null;
  let particles = [];
  let blobs = [];
  let time = 0;

  // Initialize particles once (not every frame)
  function initParticles() {
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;
    particles = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        radius: 2 + Math.random() * 3,
        vx: -0.3 - Math.random() * 0.2, // slow upward-left drift
        vy: -0.5 - Math.random() * 0.3,
        opacity: 0.3 + Math.random() * 0.4
      });
    }
  }

  // Initialize blobs (2-3 large blurred circles)
  function initBlobs() {
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;
    blobs = [];
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    for (let i = 0; i < count; i++) {
      blobs.push({
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        radius: 80 + Math.random() * 120,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speedX: 0.0005 + Math.random() * 0.0005,
        speedY: 0.0005 + Math.random() * 0.0005,
        amplitudeX: logicalWidth * 0.3,
        amplitudeY: logicalHeight * 0.3,
        opacity: 0.15 + Math.random() * 0.1
      });
    }
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = logicalWidth + "px";
    canvas.style.height = logicalHeight + "px";
    
    // Reinitialize particles and blobs for new size (in logical coordinates)
    initParticles();
    initBlobs();
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear (use logical dimensions since we scaled the context)
    ctx.clearRect(0, 0, width, height);

    // Draw vertical purple gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#4a148c"); // dark purple top
    gradient.addColorStop(0.5, "#6a1b9a"); // medium purple
    gradient.addColorStop(1, "#8e24aa"); // lighter purple bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw blobs (large blurred circles on sine paths)
    time += 0.01;
    blobs.forEach(blob => {
      const x = blob.x + Math.sin(time * blob.speedX + blob.phaseX) * blob.amplitudeX;
      const y = blob.y + Math.sin(time * blob.speedY + blob.phaseY) * blob.amplitudeY;
      
      // Create radial gradient for soft blob
      const blobGradient = ctx.createRadialGradient(x, y, 0, x, y, blob.radius);
      blobGradient.addColorStop(0, `rgba(200, 150, 255, ${blob.opacity})`);
      blobGradient.addColorStop(0.5, `rgba(150, 100, 255, ${blob.opacity * 0.5})`);
      blobGradient.addColorStop(1, `rgba(100, 50, 255, 0)`);
      
      ctx.fillStyle = blobGradient;
      ctx.beginPath();
      ctx.arc(x, y, blob.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw particles (small soft circles drifting upward-left)
    particles.forEach(particle => {
      // Update position with wrap-around (in logical coordinates)
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      if (particle.x < 0) particle.x += width;
      if (particle.x > width) particle.x -= width;
      if (particle.y < 0) particle.y += height;
      if (particle.y > height) particle.y -= height;

      // Draw particle (in logical coordinates, context is already scaled)
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    animationId = requestAnimationFrame(draw);
  }

  // Initial setup
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Start animation
  draw();

  // Return stop function
  return function stop() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    window.removeEventListener("resize", resizeCanvas);
  };
}
