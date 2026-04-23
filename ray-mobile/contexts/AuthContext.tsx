import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  fetchMe,
  postTokenLogin,
  postTokenRevoke,
  setApiToken,
  type Me,
} from '@/lib/api';

const TOKEN_KEY = 'ray_api_token';

type AuthContextValue = {
  user: Me | null;
  booting: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) setApiToken(stored);
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await postTokenLogin(username, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setApiToken(res.token);
    setUser({
      id: res.id,
      username: res.username,
      email: res.email,
      groups: res.groups ?? [],
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await postTokenRevoke();
    } catch {
      /* still clear local session */
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setApiToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, logout }),
    [user, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
