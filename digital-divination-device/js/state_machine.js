export const STATES = Object.freeze({
    BOOT: "BOOT",
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
  
  let currentState = STATES.BOOT;
  
  export function getState() {
    return currentState;
  }
  
  export function transition(next) {
    console.log(`STATE → ${next}`);
    currentState = next;
  }
  
  export function isState(s) {
    return currentState === s;
  }
  