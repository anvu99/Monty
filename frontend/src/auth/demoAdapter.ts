import type { AuthAdapter, AuthSession } from './types';

const STORAGE_KEY = 'monty_demo_session';
const listeners = new Set<(session: AuthSession | null) => void>();

const notify = (session: AuthSession | null) => {
  listeners.forEach((listener) => listener(session));
};

const readSession = (): AuthSession | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

const writeSession = (session: AuthSession | null) => {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  notify(session);
};

const createDemoSession = (): AuthSession => ({
  id: crypto.randomUUID(),
  role: 'parent',
  displayName: 'Demo Parent',
  demo: true,
  createdAt: new Date().toISOString()
});

export const demoAuthAdapter: AuthAdapter = {
  async getSession() {
    return readSession();
  },
  async signInWithDemo() {
    const session = createDemoSession();
    writeSession(session);
    return session;
  },
  async signOut() {
    writeSession(null);
  },
  onChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
};
