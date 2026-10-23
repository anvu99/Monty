import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthAdapter, AuthSession } from './types';
import { demoAuthAdapter } from './demoAdapter';

export type AuthContextValue = {
  session: AuthSession | null;
  status: 'loading' | 'ready';
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, adapter = demoAuthAdapter }: { children: ReactNode; adapter?: AuthAdapter }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const existing = await adapter.getSession();
      if (!active) return;
      if (existing) {
        setSession(existing);
        setStatus('ready');
        return;
      }
      const demoSession = await adapter.signInWithDemo();
      if (!active) return;
      setSession(demoSession);
      setStatus('ready');
    };

    load();
    const unsubscribe = adapter.onChange((next) => {
      setSession(next);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [adapter]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      signOut: () => adapter.signOut()
    }),
    [adapter, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
