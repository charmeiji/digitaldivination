const KEY = "ddd_session_v1";

export function newSessionId() {
  // deterministic enough for MVP; no crypto dependency
  return "ddd_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

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

export function saveSession(data) {
  const payload = { schema: 1, ...data };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function sessionExists() {
  return !!localStorage.getItem(KEY);
}

export function isActiveRitualState(state) {
  return state !== "END_LOCK" && state !== "BOOT";
}
