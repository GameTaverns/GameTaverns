import { useEffect, useState } from "react";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const { url: apiUrl, anonKey } = getSupabaseConfig();
  const authStorageKey = (() => {
    try {
      const baseUrl = new URL(apiUrl);
      // Prefer the canonical key format when the backend is a hosted project:
      // `sb-<projectRef>-auth-token` where <projectRef> is the subdomain.
      // This avoids an initial "unauthenticated" render, which can cause
      // /admin <-> /settings redirect loops.
      const hostedMatch = baseUrl.host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
      if (hostedMatch?.[1]) {
        return `sb-${hostedMatch[1]}-auth-token`;
      }

      // In self-hosted we don't have a stable project ref. Use host-based namespace.
      const ns = baseUrl.host.replace(/[^a-z0-9]/gi, "_");
      return `sb-${ns}-auth-token`;
    } catch {
      return "sb-local-auth-token";
    }
  })();

  const getAllAuthTokenKeys = (): string[] => {
    if (typeof window === "undefined" || !window.localStorage) return [authStorageKey];
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === authStorageKey) continue;
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) keys.push(k);
    }
    return [authStorageKey, ...keys];
  };

  const clearAuthStorage = (keys?: string[]) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const targetKeys = keys ?? getAllAuthTokenKeys();
    for (const k of targetKeys) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }

    // Also clear any stuck lock keys (Supabase SDK storage lock).
    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
      allKeys
        .filter((k) => k.startsWith("lock:sb-") && k.endsWith("-auth-token"))
        .forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            // ignore
          }
        });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let mounted = true;

    const decodeJwtPayload = (jwt?: string): any | null => {
      if (!jwt) return null;
      const parts = jwt.split(".");
      if (parts.length < 2) return null;
      try {
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
        const json = atob(padded);
        return JSON.parse(json);
      } catch {
        return null;
      }
    };

    const isTokenExpired = (accessToken?: string, expiresAt?: number | null) => {
      // Prefer explicit expires_at when available (seconds since epoch).
      if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
        return Date.now() >= expiresAt * 1000;
      }

      // Fall back to JWT exp claim.
      const payload = decodeJwtPayload(accessToken);
      const exp = payload?.exp;
      if (typeof exp === "number" && Number.isFinite(exp)) {
        return Date.now() >= exp * 1000;
      }

      // If we can't determine expiry, treat it as not expired.
      return false;
    };

    const fetchIsAdmin = async (userId: string, accessToken?: string) => {
      // Role lookup should never block auth UI rendering.
      const timeoutMs = 3000;

      // Prefer a direct REST call with the access token.
      // This avoids any SDK auth-storage lock edge cases.
      const tryDirect = async () => {
        if (!accessToken) return null;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const url = new URL(`${apiUrl}/rest/v1/user_roles`);
          url.searchParams.set("select", "role");
          url.searchParams.set("user_id", `eq.${userId}`);
          url.searchParams.set("role", "eq.admin");
          url.searchParams.set("limit", "1");

          const res = await fetch(url.toString(), {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          });

          if (!res.ok) return false;
          const json = (await res.json().catch(() => [])) as Array<{ role: string }>;
          return Array.isArray(json) && json.length > 0;
        } catch {
          return null;
        } finally {
          clearTimeout(t);
        }
      };

      try {
        const direct = await tryDirect();
        if (direct !== null) return direct;

        const result = await Promise.race([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle(),
          new Promise<{ data: null; error: null }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: null }), timeoutMs)
          ),
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
        setRoleLoading(false);
        return;
      }

      // Fetch role in background; do not block rendering.
      setRoleLoading(true);
      fetchIsAdmin(nextSession.user.id, (nextSession as any)?.access_token).then((nextIsAdmin) => {
        if (!mounted) return;
        setIsAdmin(nextIsAdmin);
        setRoleLoading(false);
      });
    };

    // Set up auth state listener BEFORE checking session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // If the SDK says SIGNED_OUT, clear our hydrated state immediately
      // This prevents the race where we hydrated a stale session
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !nextSession) {
        clearAuthStorage();
      }
      applySession(nextSession);
    });

    // Check for existing session.
    // IMPORTANT: We avoid awaiting supabase.auth.getSession() here because in some
    // browser states the SDK's storage-lock can hang indefinitely.
    // Instead we read from localStorage synchronously and then let
    // onAuthStateChange keep everything up to date.

    const readStoredSession = (): Session | null => {
      const tokenKeys = getAllAuthTokenKeys();

      for (const key of tokenKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          // When the SDK writes this, it is shaped like a Session.
          if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {
            const expired = isTokenExpired(parsed.access_token, parsed?.expires_at ?? null);
            if (expired) {
              // Stale sessions in storage cause redirect loops (/admin <-> /settings).
              // Clear all possible auth token keys so a leftover key can't re-trigger the loop.
              clearAuthStorage(tokenKeys);
              return null;
            }

            return parsed as Session;
          }

          // Fallback for older/manual shapes; still unlock UI.
          if (parsed?.user) return ({ user: parsed.user } as any);
        } catch {
          // ignore this key and keep searching
        }
      }

      return null;
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
      // If role check is still pending after a long stall, stop blocking UI.
      setRoleLoading(false);
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
      const url = `${apiUrl}/auth/v1/token?grant_type=password`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
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
        const lockPrefix = `lock:${authStorageKey}`;
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
        localStorage.setItem(authStorageKey, JSON.stringify(sessionToPersist));
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
    roleLoading,
  };
}
