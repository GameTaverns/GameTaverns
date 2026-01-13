import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signUp: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthStorageKey() {
  // Matches supabase-js default: sb-${projectRef}-auth-token
  const baseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
  return `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
}

function clearStaleAuthLocks(storageKey: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const lockPrefix = `lock:${storageKey}`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  keys
    .filter((k) => k.startsWith(lockPrefix))
    .forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    Promise.resolve(promise as any) as Promise<T>,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Keep one subscription for the whole app
  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    const init = async () => {
      const storageKey = getAuthStorageKey();

      try {
        // 1) Normal path
        const result = await withTimeout(supabase.auth.getSession(), 3000, "getSession");
        if (result.data.session) {
          applySession(result.data.session);
          return;
        }

        // 2) Recovery path: if auth-js is stuck on a lock, clear it and try to hydrate from stored tokens.
        clearStaleAuthLocks(storageKey);

        const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const access_token = parsed?.access_token;
          const refresh_token = parsed?.refresh_token;

          if (access_token && refresh_token) {
            await withTimeout(supabase.auth.setSession({ access_token, refresh_token }), 3000, "setSession");
            const after = await withTimeout(supabase.auth.getSession(), 3000, "getSession (after setSession)");
            applySession(after.data.session);
            return;
          }
        }

        applySession(null);
      } catch (e) {
        if (import.meta.env.DEV) console.error("[AuthProvider] init error", e);
        applySession(null);
      }
    };

    init();

    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  // Role lookup (never from local storage)
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const result = await withTimeout(
          supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }) as any,
          3000,
          "has_role"
        );

        const data = (result as any)?.data;
        if (!mounted) return;
        setIsAdmin(Boolean(data));
      } catch (e) {
        if (!mounted) return;
        // Fail closed: treat as non-admin if role lookup fails/times out
        setIsAdmin(false);
        if (import.meta.env.DEV) console.error("[AuthProvider] role lookup error", e);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as any)?.error_description || (json as any)?.error || "Invalid login credentials";
        return { error: { message: msg } };
      }

      const access_token = (json as any)?.access_token as string | undefined;
      const refresh_token = (json as any)?.refresh_token as string | undefined;

      if (!access_token || !refresh_token) {
        return { error: { message: "Sign in succeeded but session tokens were missing." } };
      }

      const storageKey = getAuthStorageKey();
      clearStaleAuthLocks(storageKey);

      try {
        await withTimeout(supabase.auth.setSession({ access_token, refresh_token }), 5000, "setSession");
      } catch {
        // One retry after clearing locks again
        clearStaleAuthLocks(storageKey);
        await withTimeout(supabase.auth.setSession({ access_token, refresh_token }), 5000, "setSession (retry)");
      }

      return { error: null };
    } catch (e: any) {
      if (e?.name === "AbortError") return { error: { message: "Sign in timed out. Please try again." } };
      return { error: { message: e?.message || "Sign in failed. Please try again." } };
    } finally {
      clearTimeout(timeout);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    return { error: error ? { message: error.message } : null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setIsAdmin(false);
    return { error: error ? { message: error.message } : null };
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: !!user,
      isAdmin,
      signIn,
      signUp,
      signOut,
    }),
    [user, session, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
