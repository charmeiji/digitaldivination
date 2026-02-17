export const PACE = Object.freeze({
  // Global fades
  FADE_OUT_MS: 750,
  BLACK_HOLD_MS: 220,
  FADE_IN_MS: 750,
  
  // ATTRACT
  ATTRACT_INPUT_LOCK_MS: 400,
  ATTRACT_INPUT_DELAY_MS: 220, // 150–300ms wait before transitioning to CONFIRM_1
  ATTRACT_AMBIENCE_INTERVAL_MIN_MS: 10000,
  ATTRACT_AMBIENCE_INTERVAL_MAX_MS: 20000,
  
  // CONFIRM_1 (staged: text first, then options)
  CONFIRM1_TEXT_FADE_MS: 500,
  PROMPT_1_OPTIONS_REVEAL_MS: 800,   // show YES/NO after this from state enter
  PROMPT_1_INPUT_ENABLE_MS: 1200,    // input enabled after options rendered + this
  CONFIRM1_BUTTONS_FADE_MS: 450,
  CONFIRM1_INPUT_LOCK_MS: 1200,      // derived: options reveal + buffer
  
  // CONFIRM_2 (staged: text first, then YES only)
  PROMPT_2_YES_REVEAL_MS: 700,
  PROMPT_2_INPUT_ENABLE_MS: 1100,
  CONFIRM_2_FADE_TO_BLACK_MS: 500,
  
  // ORACLE scene
  ORACLE_SCENE_FADE_IN_MS: 900,
  ORACLE_INTRO_FADE_IN_MS: 750,
  ORACLE_FIRST_LINE_DELAY_MS: 1800,   // longer pause before first oracle line appears
  ORACLE_LINE_IN_MS: 700,
  /** Per-line hold (ms). One value per line; line index used. */
  ORACLE_LINE_HOLD_MS: Object.freeze([2400, 2300]),
  /** Default hold for long oracle sequences (e.g. READY_CONFIRM). */
  ORACLE_LINE_HOLD_DEFAULT_MS: 1600,
  ORACLE_GHOST_OPACITY: 0.28,
  ORACLE_LINE_OUT_MS: 550,
  ORACLE_INTERLINE_DELAY_MS: 1400,    // linger in silence between line 1 and line 2
  /** Min ms after line reveal before user can skip to next (oracle intro). */
  ORACLE_MIN_HOLD_BEFORE_SKIP_MS: 400,
  CRYSTAL_ZOOM_DELAY_MS: 1400,
  CRYSTAL_ZOOM_MS: 900,               // camera/crystal zoom transition duration (ease-in)
  
  // Camera reveal
  CAMERA_REVEAL_DELAY_MS: 850,
  CAMERA_REVEAL_FADE_MS: 1000,
  
  // Face positioning + capture
  FACE_PROMPT_IN_MS: 400,
  FACE_DWELL_MS: 900,
  AUTO_CAPTURE_AFTER_MS: 1500,
  FLASH_TOTAL_MS: 140,
  FREEZE_HOLD_MS: 650,
  
  // Name entry
  NAME_ENTRY_LOCK_MS: 300,
  
  // Ready confirm
  READY_LOCK_MS: 450,
  
  // Existing pacing
  INTRO_HOLD_MS: 1400,        // first "machine wakes up"
  ROUND_ENTER_MS: 550,        // hesitation before choices are clickable
  ROUND_AFTER_CHOICE_MS: 450,  // micro-pause after selection
  PROCESSING_MS: 2500,        // "calculating…"
  PHOTO_HOLD_MS: 4000,        // let judgment land
  STICKERS_HOLD_MS: 4500,     // let debris land
  TALISMAN_HOLD_MS: 4000      // verdict lingers
});
