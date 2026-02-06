/**
 * Close guard: warns user if they try to close/refresh during an active ritual.
 * Only allows closing without warning in BOOT or END_LOCK states.
 */

export function installCloseGuard(getStateFn) {
  window.addEventListener("beforeunload", (e) => {
    const state = getStateFn();
    
    // Allow closing without warning only in terminal states
    if (state === "BOOT" || state === "END_LOCK") {
      return; // no warning
    }
    
    // Warn for all other states (active ritual in progress)
    e.preventDefault();
    e.returnValue = ""; // Chrome requires returnValue to be set
    return ""; // Some browsers require return value
  });
}
