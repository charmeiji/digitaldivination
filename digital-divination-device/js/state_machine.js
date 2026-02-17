export const STATES = Object.freeze({
  BOOT: "BOOT",
  ATTRACT: "ATTRACT",
  CONFIRM_1: "CONFIRM_1",
  ORACLE_INTRO: "ORACLE_INTRO",
  CRYSTAL_PREVIEW: "CRYSTAL_PREVIEW",
  FACE_POSITION: "FACE_POSITION",
  PORTRAIT_CAPTURE: "PORTRAIT_CAPTURE",
  ORACLE_POST_PORTRAIT: "ORACLE_POST_PORTRAIT",
  NAME_ENTRY: "NAME_ENTRY",
  READY_CONFIRM: "READY_CONFIRM",
  CONFIRM_2: "CONFIRM_2",
  CAMERA_PORTRAIT: "CAMERA_PORTRAIT",
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
  ATTRACT: [STATES.CONFIRM_1],
  CONFIRM_1: [STATES.ATTRACT, STATES.CONFIRM_2], // Decline -> ATTRACT; Accept -> CONFIRM_2
  CONFIRM_2: [STATES.ORACLE_INTRO],              // YES -> white flash -> ORACLE_INTRO
  ORACLE_INTRO: [STATES.CRYSTAL_PREVIEW],
  CRYSTAL_PREVIEW: [STATES.FACE_POSITION],
  FACE_POSITION: [STATES.PORTRAIT_CAPTURE],
  PORTRAIT_CAPTURE: [STATES.ORACLE_POST_PORTRAIT],
  ORACLE_POST_PORTRAIT: [STATES.NAME_ENTRY],
  NAME_ENTRY: [STATES.READY_CONFIRM],
  READY_CONFIRM: [STATES.ROUND_1],
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
