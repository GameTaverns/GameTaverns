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

// Fetch presence rows via PostgREST directly (works on both cloud and self-hosted Supabase stack)
async function fetchPresenceRows(filter: { userId?: string; userIds?: string[] }) {
  const { url, anonKey } = getPresenceConfig();

  if (!url || !anonKey) return null;

  let endpoint = `${url}/rest/v1/user_presence?select=user_id,status,last_seen`;
  if (filter.userId) {
    endpoint += `&user_id=eq.${filter.userId}`;
  } else if (filter.userIds && filter.userIds.length > 0) {
    endpoint += `&user_id=in.(${filter.userIds.join(',')})`;
  }

  const token = await getAuthToken();
  const res = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Update presence in DB
async function upsertPresence(userId: string, status: PresenceStatus) {
  const { url, anonKey } = getPresenceConfig();

  if (url && anonKey) {
    const token = await getAuthToken();
    await fetch(`${url}/rest/v1/user_presence`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token || anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: userId, status, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    return;
  }

  // Fallback: Supabase client (cloud)
  await (supabase as any)
    .from("user_presence")
    .upsert(
      { user_id: userId, status, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
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

      // Try direct PostgREST fetch (works on self-hosted Supabase stack)
      const rows = await fetchPresenceRows({ userId });
      const data = Array.isArray(rows) ? rows[0] : rows;

      if (!data) {
        // Fallback to supabase client (cloud)
        const { data: d } = await (supabase as any)
          .from("user_presence")
          .select("status, last_seen")
          .eq("user_id", userId)
          .maybeSingle();
        if (!d) return "offline";
        const age = Date.now() - new Date(d.last_seen).getTime();
        if (age > OFFLINE_THRESHOLD) return "offline";
        return d.status as PresenceStatus;
      }

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

      // Try direct PostgREST fetch first (works on self-hosted Supabase stack)
      let rows = await fetchPresenceRows({ userIds });

      // Fallback to supabase client (cloud)
      if (!rows) {
        const { data } = await (supabase as any)
          .from("user_presence")
          .select("user_id, status, last_seen")
          .in("user_id", userIds);
        rows = data;
      }

      const map = new Map<string, PresenceStatus>();
      // Default all requested users to offline first
      for (const id of userIds) map.set(id, "offline");
      // Then overlay with actual data
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
