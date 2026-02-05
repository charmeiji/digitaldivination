/**
 * Asset validation for development diagnostics.
 * Checks that all required choice images and outcome assets exist.
 */

async function checkAssetExists(src) {
  try {
    const response = await fetch(src, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function validateAssets() {
  const missing = [];

  // Validate choice images (r1_a.png through r5_b.png)
  for (let round = 1; round <= 5; round++) {
    for (const variant of ["a", "b"]) {
      const src = `./assets/choices/r${round}_${variant}.png`;
      const exists = await checkAssetExists(src);
      if (!exists) {
        missing.push(src);
      }
    }
  }

  // Load outcomes.json and validate photo/talisman assets
  try {
    const response = await fetch("./data/outcomes.json");
    if (!response.ok) {
      missing.push("./data/outcomes.json");
    } else {
      const outcomes = await response.json();

      // Check each outcome's photo and talisman
      for (const [code, entry] of Object.entries(outcomes)) {
        if (entry.photo) {
          const exists = await checkAssetExists(entry.photo);
          if (!exists) {
            missing.push(entry.photo);
          }
        }
        if (entry.talisman) {
          const exists = await checkAssetExists(entry.talisman);
          if (!exists) {
            missing.push(entry.talisman);
          }
        }
      }
    }
  } catch (error) {
    missing.push("./data/outcomes.json (failed to load)");
  }

  // If missing assets found, show diagnostic screen
  if (missing.length > 0) {
    const app = document.querySelector("#app");
    if (app) {
      app.innerHTML = `
        <main style="padding:16px; font-family:monospace;">
          <div style="margin-bottom:12px; font-weight:bold;">ASSET VALIDATION FAILED</div>
          ${missing.map(path => `<div>${path}</div>`).join("")}
        </main>
      `;
    }

    console.error("ASSET VALIDATION FAILED");
    missing.forEach(path => console.error(`  Missing: ${path}`));

    return false;
  }

  return true;
}
