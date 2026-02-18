import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseConfig } from "@/config/runtime";
import { computeAuthStorageKey } from "@/lib/authStorageKey";

// Get the best available auth token for PostgREST requests (self-hosted Supabase stack)
async function getAuthToken(): Promise<string> {
  // Try supabase client session first (works on cloud and self-hosted Supabase)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch {}
  // Fallback: read directly from localStorage using the correct storage key
  try {
    const { url } = getSupabaseConfig();
    if (url) {
      const storageKey = computeAuthStorageKey(url);
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
      }
    }
  } catch {}
  return localStorage.getItem('auth_token') || '';
}

// Get Supabase URL and anon key, supporting both cloud and self-hosted runtime config
function getPresenceConfig() {
  // __RUNTIME_CONFIG__ uses UPPERCASE keys (SUPABASE_URL, SUPABASE_ANON_KEY)
  const config = (window as any).__RUNTIME_CONFIG__;
  const url = config?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = config?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  return { url, anonKey };
}

export type PresenceStatus = "online" | "idle" | "offline";

const HEARTBEAT_INTERVAL = 30_000; // 30s
const IDLE_THRESHOLD = 120_000; // 2 min of no activity = idle
const OFFLINE_THRESHOLD = 300_000; // 5 min = offline

let lastActivity = Date.now();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Fetch presence rows via PostgREST directly (self-hosted fallback)
async function fetchPresenceRowsDirect(filter: { userId?: string; userIds?: string[] }) {
  const { url, anonKey } = getPresenceConfig();

  if (!url || !anonKey) return null;

  let endpoint = `${url}/rest/v1/user_presence?select=user_id,status,last_seen`;
  if (filter.userId) {
    endpoint += `&user_id=eq.${filter.userId}`;
  } else if (filter.userIds && filter.userIds.length > 0) {
    endpoint += `&user_id=in.(${filter.userIds.join(',')})`;
  }

  const token = await getAuthToken();
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token || anonKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.warn('[Presence] PostgREST fetch failed:', res.status);
      return null;
    }
    return res.json();
  } catch (e) {
    console.warn('[Presence] PostgREST fetch threw:', e);
    return null;
  }
}

// Update presence in DB
async function upsertPresence(userId: string, status: PresenceStatus) {
  const now = new Date().toISOString();
  const payload = { user_id: userId, status, last_seen: now, updated_at: now };

  // Always try Supabase client first — it has the right credentials in all modes
  try {
    const { error } = await (supabase as any)
      .from("user_presence")
      .upsert(payload, { onConflict: "user_id" });
    if (!error) return;
    console.warn('[Presence] Supabase client upsert failed, trying PostgREST direct:', error.message);
  } catch (e) {
    console.warn('[Presence] Supabase client upsert threw, trying PostgREST direct:', e);
  }

  // Fallback: direct PostgREST fetch (self-hosted where client stub may not work)
  const { url, anonKey } = getPresenceConfig();
  if (!url || !anonKey) return;

  const token = await getAuthToken();
  try {
    const res = await fetch(
      `${url}/rest/v1/user_presence?on_conflict=user_id`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token || anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error('[Presence] PostgREST upsert failed:', res.status, text);
    }
  } catch (e) {
    console.error('[Presence] PostgREST upsert threw:', e);
  }
}

// Track own presence with heartbeat + activity listeners
export function useOwnPresence() {
  const { user } = useAuth();

  const sendHeartbeat = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    const idle = now - lastActivity > IDLE_THRESHOLD;
    await upsertPresence(user.id, idle ? "idle" : "online");
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const onActivity = () => { lastActivity = Date.now(); };
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });

    // Set online immediately
    upsertPresence(user.id, "online");

    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Set offline on unload
    const onUnload = () => {
      const { url } = getPresenceConfig();
      if (url) {
        navigator.sendBeacon?.(
          `${url}/rest/v1/user_presence`,
          JSON.stringify({ user_id: user.id, status: "offline", last_seen: new Date().toISOString() })
        );
      }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("beforeunload", onUnload);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      // Mark offline on cleanup
      upsertPresence(user.id, "offline");
    };
  }, [user, sendHeartbeat]);
}

// Get presence for a specific user
export function useUserPresence(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-presence", userId],
    queryFn: async (): Promise<PresenceStatus> => {
      if (!userId) return "offline";

      // Try Supabase client first (works in all modes)
      try {
        const { data: d } = await (supabase as any)
          .from("user_presence")
          .select("status, last_seen")
          .eq("user_id", userId)
          .maybeSingle();
        if (d) {
          const age = Date.now() - new Date(d.last_seen).getTime();
          if (age > OFFLINE_THRESHOLD) return "offline";
          return d.status as PresenceStatus;
        }
      } catch {}

      // Fallback: direct PostgREST fetch (self-hosted where client may be stubbed)
      const rows = await fetchPresenceRowsDirect({ userId });
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (!data) return "offline";
      const age = Date.now() - new Date(data.last_seen).getTime();
      if (age > OFFLINE_THRESHOLD) return "offline";
      return data.status as PresenceStatus;
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

// Get presence for multiple users (for feeds/admin table)
export function useMultiPresence(userIds: string[]) {
  return useQuery({
    queryKey: ["multi-presence", [...userIds].sort().join(",")],
    queryFn: async (): Promise<Map<string, PresenceStatus>> => {
      if (userIds.length === 0) return new Map();

      let rows: any[] | null = null;

      // Try Supabase client first (works in all modes)
      try {
        const { data, error } = await (supabase as any)
          .from("user_presence")
          .select("user_id, status, last_seen")
          .in("user_id", userIds);
        if (!error && data) rows = data;
      } catch {}

      // Fallback: direct PostgREST fetch
      if (!rows) {
        rows = await fetchPresenceRowsDirect({ userIds });
      }

      const map = new Map<string, PresenceStatus>();
      for (const id of userIds) map.set(id, "offline");
      for (const row of rows || []) {
        const age = Date.now() - new Date(row.last_seen).getTime();
        map.set(row.user_id, age > OFFLINE_THRESHOLD ? "offline" : (row.status as PresenceStatus));
      }
      return map;
    },
    enabled: userIds.length > 0,
    refetchInterval: 60_000,
  });
}
