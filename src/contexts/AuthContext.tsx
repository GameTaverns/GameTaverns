import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import { computeAuthStorageKey } from "@/lib/authStorageKey";
import type { User, Session } from "@supabase/supabase-js";

type SelfHostedMe = {
  id: string;
  email: string;
  emailVerified?: boolean;
  roles?: string[];
  isAdmin?: boolean;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

function mapSelfHostedMeToUser(me: SelfHostedMe): { user: User; isAdmin: boolean } {
  const isAdminFlag = !!me.isAdmin || (me.roles ?? []).includes("admin");
  const user = ({
    id: me.id,
    email: me.email,
    email_confirmed_at: me.emailVerified ? new Date().toISOString() : undefined,
    user_metadata: {
      display_name: me.displayName || undefined,
      username: me.username || undefined,
      avatar_url: me.avatarUrl || undefined,
    },
    // Store admin flag so other hooks can access it directly
    app_metadata: {
      is_admin: isAdminFlag,
    },
  } as unknown) as User;

  return { user, isAdmin: isAdminFlag };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  roleLoading: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<{ error: { message: string } | null }>;
  signUp: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache admin role check results to avoid duplicate queries
const adminRoleCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const { url: apiUrl, anonKey } = getSupabaseConfig();
  
  const authStorageKey = useMemo(() => computeAuthStorageKey(apiUrl), [apiUrl]);

  const getAllAuthTokenKeys = useCallback((): string[] => {
    if (typeof window === "undefined" || !window.localStorage) return [authStorageKey];
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === authStorageKey) continue;
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) keys.push(k);
    }
    return [authStorageKey, ...keys];
  }, [authStorageKey]);

  const clearAuthStorage = useCallback((keys?: string[]) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const targetKeys = keys ?? getAllAuthTokenKeys();
    for (const k of targetKeys) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
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
          } catch {}
        });
    } catch {}
  }, [getAllAuthTokenKeys]);

  useEffect(() => {
    let mounted = true;

    // =============================
    // Self-hosted auth (Express + JWT)
    // =============================
    if (isSelfHostedMode()) {
      const bootstrapSelfHosted = async () => {
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
          if (!token) {
            if (!mounted) return;
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            setRoleLoading(false);
            return;
          }

          // Validate token + fetch user
          const me = await apiClient.get<SelfHostedMe>("/auth/me");

          if (!mounted) return;
          setSession(null);
          const mapped = mapSelfHostedMeToUser(me);
          setUser(mapped.user);
          setIsAdmin(mapped.isAdmin);
          setLoading(false);
          setRoleLoading(false);
        } catch {
          // Token invalid / API unreachable → clear and reset
          try {
            localStorage.removeItem("auth_token");
          } catch {}
          if (!mounted) return;
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          setRoleLoading(false);
        }
      };

      bootstrapSelfHosted();

      return () => {
        mounted = false;
      };
    }

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
      if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
        return Date.now() >= expiresAt * 1000;
      }
      const payload = decodeJwtPayload(accessToken);
      const exp = payload?.exp;
      if (typeof exp === "number" && Number.isFinite(exp)) {
        return Date.now() >= exp * 1000;
      }
      return false;
    };

    const fetchIsAdmin = async (userId: string, accessToken?: string) => {
      // Check cache first
      const cached = adminRoleCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.isAdmin;
      }

      const timeoutMs = 3000;

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

          // If RLS blocks direct access to user_roles, allow fallback to the
          // SECURITY DEFINER has_role() RPC instead of incorrectly marking false.
          if (!res.ok) return null;
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
        if (direct !== null) {
          adminRoleCache.set(userId, { isAdmin: direct, timestamp: Date.now() });
          return direct;
        }

        // Prefer security-definer function call (avoids RLS chicken/egg on user_roles)
        // Function exists in DB: public.has_role(_user_id uuid, _role app_role) returns boolean
        try {
          const rpc = await Promise.race([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any).rpc("has_role", { _user_id: userId, _role: "admin" }),
            new Promise<{ data: null; error: null }>((resolve) =>
              setTimeout(() => resolve({ data: null, error: null }), timeoutMs)
            ),
          ]);

          const { data: rpcData, error: rpcError } = rpc as any;
          if (!rpcError && typeof rpcData === "boolean") {
            adminRoleCache.set(userId, { isAdmin: rpcData, timestamp: Date.now() });
            return rpcData;
          }
        } catch {
          // fall through to table query
        }

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
          console.error("[AuthContext] role lookup error", error);
        }

        const isAdminResult = !!data;
        adminRoleCache.set(userId, { isAdmin: isAdminResult, timestamp: Date.now() });
        return isAdminResult;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("[AuthContext] role lookup exception", e);
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

      setRoleLoading(true);
      fetchIsAdmin(nextSession.user.id, (nextSession as any)?.access_token).then((nextIsAdmin) => {
        if (!mounted) return;
        setIsAdmin(nextIsAdmin);
        setRoleLoading(false);
      });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !nextSession)) {
        clearAuthStorage();
        adminRoleCache.clear();
      }
      applySession(nextSession);
    });

    const readStoredSession = (): Session | null => {
      const tokenKeys = getAllAuthTokenKeys();

      for (const key of tokenKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {
            const expired = isTokenExpired(parsed.access_token, parsed?.expires_at ?? null);
            if (expired) {
              clearAuthStorage(tokenKeys);
              return null;
            }
            return parsed as Session;
          }
          if (parsed?.user) return { user: parsed.user } as any;
        } catch {}
      }

      return null;
    };

    const verifyUserExists = async (storedSession: Session | null) => {
      if (!storedSession?.access_token || !storedSession?.user?.id) return;

      try {
        const res = await fetch(`${apiUrl}/auth/v1/user`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${storedSession.access_token}`,
          },
        });

        if (!res.ok) {
          console.warn("[AuthContext] Stored session user no longer exists, clearing auth");
          clearAuthStorage();
          if (mounted) {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            setRoleLoading(false);
          }
        }
      } catch {}
    };

    if (typeof window !== "undefined") {
      const storedSession = readStoredSession();
      applySession(storedSession);
      verifyUserExists(storedSession);
    } else {
      setLoading(false);
    }

    const watchdog = setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
      setRoleLoading(false);
    }, 2000);

    return () => {
      mounted = false;
      try {
        clearTimeout(watchdog);
      } catch {}
      subscription.unsubscribe();
    };
  }, [apiUrl, anonKey, authStorageKey, clearAuthStorage, getAllAuthTokenKeys]);

  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    if (isSelfHostedMode()) {
      try {
        const res = await apiClient.post<{
          user: { id: string; email: string; role?: string; roles?: string[] };
          token: string;
        }>("/auth/login", {
          email: emailOrUsername,
          password,
        });

        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", res.token);
        }

        // IMPORTANT: /auth/login may not include full role/profile data.
        // Always hydrate from /auth/me so the UI (display name + /admin gating) updates immediately.
        setSession(null);
        setRoleLoading(true);
        try {
          const me = await apiClient.get<SelfHostedMe>("/auth/me");
          const mapped = mapSelfHostedMeToUser(me);
          setUser(mapped.user);
          setIsAdmin(mapped.isAdmin);
        } catch {
          // Fallback to login response if /auth/me fails (still lets user proceed)
          setUser(({ id: res.user.id, email: res.user.email } as unknown) as User);
          const roles = res.user.roles ?? (res.user.role ? [res.user.role] : []);
          setIsAdmin(roles.includes("admin"));
        } finally {
          setLoading(false);
          setRoleLoading(false);
        }

        return { error: null };
      } catch (e: any) {
        return { error: { message: e?.message?.includes("Invalid credentials") ? "Invalid login credentials" : (e?.message || "Sign in failed") } };
      }
    }

    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let email = emailOrUsername;
      
      if (!emailOrUsername.includes("@")) {
        // Self-hosted mode should not reach here (handled above), but just in case
        if (isSelfHostedMode()) {
          return { error: { message: "Username login not yet supported in self-hosted mode. Please use email." } };
        }
        
        try {
          const resolveRes = await fetch(`${apiUrl}/functions/v1/resolve-username`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              apikey: anonKey,
            },
            body: JSON.stringify({ username: emailOrUsername }),
          });
          
          if (resolveRes.ok) {
            const data = await resolveRes.json();
            if (data.email) {
              email = data.email;
            } else {
              return { error: { message: "Invalid username or password" } };
            }
          } else {
            return { error: { message: "Invalid username or password" } };
          }
        } catch {
          return { error: { message: "Unable to verify username. Please try again." } };
        }
      }

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

      if (typeof window !== "undefined" && window.localStorage) {
        const lockPrefix = `lock:${authStorageKey}`;
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) keys.push(k);
        }
        keys.filter((k) => k.startsWith(lockPrefix)).forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
      }

      const setSessionResult = await Promise.race([
        supabase.auth.setSession({ access_token, refresh_token }),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: "Session hydration timed out." } }), 5000)
        ),
      ]);

      const maybeError = (setSessionResult as any)?.error;
      if (!maybeError) return { error: null };

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
        // If setSession() fails (often due to storage contention), we still
        // persist the session and continue the normal post-login flow.
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
  }, [apiUrl, anonKey, authStorageKey]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (isSelfHostedMode()) {
      try {
        await apiClient.post("/auth/register", {
          email,
          password,
          displayName: email.split("@")[0],
        });
        return { error: null };
      } catch (e: any) {
        return { error: { message: e?.message || "Signup failed" } };
      }
    }

    try {
      const res = await fetch(`${apiUrl}/functions/v1/signup`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          email,
          password,
          redirectUrl: window.location.origin,
          displayName: email.split("@")[0],
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { error: { message: (json as any)?.error || "Signup failed" } };
      }

      return { error: null };
    } catch (e: any) {
      return { error: { message: e?.message || "Signup failed" } };
    }
  }, [apiUrl, anonKey]);

  const signOut = useCallback(async () => {
    if (isSelfHostedMode()) {
      try {
        localStorage.removeItem("auth_token");
      } catch {}
      adminRoleCache.clear();
      setIsAdmin(false);
      setSession(null);
      setUser(null);
      return { error: null };
    }

    const { error } = await supabase.auth.signOut();
    adminRoleCache.clear();
    setIsAdmin(false);
    return { error };
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    roleLoading,
    signIn,
    signUp,
    signOut,
  }), [user, session, loading, isAdmin, roleLoading, signIn, signUp, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
