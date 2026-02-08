const KEY = "ddd_session_v1";

export function newSessionId() {
  // deterministic enough for MVP; no crypto dependency
  return "ddd_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * Session model:
 * {
 *   runId: string,
 *   startedAt: ISO string,
 *   choices: ["a"|"b", ... length 5],
 *   bitstring: "01011",
 *   tagTotals: { cute: number, neutral: number, cursed: number },
 *   stickerSetId: "set_cute"|"set_neutral"|"set_cursed",
 *   selectedStickerPaths: string[] (length 16)
 * }
 */

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.schema !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(sessionData) {
  const payload = { schema: 1, ...sessionData };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function sessionExists() {
  return !!localStorage.getItem(KEY);
}

export function isActiveRitualState(state) {
  return state !== "END_LOCK" && state !== "BOOT" && state !== "IDLE" && state !== "ATTRACT";
}
