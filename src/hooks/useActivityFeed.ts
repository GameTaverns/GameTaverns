import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export interface ActivityEvent {
  id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export function useUserActivity(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["user-activity", userId, limit],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!userId) return [];

      const { data, error } = await (supabase as any)
        .from("activity_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}
