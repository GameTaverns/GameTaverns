import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export type PresenceStatus = "online" | "idle" | "offline";

const HEARTBEAT_INTERVAL = 30_000; // 30s
const IDLE_THRESHOLD = 120_000; // 2 min of no activity = idle
const OFFLINE_THRESHOLD = 300_000; // 5 min = offline

let lastActivity = Date.now();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Update presence in DB
async function upsertPresence(userId: string, status: PresenceStatus) {
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
      // Use sendBeacon for reliability
      const url = `${(supabase as any).supabaseUrl}/rest/v1/user_presence`;
      navigator.sendBeacon?.(
        url,
        JSON.stringify({ user_id: user.id, status: "offline", last_seen: new Date().toISOString() })
      );
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
      const { data } = await (supabase as any)
        .from("user_presence")
        .select("status, last_seen")
        .eq("user_id", userId)
        .maybeSingle();

      if (!data) return "offline";
      // Consider offline if last_seen > OFFLINE_THRESHOLD
      const age = Date.now() - new Date(data.last_seen).getTime();
      if (age > OFFLINE_THRESHOLD) return "offline";
      return data.status as PresenceStatus;
    },
    enabled: !!userId,
    refetchInterval: 60_000, // refresh every minute
  });
}

// Get presence for multiple users (for feeds)
export function useMultiPresence(userIds: string[]) {
  return useQuery({
    queryKey: ["multi-presence", userIds.sort().join(",")],
    queryFn: async (): Promise<Map<string, PresenceStatus>> => {
      if (userIds.length === 0) return new Map();
      const { data } = await (supabase as any)
        .from("user_presence")
        .select("user_id, status, last_seen")
        .in("user_id", userIds);

      const map = new Map<string, PresenceStatus>();
      for (const row of data || []) {
        const age = Date.now() - new Date(row.last_seen).getTime();
        map.set(row.user_id, age > OFFLINE_THRESHOLD ? "offline" : row.status);
      }
      return map;
    },
    enabled: userIds.length > 0,
    refetchInterval: 60_000,
  });
}
