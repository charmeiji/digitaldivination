export const STATES = Object.freeze({
  BOOT: "BOOT",
  ATTRACT: "ATTRACT",
  CONFIRM_1: "CONFIRM_1",
  CONFIRM_2: "CONFIRM_2",

  CAMERA_PORTRAIT: "CAMERA_PORTRAIT", // ← ADD

  IDLE: "IDLE",
  INTRO: "INTRO",
  ROUND_1: "ROUND_1",
  ROUND_2: "ROUND_2",
  ROUND_3: "ROUND_3",
  ROUND_4: "ROUND_4",
  ROUND_5: "ROUND_5",
  PROCESSING: "PROCESSING",
  OUTPUT_PHOTO: "OUTPUT_PHOTO",
  OUTPUT_STICKERS: "OUTPUT_STICKERS",
  OUTPUT_TALISMAN: "OUTPUT_TALISMAN",
  END_LOCK: "END_LOCK"
});


// Linear state machine: enforced sequence
const VALID_TRANSITIONS = Object.freeze({
  BOOT: [STATES.ATTRACT],
  ATTRACT: [STATES.ROUND_1],
  CONFIRM_1: [STATES.CONFIRM_2],
  CONFIRM_2: [STATES.CAMERA_PORTRAIT],
  CAMERA_PORTRAIT: [STATES.ROUND_1],
  IDLE: [STATES.INTRO],
  INTRO: [STATES.ROUND_1],
  ROUND_1: [STATES.ROUND_2],
  ROUND_2: [STATES.ROUND_3],
  ROUND_3: [STATES.ROUND_4],
  ROUND_4: [STATES.ROUND_5],
  ROUND_5: [STATES.PROCESSING],
  PROCESSING: [STATES.OUTPUT_PHOTO],
  OUTPUT_PHOTO: [STATES.OUTPUT_STICKERS],
  OUTPUT_STICKERS: [STATES.OUTPUT_TALISMAN],
  OUTPUT_TALISMAN: [STATES.END_LOCK],
  END_LOCK: [] // terminal state
});

let currentState = STATES.BOOT;

export function getState() {
  return currentState;
}

export function transition(next) {
  // Defensive guard: BOOT must only transition to ATTRACT
  if (currentState === STATES.BOOT && next !== STATES.ATTRACT) {
    console.warn(`Illegal transition from BOOT to ${next}. Forcing ATTRACT.`);
    next = STATES.ATTRACT;
  }
  
  const validNext = VALID_TRANSITIONS[currentState];
  
  if (!validNext || !validNext.includes(next)) {
    throw new Error(
      `Illegal state transition: ${currentState} → ${next}. ` +
      `Valid transitions from ${currentState}: ${validNext.join(", ") || "none (terminal state)"}`
    );
  }
  
  console.log(`STATE → ${next}`);
  currentState = next;
}

export function isState(s) {
  return currentState === s;
}
