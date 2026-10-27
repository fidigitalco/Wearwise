import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, loadToken, setToken, setUnauthorizedHandler } from './api';
import type { User } from './types';

type AuthState = {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    (async () => {
      try {
        if (await loadToken()) setUser(await auth.me());
      } catch (e: any) {
        // A stale token is cleared by the 401 handler; offline keeps the token
        // so the next launch can try again.
        if (e?.response?.status === 401) await clear();
      } finally {
        setReady(true);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => {
        const r = await auth.login(email.trim(), password);
        await setToken(r.token);
        setUser(r.user);
      },
      signUp: async (email, password, name) => {
        const r = await auth.register(email.trim(), password, name?.trim());
        await setToken(r.token);
        setUser(r.user);
      },
      signOut: async () => {
        try {
          await auth.logout();
        } catch {}
        await clear();
      },
      updateUser: async (patch) => setUser(await auth.update(patch)),
      deleteAccount: async () => {
        await auth.deleteAccount();
        await clear();
      },
    }),
    [user, ready, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
