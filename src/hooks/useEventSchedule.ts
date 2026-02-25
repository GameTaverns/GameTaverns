import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

export interface ScheduleBlock {
  id: string;
  event_id: string;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
  block_type: string;
  display_order: number;
  created_at: string;
}

export function useEventScheduleBlocks(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-schedule-blocks", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await db
        .from("event_schedule_blocks")
        .select("*")
        .eq("event_id", eventId)
        .order("day_date", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduleBlock[];
    },
    enabled: !!eventId,
  });
}

export function useAddScheduleBlock() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Omit<ScheduleBlock, "id" | "created_at">) => {
      const { data, error } = await db
        .from("event_schedule_blocks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["event-schedule-blocks", data.event_id] });
      toast({ title: "Schedule block added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add block", description: e.message, variant: "destructive" }),
  });
}

export function useRemoveScheduleBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId, eventId }: { blockId: string; eventId: string }) => {
      const { error } = await db.from("event_schedule_blocks").delete().eq("id", blockId);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data: any) => qc.invalidateQueries({ queryKey: ["event-schedule-blocks", data.eventId] }),
  });
}

export function usePublicEventDirectory() {
  return useQuery({
    queryKey: ["public-event-directory"],
    queryFn: async () => {
      const { data, error } = await db
        .from("public_event_directory")
        .select("*")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}
