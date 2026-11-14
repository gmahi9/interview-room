import type { Session } from '../types';

const KEY = 'ipr-sessions';
const MAX_SESSIONS = 40;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Session;
  return typeof session.id === 'string' && Array.isArray(session.answers) && typeof session.role === 'string';
}

export function loadSessions(store: KeyValueStore): Session[] {
  const raw = store.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSession);
  } catch {
    return [];
  }
}

export function saveSessions(store: KeyValueStore, sessions: Session[]): void {
  const next = [...sessions]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, MAX_SESSIONS);
  store.setItem(KEY, JSON.stringify(next));
}

export function addSession(store: KeyValueStore, session: Session): Session[] {
  const next = [session, ...loadSessions(store).filter((item) => item.id !== session.id)];
  saveSessions(store, next);
  return loadSessions(store);
}

export function deleteSession(store: KeyValueStore, id: string): Session[] {
  const next = loadSessions(store).filter((item) => item.id !== id);
  saveSessions(store, next);
  return next;
}

export function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}
