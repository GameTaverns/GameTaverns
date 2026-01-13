import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchIsAdmin = async (userId: string) => {
      // Role lookup should never block auth UI rendering.
      const timeoutMs = 3000;

      try {
        const result = await Promise.race([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle(),
          new Promise<{ data: null; error: null }>((resolve) => setTimeout(() => resolve({ data: null, error: null }), timeoutMs)),
        ]);

        const { data, error } = result as any;
        if (error && import.meta.env.DEV) {
          console.error("[useAuth] role lookup error", error);
        }

        return !!data;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("[useAuth] role lookup exception", e);
        }
        return false;
      }
    };

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (!nextSession?.user) {
        setIsAdmin(false);
        return;
      }

      // Fetch role in background; do not block rendering.
      fetchIsAdmin(nextSession.user.id).then((nextIsAdmin) => {
        if (!mounted) return;
        setIsAdmin(nextIsAdmin);
      });
    };

    // Set up auth state listener BEFORE checking session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    // Check for existing session.
    // IMPORTANT: We avoid awaiting supabase.auth.getSession() here because in some
    // browser states the SDK's storage-lock can hang indefinitely.
    // Instead we read from localStorage synchronously and then let
    // onAuthStateChange keep everything up to date.

    const readStoredSession = (): Session | null => {
      try {
        const baseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
        const storageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        // When the SDK writes this, it is shaped like a Session.
        if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {
          return parsed as Session;
        }

        // Fallback for older/manual shapes; still unlock UI.
        if (parsed?.user) return ({ user: parsed.user } as any);
        return null;
      } catch {
        return null;
      }
    };

    // Hydrate immediately from storage so pages don't sit on a spinner.
    if (typeof window !== "undefined") {
      applySession(readStoredSession());
    } else {
      setLoading(false);
    }

    // Watchdog: never allow auth "loading" to hang indefinitely.
    const watchdog = setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
    }, 2000);


    return () => {
      mounted = false;
      try {
        clearTimeout(watchdog);
      } catch {
        // ignore
      }
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Root cause of the "hang": the auth SDK uses a storage lock. In some browser
    // states that lock can get stuck, making signInWithPassword/setSession await forever.
    // We:
    // 1) call the token endpoint directly (fast, reliable)
    // 2) clear any stale auth storage lock keys
    // 3) try supabase.auth.setSession with a short timeout
    // 4) if it still hangs, write the session to storage and hard-navigate.

    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const baseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
      const storageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;

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

      // Clear potentially stuck lock keys for this storage namespace.
      if (typeof window !== "undefined" && window.localStorage) {
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

      // Try normal SDK hydration first, but don't allow it to hang forever.
      const setSessionResult = await Promise.race([
        supabase.auth.setSession({ access_token, refresh_token }),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: "Session hydration timed out." } }), 5000)
        ),
      ]);

      const maybeError = (setSessionResult as any)?.error;
      if (!maybeError) return { error: null };

      // Fallback: manually persist the session and hard navigate.
      if (typeof window !== "undefined" && window.localStorage) {
        const sessionToPersist = {
          access_token,
          refresh_token,
          token_type: (json as any)?.token_type,
          expires_in: (json as any)?.expires_in,
          expires_at: (json as any)?.expires_at,
          user: (json as any)?.user,
        };
        localStorage.setItem(storageKey, JSON.stringify(sessionToPersist));
        window.location.assign("/settings");
        return { error: null };
      }

      return { error: { message: "Could not persist session in this environment." } };
    } catch (e: any) {
      if (e?.name === "AbortError") {
        return { error: { message: "Sign in timed out. Please try again." } };
      }
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
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setIsAdmin(false);
    return { error };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    isAdmin,
  };
}
