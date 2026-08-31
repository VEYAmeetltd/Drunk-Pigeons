// Leaderboard API client. All calls are best-effort and fail silently so the game
// stays fully playable offline. Never blocks gameplay.
const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
const API = `${BASE}/api/leaderboard`;
export const GAME_VERSION = '1.0.0';

// Anonymous, unguessable-enough player id (never shown publicly).
export function generatePlayerId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'p' + crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    // crypto unavailable in this runtime — fall through to the timestamp-based id below
  }
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export function generateRunId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

async function post(path, body, timeout = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await res.json();
  } catch {
    return { ok: false, offline: true };
  } finally {
    clearTimeout(t);
  }
}

export const LeaderboardAPI = {
  register: (playerId, nickname) => post('/register', { playerId, nickname }),
  submit: (payload) => post('/submit', payload),
  async me(playerId) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`${API}/me?playerId=${encodeURIComponent(playerId)}`, { signal: ctrl.signal });
      return await res.json();
    } catch {
      return { ok: false, offline: true };
    } finally {
      clearTimeout(t);
    }
  },
  async check(nickname, playerId) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const params = [`nickname=${encodeURIComponent(nickname)}`];
      if (playerId) params.push(`playerId=${encodeURIComponent(playerId)}`);
      const res = await fetch(`${API}/check?${params.join('&')}`, { signal: ctrl.signal });
      return await res.json();
    } catch {
      return { ok: false, offline: true };
    } finally {
      clearTimeout(t);
    }
  },
  async top(playerId, mode = 'normal') {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const params = [];
      if (playerId) params.push(`playerId=${encodeURIComponent(playerId)}`);
      if (mode) params.push(`mode=${encodeURIComponent(mode)}`);
      const q = params.length ? `?${params.join('&')}` : '';
      const res = await fetch(`${API}/top${q}`, { signal: ctrl.signal });
      return await res.json();
    } catch {
      return { ok: false, offline: true };
    } finally {
      clearTimeout(t);
    }
  },
};
