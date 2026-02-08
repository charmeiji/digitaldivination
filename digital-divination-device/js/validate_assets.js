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

  // Load and validate manifest.json
  try {
    const manifestResp = await fetch("./data/manifest.json");
    if (!manifestResp.ok) {
      missing.push("./data/manifest.json (failed to load)");
    } else {
      const manifest = await manifestResp.json();
      
      if (!manifest.rounds || manifest.rounds.length !== 5) {
        missing.push("./data/manifest.json (invalid: must have 5 rounds)");
      } else {
        // Validate each round's choices (a/b format)
        for (const round of manifest.rounds) {
          if (!round.a || !round.b) {
            missing.push(`./data/manifest.json (round ${round.id}: must have a and b choices)`);
          } else {
            for (const choiceKey of ["a", "b"]) {
              const choice = round[choiceKey];
              if (!choice.id || !choice.img || !choice.tags) {
                missing.push(`./data/manifest.json (round ${round.id}.${choiceKey}: missing id, img, or tags)`);
              } else {
                // Validate tags: must have at least one of cute/neutral/cursed with weight >= 1
                const tagSum = (choice.tags.cute || 0) + (choice.tags.neutral || 0) + (choice.tags.cursed || 0);
                if (tagSum < 1) {
                  missing.push(`./data/manifest.json (${choice.id}: tags must sum to >= 1)`);
                }
                const exists = await checkAssetExists(choice.img);
                if (!exists) {
                  missing.push(choice.img);
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    missing.push("./data/manifest.json (failed to load)");
  }

  // Validate all 32 photo strips (5-bit strings)
  for (let i = 0; i < 32; i++) {
    const bitstring = i.toString(2).padStart(5, "0");
    const photoPath = `assets/photos/strip_${bitstring}.png`;
    const exists = await checkAssetExists(photoPath);
    if (!exists) {
      missing.push(photoPath);
    }
  }

  // Validate all 32 talisman files (exact naming required)
  for (let i = 0; i < 32; i++) {
    const bitstring = i.toString(2).padStart(5, "0");
    const talismanPath = `assets/talismans/talisman_${bitstring}.png`;
    const exists = await checkAssetExists(talismanPath);
    if (!exists) {
      missing.push(talismanPath);
    }
  }

  // Load and validate sticker_sets.json structure (but allow missing sticker images - they will fall back to placeholder)
  try {
    const stickerResp = await fetch("./data/sticker_sets.json");
    if (!stickerResp.ok) {
      missing.push("./data/sticker_sets.json (failed to load)");
    } else {
      const stickerSets = await stickerResp.json();
      const requiredSets = ["set_cute", "set_cursed", "set_neutral"];
      
      for (const setName of requiredSets) {
        if (!stickerSets[setName] || !Array.isArray(stickerSets[setName]) || stickerSets[setName].length < 16) {
          missing.push(`./data/sticker_sets.json (${setName}: must have at least 16 sticker paths)`);
        }
        // Note: Individual sticker image files are NOT validated here.
        // Missing sticker images will automatically fall back to placeholder.png at render time.
      }
      
      // Validate that the placeholder exists (required for fallback)
      const placeholderExists = await checkAssetExists("assets/stickers/placeholder.png");
      if (!placeholderExists) {
        missing.push("assets/stickers/placeholder.png (required for sticker fallback)");
      }
    }
  } catch (error) {
    missing.push("./data/sticker_sets.json (failed to load)");
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
