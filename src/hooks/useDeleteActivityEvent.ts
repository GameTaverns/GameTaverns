import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function useDeleteActivityEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { error } = await (supabase as any)
        .from("activity_events")
        .delete()
        .in("id", eventIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-activity"] });
      queryClient.invalidateQueries({ queryKey: ["following-feed"] });
      toast.success("Activity removed");
    },
    onError: () => {
      toast.error("Failed to remove activity");
    },
  });
}
